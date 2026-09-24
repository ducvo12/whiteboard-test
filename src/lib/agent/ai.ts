import "server-only";
import { askCodex } from "../codex/server";
import { createResponseExtractor } from "../response-extractor";
import { toolDescriptions } from "./tools";

const BASE_INSTRUCTIONS = `
You are an educational assistant.
You will recieve an array of JSON objects containing chat history, with the first element being the first chat message.
You may only call tools that are provided in the instructions, not anywhere else.
Do not attempt to access external resources beyond the prompt and instructions.
Return only a valid JSON object with exactly this structure:
{
  "status": "success" | "tool_call" | "wait" | "failure",
  "res": "your answer"
}

Here are the tools that are provided:
${JSON.stringify(
  toolDescriptions.map(({ tool_name, tool_description, arguments: args }) => ({
    tool_name,
    tool_description,
    arguments: args,
  })),
  null,
  2
)}

If you believe that you can confidently give a final correct answer, set status as "success".
If you are believe that you need to call tools to fulfill the request, call the tools listed.
If you believe that you cannot find the final answer even with the tools provded, please set status as "failure".
If you decide to call tools, please do not put any other text inside the res value, return an array with JSON objects.

Sample tool call:
{
  "status": "tool_call",
  "res": [
    {
      "tool_name": "add_shape",
      "arguments": {
        "shape": "rectangle",
        "strokeColor": "#344b2d",
        "fillColor": "#799571ff",
        "strokeWidth": 1,
        "w": 24,
        "h": 24,
        "x": 570,
        "y": 350
      }
    }
  ]
}

Once a mutation succeeds, do not mutate the same property again for the same user instruction unless the user explicitly requested iteration or the tool reported failure.

The whiteboard uses a Cartesian coordinate system, not screen/SVG coordinates:
- Origin (0, 0) is the bottom-left corner.
- X increases to the right.
- Y increases upward. A larger y is visually above; a smaller y is visually below.
- Do not invert y. "Above" means increase y. "Below" means decrease y.

Shape anchors in this same system:
- rect: (x, y) is the bottom-left corner. The rectangle occupies x..x+w and y..y+h.
- circle: (x, y) is the center.
- polygon: each entry in points is an absolute world vertex.
- textbox: (x, y) is the bottom-left corner. The box occupies x..x+w and y..y+h. Text is drawn inside.

If you decide that the status is either "success" or "failure", you may use markdown formatting, including bold, lists, etc.

- Put your entire answer in res.
- Do not wrap the JSON in Markdown fences or add text outside it.
`;

export async function generateResponse(prompt: string, signal: AbortSignal, sendDelta?: (delta: string) => void): Promise<string> {
  const messages: { role: String, specific?: String, call_id?: String, content: unknown }[] = [];

  let response = "";

  // push prompt to messages first
  messages.push({
    role: "user",
    content: prompt
  })

  console.log(prompt)
  console.log()

  // run
  while (true) {
    const extractor = createResponseExtractor();
    let inIterAgentResponse = "";

    await askCodex({
      instructions: BASE_INSTRUCTIONS,
      prompt: JSON.stringify(messages, null, 2),
      signal: signal,
      onDelta: (chunk) => {
        inIterAgentResponse += chunk;

        const { status, delta } = extractor.push(chunk);

        if ((status === "success" || status === "failure") && delta) {
          response += chunk;
          sendDelta?.(delta);
        }
      },
    });
    const status = extractor.finish();

    if (status === "tool_call") {

      let toolCallJson: any;

      // validate json
      try {
        toolCallJson = JSON.parse(inIterAgentResponse);
      } catch (err) {
        messages.push({
          role: "error1",
          content: "error1"
        });
        break;
      }

      // validate res array
      if (!toolCallJson.res || !Array.isArray(toolCallJson.res)) {
        messages.push({
          role: "error2",
          content: "error2"
        });
        break;
      }

      // add tool call id
      for (const tool of toolCallJson.res) {
        tool.call_id = `call_${crypto.randomUUID()}`;
      }
      messages.push({
        role: "assistant",
        content: toolCallJson.res
      })

      // loop through tools
      for (const tool of toolCallJson.res) {

        // validate array object format
        if (!tool.tool_name || !("arguments" in tool)) {
          messages.push({
            role: "error3",
            content: "error3"
          });
          console.log()
          console.log(JSON.stringify(tool, null, 2))
          console.log()
          break;
        }

        // validate accurate tool
        const specificTool = toolDescriptions.find(t => t.tool_name === tool.tool_name)
        if (!specificTool) {
          messages.push({
            role: "error4",
            content: "error4"
          });
          break;
        }

        // validate arguments
        const argumentParse = specificTool.inputSchema.safeParse(tool.arguments);
        if (!argumentParse.success) {
          messages.push({
            role: "error5",
            content: "error5"
          });
          break;
        }

        // call tool
        console.log(tool.tool_name);
        console.log(argumentParse.data);
        console.log();

        const ret = specificTool.execute(argumentParse.data);
        messages.push({
          role: "tool_call_result",
          specific: tool.tool_name,
          call_id: tool.call_id,
          content: ret
        });

      }
    }

    // break when done
    if (status === "success" || status === "failure") {
      console.log();
      console.log("messages");
      console.log(JSON.stringify(messages, null, 1))
      console.log();

      break;
    }
  }

  // return
  return response;
}
