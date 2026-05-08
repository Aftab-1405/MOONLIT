/**
 * StatusBar - Bottom status bar with connection, actions, and editor info
 */

import { useState, useCallback, memo } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useTheme as useAppTheme } from '../../../../contexts/ThemeContext';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import AutoFixHighRounded from '@mui/icons-material/AutoFixHighRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { ButtonLoadingSpinner } from '../../../../components';
import { runQuery } from '../../../../api';

function StatusBar({ isConnected, currentDatabase, activeTab, onQueryExecute }) {
  const theme = useTheme();
  const { settings } = useAppTheme();
  const isDark = theme.palette.mode === 'dark';
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRunQuery = useCallback(async () => {
    if (!activeTab?.query?.trim() || isRunning || !isConnected) return;

    setIsRunning(true);

    try {
      const maxRows = settings.maxRows ?? 1000;
      const queryTimeout = settings.queryTimeout ?? 30;

      const data = await runQuery({
        sql: activeTab.query,
        maxRows,
        timeout: queryTimeout,
      });

      if (data.status === 'success') {
        const columns = data.result?.fields || [];
        const rows = data.result?.rows || [];

        const transformedResult = rows.map((row) => {
          const obj = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          return obj;
        });

        const results = {
          columns,
          result: transformedResult,
          row_count: data.row_count,
          total_rows: data.total_rows,
          truncated: data.truncated,
          execution_time: data.execution_time_ms
            ? data.execution_time_ms / 1000
            : null,
        };

        onQueryExecute(results, null);
      } else {
        onQueryExecute(null, data.message || 'Query execution failed');
      }
    } catch (err) {
      onQueryExecute(null, 'Failed to execute query: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  }, [activeTab, isConnected, isRunning, onQueryExecute, settings]);

  const handleFormatQuery = useCallback(() => {
    // TODO: Implement SQL formatting
    console.log('Format query');
  }, []);

  const handleCopyQuery = useCallback(() => {
    if (activeTab?.query) {
      navigator.clipboard.writeText(activeTab.query);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeTab]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        px: 1.5,
        py: 0.5,
        borderTop: '1px solid',
        borderColor: theme.palette.border.subtle,
        bgcolor: alpha(theme.palette.background.paper, isDark ? 0.8 : 0.9),
        flexShrink: 0,
        minHeight: 32,
      }}
    >
      {/* Left: Connection status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FiberManualRecordRoundedIcon
            sx={{
              fontSize: 8,
              color: isConnected ? 'success.main' : 'text.disabled',
            }}
          />
          <Typography
            sx={{
              ...theme.typography.uiCaptionXs,
              color: 'text.secondary',
            }}
          >
            {currentDatabase || (isConnected ? 'Connected' : 'Not connected')}
          </Typography>
        </Box>

        {activeTab?.results && (
          <Typography
            sx={{
              ...theme.typography.uiCaptionXs,
              color: 'text.disabled',
            }}
          >
            {activeTab.results.row_count} rows
          </Typography>
        )}
      </Box>

      {/* Center: Action buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip
          title={
            !isConnected
              ? 'Connect to database first'
              : isRunning
              ? 'Running...'
              : 'Run query (Ctrl+Enter)'
          }
        >
          <span>
            <IconButton
              size="small"
              onClick={handleRunQuery}
              disabled={isRunning || !activeTab?.query?.trim() || !isConnected}
              sx={{
                width: 28,
                height: 28,
                border: 'none',
              }}
            >
              {isRunning ? (
                <ButtonLoadingSpinner />
              ) : (
                <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Format SQL">
          <IconButton
            size="small"
            onClick={handleFormatQuery}
            disabled={!activeTab?.query?.trim()}
            sx={{ width: 28, height: 28, border: 'none' }}
          >
            <AutoFixHighRounded sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={copied ? "Copied!" : "Copy query"}>
          <IconButton
            size="small"
            onClick={handleCopyQuery}
            disabled={!activeTab?.query?.trim()}
            sx={{ 
              width: 28, 
              height: 28, 
              border: 'none',
              color: copied ? 'success.main' : 'inherit',
              '&:hover': copied ? {
                color: 'success.main',
                bgcolor: alpha(theme.palette.success.main, 0.08),
              } : undefined,
            }}
          >
            {copied ? (
              <CheckCircleRounded sx={{ fontSize: 16 }} />
            ) : (
              <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Right: Editor info */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, justifyContent: 'flex-end' }}>
        <Typography
          sx={{
            ...theme.typography.uiCaptionXs,
            color: 'text.disabled',
          }}
        >
          SQL
        </Typography>
      </Box>
    </Box>
  );
}

export default memo(StatusBar);
