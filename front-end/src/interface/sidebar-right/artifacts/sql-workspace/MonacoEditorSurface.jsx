/**
 * MonacoEditorSurface - Monaco SQL editor with error handling
 */

import { useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import Editor from '@monaco-editor/react';
import { registerMonacoThemes, getMonacoThemeName } from '../../../../theme';
import { getScrollbarStyles } from '../../../../styles/shared';

const toastSlideUp = keyframes`
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

const MONACO_OPTIONS = {
  minimap: { enabled: false },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on',
  wrappingIndent: 'same',
  padding: { top: 16, bottom: 16 },
  renderLineHighlight: 'line',
  lineHeight: 22,
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
  },
  suggest: {
    showKeywords: true,
    showSnippets: true,
  },
  quickSuggestions: {
    other: true,
    comments: false,
    strings: false,
  },
  tabSize: 2,
  insertSpaces: true,
  formatOnPaste: true,
  formatOnType: true,
};

function MonacoEditorSurface({
  query,
  error,
  isConnected: _isConnected,
  onQueryChange,
  onQueryExecute,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const editorRef = useRef(null);
  const handleRunQueryRef = useRef(null);

  const monacoOptions = useMemo(
    () => ({
      ...MONACO_OPTIONS,
      fontFamily: theme.typography.fontFamilyMono,
      fontSize: theme.typography.uiCode.fontSizePx,
    }),
    [theme.typography.fontFamilyMono, theme.typography.uiCode.fontSizePx]
  );

  const handleEditorDidMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      editor.focus();

      // Register Monaco themes
      registerMonacoThemes(monaco, { transparent: false });
      monaco.editor.setTheme(getMonacoThemeName(theme.palette.mode, false));

      // Register Ctrl+Enter / Cmd+Enter for query execution
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => {
          handleRunQueryRef.current?.();
        }
      );

      // SQL language configuration
      monaco.languages.setLanguageConfiguration('sql', {
        comments: {
          lineComment: '--',
          blockComment: ['/*', '*/'],
        },
        brackets: [
          ['(', ')'],
          ['[', ']'],
        ],
        autoClosingPairs: [
          { open: '(', close: ')' },
          { open: '[', close: ']' },
          { open: "'", close: "'", notIn: ['string', 'comment'] },
          { open: '"', close: '"', notIn: ['string'] },
        ],
      });
    },
    [theme.palette.mode]
  );

  useEffect(() => {
    handleRunQueryRef.current = onQueryExecute;
  }, [onQueryExecute]);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          '& .monaco-editor': {
            ...getScrollbarStyles(theme),
          },
          '& .monaco-editor .margin': {
            bgcolor: 'background.default',
          },
        }}
      >
        <Editor
          height="100%"
          language="sql"
          theme={getMonacoThemeName(theme.palette.mode, false)}
          value={query}
          onChange={(value) => onQueryChange(value || '')}
          onMount={handleEditorDidMount}
          options={monacoOptions}
        />
      </Box>

      {/* Error toast */}
      {error && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            zIndex: 10,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            maxWidth: 'calc(100% - 48px)',
            borderRadius: '10px',
            border: '1px solid',
            borderColor: alpha(theme.palette.error.main, isDark ? 0.35 : 0.25),
            backgroundColor: isDark
              ? alpha(theme.palette.background.paper, 0.95)
              : alpha(theme.palette.background.paper, 0.98),
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: isDark
              ? `0 8px 28px ${alpha(theme.palette.common.black, 0.5)}, 0 0 0 1px ${alpha(theme.palette.error.main, 0.15)}`
              : `0 8px 24px ${alpha(theme.palette.common.black, 0.11)}, 0 0 0 1px ${alpha(theme.palette.error.main, 0.1)}`,
            animation: `${toastSlideUp} 0.22s cubic-bezier(0.22, 1, 0.36, 1) both`,
          }}
        >
          <Typography
            variant="body2"
            color="error.main"
            sx={{
              ...theme.typography.uiMenuItemSm,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default memo(MonacoEditorSurface);
