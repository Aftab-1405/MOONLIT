/**
 * SqlCodeViewer — lightweight read-only CodeMirror 6 SQL viewer.
 *
 * Replaces the read-only <Editor> (Monaco) instances used in
 * StepTimelineItems (chat timeline) and UserDBContextManagerForAI (settings).
 *
 * Props:
 *   value       {string}  SQL text to display
 *   height      {string}  CSS height string, e.g. '200px' or '100%'
 *   transparent {boolean} Use transparent background (for chat timeline)
 *   style       {object}  Extra inline styles on the CodeMirror root
 */
import { useMemo, memo } from 'react';
import { useTheme } from '@mui/material';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { EditorView } from '@codemirror/view';
import { getCodeMirrorTheme, getCodeMirrorHighlighting } from '@/theme/themeCodeMirror';

function SqlCodeViewer({ value = '', height = 'auto', transparent = false, style }) {
  const theme = useTheme();
  const mode = theme.palette.mode;

  const codeMirrorTheme = useMemo(
    () => getCodeMirrorTheme(mode, transparent),
    [mode, transparent]
  );

  const extensions = useMemo(
    () => [
      sql(),
      EditorView.lineWrapping,
      getCodeMirrorHighlighting(mode),
    ],
    [mode]
  );

  return (
    <CodeMirror
      value={value}
      height={height === 'auto' ? undefined : height}
      extensions={extensions}
      readOnly
      editable={false}
      theme={codeMirrorTheme}
      style={{
        fontSize: theme.typography.uiCodeCompact?.fontSizePx ?? 12,
        fontFamily: theme.typography.fontFamilyMono,
        ...style,
      }}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        dropCursor: false,
        allowMultipleSelections: false,
        indentOnInput: false,
        syntaxHighlighting: false,  // provided by getCodeMirrorHighlighting
        bracketMatching: false,
        closeBrackets: false,
        autocompletion: false,
        rectangularSelection: false,
        crosshairCursor: false,
        highlightSelectionMatches: false,
        searchKeymap: false,
        lintKeymap: false,
        completionKeymap: false,
        closeBracketsKeymap: false,
        historyKeymap: false,
      }}
    />
  );
}

export default memo(SqlCodeViewer);
