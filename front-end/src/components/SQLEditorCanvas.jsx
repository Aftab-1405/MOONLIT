import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Tab,
  Tabs,
} from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import Editor from '@monaco-editor/react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import SQLResultsTable from './SQLResultsTable';
import ChartVisualization from './ChartVisualization';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const DRAWER_WIDTH = 520;

function SQLEditorCanvas({
  open,
  onClose,
  initialQuery = '',
  initialResults = null,
  isConnected = false,
  currentDatabase = null,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(initialResults);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0: Editor, 1: Results, 2: Chart
  const editorRef = useRef(null);

  // Update query when initialQuery changes (e.g., from AI tool)
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      setActiveTab(0); // Switch to editor tab
    }
  }, [initialQuery]);

  // Update results when initialResults changes
  useEffect(() => {
    if (initialResults) {
      setResults(initialResults);
      setError(null);
      setActiveTab(1); // Switch to results tab
    }
  }, [initialResults]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.focus();
    
    // Make Monaco editor background transparent for starfield visibility
    if (isDark) {
      monaco.editor.defineTheme('transparent-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#00000000', // Fully transparent
          'editor.lineHighlightBackground': '#ffffff08',
          'editorGutter.background': '#00000000',
        }
      });
      monaco.editor.setTheme('transparent-dark');
    }
  };

  const handleRunQuery = useCallback(async () => {
    if (!query.trim() || isRunning) return;
    
    if (!isConnected) {
      setError('Please connect to a database first');
      return;
    }

    setIsRunning(true);
    setError(null);
    
    try {
      const response = await fetch('/run_sql_query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql_query: query,
          max_rows: 1000,
          timeout: 30,
        }),
      });
      
      const data = await response.json();
      
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
        setActiveTab(1); // Auto-switch to results tab
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
  }, [query, isConnected, isRunning]);

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
    setTimeout(() => setCopied(false), 2000);
  }, [query]);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunQuery();
    }
  }, [handleRunQuery]);

  // Tab change handler
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 0: // Editor Tab
        return (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              // Transparent background for starfield
              backgroundColor: 'transparent',
            }}
          >
            {/* Error Display */}
            {error && (
              <Box
                sx={{
                  px: 2.5,
                  py: 1.5,
                  backgroundColor: alpha(theme.palette.error.main, isDark ? 0.15 : 0.08),
                  borderBottom: '1px solid',
                  borderColor: alpha(theme.palette.error.main, 0.3),
                  animation: `${fadeIn} 0.2s ease-out`,
                }}
              >
                <Typography 
                  variant="body2" 
                  color="error.main" 
                  sx={{ 
                    fontSize: '0.8rem',
                    fontFamily: 'monospace',
                  }}
                >
                  ⚠ {error}
                </Typography>
              </Box>
            )}
            
            {/* Full-height Editor with transparent background */}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                backgroundColor: 'transparent',
                '& .monaco-editor, & .monaco-editor-background, & .monaco-editor .margin': {
                  backgroundColor: 'transparent !important',
                },
              }}
              onKeyDown={handleKeyDown}
            >
              <Editor
                height="100%"
                language="sql"
                theme={isDark ? 'vs-dark' : 'light'}
                value={query}
                onChange={(value) => setQuery(value || '')}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  fontFamily: '"JetBrains Mono", "Fira Code", "Monaco", "Consolas", monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  wordWrap: 'on',
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: 'line',
                  lineHeight: 22,
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                  suggest: {
                    showKeywords: true,
                  },
                }}
              />
            </Box>
          </Box>
        );

      case 1: // Results Tab
        return (
          <Box sx={{ height: '100%', overflow: 'auto', backgroundColor: 'transparent' }}>
            {results ? (
              <SQLResultsTable 
                data={results} 
                onClose={() => setResults(null)} 
                embedded
              />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'text.secondary',
                  gap: 2,
                  animation: `${fadeIn} 0.3s ease-out`,
                }}
              >
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03),
                    border: '2px dashed',
                    borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.1),
                  }}
                >
                  <TableChartOutlinedIcon sx={{ fontSize: 32, opacity: 0.3 }} />
                </Box>
                <Typography variant="body1" sx={{ opacity: 0.6, fontWeight: 500 }}>
                  No results yet
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.4, textAlign: 'center', px: 4 }}>
                  Run a query to see results here
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 2: // Chart Tab
        return (
          <Box sx={{ height: '100%', overflow: 'auto', backgroundColor: 'transparent' }}>
            {results ? (
              <ChartVisualization 
                data={results} 
                embedded
              />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'text.secondary',
                  gap: 2,
                  animation: `${fadeIn} 0.3s ease-out`,
                }}
              >
                <Box
                  sx={{
                    width: 72,
                    height: 72,
                    borderRadius: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03),
                    border: '2px dashed',
                    borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.1),
                  }}
                >
                  <BarChartRoundedIcon sx={{ fontSize: 32, opacity: 0.3 }} />
                </Box>
                <Typography variant="body1" sx={{ opacity: 0.6, fontWeight: 500 }}>
                  No data to visualize
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.4, textAlign: 'center', px: 4 }}>
                  Run a query to create charts
                </Typography>
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      transitionDuration={300}
      sx={{
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          // Transparent background to see starfield - use very low opacity
          backgroundColor: isDark 
            ? alpha('#0A0A0A', 0.75)  // 75% opacity for starfield visibility
            : alpha('#FFFFFF', 0.92),
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderLeft: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08),
          boxShadow: isDark 
            ? '-8px 0 40px rgba(0, 0, 0, 0.6)'
            : '-8px 0 40px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Compact Header - Monochrome */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.06) : alpha('#000', 0.06),
          backgroundColor: 'transparent',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Modern SQL Editor Icon - Monochrome */}
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06),
              border: '1px solid',
              borderColor: isDark ? alpha('#fff', 0.12) : alpha('#000', 0.1),
            }}
          >
            <TerminalRoundedIcon sx={{ fontSize: 18, color: 'text.primary' }} />
          </Box>
          <Typography variant="subtitle2" fontWeight={600}>
            SQL Editor
          </Typography>
          {currentDatabase && (
            <Chip
              size="small"
              icon={<StorageRoundedIcon sx={{ fontSize: 12 }} />}
              label={currentDatabase}
              sx={{ 
                height: 22, 
                fontSize: '0.7rem',
                backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06),
                color: 'text.primary',
                '& .MuiChip-icon': { ml: 0.5, color: 'inherit' },
              }}
            />
          )}
        </Box>
        
        <Tooltip title="Close">
          <IconButton 
            size="small" 
            onClick={onClose}
            sx={{ 
              color: 'text.secondary',
              '&:hover': { 
                backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06),
              },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Centered Tab Bar - Monochrome */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          borderBottom: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.05),
          backgroundColor: 'transparent',
          flexShrink: 0,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          centered
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': {
              height: 2,
              borderRadius: '2px 2px 0 0',
              backgroundColor: isDark ? '#FFFFFF' : '#000000', // Monochrome
            },
            '& .MuiTab-root': {
              minHeight: 44,
              minWidth: 100,
              px: 2.5,
              py: 0,
              fontSize: '0.8rem',
              fontWeight: 500,
              textTransform: 'none',
              color: 'text.secondary',
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                color: 'text.primary', // Monochrome
              },
              '&:hover': {
                color: 'text.primary',
                backgroundColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.04),
              },
            },
          }}
        >
          <Tab 
            icon={<TerminalRoundedIcon sx={{ fontSize: 16 }} />} 
            iconPosition="start" 
            label="Editor"
          />
          <Tab 
            icon={<TableChartOutlinedIcon sx={{ fontSize: 16 }} />} 
            iconPosition="start" 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                Results
                {results && (
                  <Chip 
                    size="small" 
                    label={results.row_count}
                    sx={{ 
                      height: 18, 
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      backgroundColor: isDark ? alpha('#fff', 0.12) : alpha('#000', 0.08),
                      color: 'text.primary',
                    }}
                  />
                )}
              </Box>
            }
          />
          <Tab 
            icon={<BarChartRoundedIcon sx={{ fontSize: 16 }} />} 
            iconPosition="start" 
            label="Chart"
            disabled={!results}
          />
        </Tabs>
      </Box>

      {/* Tab Content - Full Height with transparent bg */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: 'transparent' }}>
        {renderTabContent()}
      </Box>

      {/* Centered Floating Action Bar - Monochrome */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderTop: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.06) : alpha('#000', 0.06),
          backgroundColor: isDark 
            ? alpha('#0A0A0A', 0.6)
            : alpha('#FFFFFF', 0.7),
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        {/* Run Button - Monochrome */}
        <Tooltip title={isRunning ? 'Running...' : 'Run Query (Ctrl+Enter)'}>
          <span>
            <IconButton
              size="small"
              onClick={handleRunQuery}
              disabled={isRunning || !query.trim()}
              sx={{
                width: 36,
                height: 36,
                color: isRunning ? 'text.secondary' : 'text.primary',
                backgroundColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.08),
                border: '1px solid',
                borderColor: isDark ? alpha('#fff', 0.15) : alpha('#000', 0.12),
                '&:hover': { 
                  backgroundColor: isDark ? alpha('#fff', 0.15) : alpha('#000', 0.12),
                },
                '&.Mui-disabled': {
                  color: 'text.disabled',
                  backgroundColor: 'transparent',
                  borderColor: 'transparent',
                },
              }}
            >
              {isRunning ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <PlayArrowRoundedIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>

        {/* Separator */}
        <Box sx={{ width: 1, height: 24, backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08), mx: 0.5 }} />

        {/* Copy Button */}
        <Tooltip title={copied ? 'Copied!' : 'Copy query'}>
          <span>
            <IconButton 
              size="small" 
              onClick={handleCopy} 
              disabled={!query.trim()}
              sx={{ 
                width: 36,
                height: 36,
                color: copied ? 'text.primary' : 'text.secondary',
                backgroundColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.04),
                '&:hover': { 
                  backgroundColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.08),
                },
                '&.Mui-disabled': {
                  color: 'text.disabled',
                },
              }}
            >
              {copied ? (
                <CheckRoundedIcon sx={{ fontSize: 18 }} />
              ) : (
                <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>

        {/* Clear Button */}
        <Tooltip title="Clear all">
          <IconButton 
            size="small" 
            onClick={handleClear} 
            sx={{ 
              width: 36,
              height: 36,
              color: 'text.secondary',
              backgroundColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.04),
              '&:hover': { 
                backgroundColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.08),
              },
            }}
          >
            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>

        {/* Separator */}
        <Box sx={{ width: 1, height: 24, backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08), mx: 0.5 }} />

        {/* Keyboard hint */}
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem', opacity: 0.7 }}>
          Ctrl+Enter
        </Typography>
      </Box>
    </Drawer>
  );
}

export default SQLEditorCanvas;
