import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  InputAdornment,
  IconButton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DatasetOutlinedIcon from '@mui/icons-material/DatasetOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import CodeEditorIcon from '../../../../components/icons/CodeEditorIcon';
import { ArtifactEmptyState, ArtifactShell, getArtifactActionButtonSx } from '../../artifact-loader';
import { useSettings } from '../../../../contexts/SettingsContext';
import { getScrollbarStyles, UI_Z_INDEX } from '../../../../styles/shared';

const ROWS_PER_PAGE = 25;

function isNumericColumn(data, column) {
  if (!Array.isArray(data) || data.length === 0) return false;
  const sample = data.slice(0, 10);
  const numericCount = sample.filter((row) => typeof row?.[column] === 'number').length;
  return numericCount > sample.length * 0.7;
}

function ExecutionResultPanel({
  data,
  chrome = 'standalone',
  title = 'Query Results',
  onClose,
  onOpenArtifact,
  onRequestClose,
  onRequestOpenArtifact,
  isFullscreen = false,
  onEnterFullscreen,
  onExitFullscreen,
  onToggleFullscreen,
  sourceQuery,
  sourceType,
  workspaceContainerRef,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { settings } = useSettings();
  const nullDisplay = settings.nullDisplay ?? 'NULL';

  const [page, setPage] = useState(0);
  const [orderBy, setOrderBy] = useState('');
  const [order, setOrder] = useState('asc');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cellCopied, setCellCopied] = useState(null);
  const [hoveredColumn, setHoveredColumn] = useState(null);

  const copyTimeoutRef = useRef(null);
  const cellCopyTimeoutRef = useRef(null);
  const { columns = [], result = [], row_count = 0, execution_time, truncated } = data || {};
  const requestOpenArtifact = onRequestOpenArtifact || onOpenArtifact;

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    if (cellCopyTimeoutRef.current) clearTimeout(cellCopyTimeoutRef.current);
  }, []);

  const columnConfig = useMemo(() => {
    const config = {};
    columns.forEach((column) => {
      config[column] = {
        isNumeric: isNumericColumn(result, column),
        minWidth: isMobile ? 120 : 150,
      };
    });
    return config;
  }, [columns, isMobile, result]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase();
    return result.filter((row) =>
      columns.some((column) => {
        const value = row?.[column];
        return value != null && String(value).toLowerCase().includes(query);
      }),
    );
  }, [columns, result, searchQuery]);

  const sortedData = useMemo(() => {
    if (!orderBy) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a?.[orderBy];
      const bVal = b?.[orderBy];

      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return order === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, order, orderBy]);

  const visibleRowCount = searchQuery ? filteredData.length : row_count;
  const maxPage = Math.max(0, Math.ceil(visibleRowCount / ROWS_PER_PAGE) - 1);
  const currentPage = Math.min(page, maxPage);
  const pageStart = visibleRowCount ? currentPage * ROWS_PER_PAGE + 1 : 0;
  const pageEnd = visibleRowCount ? Math.min(currentPage * ROWS_PER_PAGE + ROWS_PER_PAGE, visibleRowCount) : 0;
  const canPageBack = currentPage > 0;
  const canPageForward = pageEnd < visibleRowCount;
  const paginatedData = sortedData.slice(
    currentPage * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE + ROWS_PER_PAGE,
  );

  const handleSort = useCallback((column) => {
    setOrder((prev) => (orderBy === column && prev === 'asc' ? 'desc' : 'asc'));
    setOrderBy(column);
  }, [orderBy]);

  const generateCSV = useCallback(() => {
    if (!columns.length || !result.length) return '';
    const header = columns.join(',');
    const rows = result.map((row) =>
      columns.map((column) => {
        const value = row?.[column];
        if (value == null) return '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(','),
    );

    return [header, ...rows].join('\n');
  }, [columns, result]);

  const handleCopyAsCSV = useCallback(() => {
    const csv = generateCSV();
    if (!csv) return;
    navigator.clipboard.writeText(csv);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [generateCSV]);

  const handleDownloadCSV = useCallback(() => {
    const csv = generateCSV();
    if (!csv) return;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `query_results_${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [generateCSV]);

  const handleCellClick = useCallback((value, rowIndex, colIndex) => {
    navigator.clipboard.writeText(value == null ? '' : String(value));
    setCellCopied(`${rowIndex}-${colIndex}`);
    if (cellCopyTimeoutRef.current) clearTimeout(cellCopyTimeoutRef.current);
    cellCopyTimeoutRef.current = setTimeout(() => setCellCopied(null), 1500);
  }, []);

  const openEditor = useCallback(() => {
    requestOpenArtifact?.({
      type: 'sql-editor',
      title: 'SQL Editor',
      props: { initialQuery: sourceQuery, initialResults: data },
    }, { preserveFullscreen: isFullscreen });
  }, [data, isFullscreen, requestOpenArtifact, sourceQuery]);

  const openChart = useCallback(() => {
    requestOpenArtifact?.({
      type: 'visualization',
      title: 'Data Visualization',
      props: { data, sourceQuery, sourceType },
    }, { preserveFullscreen: isFullscreen });
  }, [data, isFullscreen, requestOpenArtifact, sourceQuery, sourceType]);

  if (!data || !columns.length) {
    return (
      <ArtifactEmptyState
        icon={<DatasetOutlinedIcon sx={{ fontSize: 48 }} />}
        title="No results to display"
      />
    );
  }

  const controls = (
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: '6px',
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08),
            border: '1px solid',
            borderColor: alpha(theme.palette.primary.main, isDark ? 0.25 : 0.15),
          }}
        >
          <Typography sx={{ ...theme.typography.uiCaptionSm, fontWeight: 600, color: 'primary.main' }}>
            {visibleRowCount} rows
          </Typography>
        </Box>
        {execution_time != null ? (
          <Box
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: '6px',
              bgcolor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
              border: '1px solid',
              borderColor: theme.palette.border.subtle,
            }}
          >
            <TimerOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography sx={{ ...theme.typography.uiCaptionSm, color: 'text.secondary' }}>
              {execution_time.toFixed(2)}s
            </Typography>
          </Box>
        ) : null}
        {truncated ? (
          <Box
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              alignItems: 'center',
              px: 1,
              py: 0.5,
              borderRadius: '6px',
              bgcolor: alpha(theme.palette.warning.main, isDark ? 0.15 : 0.08),
              border: '1px solid',
              borderColor: alpha(theme.palette.warning.main, isDark ? 0.25 : 0.15),
            }}
          >
            <Typography sx={{ ...theme.typography.uiCaptionSm, fontWeight: 600, color: 'warning.main' }}>
              Truncated
            </Typography>
          </Box>
        ) : null}
      </Stack>

      <TextField
        size="small"
        placeholder="Search..."
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setPage(0);
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            </InputAdornment>
          ),
        }}
        sx={{
          minWidth: isMobile ? '100%' : 240,
          maxWidth: isMobile ? '100%' : 360,
          '& .MuiOutlinedInput-root': {
            height: 36,
            ...theme.typography.uiCaptionMd,
            bgcolor: alpha(theme.palette.text.primary, isDark ? 0.04 : 0.02),
            '& fieldset': { borderColor: theme.palette.border.subtle },
            '&:hover fieldset': { borderColor: theme.palette.border.default },
          },
        }}
      />
    </Stack>
  );

  const footer = (
    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
      <Typography
        sx={{
          ...theme.typography.uiCaptionMd,
          color: 'text.secondary',
          display: { xs: 'none', sm: 'block' },
        }}
      >
        {pageStart}-{pageEnd} of {visibleRowCount}
      </Typography>
      <Stack direction="row" alignItems="center" gap={0.5} ml="auto">
        <Tooltip title="Previous page">
          <span>
            <IconButton
              size="small"
              aria-label="Previous page"
              onClick={() => setPage(currentPage - 1)}
              disabled={!canPageBack}
              sx={getArtifactActionButtonSx(theme, { size: 32 })}
            >
              <KeyboardArrowLeftRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Next page">
          <span>
            <IconButton
              size="small"
              aria-label="Next page"
              onClick={() => setPage(currentPage + 1)}
              disabled={!canPageForward}
              sx={getArtifactActionButtonSx(theme, { size: 32 })}
            >
              <KeyboardArrowRightRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  );

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <ArtifactShell
        title={title}
        icon={<TableRowsRoundedIcon sx={{ fontSize: 20 }} />}
        chrome={chrome}
        onClose={onClose}
        onRequestClose={onRequestClose}
        onOpenArtifact={onOpenArtifact}
        isFullscreen={isFullscreen}
        onEnterFullscreen={onEnterFullscreen}
        onExitFullscreen={onExitFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        workspaceContainerRef={workspaceContainerRef}
        controls={controls}
        footer={footer}
        actions={[
          sourceQuery && sourceType === 'sql-editor' && requestOpenArtifact
            ? {
                key: 'editor',
                label: 'Back to editor',
                icon: <CodeEditorIcon sx={{ width: 18, height: 18 }} />,
                onClick: openEditor,
              }
            : null,
          {
            key: 'copy',
            label: copied ? 'Copied!' : 'Copy as CSV',
            icon: copied ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />,
            onClick: handleCopyAsCSV,
          },
          {
            key: 'download',
            label: 'Download CSV',
            icon: <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />,
            onClick: handleDownloadCSV,
          },
          requestOpenArtifact
            ? {
                key: 'chart',
                label: 'Open as chart',
                icon: <BarChartRoundedIcon sx={{ fontSize: 18 }} />,
                onClick: openChart,
              }
            : null,
        ]}
      >
        <TableContainer
          sx={{
            position: 'relative',
            zIndex: 0,
            isolation: 'isolate',
            height: '100%',
            minHeight: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            ...getScrollbarStyles(theme),
          }}
        >
          <Table stickyHeader sx={{ minWidth: isMobile ? 'max-content' : '100%' }}>
            <TableHead>
              <TableRow>
                {columns.map((column) => {
                  const config = columnConfig[column];
                  const isActive = orderBy === column;
                  const isHovered = hoveredColumn === column;
                  const showSortIcon = isActive || isHovered;

                  return (
                    <TableCell
                      key={column}
                      onMouseEnter={() => setHoveredColumn(column)}
                      onMouseLeave={() => setHoveredColumn(null)}
                      sx={{
                        minWidth: config.minWidth,
                        px: 2,
                        py: 1.5,
                        bgcolor: alpha(theme.palette.text.primary, isDark ? 0.03 : 0.02),
                        borderBottom: '2px solid',
                        borderColor: theme.palette.border.subtle,
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        cursor: 'pointer',
                        zIndex: UI_Z_INDEX.artifactStickyHeader,
                      }}
                    >
                      <TableSortLabel
                        active={isActive}
                        direction={isActive ? order : 'asc'}
                        onClick={() => handleSort(column)}
                        hideSortIcon={!showSortIcon}
                        sx={{
                          ...theme.typography.uiCaptionMd,
                          fontWeight: 650,
                          textTransform: 'none',
                          letterSpacing: 0,
                          color: isActive ? 'text.primary' : 'text.secondary',
                          '&:hover': { color: 'text.primary' },
                          '& .MuiTableSortLabel-icon': {
                            fontSize: 16,
                            ml: 0.5,
                            opacity: isActive ? 1 : 0.5,
                          },
                        }}
                      >
                        {column}
                      </TableSortLabel>
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((row, rowIndex) => (
                <TableRow
                  key={`${currentPage}-${rowIndex}`}
                  sx={{
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.text.primary, isDark ? 0.04 : 0.03),
                    },
                  }}
                >
                  {columns.map((column, colIndex) => {
                    const cellKey = `${rowIndex}-${colIndex}`;
                    const isCellCopied = cellCopied === cellKey;
                    const config = columnConfig[column];
                    const value = row?.[column];

                    return (
                      <TableCell
                        key={column}
                        onClick={() => handleCellClick(value, rowIndex, colIndex)}
                        align={config.isNumeric ? 'right' : 'left'}
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderBottom: '1px solid',
                          borderColor: theme.palette.border.subtle,
                          cursor: 'pointer',
                          bgcolor: isCellCopied ? alpha(theme.palette.success.main, 0.12) : 'transparent',
                          '&:hover': {
                            bgcolor: isCellCopied
                              ? alpha(theme.palette.success.main, 0.16)
                              : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                          },
                        }}
                      >
                        {value == null ? (
                          <Typography
                            component="span"
                            sx={{
                              ...theme.typography.uiCaptionSm,
                              color: 'text.disabled',
                              fontStyle: 'italic',
                              bgcolor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                              px: 0.75,
                              py: 0.25,
                              borderRadius: '4px',
                            }}
                          >
                            {nullDisplay}
                          </Typography>
                        ) : typeof value === 'number' ? (
                          <Typography
                            component="span"
                            sx={{
                              ...theme.typography.uiBodySm,
                              fontVariantNumeric: 'tabular-nums',
                              color: 'text.primary',
                            }}
                          >
                            {value.toLocaleString()}
                          </Typography>
                        ) : (
                          <Typography
                            component="span"
                            sx={{
                              ...theme.typography.uiBodySm,
                              color: 'text.primary',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {String(value)}
                          </Typography>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ArtifactShell>
      <Snackbar
        open={!!cellCopied}
        message="Cell copied!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            minWidth: 'auto',
            py: 0.75,
            px: 2,
            backgroundColor: isDark ? theme.palette.background.elevated : theme.palette.text.primary,
            color: isDark ? 'text.primary' : theme.palette.background.paper,
            borderRadius: '8px',
          },
        }}
      />
    </Box>
  );
}

export default memo(ExecutionResultPanel);
