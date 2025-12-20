import { useState, useMemo } from 'react';
import {
  Box,
  Paper,
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
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import ChartVisualization from './ChartVisualization';

function SQLResultsTable({ data, onClose }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy, setOrderBy] = useState('');
  const [order, setOrder] = useState('asc');
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'chart'

  // Read NULL display setting from user preferences
  const storedSettings = JSON.parse(localStorage.getItem('db-genie-settings') || '{}');
  const nullDisplay = storedSettings.nullDisplay ?? 'NULL';

  const { columns = [], result = [], row_count = 0, execution_time } = data || {};

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

  // Show chart view
  if (viewMode === 'chart') {
    return (
      <Box>
        {/* View Toggle Header */}
        <Box
          sx={{
            m: { xs: 1, sm: 2 },
            mb: 0,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="table">
              <Tooltip title="Table View">
                <TableChartOutlinedIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="chart">
              <Tooltip title="Chart View">
                <BarChartRoundedIcon fontSize="small" />
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
    <Paper
      sx={{
        m: { xs: 1, sm: 2 },
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'rgba(16, 185, 129, 0.3)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          py: 1.5,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderBottom: '1px solid',
          borderColor: 'rgba(16, 185, 129, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CheckCircleOutlineRoundedIcon sx={{ color: 'success.main', fontSize: 20 }} />
          <Typography variant="body2" fontWeight={500}>
            Query Results
          </Typography>
          <Chip
            size="small"
            label={`${row_count} rows`}
            sx={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
          />
          {execution_time && (
            <Chip
              size="small"
              icon={<TimerOutlinedIcon sx={{ fontSize: 14 }} />}
              label={`${execution_time.toFixed(2)}s`}
              sx={{ backgroundColor: 'rgba(6, 182, 212, 0.15)' }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* View Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="table">
              <Tooltip title="Table View">
                <TableChartOutlinedIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="chart">
              <Tooltip title="Chart View">
                <BarChartRoundedIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={copied ? 'Copied!' : 'Copy as CSV'}>
              <IconButton size="small" onClick={handleCopyAsCSV}>
                <ContentCopyRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download CSV">
              <IconButton size="small" onClick={handleDownloadCSV}>
                <FileDownloadOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton size="small" onClick={onClose}>
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Table */}
      <TableContainer sx={{ maxHeight: 400 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column}
                  sx={{
                    backgroundColor: 'background.paper',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <TableSortLabel
                    active={orderBy === column}
                    direction={orderBy === column ? order : 'asc'}
                    onClick={() => handleSort(column)}
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
                hover
                sx={{
                  '&:hover': {
                    backgroundColor: 'rgba(148, 163, 184, 0.04)',
                  },
                }}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column}
                    sx={{
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row[column] === null ? (
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.disabled', fontStyle: 'italic' }}
                      >
                        {nullDisplay || 'NULL'}
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
          borderColor: 'divider',
        }}
      />
    </Paper>
  );
}

export default SQLResultsTable;
