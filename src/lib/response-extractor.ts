// Extract the string after "res": from the small JSON object requested in ai.ts.
export function createResponseExtractor() {
  let buffer = "";
  let started = false;
  let finished = false;
  let pendingSurrogate = "";

  return {
    push(chunk: string): string {
      if (finished) return "";
      buffer += chunk;
      if (!started) {
        const match = /"res"\s*:\s*"/.exec(buffer);
        if (!match) return "";
        buffer = buffer.slice(match.index + match[0].length);
        started = true;
      }

      let text = pendingSurrogate;
      pendingSurrogate = "";
      while (buffer.length) {
        if (buffer[0] === '"') {
          finished = true;
          buffer = "";
          break;
        }
        if (buffer[0] === "\\") {
          const length = buffer[1] === "u" ? 6 : 2;
          if (buffer.length < length) break;
          // JSON.parse decodes escapes such as \n, \" and \uXXXX.
          text += JSON.parse('"' + buffer.slice(0, length) + '"');
          buffer = buffer.slice(length);
        } else {
          text += buffer[0];
          buffer = buffer.slice(1);
        }
      }
      // Keep a split emoji together before TextEncoder converts it to bytes.
      if (!finished && /[\uD800-\uDBFF]$/.test(text)) {
        pendingSurrogate = text.slice(-1);
        text = text.slice(0, -1);
      }
      return text;
    },
    finish() {
      if (!finished) throw new Error("AI returned an incomplete res string.");
    },
  };
}
