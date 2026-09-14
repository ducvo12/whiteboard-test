import { FormEvent, useState } from "react";
import AIResponse from "./ai-response";

export default function Sidebar() {
    const [prompt, setPrompt] = useState("");
    const [response, setResponse] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (loading || !prompt.trim()) return;
        setLoading(true);
        setError("");
        setResponse("");
        try {
            const result = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt }),
            });

            if (!result.ok) {
                const data = await result.json();
                throw new Error(data.error || "Something went wrong. Try again.");
            }
            if (!result.body) throw new Error("No response stream. Try again.");

            const reader = result.body.pipeThrough(new TextDecoderStream()).getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    setResponse((text) => text + value);
                }
            } catch {
                throw new Error("The response was interrupted. Check codex login status and try again.");
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : "Could not connect. Try again.");
        } finally {
            setLoading(false);
        }
    }

    async function addVal() {
        await fetch("/api/objects", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id: "4",
                shape: "rect",
                strokeColor: "#344b2d",
                fillColor: "#799571ff",
                strokeWidth: 1,
                w: 24,
                h: 24,
                x: 570,
                y: 350,
            }),
        });
    }

    async function deleteVal() {
        await fetch("/api/objects/", {
            method: "DELETE",
            body: JSON.stringify({ id: "4" }),
        });
    }

    return (
        <aside className="sidebar" aria-label="AI chat" >

            <header className="sidebar-header">
                <div className="eyebrow">WHITEBOARD</div>
                <h1>Ask AI</h1>
                <p>A little space to try an idea.</p>
            </header>

            <form onSubmit={submit}>
                <label htmlFor="prompt">Your prompt</label>
                <textarea id="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)}
                    placeholder="What are you thinking about?" maxLength={20_000} rows={6} required />
                <div className="form-footer">
                    <span>Each prompt starts fresh</span>
                    <button type="submit" disabled={loading || !prompt.trim()}>
                        {loading ? "Thinking…" : "Send ↗"}
                    </button>
                </div>
            </form>

            <div className="flex items-center gap-2">
                <button onClick={addVal}>
                    add
                </button>
                <button onClick={deleteVal}>
                    delete
                </button>
            </div>

            <section className="response-section" aria-label="AI response" aria-busy={loading}>
                <h2>Response</h2>
                <div className="response" aria-live="polite">
                    {response ? (
                        <AIResponse content={response} />
                    ) : loading ? (
                        <p className="muted">Thinking about your prompt…</p>
                    ) : (
                        <p className="muted">Your answer will appear here.</p>
                    )}
                </div>
                {error && <p className="error" role="alert">{error}</p>}
            </section>

        </aside >
    )

}