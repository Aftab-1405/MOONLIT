import { describe, expect, it } from 'vitest';

import { mergeBaseTimelineWithText } from './useMessageStreaming';

describe('mergeBaseTimelineWithText', () => {
  it('preserves existing flat assistant text when live workflow status creates a timeline', () => {
    const merged = mergeBaseTimelineWithText('Earlier generated answer.', [
      {
        type: 'thinking',
        id: 'workflow-summarizing_context',
        content: 'Summarizing conversation context before continuing.',
        isComplete: false,
      },
    ]);

    expect(merged).toEqual([
      {
        type: 'text',
        id: 'base-text',
        content: 'Earlier generated answer.',
      },
      {
        type: 'thinking',
        id: 'workflow-summarizing_context',
        content: 'Summarizing conversation context before continuing.',
        isComplete: false,
      },
    ]);
  });

  it('does not duplicate base text when the timeline already has text', () => {
    const merged = mergeBaseTimelineWithText('Earlier generated answer.', [
      {
        type: 'text',
        id: 'existing-text',
        content: 'Earlier generated answer.',
      },
    ]);

    expect(merged).toEqual([
      {
        type: 'text',
        id: 'existing-text',
        content: 'Earlier generated answer.',
      },
    ]);
  });
});
