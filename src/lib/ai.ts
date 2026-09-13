import "server-only";
import { askCodex } from "./codex/server";

const BASE_INSTRUCTIONS =
  "Answer the user's message using only the text provided. " +
  "You have no tools. " +
  "Do not attempt tool calls or access external resources.";

export async function generateResponse(prompt: string, signal: AbortSignal): Promise<string> {
  return askCodex({
    instructions: BASE_INSTRUCTIONS,
    prompt,
    signal,
  });
}
