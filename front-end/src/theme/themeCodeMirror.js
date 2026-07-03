import { EditorView } from '@codemirror/view';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { githubLight } from '@uiw/codemirror-theme-github';

/**
 * Returns the UIW CodeMirror theme matching the Moonlit palette mode.
 *
 * @param {'light'|'dark'} mode
 * @param {boolean}        transparent  use transparent bg (for inline viewers)
 */
export function getCodeMirrorTheme(mode, transparent = false) {
  const baseTheme = mode === 'dark' ? dracula : githubLight;

  if (!transparent) {
    return baseTheme;
  }

  // Override the background to be transparent when requested
  return [
    baseTheme,
    EditorView.theme({
      '&': { backgroundColor: 'transparent !important' },
      '.cm-gutters': { backgroundColor: 'transparent !important' },
    }),
  ];
}

/**
 * Returns a syntaxHighlighting Extension.
 * Since UIW themes already bundle the highlighting with the theme extension above,
 * this function just returns an empty array to remain backward-compatible
 * with components calling it.
 *
 * @param {'light'|'dark'} mode
 */
export function getCodeMirrorHighlighting(_mode) {
  return [];
}
