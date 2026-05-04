import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  ButtonBase,
  Button,
  Menu,
  MenuItem,
} from '@mui/material';
import { useTheme as useMuiTheme, alpha, keyframes } from '@mui/material/styles';
import { useTheme as useAppTheme } from '../contexts/ThemeContext';
import Editor from '@monaco-editor/react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import HighlightOffSharpIcon from '@mui/icons-material/HighlightOffSharp';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import SQLResultsTable from './SQLResultsTable';
import ChartVisualization from './ChartVisualization';
import { registerMonacoThemes, getMonacoThemeName } from '../theme';
import { TRANSITIONS } from '../styles/themeEffects';
import { getGhostIconButtonSx, getGlassmorphismStyles } from '../styles/shared';
import { runQuery } from '../api';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

// Separate keyframe for the bottom-center toast — must keep translateX(-50%)
// in both states so the centering offset is never dropped during the animation.
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
  padding: { top: 18, bottom: 20 },
  renderLineHighlight: 'line',
  lineHeight: 22,
  scrollbar: {
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
    useShadows: false,
  },
  suggest: {
    showKeywords: true,
  },
};

function resultsToCsv(results) {
  const columns = results?.columns || [];
  const rows = results?.result || [];
  if (!columns.length || !rows.length) return '';
  const header = columns.join(',');
  const body = rows.map((row) =>
    columns.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(',')
  );
  return [header, ...body].join('\n');
}

const openedMixin = (theme, width) => ({
  width: typeof width === 'number' ? width : width,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
  ...getGlassmorphismStyles(theme),
});

const closedMixin = (theme) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: 0,
  ...getGlassmorphismStyles(theme),
});

function buildPanelSx(theme, open, panelWidth) {
  return {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open ? openedMixin(theme, panelWidth) : closedMixin(theme)),
  };
}

