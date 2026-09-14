import "server-only";
import { askCodex } from "./codex/server";
import { createResponseExtractor } from "./response-extractor";

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
If you believe that you can confidently give a final correct answer, set status as "success".
- Put your entire answer in res.
- Do not wrap the JSON in Markdown fences or add text outside it.
- In res, you may use proper markdown formatting, including lists, bold text, etc.
`;

export async function generateResponse(prompt: string, signal: AbortSignal, sendDelta?: (delta: string) => void): Promise<string> {
  const messages: { role: String, content: String }[] = [];

  let response = "";

  // push prompt to messages first
  messages.push({
    role: "user",
    content: prompt
  })

  // run
  while (true) {
    const extractor = createResponseExtractor();
    let inIterAgentResponse = "";

    await askCodex({
      instructions: BASE_INSTRUCTIONS,
      prompt: JSON.stringify(messages),
      signal: signal,
      onDelta: (chunk) => {
        inIterAgentResponse += chunk;

        const { status, delta } = extractor.push(chunk);

        if (status === "success" && delta) {
          response += chunk;
          sendDelta?.(delta);
        }
      },
    });
    const status = extractor.finish();

    // save response in messages
    messages.push({
      role: "assistant",
      content: inIterAgentResponse
    })

    if (status === "wait") {

    }

    //console.log(JSON.stringify(messages));
    console.log(status)
    console.log();
    console.log(JSON.stringify(messages))
    console.log();

    // break when done
    if (status === "success") {
      break;
    }
  }

  // return
  return response;
}
