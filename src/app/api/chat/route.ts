import { generateResponse } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // This subscription-backed prototype is deliberately local-development only.
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Local chat is available only with npm run dev." }, { status: 403 });
  }
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      (origin && origin !== url.origin)) {
    return Response.json({ error: "Use chat from this app on localhost." }, { status: 403 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Send a valid JSON prompt." }, { status: 400 }); }
  const prompt = body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 20_000) {
    return Response.json({ error: "Enter a prompt between 1 and 20,000 characters." }, { status: 400 });
  }

  try {
    return Response.json({ response: await generateResponse(prompt.trim(), request.signal) });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return Response.json({ error: code === "ENOENT"
      ? "Codex was not found. Install the Codex CLI or set CODEX_BIN in .env.local."
      : "Codex could not finish. Check codex login status, sign in with codex login if needed, and try again. Requests time out after 2 minutes." }, { status: 502 });
  }
}