const EmptyState = memo(function EmptyState({ icon: _Icon, title, subtitle, textColor, accent, hint }) {
  const Icon = _Icon;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: 'text.secondary',
        gap: 1.35,
        animation: `${fadeIn} 0.4s cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(accent, 0.055),
          border: '1px solid',
          borderColor: alpha(accent, 0.12),
        }}
      >
        <Icon sx={{ fontSize: 23, color: accent, opacity: 0.78 }} />
      </Box>
      <Typography
        variant="body1"
        sx={{
          fontWeight: 600,
          letterSpacing: 0,
          color: 'text.primary',
          opacity: 0.9,
        }}
      >
        {title}
      </Typography>
      {subtitle && (
        <Typography
          variant="body2"
          sx={{
            textAlign: 'center',
            px: 3,
            maxWidth: 320,
            lineHeight: 1.55,
            color: 'text.secondary',
            opacity: 0.78,
          }}
        >
          {subtitle}
        </Typography>
      )}
      {hint && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: alpha(textColor, 0.08),
            bgcolor: alpha(textColor, 0.025),
          }}
        >
          {hint}
        </Box>
      )}
    </Box>
  );
});

function SQLEditorCanvas({
  onClose,
  initialQuery = '',
  initialResults = null,
  isConnected = false,
  currentDatabase = null,
  isOpen = true,
  panelWidth = 450,
  fullscreen = false,
}) {
  const theme = useMuiTheme();
  const { settings } = useAppTheme();
  const isDark = theme.palette.mode === 'dark';

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(initialResults);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [copyMenuAnchor, setCopyMenuAnchor] = useState(null);
  const editorRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const handleRunQueryRef = useRef(null);
  const textColor = useMemo(() => theme.palette.text.primary, [theme.palette.text.primary]);
  const monacoOptions = useMemo(
    () => ({
      ...MONACO_OPTIONS,
      fontFamily: theme.typography.fontFamilyMono,
      fontSize: theme.typography.uiCode.fontSizePx,
    }),
    [theme.typography.fontFamilyMono, theme.typography.uiCode.fontSizePx]
  );
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (initialResults) {
      setResults(initialResults);
      setError(null);
      setActiveTab(1);
    }
  }, [initialResults]);

  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    editor.focus();
    registerMonacoThemes(monaco, { transparent: true });
    monaco.editor.setTheme(getMonacoThemeName(theme.palette.mode, true));
    // Register Ctrl+Enter / Cmd+Enter directly on the Monaco instance.
    // Monaco captures keyboard events inside its own DOM layer, so the outer
    // React onKeyDown wrapper never fires when the editor has focus.
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => { handleRunQueryRef.current?.(); }
    );
  }, [theme.palette.mode]);

  const handleRunQuery = useCallback(async () => {
    if (!query.trim() || isRunning) return;
    if (!isConnected) {
      setError('Please connect to a database first');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const maxRows = settings.maxRows ?? 1000;
      const queryTimeout = settings.queryTimeout ?? 30;

      const data = await runQuery({ sql: query, maxRows, timeout: queryTimeout });

      if (data.status === 'success') {
        const columns = data.result?.fields || [];
        const rows = data.result?.rows || [];

        const transformedResult = rows.map(row => {
          const obj = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj;
        });

        setResults({
          columns,
          result: transformedResult,
          row_count: data.row_count,
          total_rows: data.total_rows,
          truncated: data.truncated,
          execution_time: data.execution_time_ms ? data.execution_time_ms / 1000 : null,
        });
        setError(null);
        setActiveTab(1);
      } else {
        setError(data.message || 'Query execution failed');
        setResults(null);
      }
    } catch (err) {
      setError('Failed to execute query: ' + err.message);
      setResults(null);
    } finally {
      setIsRunning(false);
    }
  }, [query, isConnected, isRunning, settings.maxRows, settings.queryTimeout]);

  // Keep the ref pointing at the latest version so the Monaco addCommand
  // closure (registered once on mount) always calls the current handler.
  handleRunQueryRef.current = handleRunQuery;

  const handleClear = useCallback(() => {
    setQuery('');
    setResults(null);
    setError(null);
    setActiveTab(0);
    editorRef.current?.focus();
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [query]);

  const handleCopyCsv = useCallback(() => {
    const csv = resultsToCsv(results);
    if (!csv) return;
    navigator.clipboard.writeText(csv);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    setCopyMenuAnchor(null);
  }, [results]);

  const openCopyMenu = useCallback((e) => {
    setCopyMenuAnchor(e.currentTarget);
  }, []);

  const closeCopyMenu = useCallback(() => setCopyMenuAnchor(null), []);

  const handleCopyMenuSql = useCallback(() => {
    handleCopy();
    setCopyMenuAnchor(null);
  }, [handleCopy]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunQuery();
    }
  }, [handleRunQuery]);

  const handleTabChange = useCallback((index) => {
    setActiveTab(index);
  }, []);

  const handleQueryChange = useCallback((value) => {
    setQuery(value || '');
  }, []);

  const handleCloseResults = useCallback(() => {
    setResults(null);
  }, []);
  const artifactChromeBg = useMemo(
    () => theme.palette.background.paper,
    [theme.palette.background.paper]
  );
  const artifactBorder = useMemo(
    () => alpha(theme.palette.divider, isDark ? 0.85 : 0.95),
    [theme.palette.divider, isDark]
  );
  const segmentTrackBg = useMemo(
    () => alpha(theme.palette.text.primary, isDark ? 0.11 : 0.055),
    [theme.palette.text.primary, isDark]
  );
  const headerBarBg = useMemo(
    () => (isDark
      ? `linear-gradient(180deg, ${alpha(artifactChromeBg, 1)} 0%, ${alpha(artifactChromeBg, 0.94)} 100%)`
      : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 1)} 0%, ${alpha(artifactChromeBg, 0.98)} 100%)`
    ),
    [artifactChromeBg, isDark, theme.palette.common.white]
  );
  const footerBarBg = useMemo(
    () => (isDark
      ? `linear-gradient(0deg, ${alpha(artifactChromeBg, 1)} 0%, ${alpha(artifactChromeBg, 0.92)} 100%)`
      : `linear-gradient(0deg, ${alpha(artifactChromeBg, 1)} 0%, ${alpha(theme.palette.common.white, 0.97)} 100%)`
    ),
    [artifactChromeBg, isDark, theme.palette.common.white]
  );
  const headerActionHoverBg = useMemo(
    () => alpha(theme.palette.text.primary, isDark ? 0.12 : 0.065),
    [theme.palette.text.primary, isDark]
  );

  const actionBarStyles = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 0.75,
    px: { xs: 1, sm: 1.25 },
    py: { xs: 0.75, sm: 0.85 },
    flexShrink: 0,
    minHeight: { xs: 48, sm: 50 },
    borderTop: '1px solid',
    borderColor: artifactBorder,
    background: footerBarBg,
    boxShadow: isDark
      ? `0 -1px 0 ${alpha(theme.palette.common.white, 0.04)} inset`
      : `0 -1px 0 ${alpha(theme.palette.common.white, 0.85)} inset`,
  }), [artifactBorder, footerBarBg, isDark, theme.palette.common.white]);

  const toolbarGhostStyles = useMemo(() => ({
    minWidth: 0,
    height: 34,
    px: 1.15,
    borderRadius: '10px',
    ...theme.typography.uiButtonSm,
    textTransform: 'none',
    color: 'text.secondary',
    border: '1px solid',
    borderColor: 'transparent',
    bgcolor: 'transparent',
    transition: TRANSITIONS.default,
    '&:hover': {
      color: 'text.primary',
      borderColor: alpha(theme.palette.text.primary, isDark ? 0.11 : 0.08),
      bgcolor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.045),
    },
    '&.Mui-disabled': {
      color: 'text.disabled',
      bgcolor: 'transparent',
      borderColor: 'transparent',
    },
  }), [theme, isDark]);

  const runButtonStyles = useMemo(() => ({
    minWidth: 0,
    height: 34,
    px: 1.35,
    borderRadius: '10px',
    ...theme.typography.uiButtonSm,
    textTransform: 'none',
    color: 'primary.contrastText',
    bgcolor: 'primary.main',
    boxShadow: `0 1px 6px ${alpha(theme.palette.primary.main, isDark ? 0.34 : 0.2)}`,
    transition: TRANSITIONS.default,
    '&:hover': {
      bgcolor: 'primary.dark',
      boxShadow: `0 2px 10px ${alpha(theme.palette.primary.main, isDark ? 0.4 : 0.24)}`,
    },
    '&.Mui-disabled': {
      color: alpha(theme.palette.text.primary, 0.35),
      bgcolor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.055),
      boxShadow: 'none',
    },
  }), [isDark, theme]);

  const shortcutHintStyles = useMemo(() => ({
    display: { xs: 'none', sm: 'inline-flex' },
    alignItems: 'center',
    gap: 0.5,
    mr: 'auto',
    color: 'text.disabled',
  }), []);

  const shortcutKeyStyles = useMemo(() => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 24,
    height: 22,
    px: 0.625,
    borderRadius: '6px',
    ...theme.typography.uiMonoLabel,
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: 'text.secondary',
    bgcolor: alpha(textColor, 0.055),
    border: '1px solid',
    borderColor: alpha(textColor, 0.1),
    boxSizing: 'border-box',
  }), [textColor, theme.typography.uiMonoLabel]);

  /** Fills canvas body; overflow stays inside table/chart (not this wrapper). */
  const artifactTabPaneStyles = useMemo(() => ({
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    bgcolor: artifactChromeBg,
  }), [artifactChromeBg]);

  const centeredEmptyWrapStyles = useMemo(() => ({
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    px: { xs: 2.5, md: 4 },
    py: { xs: 2.5, md: 3.5 },
    maxWidth: 420,
    mx: 'auto',
    width: '100%',
    boxSizing: 'border-box',
    overflow: 'auto',
  }), []);
  const editorTabContent = useMemo(() => (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: artifactChromeBg,
        position: 'relative',
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          '& .monaco-editor, & .monaco-editor-background, & .monaco-editor .margin': {
            backgroundColor: `${artifactChromeBg} !important`,
          },
        }}
        onKeyDown={handleKeyDown}
      >
        <Editor
          height="100%"
          language="sql"
          theme={getMonacoThemeName(theme.palette.mode, true)}
          value={query}
          onChange={handleQueryChange}
          onMount={handleEditorDidMount}
          options={monacoOptions}
        />
      </Box>

      {/* Floating toast — slides up from the bottom-center of the editor */}
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
            whiteSpace: 'nowrap',
            animation: `${toastSlideUp} 0.22s cubic-bezier(0.22, 1, 0.36, 1) both`,
          }}
        >
          <Typography
            variant="body2"
            color="error.main"
            sx={{ ...theme.typography.uiMenuItemSm, fontWeight: 500 }}
          >
            {error}
          </Typography>
        </Box>
      )}
    </Box>
  ), [artifactChromeBg, error, isDark, query, handleKeyDown, handleQueryChange, handleEditorDidMount, monacoOptions, theme]);

  const resultsTabContent = useMemo(() => (
    <Box sx={artifactTabPaneStyles}>
      {results ? (
        <SQLResultsTable data={results} onClose={handleCloseResults} embedded />
      ) : (
        <Box sx={centeredEmptyWrapStyles}>
          <EmptyState
            icon={DatasetOutlinedIcon}
            title="Awaiting results"
            subtitle={null}
            textColor={textColor}
            accent={theme.palette.text.secondary}
          />
        </Box>
      )}
    </Box>
  ), [
    artifactTabPaneStyles,
    centeredEmptyWrapStyles,
    handleCloseResults,
    results,
    textColor,
    theme.palette.text.secondary,
  ]);

  const chartTabContent = useMemo(() => (
    <Box sx={artifactTabPaneStyles}>
      {results ? (
        <ChartVisualization data={results} embedded />
      ) : (
        <Box sx={centeredEmptyWrapStyles}>
          <EmptyState
            icon={BarChartRoundedIcon}
            title="Awaiting data"
            subtitle={null}
            hint={
              <Typography variant="caption" sx={{ fontFamily: 'inherit', color: 'text.disabled', ...theme.typography.uiCaptionXs, letterSpacing: '0.02em' }}>
                Results required
              </Typography>
            }
            textColor={textColor}
            accent={theme.palette.info.main}
          />
        </Box>
      )}
    </Box>
  ), [
    artifactTabPaneStyles,
    centeredEmptyWrapStyles,
    results,
    textColor,
    theme.palette.info.main,
    theme.typography.uiCaptionXs,
  ]);
  const panelSx = useMemo(
    () => buildPanelSx(theme, isOpen, panelWidth),
    [theme, isOpen, panelWidth],
  );

  const tabContent = activeTab === 0 ? editorTabContent : activeTab === 1 ? resultsTabContent : chartTabContent;

  const navSegments = useMemo(() => [
    { id: 0, label: 'Editor', ariaLabel: 'SQL editor', icon: CodeRoundedIcon, disabled: false },
    { id: 1, label: 'Results', ariaLabel: 'Query results', icon: DatasetOutlinedIcon, disabled: false },
    { id: 2, label: 'Chart', ariaLabel: 'Chart', icon: BarChartRoundedIcon, disabled: !results },
  ], [results]);

  const unifiedHeader = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        px: { xs: 1, sm: 1.25 },
        py: { xs: 0.85, sm: 0.95 },
        flexShrink: 0,
        minHeight: { xs: 52, sm: 54 },
        borderBottom: '1px solid',
        borderColor: artifactBorder,
        background: headerBarBg,
        boxShadow: isDark
          ? `0 1px 0 ${alpha(theme.palette.common.white, 0.06)} inset`
          : `0 1px 0 ${alpha(theme.palette.common.white, 0.85)} inset`,
      }}
    >
      <Box
        role="tablist"
        aria-label="SQL workspace views"
        sx={{
          display: 'inline-grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          alignItems: 'center',
          gap: 0.25,
          p: 0.25,
          width: { xs: 156, sm: 186 },
          height: 34,
          flexShrink: 0,
          borderRadius: '10px',
          bgcolor: segmentTrackBg,
          border: '1px solid',
          borderColor: alpha(theme.palette.text.primary, isDark ? 0.09 : 0.07),
          boxSizing: 'border-box',
        }}
      >
        {navSegments.map((seg) => {
          const Icon = seg.icon;
          const selected = activeTab === seg.id;
          return (
            <ButtonBase
              key={seg.id}
              role="tab"
              aria-label={seg.ariaLabel}
              aria-selected={selected}
              aria-disabled={seg.disabled}
              disabled={seg.disabled}
              onClick={() => !seg.disabled && handleTabChange(seg.id)}
              sx={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                minWidth: 0,
                height: 28,
                px: { xs: 0.5, sm: 0.75 },
                borderRadius: '8px',
                color: selected ? 'text.primary' : 'text.secondary',
                bgcolor: selected ? alpha(theme.palette.background.paper, isDark ? 0.96 : 1) : 'transparent',
                boxShadow: selected
                  ? `0 0 0 1px ${alpha(theme.palette.text.primary, isDark ? 0.12 : 0.08)}, 0 1px 4px ${alpha(theme.palette.common.black, isDark ? 0.38 : 0.06)}`
                  : 'none',
                transition: theme.transitions.create(['background-color', 'color', 'box-shadow'], {
                  duration: 160,
                  easing: theme.transitions.easing.easeInOut,
                }),
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                },
                '&:hover': {
                  color: 'text.primary',
                  bgcolor: selected
                    ? theme.palette.background.paper
                    : alpha(theme.palette.text.primary, 0.055),
                },
                '&:focus-visible': {
                  outline: `2px solid ${alpha(theme.palette.text.secondary, 0.38)}`,
                  outlineOffset: 1,
                },
                '&.Mui-disabled': { opacity: 0.32 },
              }}
            >
              <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon sx={{ fontSize: 17 }} />
                {seg.id === 1 && results?.row_count != null && (
                  <Box
                    component="span"
                    sx={{
                      position: 'absolute',
                      top: -6,
                      right: -8,
                      minWidth: 15,
                      height: 15,
                      px: 0.25,
                      borderRadius: 999,
                      fontSize: 8,
                      fontWeight: 700,
                      lineHeight: '15px',
                      textAlign: 'center',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      boxShadow: `0 0 0 2px ${artifactChromeBg}`,
                    }}
                  >
                    {results.row_count > 99 ? '99+' : results.row_count}
                  </Box>
                )}
              </Box>
              <Typography
                component="span"
                noWrap
                sx={{
                  display: { xs: 'none', sm: 'inline' },
                  minWidth: 0,
                  ...theme.typography.uiCaptionXs,
                  fontWeight: selected ? 650 : 550,
                  lineHeight: 1,
                  color: 'inherit',
                }}
              >
                {seg.label}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      <Box
        sx={{
          display: { xs: 'none', sm: 'inline-flex' },
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.75,
          minWidth: 0,
          maxWidth: '42%',
          height: 32,
          px: 1,
          borderRadius: '9px',
          border: '1px solid',
          borderColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.065),
          bgcolor: alpha(theme.palette.text.primary, isDark ? 0.045 : 0.025),
          boxSizing: 'border-box',
        }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            flexShrink: 0,
            bgcolor: isConnected ? 'success.main' : 'text.disabled',
          }}
        />
        <Typography
          noWrap
          title={currentDatabase || undefined}
          sx={{
            minWidth: 0,
            ...theme.typography.uiCaptionXs,
            fontWeight: 500,
            lineHeight: 1,
            color: 'text.secondary',
          }}
        >
          {currentDatabase || (isConnected ? 'Connected' : 'Not connected')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, flexShrink: 0 }}>
        <Tooltip title={copied ? 'Copied' : 'Copy SQL'}>
          <span>
            <IconButton
              size="small"
              onClick={handleCopy}
              disabled={!query.trim()}
              aria-label="Copy SQL"
              sx={{
                ...getGhostIconButtonSx(theme, { size: 34, radius: '10px' }),
                color: copied ? 'success.main' : 'text.secondary',
                '&:hover': {
                  opacity: 1,
                  color: copied ? 'success.main' : 'text.primary',
                  bgcolor: headerActionHoverBg,
                },
                '&.Mui-disabled': { opacity: 0.36 },
              }}
            >
              {copied ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Copy options">
          <IconButton
            size="small"
            onClick={openCopyMenu}
            aria-label="More copy options"
            aria-haspopup="true"
            aria-expanded={Boolean(copyMenuAnchor)}
            sx={{
              ...getGhostIconButtonSx(theme, { size: 34, radius: '10px' }),
              '&:hover': {
                opacity: 1,
                bgcolor: headerActionHoverBg,
              },
            }}
          >
            <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Close panel">
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Close SQL editor"
            sx={{
              ...getGhostIconButtonSx(theme, { size: 34, radius: '10px' }),
              '&:hover': {
                opacity: 1,
                backgroundColor: headerActionHoverBg,
              },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Menu
        anchorEl={copyMenuAnchor}
        open={Boolean(copyMenuAnchor)}
        onClose={closeCopyMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              minWidth: 208,
              mt: 0.75,
              borderRadius: '12px',
              border: '1px solid',
              borderColor: artifactBorder,
              boxShadow: isDark
                ? `0 12px 40px ${alpha(theme.palette.common.black, 0.55)}`
                : `0 12px 40px ${alpha(theme.palette.common.black, 0.1)}, 0 2px 8px ${alpha(theme.palette.common.black, 0.04)}`,
              overflow: 'hidden',
            },
          },
        }}
      >
        <MenuItem
          onClick={handleCopyMenuSql}
          disabled={!query.trim()}
          sx={{ ...theme.typography.uiMenuItemSm, py: 1, borderRadius: '8px', mx: 0.5, my: 0.25 }}
        >
          Copy SQL
        </MenuItem>
        <MenuItem
          onClick={handleCopyCsv}
          disabled={!results?.columns?.length}
          sx={{ ...theme.typography.uiMenuItemSm, py: 1, borderRadius: '8px', mx: 0.5, mb: 0.5 }}
        >
          Copy results as CSV
        </MenuItem>
      </Menu>
    </Box>
  );

  const actionBarComponent = (
    <Box sx={actionBarStyles}>
      <Box sx={shortcutHintStyles} aria-hidden="true">
        {['Ctrl', 'Enter'].map((key) => (
          <Box key={key} component="kbd" sx={shortcutKeyStyles}>
            {key}
          </Box>
        ))}
      </Box>
      <Tooltip title="Clear query and results">
        <Button
          size="small"
          onClick={handleClear}
          sx={toolbarGhostStyles}
          startIcon={<HighlightOffSharpIcon sx={{ fontSize: 18 }} />}
        >
          Clear
        </Button>
      </Tooltip>
      <Tooltip title={activeTab !== 0 ? 'Switch to SQL tab to run' : (isRunning ? 'Running…' : 'Run query (Ctrl+Enter)')}>
        <span>
          <Button
            size="small"
            onClick={handleRunQuery}
            disabled={isRunning || !query.trim() || activeTab !== 0}
            sx={runButtonStyles}
            startIcon={
              isRunning
                ? <CircularProgress size={16} thickness={4} sx={{ color: 'inherit' }} />
                : <PlayCircleOutlineIcon sx={{ fontSize: 19 }} />
            }
            aria-label="Run query"
          >
            {isRunning ? 'Running' : 'Run'}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
  if (fullscreen) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100dvh',
          '@supports not (height: 100dvh)': {
            height: '100vh',
          },
          width: '100%',
          bgcolor: 'background.default',
        }}
      >
        {unifiedHeader}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {tabContent}
        </Box>
        {actionBarComponent}
      </Box>
    );
  }
  return (
    <Box component="section" aria-label="SQL editor panel" sx={panelSx}>
      {unifiedHeader}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {tabContent}
      </Box>
      {actionBarComponent}
    </Box>
  );
}

export default memo(SQLEditorCanvas);

