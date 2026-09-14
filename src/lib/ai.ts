import "server-only";
import { askCodex } from "./codex/server";
import { createResponseExtractor } from "./response-extractor";

const BASE_INSTRUCTIONS = `
Answer the user's message using only the text provided.
You have no tools.
Do not attempt tool calls or access external resources.
Return only a valid JSON object with exactly this structure:
{
  "status": "success" | "failure",
  "res": "your answer"
}
- Put your entire answer in res.
- Do not wrap the JSON in Markdown fences or add text outside it.
- In res, you may use proper markdown formatting, including lists, bold text, etc.
`;

export async function generateResponse(prompt: string, signal: AbortSignal, sendDelta?: (delta: string) => void): Promise<string> {
  const extractor = createResponseExtractor();
  let response = "";

  await askCodex({
    instructions: BASE_INSTRUCTIONS,
    prompt: prompt,
    signal: signal,
    onDelta: (delta) => {
      const text = extractor.push(delta);

      // save everything in response
      response += text;

      // call sendDelta function (passed from /api/chat/route.ts)
      if (text) sendDelta?.(text);
    },
  });
  extractor.finish();

  return response;
}
