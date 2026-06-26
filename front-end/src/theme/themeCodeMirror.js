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
import { alpha } from '@mui/material/styles';
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
  const bg = transparent ? TRANSPARENT : T.bg000;

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
        lineHeight: '1.7',
      },

      // Text content area
      '.cm-content': {
        caretColor: T.text000,
        padding: '14px 0',
      },
      '.cm-line': { padding: '0 14px' },

      // Cursor
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: T.text000 },

      // Selection
      '.cm-selectionBackground': {
        backgroundColor: alpha(T.text000, isDark ? 0.13 : 0.1),
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: alpha(T.text000, isDark ? 0.18 : 0.14),
      },

      // Gutter (line numbers)
      '.cm-gutters': {
        backgroundColor: bg,
        color: T.text400,
        borderRight: `1px solid ${alpha(T.text000, isDark ? 0.06 : 0.07)}`,
      },
      '.cm-lineNumbers .cm-gutterElement': {
        minWidth: '2.5em',
        paddingRight: '0.85em',
        fontVariantNumeric: 'tabular-nums',
        userSelect: 'none',
      },
      '.cm-activeLineGutter': {
        backgroundColor: alpha(T.text000, isDark ? 0.04 : 0.025),
      },

      // Active line highlight
      '.cm-activeLine': {
        backgroundColor: transparent
          ? alpha(T.text000, isDark ? 0.03 : 0.02)
          : alpha(T.text000, isDark ? 0.04 : 0.03),
      },

      // Autocomplete tooltip
      '.cm-tooltip': {
        backgroundColor: isDark ? DARK.bg100 : LIGHT.bg100,
        border: `1px solid ${alpha(T.text000, isDark ? 0.08 : 0.1)}`,
        borderRadius: '6px',
        boxShadow: 'none',
      },
      '.cm-tooltip-autocomplete ul li[aria-selected]': {
        backgroundColor: alpha(T.text000, isDark ? 0.08 : 0.06),
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
  const palette = isDark
    ? {
        keyword: '#82aaff',
        string: '#9ad6a3',
        number: '#d7b4ff',
        comment: '#7c8490',
        name: '#e6e7eb',
        operator: '#c8d0dd',
        punctuation: '#8f98a7',
        type: '#7dd3c7',
        atom: '#f0c674',
        functionName: '#b9d7ff',
      }
    : {
        keyword: '#1f4fbf',
        string: '#1f7a3a',
        number: '#7a3fb2',
        comment: '#7a7f89',
        name: '#141821',
        operator: '#3e4a5f',
        punctuation: '#687083',
        type: '#056c73',
        atom: '#9a5b00',
        functionName: '#145aa0',
      };

  return syntaxHighlighting(
    HighlightStyle.define([
      { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword], color: palette.keyword, fontWeight: '650' },
      { tag: [t.string, t.special(t.string)], color: palette.string },
      { tag: [t.number, t.integer, t.float], color: palette.number },
      { tag: [t.bool, t.null, t.atom], color: palette.atom, fontWeight: '600' },
      { tag: t.comment, color: palette.comment, fontStyle: 'italic' },
      { tag: [t.name, t.variableName, t.propertyName], color: palette.name },
      { tag: [t.function(t.variableName), t.function(t.propertyName)], color: palette.functionName },
      { tag: [t.operator, t.compareOperator, t.logicOperator, t.arithmeticOperator], color: palette.operator },
      { tag: t.punctuation, color: palette.punctuation },
      { tag: [t.typeName, t.standard(t.name)], color: palette.type, fontWeight: '600' },
    ])
  );
}
