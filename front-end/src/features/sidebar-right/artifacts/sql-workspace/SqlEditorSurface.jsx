/**
 * SqlEditorSurface — CodeMirror 6 SQL editor (read/write).
 *
 * Drop-in replacement for the removed MonacoEditorSurface.
 * The props interface is identical so QueryWorkspace.jsx only needs
 * an updated lazy-import path.
 *
 * Props:
 *   query          {string}   current SQL text
 *   error          {string}   error message to show as a toast (falsy = hidden)
 *   onQueryChange  {fn}       called with new string on every keystroke
 *   onQueryExecute {fn}       fallback run handler (used if onRunQuery absent)
 *   onRunQuery     {fn}       primary run handler (tied to the Run button in StatusBar)
 */

import { StandardSQL, sql } from '@codemirror/lang-sql';
import { Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CodeMirror from '@uiw/react-codemirror';
import { AnimatePresence, motion } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { memo, useMemo } from 'react';
import Notification from '@/components/ui/toast';
import { getScrollbarStyles } from '@/styles/shared';
import { getCodeMirrorHighlighting, getCodeMirrorTheme } from '@/theme/themeCodeMirror';

function SqlEditorSurface({
  query,
  error,
  onQueryChange,
  onQueryExecute,
  onRunQuery,
  onClearError,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Resolve the run handler from props. CodeMirror efficiently reconfigures
  // extensions when this reference changes, so no ref/effect indirection needed.
  const runQuery = onRunQuery ?? onQueryExecute;

  const codeMirrorTheme = useMemo(
    () => getCodeMirrorTheme(theme.palette.mode, true),
    [theme.palette.mode],
  );

  const extensions = useMemo(
    () => [
      sql({ dialect: StandardSQL, upperCaseKeywords: true }),
      EditorView.lineWrapping,
      placeholder('Write a SQL query…'),
      // Ctrl+Enter / Cmd+Enter → same action as clicking the Run button
      Prec.high(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              runQuery?.();
              return true;
            },
          },
        ]),
      ),
      getCodeMirrorHighlighting(theme.palette.mode),
    ],
    [theme.palette.mode, runQuery],
  );

  const scrollbarSx = useMemo(() => getScrollbarStyles(theme), [theme]);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        bgcolor: 'background.default',
        borderRadius: '0 0 12px 12px',
      }}
    >
      {/* Editor */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          '& .cm-editor': {
            height: '100%',
            backgroundColor: 'transparent',
          },
          '& .cm-scroller': {
            ...scrollbarSx,
            fontFeatureSettings: '"liga" 0, "calt" 0',
          },
          '& .cm-content': {
            minHeight: '100%',
          },
          '& .cm-gutters': {
            borderRight: '0 !important',
            boxShadow: 'none',
            backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.018 : 0.014),
          },
          '& .cm-placeholder': {
            color: theme.palette.text.disabled,
            fontStyle: 'normal',
          },
          '& .cm-activeLine, & .cm-activeLineGutter': {
            backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.055 : 0.035),
          },
        }}
      >
        <CodeMirror
          value={query}
          height="100%"
          style={{
            height: '100%',
            fontSize: theme.typography.uiCode.fontSizePx,
            fontFamily: theme.typography.fontFamilyMono,
          }}
          extensions={extensions}
          theme={codeMirrorTheme}
          onChange={onQueryChange}
          autoFocus
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: true,
            highlightActiveLineGutter: true,
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            syntaxHighlighting: false, // provided by getCodeMirrorHighlighting
            tabSize: 2,
            indentOnInput: true,
            history: true,
            drawSelection: true,
            rectangularSelection: false,
            crosshairCursor: false,
            highlightSelectionMatches: true,
            searchKeymap: true,
            historyKeymap: true,
            defaultKeymap: true,
          }}
        />
      </Box>

      {/* Error alert — auto-dismissed via parent after 5 s */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              bottom: 18,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 10,
              padding: '0 16px',
            }}
          >
            <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: '420px' }}>
              <Notification
                type="error"
                title={
                  error.startsWith('Query blocked:') ? 'Query blocked' : 'Query Execution Error'
                }
                message={
                  error.startsWith('Query blocked:')
                    ? error.replace('Query blocked:', '').trim()
                    : error
                }
                onClose={onClearError}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

function areEditorPropsEqual(prev, next) {
  return (
    prev.query === next.query &&
    prev.error === next.error &&
    prev.onQueryChange === next.onQueryChange &&
    prev.onQueryExecute === next.onQueryExecute &&
    prev.onRunQuery === next.onRunQuery &&
    prev.onClearError === next.onClearError
  );
}

export default memo(SqlEditorSurface, areEditorPropsEqual);
