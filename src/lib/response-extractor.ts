type ResponseStatus = "success" | "tool_call" | "wait" | "failure";

type ExtractedChunk = {
  status: ResponseStatus | undefined;
  delta: string;
};

// Extract the string after "res": from the small JSON object requested in ai.ts.
export function createResponseExtractor() {
  let buffer = "";
  let status: ResponseStatus | undefined;
  let resStarted = false;
  let resFinished = false;
  let pendingSurrogate = "";

  return {
    push(chunk: string): ExtractedChunk {
      if (resFinished) {
        return { status, delta: "" };
      }

      buffer += chunk;

      // Wait until the status has been streamed.
      if (!status) {
        const statusMatch =
          /"status"\s*:\s*"(success|tool_call|wait|failure)"/.exec(buffer);

        if (!statusMatch) {
          return { status: undefined, delta: "" };
        }

        status = statusMatch[1] as ResponseStatus;
      }

      // Tool calls and failures should not be streamed to the UI.
      // Their complete JSON will be handled after askCodex finishes.
      if (status !== "success") {
        return { status, delta: "" };
      }

      // Find the beginning of the res string.
      // everything after this part can be abstracted to this:
      // - if streaming hasnt started, look for "res" value
      // - if streaming has started, just parse text and return it
      if (!resStarted) {
        const resMatch = /"res"\s*:\s*"/.exec(buffer);

        if (!resMatch) {
          return { status, delta: "" };
        }

        buffer = buffer.slice(resMatch.index + resMatch[0].length);
        resStarted = true;
      }

      let delta = pendingSurrogate;
      pendingSurrogate = "";

      while (buffer.length > 0) {
        // An unescaped quote ends the res string.
        if (buffer[0] === '"') {
          resFinished = true;
          buffer = "";
          break;
        }

        // Decode JSON escape sequences.
        if (buffer[0] === "\\") {
          if (buffer.length < 2) break;

          const escapeLength = buffer[1] === "u" ? 6 : 2;

          // The escape sequence may be split across streamed chunks.
          if (buffer.length < escapeLength) break;

          delta += JSON.parse(
            `"${buffer.slice(0, escapeLength)}"`
          );

          buffer = buffer.slice(escapeLength);
          continue;
        }

        delta += buffer[0];
        buffer = buffer.slice(1);
      }

      // Avoid sending half of an emoji to TextEncoder.
      if (
        !resFinished &&
        /[\uD800-\uDBFF]$/.test(delta)
      ) {
        pendingSurrogate = delta.slice(-1);
        delta = delta.slice(0, -1);
      }

      return { status, delta };
    },

    finish(): ResponseStatus {
      if (!status) {
        throw new Error("AI response did not include a valid status.");
      }

      if (status === "success" && !resFinished) {
        throw new Error("AI returned an incomplete res string.");
      }

      return status;
    },

    getStatus(): ResponseStatus | undefined {
      return status;
    },
  };
}
