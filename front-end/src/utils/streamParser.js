/**
 * SSE Stream Parser
 *
 * Parses Server-Sent Events (SSE) from a ReadableStream and dispatches
 * typed event objects to a callback.
 *
 * @module utils/streamParser
 */

const DATA_PREFIX = 'data: ';
const DONE_PAYLOAD = '[DONE]';

/**
 * @param {string} line
 * @returns {string|null}
 */
function extractDataPayload(line) {
  const prefixAt = line.indexOf(DATA_PREFIX);
  if (prefixAt === -1) return null;

  const payload = line.slice(prefixAt + DATA_PREFIX.length).trim();
  return payload.length ? payload : null;
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

  const processLine = (line) => {
    const payload = extractDataPayload(line);
    if (!payload) return false;

    if (payload === DONE_PAYLOAD) {
      onEvent({ type: 'done' });
      return true;
    }

    try {
      const event = JSON.parse(payload);
      onEvent(event);
      return event.type === 'done';
    } catch {
      return false;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          processLine(buffer);
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (let i = 0; i < lines.length; i += 1) {
        if (processLine(lines[i])) return;
      }
    }
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
