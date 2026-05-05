import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import {
  Box,
  Typography,
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
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import HighlightOffSharpIcon from '@mui/icons-material/HighlightOffSharp';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExecutionResultPanel from './ExecutionResultPanel';
import DataVisualizationPanel from './DataVisualizationPanel';
import {
  ArtifactActions,
  ArtifactBody,
  ArtifactCommandBar,
  ArtifactEmptyState,
  ArtifactIconButton,
  ArtifactSurface,
} from './ArtifactLayout';
import { registerMonacoThemes, getMonacoThemeName } from '../theme';
import { TRANSITIONS } from '../styles/themeEffects';
import { runQuery } from '../api';

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

function MonacoEditor({
  initialQuery = '',
  initialResults = null,
  isConnected = false,
  currentDatabase = null,
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
  const [resultControls, setResultControls] = useState(null);
  const [chartControls, setChartControls] = useState(null);
  const editorRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const handleRunQueryRef = useRef(null);
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

  const handleResultControlsChange = useCallback((controls) => {
    setResultControls(controls);
  }, []);

  const handleChartControlsChange = useCallback((controls) => {
    setChartControls(controls);
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

  const runButtonStyles = useMemo(() => ({
    minWidth: 0,
    height: 32,
    px: 1.2,
    borderRadius: '9px',
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
        <ExecutionResultPanel
          data={results}
          chrome="contained"
          onControlsChange={handleResultControlsChange}
        />
      ) : (
        <Box sx={centeredEmptyWrapStyles}>
          <ArtifactEmptyState
            icon={DatasetOutlinedIcon}
            title="Awaiting results"
            subtitle={null}
          />
        </Box>
      )}
    </Box>
  ), [
    artifactTabPaneStyles,
    centeredEmptyWrapStyles,
    handleResultControlsChange,
    results,
  ]);

  const chartTabContent = useMemo(() => (
    <Box sx={artifactTabPaneStyles}>
      {results ? (
        <DataVisualizationPanel
          data={results}
          chrome="contained"
          onControlsChange={handleChartControlsChange}
        />
      ) : (
        <Box sx={centeredEmptyWrapStyles}>
          <ArtifactEmptyState
            icon={BarChartRoundedIcon}
            title="Awaiting data"
            subtitle={null}
            hint={
              <Typography variant="caption" sx={{ fontFamily: 'inherit', color: 'text.disabled', ...theme.typography.uiCaptionXs, letterSpacing: '0.02em' }}>
                Results required
              </Typography>
            }
          />
        </Box>
      )}
    </Box>
  ), [
    artifactTabPaneStyles,
    centeredEmptyWrapStyles,
    handleChartControlsChange,
    results,
    theme.typography.uiCaptionXs,
  ]);
  const tabContent = activeTab === 0 ? editorTabContent : activeTab === 1 ? resultsTabContent : chartTabContent;

  const navSegments = useMemo(() => [
    { id: 0, label: 'Editor', ariaLabel: 'SQL editor', icon: CodeRoundedIcon, disabled: false },
    { id: 1, label: 'Results', ariaLabel: 'Query results', icon: DatasetOutlinedIcon, disabled: false },
    { id: 2, label: 'Chart', ariaLabel: 'Chart', icon: BarChartRoundedIcon, disabled: !results },
  ], [results]);

  const sqlTabs = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        overflow: 'hidden',
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
          p: 0.5,
          width: 112,
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
            <Tooltip key={seg.id} title={seg.label}>
              <Box
                component="span"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 0,
                  height: '100%',
                  lineHeight: 0,
                }}
              >
                <ButtonBase
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
                    minWidth: 0,
                    width: '100%',
                    height: 24,
                    borderRadius: '7px',
                    lineHeight: 0,
                    color: selected ? 'text.primary' : 'text.secondary',
                    bgcolor: selected ? alpha(theme.palette.background.paper, isDark ? 0.96 : 1) : 'transparent',
                    boxShadow: selected
                      ? `inset 0 0 0 1px ${alpha(theme.palette.text.primary, isDark ? 0.12 : 0.08)}`
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
                  <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, height: 18, lineHeight: 0 }}>
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
                </ButtonBase>
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );

  const connectionStatus = (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        minWidth: 0,
        maxWidth: 220,
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
  );

  const sqlActions = (
    <>
      <ArtifactActions sx={{ display: { xs: 'none', sm: 'flex' } }}>
        <ArtifactIconButton
          title={copied ? 'Copied' : 'Copy options'}
          ariaLabel="Copy options"
          onClick={openCopyMenu}
          active={copied}
          disabled={!query.trim() && !results?.columns?.length}
          size={32}
          radius="9px"
          buttonProps={{
            'aria-haspopup': 'true',
            'aria-expanded': Boolean(copyMenuAnchor),
          }}
        >
          {copied ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />}
        </ArtifactIconButton>
      </ArtifactActions>
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
      <ArtifactIconButton
        title="Clear query and results"
        ariaLabel="Clear query and results"
        onClick={handleClear}
        size={32}
        radius="9px"
      >
        <HighlightOffSharpIcon sx={{ fontSize: 18 }} />
      </ArtifactIconButton>
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
    </>
  );

  const footerCenter = activeTab === 1
    ? null
    : activeTab === 2
      ? null
      : connectionStatus;
  const footerTrailing = activeTab === 1
    ? resultControls?.trailing
    : activeTab === 2
      ? chartControls?.trailing
      : sqlActions;
  const footerCenterSx = activeTab === 1
    ? {}
    : activeTab === 2
      ? {}
      : { display: { xs: 'none', md: 'flex' }, flex: '0 1 220px' };

  const actionBarComponent = (
    <ArtifactCommandBar
      leading={sqlTabs}
      center={footerCenter}
      trailing={footerTrailing}
      centerSx={footerCenterSx}
    />
  );
  return (
    <ArtifactSurface
      component="section"
      aria-label="SQL editor"
      sx={{
        height: '100%',
        minHeight: 0,
        width: '100%',
        whiteSpace: 'nowrap',
      }}
    >
      <ArtifactBody>
        {tabContent}
      </ArtifactBody>
      {actionBarComponent}
    </ArtifactSurface>
  );
}

export default memo(MonacoEditor);

