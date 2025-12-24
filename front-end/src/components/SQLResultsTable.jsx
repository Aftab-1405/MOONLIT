import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  IconButton,
  Tooltip,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import DataArrayRoundedIcon from '@mui/icons-material/DataArrayRounded';
import ChartVisualization from './ChartVisualization';

function SQLResultsTable({ data, onClose, embedded = false }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState('');
  const [order, setOrder] = useState('asc');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const storedSettings = JSON.parse(localStorage.getItem('db-genie-settings') || '{}');
  const nullDisplay = storedSettings.nullDisplay ?? 'NULL';

  const { columns = [], result = [], row_count = 0, execution_time, truncated } = data || {};
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  // Sorting logic
  const sortedData = useMemo(() => {
    if (!orderBy) return result;
    
    return [...result].sort((a, b) => {
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
  }, [result, orderBy, order]);

  const handleSort = (column) => {
    const isAsc = orderBy === column && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(column);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCopyAsCSV = () => {
    if (!columns.length || !result.length) return;
    
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
    
    const csv = [header, ...rows].join('\n');
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCSV = () => {
    if (!columns.length || !result.length) return;
    
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
    
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query_results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data || !columns.length) {
    return null;
  }

  // Chart view - only show when NOT embedded (in standalone usage)
  if (!embedded && viewMode === 'chart') {
    return (
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            px: 2,
            py: 1,
          }}
        >
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, v) => v && setViewMode(v)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: 1.5,
                px: 1.5,
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
                },
              },
            }}
          >
            <ToggleButton value="table">
              <Tooltip title="Table View">
                <TableChartOutlinedIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="chart">
              <Tooltip title="Chart View">
                <BarChartRoundedIcon sx={{ fontSize: 18 }} />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ChartVisualization data={data} onClose={onClose} />
      </Box>
    );
  }

  const paginatedData = sortedData.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header - Simplified when embedded */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          py: embedded ? 1 : 1.5,
          borderBottom: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08),
          ...(embedded ? {} : {
            background: isDark 
              ? `linear-gradient(180deg, ${alpha(theme.palette.success.main, 0.08)} 0%, transparent 100%)`
              : `linear-gradient(180deg, ${alpha(theme.palette.success.main, 0.05)} 0%, transparent 100%)`,
          }),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!embedded && (
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(theme.palette.success.main, isDark ? 0.15 : 0.1),
              }}
            >
              <DataArrayRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
            </Box>
          )}
          <Chip
            size="small"
            label={`${row_count} rows`}
            sx={{ 
              height: 24,
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: alpha(theme.palette.success.main, isDark ? 0.15 : 0.1),
              color: 'success.main',
              border: '1px solid',
              borderColor: alpha(theme.palette.success.main, 0.3),
            }}
          />
          {execution_time && (
            <Chip
              size="small"
              icon={<TimerOutlinedIcon sx={{ fontSize: 12 }} />}
              label={`${execution_time.toFixed(2)}s`}
              sx={{ 
                height: 24,
                fontSize: '0.7rem',
                backgroundColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.05),
                '& .MuiChip-icon': { ml: 0.5 },
              }}
            />
          )}
          {truncated && (
            <Chip
              size="small"
              label="Truncated"
              color="warning"
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* View Toggle - Only show when NOT embedded */}
          {!embedded && (
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, v) => v && setViewMode(v)}
              size="small"
              sx={{
                mr: 1,
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  '&.Mui-selected': {
                    backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
                  },
                },
              }}
            >
              <ToggleButton value="table">
                <Tooltip title="Table View">
                  <TableChartOutlinedIcon sx={{ fontSize: 18 }} />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="chart">
                <Tooltip title="Chart View">
                  <BarChartRoundedIcon sx={{ fontSize: 18 }} />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          )}
          
          <Tooltip title={copied ? 'Copied!' : 'Copy as CSV'}>
            <IconButton 
              size="small" 
              onClick={handleCopyAsCSV}
              sx={{ 
                color: copied ? 'success.main' : 'text.secondary',
                '&:hover': { backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06) },
              }}
            >
              {copied ? (
                <CheckRoundedIcon sx={{ fontSize: 18 }} />
              ) : (
                <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Download CSV">
            <IconButton 
              size="small" 
              onClick={handleDownloadCSV}
              sx={{ 
                color: 'text.secondary',
                '&:hover': { backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06) },
              }}
            >
              <FileDownloadOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {onClose && !embedded && (
            <Tooltip title="Close">
              <IconButton 
                size="small" 
                onClick={onClose}
                sx={{ 
                  color: 'text.secondary',
                  '&:hover': { backgroundColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.06) },
                }}
              >
                <CloseRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Table - Remove maxHeight when embedded for better scrolling */}
      <TableContainer sx={{ flex: 1, maxHeight: embedded ? 'none' : 350 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((column, idx) => (
                <TableCell
                  key={column}
                  sx={{
                    backgroundColor: isDark 
                      ? alpha(theme.palette.background.paper, 0.95)
                      : theme.palette.background.paper,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    borderBottom: '2px solid',
                    borderColor: isDark ? alpha('#fff', 0.1) : alpha('#000', 0.1),
                    ...(idx === 0 && { pl: 2 }),
                  }}
                >
                  <TableSortLabel
                    active={orderBy === column}
                    direction={orderBy === column ? order : 'asc'}
                    onClick={() => handleSort(column)}
                    sx={{
                      '&.Mui-active': { color: 'primary.main' },
                      '& .MuiTableSortLabel-icon': { fontSize: 16 },
                    }}
                  >
                    {column}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, rowIndex) => (
              <TableRow
                key={rowIndex}
                sx={{
                  '&:nth-of-type(even)': {
                    backgroundColor: isDark ? alpha('#fff', 0.02) : alpha('#000', 0.02),
                  },
                  '&:hover': {
                    backgroundColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.04),
                  },
                  transition: 'background-color 0.15s ease',
                }}
              >
                {columns.map((column, idx) => (
                  <TableCell
                    key={column}
                    sx={{
                      fontSize: '0.8rem',
                      maxWidth: 280,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      py: 1,
                      borderColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.05),
                      ...(idx === 0 && { pl: 2 }),
                    }}
                  >
                    {row[column] === null ? (
                      <Typography
                        component="span"
                        sx={{ 
                          color: 'text.disabled', 
                          fontStyle: 'italic',
                          fontSize: '0.75rem',
                          backgroundColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.05),
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 0.5,
                        }}
                      >
                        {nullDisplay || 'NULL'}
                      </Typography>
                    ) : typeof row[column] === 'number' ? (
                      <Typography
                        component="span"
                        sx={{ 
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '0.8rem',
                          color: 'info.main',
                        }}
                      >
                        {row[column].toLocaleString()}
                      </Typography>
                    ) : (
                      String(row[column])
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={row_count}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
        sx={{
          borderTop: '1px solid',
          borderColor: isDark ? alpha('#fff', 0.08) : alpha('#000', 0.08),
          '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
            fontSize: '0.75rem',
          },
          '& .MuiTablePagination-select': {
            fontSize: '0.8rem',
          },
        }}
      />
    </Box>
  );
}

export default SQLResultsTable;
