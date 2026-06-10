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

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (let i = 0; i < lines.length; i += 1) {
        const payload = extractDataPayload(lines[i]);
        if (!payload) continue;

        if (payload === DONE_PAYLOAD) {
          onEvent({ type: 'done' });
          return;
        }

        try {
          const event = JSON.parse(payload);
          onEvent(event);
          if (event.type === 'done') return;
        } catch {
          // Skip malformed lines
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
