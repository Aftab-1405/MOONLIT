/**
 * Tests for utils/streamParser.js
 *
 * Covers:
 * - Basic "data: value" format
 * - No-space "data:value" format
 * - Multi-line data (joined with \n)
 * - Keep-alive / comment lines (ignored)
 * - [DONE] termination
 * - Malformed JSON (silently skipped)
 */

import { describe, it, expect, vi } from 'vitest';
import { parseSSEStream } from './streamParser';

/**
 * Build a ReadableStreamDefaultReader from an array of string chunks.
 * Each chunk is returned as a Uint8Array encoded from the given text.
 */
function makeReader(chunks) {
  let index = 0;
  const encoder = new TextEncoder();
  return {
    read() {
      if (index >= chunks.length) {
        return Promise.resolve({ done: true, value: undefined });
      }
      const chunk = chunks[index++];
      return Promise.resolve({ done: false, value: encoder.encode(chunk) });
    },
    cancel() { return Promise.resolve(); },
    releaseLock() {},
  };
}

function makeDecoder() {
  return new TextDecoder();
}

async function collectEvents(chunks) {
  const events = [];
  const reader = makeReader(chunks);
  const decoder = makeDecoder();
  await parseSSEStream(reader, decoder, (event) => events.push(event));
  return events;
}

// ─── Basic "data: value" ──────────────────────────────────────────────────────

describe('parseSSEStream', () => {
  it('parses basic "data: value" format', async () => {
    const payload = JSON.stringify({ type: 'token', content: 'hello' });
    const events = await collectEvents([`data: ${payload}\n\n`]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'token', content: 'hello' });
  });

  it('parses "data:value" format (no space after colon)', async () => {
    const payload = JSON.stringify({ type: 'token', content: 'hello' });
    const events = await collectEvents([`data:${payload}\n\n`]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'token', content: 'hello' });
  });

  it('joins multi-line data with \\n', async () => {
    // This SSE block has two data lines; the JSON must be split accordingly.
    // Real backend won't typically do this, but it's valid SSE.
    // We test with a simple string payload split across two lines.
    const line1 = '{"type":"token","con';
    const line2 = 'tent":"hi"}';
    const events = await collectEvents([`data: ${line1}\ndata: ${line2}\n\n`]);
    // Parser joins with \n, so the payload is line1 + '\n' + line2 which is
    // not valid JSON. Test that parser does NOT crash.
    expect(events).toHaveLength(0); // Malformed JSON is silently skipped
  });

  it('ignores keep-alive comment lines', async () => {
    const payload = JSON.stringify({ type: 'token', content: 'world' });
    const events = await collectEvents([
      ': keep-alive\n\n',
      `data: ${payload}\n\n`,
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'token', content: 'world' });
  });

  it('handles [DONE] payload and emits done event', async () => {
    const events = await collectEvents(['data: [DONE]\n\n']);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'done' });
  });

  it('stops processing after [DONE]', async () => {
    const after = JSON.stringify({ type: 'token', content: 'should not appear' });
    const events = await collectEvents([
      'data: [DONE]\n\n',
      `data: ${after}\n\n`,
    ]);
    // Only the done event — subsequent chunks are never processed.
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('done');
  });

  it('silently skips malformed JSON', async () => {
    const valid = JSON.stringify({ type: 'token', content: 'ok' });
    const events = await collectEvents([
      'data: {broken json\n\n',
      `data: ${valid}\n\n`,
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'token', content: 'ok' });
  });

  it('handles empty / blank chunks without crashing', async () => {
    const payload = JSON.stringify({ type: 'token', content: 'test' });
    const events = await collectEvents(['', '\n', `data: ${payload}\n\n`, '']);
    expect(events).toHaveLength(1);
  });

  it('processes multiple events from a single chunk', async () => {
    const e1 = JSON.stringify({ type: 'token', content: 'a' });
    const e2 = JSON.stringify({ type: 'token', content: 'b' });
    const events = await collectEvents([`data: ${e1}\n\ndata: ${e2}\n\n`]);
    expect(events).toHaveLength(2);
    expect(events[0].content).toBe('a');
    expect(events[1].content).toBe('b');
  });

  it('handles events split across multiple reader chunks', async () => {
    const payload = JSON.stringify({ type: 'token', content: 'split' });
    const full = `data: ${payload}\n\n`;
    const half = Math.floor(full.length / 2);
    const events = await collectEvents([full.slice(0, half), full.slice(half)]);
    expect(events).toHaveLength(1);
    expect(events[0].content).toBe('split');
  });

  it('calls onEvent with each event as parsed object', async () => {
    const onEvent = vi.fn();
    const payload = JSON.stringify({ type: 'tool_start', name: 'run_sql' });
    const reader = makeReader([`data: ${payload}\n\n`]);
    await parseSSEStream(reader, makeDecoder(), onEvent);
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith({ type: 'tool_start', name: 'run_sql' });
  });
});
