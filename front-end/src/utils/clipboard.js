/**
 * clipboard - Shared clipboard utility with secure-context and fallback support.
 *
 * navigator.clipboard.writeText is only available in secure contexts (HTTPS /
 * localhost) and may be blocked by browser permissions. This helper tries the
 * modern API first, then falls back to the legacy execCommand approach, and
 * always returns a boolean indicating whether the copy succeeded.
 *
 * Usage:
 *   import { copyToClipboard } from '@/utils/clipboard';
 *   const ok = await copyToClipboard(text);
 *   if (ok) showSuccess(); else showError();
 *
 * @module utils/clipboard
 */

/**
 * Copy text to the system clipboard.
 *
 * @param {string} text - Text to copy.
 * @returns {Promise<boolean>} true if copy succeeded, false otherwise.
 */
export async function copyToClipboard(text) {
  // Prefer the modern Clipboard API when available in a secure context.
  if (navigator?.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy approach on permission errors.
    }
  }

  // Legacy fallback using execCommand (works on HTTP and older browsers).
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Position off-screen so it doesn't flash visually.
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.setAttribute('aria-hidden', 'true');
    textarea.setAttribute('tabindex', '-1');
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('[clipboard] Failed to copy text:', error);
    return false;
  }
}
