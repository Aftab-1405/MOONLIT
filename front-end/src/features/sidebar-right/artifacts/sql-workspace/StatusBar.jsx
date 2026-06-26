/**
 * StatusBar - Bottom status bar with connection, actions, and editor info
 */

import { useState, useCallback, memo, useEffect } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import FiberManualRecordRoundedIcon from '@mui/icons-material/FiberManualRecordRounded';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import { ButtonLoadingSpinner } from '@/components';
import { runQuery } from '@/api';
import { copyToClipboard } from '@/utils/clipboard';
import { getArtifactActionButtonSx } from '@/features/sidebar-right/artifact-loader';
import {
  getAppBarSurfaceSx,
  getAppDividerColor,
} from '@/features/styles/interfaceChrome';

const STATUS_ACTION_SIZE = 30;

function getStatusTextSx(theme, color = 'text.secondary') {
  return {
    ...theme.typography.uiCaptionXs,
    color,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'clip',
    maskImage: 'linear-gradient(to right, black 82%, transparent 98%)',
    WebkitMaskImage: 'linear-gradient(to right, black 82%, transparent 98%)',
  };
}

function StatusBar({ isConnected, currentDatabase, activeTab, onQueryExecute, onRegisterRunQuery }) {
  const theme = useTheme();
  const { settings } = useAppTheme();
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRunQuery = useCallback(async () => {
    if (!activeTab?.query?.trim() || isRunning || !isConnected) return;

    setIsRunning(true);

    try {
      const maxRows = settings.maxRows ?? 1000;
      const queryTimeout = settings.queryTimeout ?? 30;

      const response = await runQuery({
        sql: activeTab.query,
        maxRows,
        timeout: queryTimeout,
      });

      if (response.status === 'success') {
        const queryData = response.data;
        const columns = queryData.result?.columns || [];
        const rows = queryData.result?.rows || [];

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
          row_count: queryData.row_count,
          total_rows: queryData.total_rows,
          truncated: queryData.truncated,
          execution_time: queryData.execution_time_ms
            ? queryData.execution_time_ms / 1000
            : null,
        };

        onQueryExecute(results, null);
      } else {
        onQueryExecute(null, response.message || 'Query execution failed');
      }
    } catch (err) {
      // Extract the most descriptive safe message available from the error.
      const message =
        err?.data?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to execute query';
      onQueryExecute(null, message);
    } finally {
      setIsRunning(false);
    }
  }, [activeTab, isConnected, isRunning, onQueryExecute, settings]);

  // Register this run function with the parent so MonacoEditorSurface's
  // Ctrl+Enter shortcut calls the exact same code path as clicking Run.
  useEffect(() => {
    onRegisterRunQuery?.(handleRunQuery);
  }, [handleRunQuery, onRegisterRunQuery]);

  const handleCopyQuery = useCallback(async () => {
    if (!activeTab?.query) return;
    const ok = await copyToClipboard(activeTab.query);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeTab]);

  const hasRunnableQuery = Boolean(activeTab?.query?.trim());
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        px: 1,
        py: 0.75,
        borderTop: '1px solid',
        borderColor: getAppDividerColor(theme),
        ...getAppBarSurfaceSx(theme),
        flexShrink: 0,
        minHeight: 46,
      }}
    >
      {/* Left: Connection status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          <FiberManualRecordRoundedIcon
            sx={{
              fontSize: 8,
              color: isConnected ? 'success.main' : 'text.secondary',
            }}
          />
          <Typography
            sx={getStatusTextSx(theme)}
          >
            {currentDatabase || (isConnected ? 'Connected' : 'Not connected')}
          </Typography>
        </Box>

        {activeTab?.results && (
          <Typography
            sx={{
              ...theme.typography.uiCaptionXs,
              color: 'text.secondary',
              flexShrink: 0,
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
              disabled={isRunning || !hasRunnableQuery || !isConnected}
              aria-label="Run query"
              sx={getArtifactActionButtonSx(theme, { size: STATUS_ACTION_SIZE })}
            >
              {isRunning ? (
                <ButtonLoadingSpinner />
              ) : (
                <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={copied ? "Copied!" : "Copy query"}>
          <IconButton
            size="small"
            onClick={handleCopyQuery}
            disabled={!hasRunnableQuery}
            aria-label={copied ? 'Copied' : 'Copy query'}
            sx={{
              ...getArtifactActionButtonSx(theme, { size: STATUS_ACTION_SIZE }),
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
        <Typography
          sx={{
            ...theme.typography.uiCaptionXs,
            color: 'text.secondary',
            flexShrink: 0,
          }}
        >
          SQL
        </Typography>
      </Box>
    </Box>
  );
}

export default memo(StatusBar);
