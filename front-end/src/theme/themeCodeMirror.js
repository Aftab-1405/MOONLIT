/**
 * CodeMirror 6 theme helpers for Moonlit.
 *
 * Provides two exported functions consumed by SqlEditorSurface and SqlCodeViewer:
 *   getCodeMirrorTheme(mode, transparent) → EditorView.theme() Extension
 *   getCodeMirrorHighlighting(mode)        → syntaxHighlighting() Extension
 */
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { DARK, LIGHT } from '@/theme/tokens';

const TRANSPARENT = 'transparent';

/**
 * Returns an EditorView.theme() Extension that matches the Moonlit palette
 * for the given color mode.
 *
 * @param {'light'|'dark'} mode
 * @param {boolean}        transparent  use transparent bg (for inline viewers)
 */
export function getCodeMirrorTheme(mode, transparent = false) {
  const T = mode === 'dark' ? DARK : LIGHT;
  const isDark = mode === 'dark';
  const bg = transparent ? TRANSPARENT : T.bg200;

  return EditorView.theme(
    {
      // Root editor element
      '&': {
        backgroundColor: bg,
        color: T.text000,
        height: '100%',
      },
      '&.cm-focused': { outline: 'none' },

      // Scroll container
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: 'inherit',
        lineHeight: '1.65',
      },

      // Text content area
      '.cm-content': {
        caretColor: T.text000,
        padding: '12px 0',
      },
      '.cm-line': { padding: '0 8px' },

      // Cursor
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: T.text000 },

      // Selection
      '.cm-selectionBackground': {
        backgroundColor: isDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.1)',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)',
      },

      // Gutter (line numbers)
      '.cm-gutters': {
        backgroundColor: bg,
        color: T.text400,
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
      },
      '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '2.5em',
        paddingRight: '0.75em',
        userSelect: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)',
      },

      // Active line highlight
      '.cm-activeLine': {
        backgroundColor: transparent
          ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')
          : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
      },

      // Autocomplete tooltip
      '.cm-tooltip': {
        backgroundColor: isDark ? DARK.bg100 : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: '6px',
        boxShadow: isDark
          ? '0 8px 24px rgba(0,0,0,0.5)'
          : '0 4px 16px rgba(0,0,0,0.12)',
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        color: T.text000,
      },
    },
    { dark: isDark }
  );
}

/**
 * Returns a syntaxHighlighting Extension with a monochrome-friendly
 * SQL color palette that works in both Moonlit light and dark modes.
 *
 * @param {'light'|'dark'} mode
 */
export function getCodeMirrorHighlighting(mode) {
  const isDark = mode === 'dark';
  return syntaxHighlighting(
    HighlightStyle.define([
      // SQL keywords — slightly brighter and bold
      { tag: t.keyword,         color: isDark ? '#e2e2e2' : '#111111', fontWeight: '600' },
      { tag: t.operatorKeyword, color: isDark ? '#e2e2e2' : '#111111', fontWeight: '600' },
      // String literals — soft green tint
      { tag: t.string,          color: isDark ? '#98c99a' : '#236323' },
      // Numeric literals — soft purple tint
      { tag: t.number,          color: isDark ? '#b8a8d8' : '#5a3080' },
      // Comments — muted and italic
      { tag: t.comment,         color: isDark ? '#5e5e5e' : '#888888', fontStyle: 'italic' },
      // Identifiers / column names
      { tag: t.name,            color: isDark ? '#d4d4d4' : '#1a1a1a' },
      // Operators
      { tag: t.operator,        color: isDark ? '#c8c8c8' : '#2f2f2f' },
      { tag: t.punctuation,     color: isDark ? '#888888' : '#555555' },
      // Type names (e.g. INT, VARCHAR)
      { tag: t.typeName,        color: isDark ? '#a8c0d8' : '#1e4a6a' },
    ])
  );
}
