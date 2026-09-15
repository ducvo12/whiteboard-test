import { generateResponse } from "@/lib/agent/ai";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // check if its a dev server (switch to apis later)
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Local chat is available only with npm run dev." }, { status: 403 });
  }
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    (origin && origin !== url.origin)) {
    return Response.json({ error: "Use chat from this app on localhost." }, { status: 403 });
  }

  // validate body
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a valid JSON prompt." }, { status: 400 });
  }

  // validate prompt inside body
  const prompt = body?.prompt;
  if (typeof prompt !== "string") {
    return Response.json({ error: "JSON body must have 'prompt' attribute of type string" }, { status: 400 })
  }
  const promptTrim = prompt.trim()
  if (!promptTrim.trim() || promptTrim.length > 20_000) {
    return Response.json({ error: "Enter a prompt between 1 and 20,000 characters." }, { status: 400 });
  }

  // call ai
  const encoder = new TextEncoder();
  const cancellation = new AbortController();
  const signal = AbortSignal.any([request.signal, cancellation.signal]);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await generateResponse(promptTrim, signal, (delta) => {
          if (!signal.aborted) controller.enqueue(encoder.encode(delta));
        });
        if (!signal.aborted) controller.close();
      } catch {
        controller.error(new Error("Codex could not finish. Try again."));
      }
    },
    cancel() {
      cancellation.abort();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
