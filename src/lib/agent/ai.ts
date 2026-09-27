import "server-only";
import { rm } from "node:fs/promises";
import { askCodex } from "../codex/server";
import { createResponseExtractor } from "../response-extractor";
import { writeBoardScreenshot } from "../whiteboard/screenshot";
import { listObjects } from "../whiteboard/services";
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
If you want to rotate a basic shape, prefer updating the rotation value rather than making a polygon and calculating its rotated points.

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
- rotation is degrees counterclockwise around the object center. 0 is unrotated. Include "rotation": 0 when creating an object unless the user asked for an angle.
- Down the board means smaller y. Along a slope, downhill is toward the endpoint with the smaller y, and x moves toward that same endpoint. The arrow tip is (x2, y2). Kinetic friction points the opposite way along that slope.
- After every tool round, the next turn includes a picture of the current board. You do not call a screenshot tool. Use the picture to check positions and directions. If the picture is wrong, fix the objects with tools. Do not return status failure just because the picture looks wrong. A new picture is attached after that fix.

If you decide that the status is either "success" or "failure", you may use markdown formatting, including bold, lists, etc.

- Put your entire answer in res.
- Do not wrap the JSON in Markdown fences or add text outside it.
`;

export async function generateResponse(prompt: string, signal: AbortSignal, sendDelta?: (delta: string) => void): Promise<string> {
  const messages: { role: String, specific?: String, call_id?: String, content: unknown }[] = [];

  let images: string[] = [];
  let streamed = false;

  // push prompt to messages first
  messages.push({
    role: "user",
    content: prompt
  })

  console.log(prompt)
  console.log()

  // run
  for (let round = 0; round < 8; round++) {
    const extractor = createResponseExtractor();

    const attached = images;
    images = [];
    let answer = "";
    try {
      answer = await askCodex({
        instructions: BASE_INSTRUCTIONS,
        prompt: JSON.stringify(messages, null, 2),
        images: attached,
        signal: signal,
        onDelta: (chunk) => {
          const { status, delta } = extractor.push(chunk);

          if ((status === "success" || status === "failure") && delta) {
            streamed = true;
            sendDelta?.(delta);
          }
        },
      });
    } finally {
      await Promise.all(attached.map((path) => rm(path, { force: true })));
    }

    let toolCallJson: any;
    const fenced = answer.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
    try {
      toolCallJson = JSON.parse(fenced ? fenced[1] : answer);
    } catch {
      console.log("unparsed agent reply");
      console.log(answer);
      messages.push({
        role: "error1",
        content: "That reply was not valid JSON. Return one JSON object and nothing else."
      });
      continue;
    }
    const status = toolCallJson?.status;

    if (status === "tool_call") {

      // validate res array
      if (!toolCallJson.res || !Array.isArray(toolCallJson.res)) {
        messages.push({
          role: "error2",
          content: "A tool_call res must be an array of tool objects."
        });
        continue;
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

      const shot = writeBoardScreenshot(listObjects({}));
      images.push(shot.imagePath);
      messages.push({
        role: "board_screenshot",
        content: `A picture of the current board is attached to this turn. The picture is ${shot.width} by ${shot.height} pixels. Y increases upward.`,
      });
      continue;
    }

    // break when done
    if (status === "success" || status === "failure") {
      if (!streamed) {
        const text = typeof toolCallJson.res === "string" && toolCallJson.res.trim()
          ? toolCallJson.res
          : "The assistant could not finish that request.";
        streamed = true;
        sendDelta?.(text);
      }
      console.log(status);
      console.log();
      console.log("messages");
      console.log(JSON.stringify(messages, null, 1))
      console.log();

      break;
    }

    messages.push({
      role: "error",
      content: "status must be success, failure, or tool_call."
    });
  }

  if (!streamed) sendDelta?.("Stopped before a final answer.");
  await Promise.all(images.map((path) => rm(path, { force: true })));
  return "";
}
