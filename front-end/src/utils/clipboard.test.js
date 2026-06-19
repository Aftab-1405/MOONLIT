/**
 * Tests for utils/clipboard.js
 *
 * Tests the clipboard helper with mocked navigator.clipboard and execCommand.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

describe('copyToClipboard', () => {
  let originalClipboard;
  let originalIsSecureContext;
  let originalExecCommand;

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
    originalIsSecureContext = window.isSecureContext;
    originalExecCommand = document.execCommand;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: originalIsSecureContext, configurable: true });
    document.execCommand = originalExecCommand;
    vi.restoreAllMocks();
  });

  it('returns true when navigator.clipboard.writeText succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    const result = await copyToClipboard('hello');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when navigator.clipboard fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard('hello');
    expect(result).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('uses execCommand fallback in non-secure context', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: null, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);

    const result = await copyToClipboard('test text');
    expect(result).toBe(true);
  });

  it('returns false when execCommand also fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: null, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    document.execCommand = vi.fn().mockImplementation(() => { throw new Error('blocked'); });

    const result = await copyToClipboard('test');
    expect(result).toBe(false);
  });

  it('returns false when execCommand returns false', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: null, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(false);

    const result = await copyToClipboard('test');
    expect(result).toBe(false);
  });
});
