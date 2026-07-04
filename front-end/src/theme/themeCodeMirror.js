/**
 * CodeMirror theme + syntax highlighting that matches Shiki's themes.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 * The app uses Shiki for all code blocks in chat messages (CodeViewer.jsx)
 * with the themes `dracula-soft` (dark) and `github-light` (light).
 * The SQL editor uses CodeMirror 6 — which has its own theming system.
 *
 * Previously, CodeMirror used the `@uiw/codemirror-theme-dracula` and
 * `@uiw/codemirror-theme-github` packages, which did NOT match Shiki's
 * exact colors. SQL in the editor looked different from SQL in chat code
 * blocks.
 *
 * This file maps Shiki's exact token colors to CodeMirror's highlight tags
 * so the two surfaces are visually identical. The color values below were
 * extracted directly from the Shiki theme JSON files:
 *   - node_modules/@shikijs/themes/dist/github-light.mjs
 *   - node_modules/@shikijs/themes/dist/dracula-soft.mjs
 *
 * ── How it works ──────────────────────────────────────────────────────────
 * 1. `getCodeMirrorTheme(mode, transparent)` returns an Extension[] that:
 *    - Sets the editor background (transparent for inline use)
 *    - Sets gutter, selection, cursor, active-line, whitespace colors
 *    - Maps to the same editor.* colors from the Shiki theme's `colors` object
 *
 * 2. `getCodeMirrorHighlighting(mode)` returns a syntaxHighlighting Extension
 *    that uses HighlightTags → Shiki token colors. This replaces the
 *    @uiw theme packages entirely.
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// ─── Shiki color palettes (extracted from theme JSON) ───────────────────────

/**
 * GitHub Light — Shiki theme colors.
 * Source: @shikijs/themes/dist/github-light.mjs
 */
const GITHUB_LIGHT = {
  // Editor chrome
  editorForeground: '#24292e',
  editorBackground: '#ffffff',
  lineNumberForeground: '#1b1f234d',
  lineNumberActiveForeground: '#24292e',
  cursorForeground: '#044289',
  lineHighlightBackground: '#f6f8fa',
  selectionBackground: '#0366d625',
  whitespaceForeground: '#d1d5da',
  bracketMatchBackground: '#34d05840',

  // Syntax token colors
  comment: '#6a737d',
  constant: '#005cc5',
  entity: '#6f42c1',
  keyword: '#d73a49',
  storage: '#d73a49',
  string: '#032f62',
  support: '#005cc5',
  variable: '#e36209',
  variableOther: '#24292e',
  functionCall: '#6f42c1',
  propertyName: '#005cc5',
  punctuation: '#24292e',
  tagName: '#22863a',
  attributeName: '#005cc5',
  number: '#005cc5',
  boolean: '#005cc5',
  operator: '#d73a49',
  invalid: '#b31d28',
  regex: '#032f62',
  escape: '#22863a',
};

/**
 * Dracula Soft — Shiki theme colors.
 * Source: @shikijs/themes/dist/dracula-soft.mjs
 */
const DRACULA_SOFT = {
  // Editor chrome
  editorForeground: '#f6f6f4',
  editorBackground: '#282a36',
  lineNumberForeground: '#7b7f8b',
  lineNumberActiveForeground: '#f6f6f4',
  cursorForeground: '#f6f6f4',
  lineHighlightBackground: '#ffffff0d', // very subtle white overlay
  selectionBackground: '#44475a',
  whitespaceForeground: '#ffffff1a',
  bracketMatchBackground: '#f6f6f433',

  // Syntax token colors
  comment: '#7b7f8b',
  constant: '#bf9eee',
  entity: '#97e1f1',
  keyword: '#f286c4',
  storage: '#f286c4',
  string: '#e7ee98',
  support: '#97e1f1',
  variable: '#f6f6f4',
  variableOther: '#f6f6f4',
  functionCall: '#62e884',
  propertyName: '#97e1f1',
  punctuation: '#f6f6f4',
  tagName: '#f286c4',
  attributeName: '#62e884',
  number: '#bf9eee',
  boolean: '#bf9eee',
  operator: '#f286c4',
  invalid: '#ee6666',
  regex: '#e7ee98',
  escape: '#f286c4',
};

// ─── Theme factory ──────────────────────────────────────────────────────────

function getPalette(mode) {
  return mode === 'dark' ? DRACULA_SOFT : GITHUB_LIGHT;
}

/**
 * Returns a CodeMirror EditorView theme Extension that matches the Shiki
 * theme's editor chrome (background, gutter, cursor, selection, etc.).
 *
 * @param {'light'|'dark'} mode
 * @param {boolean}        transparent  use transparent bg (for inline viewers)
 * @returns {Extension} CodeMirror theme extension
 */
