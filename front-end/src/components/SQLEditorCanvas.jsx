import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Button,
  Tooltip,
  Chip,
  CircularProgress,
  Divider,
} from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import Editor from '@monaco-editor/react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import SQLResultsTable from './SQLResultsTable';

// Animations
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
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
  const editorRef = useRef(null);

  // Update query when initialQuery changes (e.g., from AI tool)
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Update results when initialResults changes
  useEffect(() => {
    if (initialResults) {
      setResults(initialResults);
      setError(null);
    }
  }, [initialResults]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    // Focus editor when mounted
    editor.focus();
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
        // Transform backend data to SQLResultsTable format
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
    editorRef.current?.focus();
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [query]);

  const handleKeyDown = useCallback((e) => {
    // Ctrl/Cmd + Enter to run query
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunQuery();
    }
  }, [handleRunQuery]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: isDark 
            ? theme.palette.background.paper
            : theme.palette.background.paper,
          borderLeft: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08),
          boxShadow: isDark 
            ? '-4px 0 24px rgba(0, 0, 0, 0.4)'
            : '-4px 0 24px rgba(0, 0, 0, 0.08)',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08),
          background: isDark 
            ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 100%)`
            : `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, transparent 100%)`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1),
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.3),
            }}
          >
            <CodeRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
              SQL Editor
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
              Write and execute queries
            </Typography>
          </Box>
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
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Database Status Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1,
          backgroundColor: isDark ? alpha('#fff', 0.02) : alpha('#000', 0.02),
          borderBottom: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.05),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentDatabase ? (
            <Chip
              size="small"
              icon={<StorageRoundedIcon sx={{ fontSize: 14 }} />}
              label={currentDatabase}
              color="success"
              variant="outlined"
              sx={{ 
                height: 26, 
                fontSize: '0.75rem',
                '& .MuiChip-icon': { ml: 0.5 },
              }}
            />
          ) : (
            <Chip
              size="small"
              label="Not connected"
              color="warning"
              variant="outlined"
              sx={{ height: 26, fontSize: '0.75rem' }}
            />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          Ctrl+Enter to run
        </Typography>
      </Box>

      {/* Editor Section */}
      <Box
        sx={{
          height: 200,
          borderBottom: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08),
          position: 'relative',
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
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            lineHeight: 20,
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

      {/* Action Bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          backgroundColor: isDark ? alpha('#fff', 0.02) : alpha('#000', 0.02),
          borderBottom: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.05),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title={isRunning ? 'Running...' : 'Run Query (Ctrl+Enter)'}>
            <span>
              <IconButton
                size="small"
                onClick={handleRunQuery}
                disabled={isRunning || !query.trim()}
                sx={{
                  color: isRunning ? 'text.secondary' : 'success.main',
                  '&:hover': { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  },
                  '&.Mui-disabled': {
                    color: 'text.disabled',
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
          <Tooltip title={copied ? 'Copied!' : 'Copy query'}>
            <span>
              <IconButton 
                size="small" 
                onClick={handleCopy} 
                disabled={!query.trim()}
                sx={{ 
                  color: copied ? 'success.main' : 'text.secondary',
                  '&:hover': { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  },
                  '&.Mui-disabled': {
                    color: 'text.disabled',
                  },
                }}
              >
                {copied ? (
                  <CheckRoundedIcon sx={{ fontSize: 20 }} />
                ) : (
                  <ContentCopyRoundedIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Clear editor">
            <IconButton 
              size="small" 
              onClick={handleClear} 
              sx={{ 
                color: 'text.secondary',
                '&:hover': { 
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                },
              }}
            >
              <DeleteOutlineRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </Box>
        {results && (
          <Chip 
            size="small" 
            label={`${results.row_count} rows`}
            sx={{ 
              height: 22, 
              fontSize: '0.7rem',
              backgroundColor: alpha(theme.palette.success.main, isDark ? 0.15 : 0.1),
              color: 'success.main',
            }}
          />
        )}
      </Box>

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

      {/* Results Section */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
        }}
      >
        {results ? (
          <SQLResultsTable 
            data={results} 
            onClose={() => setResults(null)} 
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: 200,
              color: 'text.secondary',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? alpha('#fff', 0.03) : alpha('#000', 0.03),
                border: '1px dashed',
                borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.1),
              }}
            >
              <CodeRoundedIcon sx={{ fontSize: 24, opacity: 0.4 }} />
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.6, textAlign: 'center' }}>
              Write a query and click Run
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.4 }}>
              Results will appear here
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

export default SQLEditorCanvas;
