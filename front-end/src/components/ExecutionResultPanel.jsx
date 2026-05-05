import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  TextField,
  InputAdornment,
  Snackbar,
  useMediaQuery,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSettings } from '../contexts/SettingsContext';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import KeyboardArrowLeftRoundedIcon from '@mui/icons-material/KeyboardArrowLeftRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import {
  ArtifactActions,
  ArtifactBody,
  ArtifactCommandBar,
  ArtifactIconButton,
  ArtifactSurface,
  ArtifactToolbar,
} from './ArtifactLayout';
import { getToolbarChipSx, getScrollbarStyles } from '../styles/shared';

function ExecutionResultPanel({ data, chrome = 'standalone', onControlsChange }) {
  const [page, setPage] = useState(0);
  const [orderBy, setOrderBy] = useState('');
  const [order, setOrder] = useState('asc');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cellCopied, setCellCopied] = useState(null); // Track which cell was copied
  const [columnWidthOverrides, setColumnWidths] = useState({});
  const [resizing, setResizing] = useState(null);

  const copyTimeoutRef = useRef(null);
  const cellCopyTimeoutRef = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const { settings } = useSettings();
  const nullDisplay = settings.nullDisplay ?? 'NULL';

  const { columns = [], result = [], row_count = 0, execution_time, truncated } = data || {};
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (cellCopyTimeoutRef.current) clearTimeout(cellCopyTimeoutRef.current);
    };
  }, []);
  const columnWidths = useMemo(() => {
    const widths = {};
    columns.forEach(col => {
      widths[col] = columnWidthOverrides[col] || (isCompactMobile ? 120 : 150);
    });
    return widths;
  }, [columns, columnWidthOverrides, isCompactMobile]);
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase();
    return result.filter(row =>
      columns.some(col => {
        const val = row[col];
        if (val === null) return false;
        return String(val).toLowerCase().includes(query);
      })
    );
  }, [result, columns, searchQuery]);
  const sortedData = useMemo(() => {
    if (!orderBy) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[orderBy];
      const bVal = b[orderBy];

      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return order === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [filteredData, orderBy, order]);

  const handleSort = useCallback((column) => {
    setOrder(prev => orderBy === column && prev === 'asc' ? 'desc' : 'asc');
    setOrderBy(column);
  }, [orderBy]);

  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);
  const generateCSV = useCallback(() => {
    if (!columns.length || !result.length) return '';

    const header = columns.join(',');
    const rows = result.map((row) =>
      columns.map((col) => {
        const val = row[col];
        if (val === null) return '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
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
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [generateCSV]);
  const handleCellClick = useCallback((value, rowIndex, colIndex) => {
    const textValue = value === null ? '' : String(value);
    navigator.clipboard.writeText(textValue);
    setCellCopied(`${rowIndex}-${colIndex}`);
    if (cellCopyTimeoutRef.current) clearTimeout(cellCopyTimeoutRef.current);
    cellCopyTimeoutRef.current = setTimeout(() => setCellCopied(null), 1500);
  }, []);
  const handleResizeStart = useCallback((e, column) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(column);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[column] || 150;
  }, [columnWidths]);

  const handleResizeMove = useCallback((e) => {
    if (!resizing) return;
    const diff = e.clientX - resizeStartX.current;
    const newWidth = Math.max(80, Math.min(500, resizeStartWidth.current + diff));
    setColumnWidths(prev => ({ ...prev, [resizing]: newWidth }));
  }, [resizing]);

  const handleResizeEnd = useCallback(() => {
    setResizing(null);
  }, []);
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [resizing, handleResizeMove, handleResizeEnd]);
  const visibleRowCount = searchQuery ? filteredData.length : row_count;
  const rowsPerPage = 25;
  const maxPage = Math.max(0, Math.ceil(visibleRowCount / rowsPerPage) - 1);
  const currentPage = Math.min(page, maxPage);
  const paginatedData = sortedData.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage
  );
  const pageStart = visibleRowCount ? currentPage * rowsPerPage + 1 : 0;
  const pageEnd = visibleRowCount ? Math.min(currentPage * rowsPerPage + rowsPerPage, visibleRowCount) : 0;
  const canPageBack = currentPage > 0;
  const canPageForward = pageEnd < visibleRowCount;
  const headerCellBaseSx = useMemo(() => ({
    minWidth: isCompactMobile ? 68 : 80,
    maxWidth: 500,
    backgroundColor: theme.palette.background.paper,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: isCompactMobile
      ? theme.typography.uiCaptionXs.fontSize.xs
      : theme.typography.caption.fontSize,
    color: 'text.secondary',
    whiteSpace: 'nowrap',
    borderBottom: '2px solid',
    borderColor: theme.palette.border.subtle,
    position: 'relative',
    userSelect: 'none',
  }), [isCompactMobile, theme]);
  const sortLabelSx = useMemo(() => ({
    '&.Mui-active': { color: 'text.primary' },
    '& .MuiTableSortLabel-icon': { fontSize: 16 },
  }), []);
  const resizeHandleBaseSx = useMemo(() => ({
    display: isCompactMobile ? 'none' : 'block',
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 6,
    cursor: 'col-resize',
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  }), [isCompactMobile, theme.palette.action.selected]);
  const rowSx = useMemo(() => ({
    '&:nth-of-type(even)': {
      backgroundColor: theme.palette.action.disabledBackground,
    },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
    transition: 'background-color 0.15s ease',
  }), [theme.palette.action.disabledBackground, theme.palette.action.hover]);
  const bodyCellBaseSx = useMemo(() => ({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    py: isCompactMobile ? 0.75 : 1,
    px: isCompactMobile ? 1 : 1.5,
    fontFamily: theme.typography.fontFamily,
    fontSize: isCompactMobile
      ? theme.typography.uiBodyTable.fontSize.xs
      : theme.typography.body2.fontSize,
    borderColor: theme.palette.border.subtle,
    cursor: 'pointer',
    transition: 'background-color 0.1s ease',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  }), [
    isCompactMobile,
    theme.palette.action.hover,
    theme.palette.border.subtle,
    theme.typography.body2.fontSize,
    theme.typography.fontFamily,
    theme.typography.uiBodyTable.fontSize.xs,
  ]);
  const nullValueSx = useMemo(() => ({
    color: 'text.disabled',
    fontStyle: 'italic',
    backgroundColor: theme.palette.action.disabledBackground,
    px: 0.75,
    py: 0.25,
    borderRadius: 0.5,
  }), [theme.palette.action.disabledBackground]);

  const panelMeta = useMemo(() => (
    <>
      <Chip
        size="small"
        label={`${visibleRowCount} rows`}
        sx={getToolbarChipSx(theme, { interactive: false })}
      />
      {execution_time != null && (
        <Chip
          size="small"
          icon={<TimerOutlinedIcon />}
          label={`${execution_time.toFixed(2)}s`}
          sx={{
            ...getToolbarChipSx(theme, { interactive: false }),
            display: { xs: 'none', lg: 'inline-flex' },
          }}
        />
      )}
      {truncated && (
        <Chip
          size="small"
          label="Truncated"
          sx={{
            ...getToolbarChipSx(theme, { interactive: false }),
            display: { xs: 'none', lg: 'inline-flex' },
          }}
        />
      )}
    </>
  ), [execution_time, theme, truncated, visibleRowCount]);
  const panelSearch = useMemo(() => (
    <TextField
      size="small"
      placeholder="Search..."
      value={searchQuery}
      onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </InputAdornment>
        ),
      }}
      sx={{
        width: { sm: 150, md: 190 },
        '& .MuiOutlinedInput-root': {
          height: 32,
          ...theme.typography.uiCaptionMd,
          bgcolor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
          '& fieldset': { borderColor: theme.palette.border.subtle },
        },
      }}
    />
  ), [isDark, searchQuery, theme]);
  const exportActions = useMemo(() => (
    <ArtifactActions>
      <ArtifactIconButton
        title={copied ? 'Copied!' : 'Copy as CSV'}
        ariaLabel="Copy as CSV"
        onClick={handleCopyAsCSV}
        active={copied}
      >
        {copied ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />}
      </ArtifactIconButton>
      <ArtifactIconButton
        title="Download CSV"
        ariaLabel="Download CSV"
        onClick={handleDownloadCSV}
      >
        <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
      </ArtifactIconButton>
    </ArtifactActions>
  ), [copied, handleCopyAsCSV, handleDownloadCSV]);
  const paginationControls = useMemo(() => (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        minWidth: 0,
      }}
    >
      <Typography
        noWrap
        sx={{
          display: { xs: 'none', sm: 'block' },
          color: 'text.secondary',
          ...theme.typography.uiCaptionMd,
        }}
      >
        {pageStart}-{pageEnd} of {visibleRowCount}
      </Typography>
      <ArtifactIconButton
        title="Previous page"
        ariaLabel="Previous page"
        onClick={(event) => handleChangePage(event, currentPage - 1)}
        disabled={!canPageBack}
        size={32}
        radius="9px"
      >
        <KeyboardArrowLeftRoundedIcon sx={{ fontSize: 18 }} />
      </ArtifactIconButton>
      <ArtifactIconButton
        title="Next page"
        ariaLabel="Next page"
        onClick={(event) => handleChangePage(event, currentPage + 1)}
        disabled={!canPageForward}
        size={32}
        radius="9px"
      >
        <KeyboardArrowRightRoundedIcon sx={{ fontSize: 18 }} />
      </ArtifactIconButton>
    </Box>
  ), [
    canPageBack,
    canPageForward,
    currentPage,
    handleChangePage,
    pageEnd,
    pageStart,
    theme,
    visibleRowCount,
  ]);
  const panelToolbar = (
    <ArtifactToolbar
      leading={panelMeta}
      center={panelSearch}
      trailing={exportActions}
      leadingSx={{ flexWrap: 'nowrap' }}
      centerSx={{ display: { xs: 'none', sm: 'flex' } }}
    />
  );
  const containedControls = useMemo(() => ({
    trailing: paginationControls,
  }), [paginationControls]);

  useEffect(() => {
    if (chrome !== 'contained') return;
    onControlsChange?.(containedControls);
  }, [chrome, containedControls, onControlsChange]);

  useEffect(() => {
    if (chrome !== 'contained') return undefined;
    return () => onControlsChange?.(null);
  }, [chrome, onControlsChange]);

  if (!data || !columns.length) {
    return null;
  }

  const tableBody = (
      <ArtifactBody
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          px: 0,
          pt: 0,
          pb: 0,
          '&::before, &::after': isCompactMobile ? {
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 10,
            zIndex: 2,
            pointerEvents: 'none',
          } : {},
          '&::before': isCompactMobile ? {
            left: 0,
            background: `linear-gradient(to right, ${alpha(theme.palette.background.paper, 0.95)}, transparent)`,
          } : {},
          '&::after': isCompactMobile ? {
            right: 0,
            background: `linear-gradient(to left, ${alpha(theme.palette.background.paper, 0.95)}, transparent)`,
          } : {},
        }}
      >
        <TableContainer
          sx={{
            height: '100%',
            cursor: resizing ? 'col-resize' : 'default',
            overflowX: 'auto',
            overflowY: 'auto',
            ...getScrollbarStyles(theme),
          }}
        >
          <Table
            stickyHeader
            size="small"
            sx={{
              tableLayout: isCompactMobile ? 'auto' : 'fixed',
              minWidth: isCompactMobile ? 'max-content' : '100%',
            }}
          >
            <TableHead>
              <TableRow>
                {columns.map((column, idx) => (
                  <TableCell
                    key={column}
                    sx={[
                      headerCellBaseSx,
                      { width: columnWidths[column] || 150 },
                      idx === 0 ? { pl: isCompactMobile ? 1.2 : 2 } : null,
                    ]}
                  >
                    <TableSortLabel
                      active={orderBy === column}
                      direction={orderBy === column ? order : 'asc'}
                      onClick={() => handleSort(column)}
                      sx={sortLabelSx}
                    >
                      {column}
                    </TableSortLabel>
                    <Box
                      onMouseDown={(e) => handleResizeStart(e, column)}
                      sx={[
                        resizeHandleBaseSx,
                        resizing === column ? { backgroundColor: alpha(theme.palette.text.secondary, 0.35) } : null,
                      ]}
                    />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedData.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  sx={rowSx}
                >
                  {columns.map((column, colIndex) => {
                    const cellKey = `${rowIndex}-${colIndex}`;
                    const isCopied = cellCopied === cellKey;

                    return (
                      <TableCell
                        key={column}
                        onClick={() => handleCellClick(row[column], rowIndex, colIndex)}
                        sx={[
                          bodyCellBaseSx,
                          { width: columnWidths[column] || 150 },
                          isCopied ? { backgroundColor: theme.palette.action.selected } : null,
                          colIndex === 0 ? { pl: isCompactMobile ? 1.2 : 2 } : null,
                        ]}
                      >
                        {row[column] === null ? (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={nullValueSx}
                          >
                            {nullDisplay || 'NULL'}
                          </Typography>
                        ) : typeof row[column] === 'number' ? (
                          <Typography
                            component="span"
                            sx={{
                              fontFamily: 'inherit',
                              color: 'text.primary',
                            }}
                          >
                            {row[column].toLocaleString()}
                          </Typography>
                        ) : (
                          String(row[column])
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </ArtifactBody>
  );
  const cellCopySnackbar = (
    <Snackbar
      open={!!cellCopied}
      message="Cell copied!"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{
        '& .MuiSnackbarContent-root': {
          minWidth: 'auto',
          width: 'fit-content',
          py: 0.5,
          px: 2,
          backgroundColor: isDark ? theme.palette.background.elevated : theme.palette.text.primary,
          color: isDark ? 'text.primary' : theme.palette.background.paper,
        },
        '& .MuiSnackbarContent-message': {
          flexGrow: 0,
        }
      }}
    />
  );

  if (chrome === 'contained') {
    return (
      <>
        {panelToolbar}
        {tableBody}
        {cellCopySnackbar}
      </>
    );
  }

  return (
    <ArtifactSurface key="table" sx={{ alignSelf: 'stretch', height: '100%', minHeight: 0 }}>
      {panelToolbar}
      {tableBody}
      <ArtifactCommandBar
        trailing={paginationControls}
      />
      {cellCopySnackbar}
    </ArtifactSurface>
  );
}

export default memo(ExecutionResultPanel);
