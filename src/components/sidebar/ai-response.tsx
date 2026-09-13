import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// Standardize LaTeX delimiters produced by AI models (convert \( \) and \[ \] to $ and $$).
// Require the backslash — optional `\\?` would match ordinary ( ) / [ ] and wrap
// them in $...$, which breaks KaTeX inside already-open math (e.g. bmatrix).
function preprocessLaTeX(content: string) {
    if (!content) return "";
    return content
        // Block math: \[ ... \] (also \\[ ... \\] from double-escaped strings)
        .replace(/\\{1,2}\[\s*([\s\S]*?)\s*\\{1,2}\]/g, (_, math) => {
            const clean = math.replace(/\$/g, "").trim();
            return `\n$$\n${clean}\n$$\n`;
        })
        // Inline math: \( ... \) (also \\( ... \\))
        .replace(/\\{1,2}\(\s*([\s\S]*?)\s*\\{1,2}\)/g, (_, math) => {
            const clean = math.replace(/\$/g, "").trim();
            return `$${clean}$`;
        });
}

export default function AIResponse({
    content,
}: {
    content: string;
}) {
    return (
        <div className="prose">
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
            >
                {preprocessLaTeX(content)}
            </ReactMarkdown>
        </div>
    );
}

