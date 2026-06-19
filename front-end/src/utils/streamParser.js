/**
 * SSE Stream Parser
 *
 * Parses Server-Sent Events (SSE) from a ReadableStream and dispatches
 * typed event objects to a callback.
 *
 * Conformant with the SSE specification:
 * - Events are separated by blank lines (\n\n)
 * - Supports both "data: value" and "data:value" (with and without space)
 * - Supports multi-line data fields (joined with \n)
 * - Ignores comment lines beginning with ":"
 * - Terminates on "[DONE]" payload or event type "done"
 *
 * @module utils/streamParser
 */

const DONE_PAYLOAD = '[DONE]';

/**
 * Parse a single SSE event block (text between blank lines) into a typed
 * event object and invoke onEvent.
 *
 * @param {string} block - Raw SSE event block (may contain multiple lines)
 * @param {(event: object) => void} onEvent
 * @returns {boolean} true if the stream should terminate (done event received)
 */
function processEventBlock(block, onEvent) {
  const lines = block.split('\n');
  const dataLines = [];

  for (const line of lines) {
    // Ignore comment lines
    if (line.startsWith(':')) continue;

    if (line.startsWith('data:')) {
      // Support both "data: value" and "data:value"
      const payload = line.slice(5).replace(/^ /, '');
      dataLines.push(payload);
    }
    // Other SSE fields (event, id, retry) are not currently used but are
    // silently ignored to avoid crashing on valid SSE frames.
  }

  if (dataLines.length === 0) return false;

  const payload = dataLines.join('\n');

  if (payload === DONE_PAYLOAD) {
    onEvent({ type: 'done' });
    return true;
  }

  try {
    const event = JSON.parse(payload);
    onEvent(event);
    return event.type === 'done';
  } catch {
    // Malformed JSON — skip silently rather than crashing the stream.
    return false;
  }
}

/**
 * Read SSE events from a ReadableStream and invoke *onEvent* for each.
 *
 * @param {ReadableStreamDefaultReader} reader
 * @param {TextDecoder} decoder
 * @param {(event: object) => void} onEvent
 * @returns {Promise<void>} Resolves when the stream ends or a `done` event arrives.
 */
export async function parseSSEStream(reader, decoder, onEvent) {
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush any remaining buffered content
        const remaining = buffer.trim();
        if (remaining) {
          processEventBlock(remaining, onEvent);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE events are delimited by blank lines (\n\n or \r\n\r\n)
      const blocks = buffer.split(/\n\n|\r\n\r\n/);
      // The last element is an incomplete block — keep it in the buffer
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue; // Empty block (e.g. keep-alive blank line)
        if (processEventBlock(trimmed, onEvent)) return;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
