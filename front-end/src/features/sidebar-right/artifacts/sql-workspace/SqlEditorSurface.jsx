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
import { useMemo, memo } from "react";
import { Box, Typography } from "@mui/material";
import { useTheme, alpha, keyframes } from "@mui/material/styles";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import {
  getCodeMirrorTheme,
  getCodeMirrorHighlighting,
} from "@/theme/themeCodeMirror";
import { getScrollbarStyles } from "@/styles/shared";

const toastSlideUp = keyframes`
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
`;

function SqlEditorSurface({
  query,
  error,
  onQueryChange,
  onQueryExecute,
  onRunQuery,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Resolve the run handler from props. CodeMirror efficiently reconfigures
  // extensions when this reference changes, so no ref/effect indirection needed.
  const runQuery = onRunQuery ?? onQueryExecute;

  const codeMirrorTheme = useMemo(
    () => getCodeMirrorTheme(theme.palette.mode, false),
    [theme.palette.mode],
  );

  const extensions = useMemo(
    () => [
      sql(),
      EditorView.lineWrapping,
      // Ctrl+Enter / Cmd+Enter → same action as clicking the Run button
      Prec.high(
        keymap.of([
          {
            key: "Mod-Enter",
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
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      {/* Editor */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          "& .cm-editor": { height: "100%" },
          "& .cm-scroller": scrollbarSx,
        }}
      >
        <CodeMirror
          value={query}
          height="100%"
          style={{
            height: "100%",
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

      {/* Error toast */}
      {error && (
        <Box
          role="alert"
          sx={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            zIndex: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 2,
            py: 1,
            maxWidth: "calc(100% - 48px)",
            borderRadius: "10px",
            border: "1px solid",
            borderColor: alpha(theme.palette.error.main, isDark ? 0.35 : 0.25),
            backgroundColor: isDark
              ? alpha(theme.palette.background.paper, 0.95)
              : alpha(theme.palette.background.paper, 0.98),
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
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
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function areEditorPropsEqual(prev, next) {
  return (
    prev.query === next.query &&
    prev.error === next.error &&
    prev.onQueryChange === next.onQueryChange &&
    prev.onQueryExecute === next.onQueryExecute &&
    prev.onRunQuery === next.onRunQuery
  );
}

export default memo(SqlEditorSurface, areEditorPropsEqual);