export function getCodeMirrorTheme(mode, transparent = false) {
  const p = getPalette(mode);
  const bg = transparent ? 'transparent' : p.editorBackground;

  return EditorView.theme({
    '&': {
      color: p.editorForeground,
      backgroundColor: bg,
    },
    '.cm-content': {
      caretColor: p.cursorForeground,
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: p.cursorForeground,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: p.selectionBackground,
      },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: p.lineNumberForeground,
      border: 'none',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: p.lineNumberActiveForeground,
    },
    '.cm-activeLine': {
      backgroundColor: p.lineHighlightBackground,
    },
    '.cm-whitespace::before, .cm-tab::before': {
      color: p.whitespaceForeground,
    },
    '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
      backgroundColor: p.bracketMatchBackground,
    },
    '.cm-placeholder': {
      color: p.lineNumberForeground,
      fontStyle: 'normal',
    },
    // Search panel (if enabled)
    '.cm-panels': {
      backgroundColor: p.editorBackground,
      color: p.editorForeground,
      borderTop: '1px solid rgba(128,128,128,0.2)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(255, 223, 93, 0.4)',
    },
    '.cm-searchMatch-selected': {
      backgroundColor: 'rgba(255, 223, 93, 0.7)',
    },
  });
}

/**
 * Returns a syntaxHighlighting Extension whose HighlightStyle maps
 * CodeMirror's Lezer highlight tags to the EXACT Shiki token colors.
 *
 * This is what makes SQL in the editor look identical to SQL in chat
 * code blocks — both use the same color values from the Shiki theme.
 *
 * @param {'light'|'dark'} mode
 * @returns {Extension} syntaxHighlighting extension
 */
export function getCodeMirrorHighlighting(mode) {
  const p = getPalette(mode);

  return syntaxHighlighting(
    HighlightStyle.define([
      // Comments
      { tag: t.comment, color: p.comment },
      { tag: t.lineComment, color: p.comment },
      { tag: t.blockComment, color: p.comment },

      // Keywords (SQL: SELECT, FROM, WHERE, etc.)
      { tag: t.keyword, color: p.keyword },
      { tag: t.controlKeyword, color: p.keyword },
      { tag: t.operatorKeyword, color: p.keyword },
      { tag: t.modifier, color: p.storage },

      // Storage / type keywords (SQL: TABLE, INDEX, VIEW, etc.)
      { tag: t.typeName, color: p.entity },
      { tag: t.standard(t.typeName), color: p.support },

      // Strings
      { tag: t.string, color: p.string },
      { tag: t.special(t.string), color: p.string },

      // Numbers and constants
      { tag: t.number, color: p.constant },
      { tag: t.bool, color: p.constant },
      { tag: t.null, color: p.constant },
      { tag: t.literal, color: p.constant },
      { tag: t.constant(t.variableName), color: p.constant },

      // Variables
      { tag: t.variableName, color: p.variableOther },
      { tag: t.local(t.variableName), color: p.variableOther },
      { tag: t.special(t.variableName), color: p.variable },
      { tag: t.definition(t.variableName), color: p.variable },

      // Function names
      { tag: t.function(t.variableName), color: p.functionCall },
      { tag: t.function(t.propertyName), color: p.functionCall },

      // Property / column names
      { tag: t.propertyName, color: p.propertyName },

      // Operators and punctuation
      { tag: t.operator, color: p.operator },
      { tag: t.derefOperator, color: p.operator },
      { tag: t.arithmeticOperator, color: p.operator },
      { tag: t.logicOperator, color: p.operator },
      { tag: t.bitwiseOperator, color: p.operator },
      { tag: t.compareOperator, color: p.operator },
      { tag: t.updateOperator, color: p.operator },
      { tag: t.definitionOperator, color: p.operator },
      { tag: t.typeOperator, color: p.operator },
      { tag: t.punctuation, color: p.punctuation },
      { tag: t.separator, color: p.punctuation },

      // Brackets and matching
      { tag: t.bracket, color: p.punctuation },
      { tag: t.brace, color: p.punctuation },
      { tag: t.paren, color: p.punctuation },
      { tag: t.squareBracket, color: p.punctuation },
      { tag: t.angleBracket, color: p.punctuation },

      // Tags and attributes (for HTML/XML — not SQL but kept for completeness)
      { tag: t.tagName, color: p.tagName },
      { tag: t.attributeName, color: p.attributeName },
      { tag: t.attributeValue, color: p.string },

      // Regular expressions and escapes
      { tag: t.regexp, color: p.regex },
      { tag: t.escape, color: p.escape },

      // Invalid / error
      { tag: t.invalid, color: p.invalid },

      // Meta and headings
      { tag: t.meta, color: p.punctuation },
      { tag: t.heading, color: p.entity },
    ]),
  );
}
