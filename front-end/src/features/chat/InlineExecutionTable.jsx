import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import { Box, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { useEffect, useState } from 'react';
import { getExecutionResult } from '@/api/conversations';
import { INTERFACE_RADIUS } from '@/features/styles/interfaceChrome';

const MIN_COLUMN_SIZE = 112;
const MAX_COLUMN_SIZE = 360;
const ROW_NUMBER_COLUMN_SIZE = 48;

function formatCellValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function estimateColumnSize(columnName, columnIndex, rows) {
  const sampledRows = rows.slice(0, 25);
  const longestValue = sampledRows.reduce((longest, row) => {
    const value = Array.isArray(row) ? row[columnIndex] : row?.[columnName];
    return Math.max(longest, formatCellValue(value).length);
  }, String(columnName).length);

  return Math.min(MAX_COLUMN_SIZE, Math.max(MIN_COLUMN_SIZE, longestValue * 7.5 + 34));
}

function ResultCell({ cell }) {
  const value = cell.getValue();
  const displayValue = formatCellValue(value);
  const isNull = value === null || value === undefined;
  const isBoolean = typeof value === 'boolean';

  return (
    <Box
      component="span"
      title={displayValue}
      sx={{
        display: 'block',
        width: '100%',
        overflow: 'hidden',
        color: isNull
          ? 'text.disabled'
          : isBoolean
            ? value
              ? 'text.primary'
              : 'text.secondary'
            : 'text.primary',
        fontStyle: isNull ? 'italic' : 'normal',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {displayValue}
    </Box>
  );
}

function createColumnDefinitions(columnNames, rows) {
  return columnNames.map((columnName, columnIndex) => ({
    id: `${String(columnName)}-${columnIndex}`,
    accessorFn: (row) => (Array.isArray(row) ? row[columnIndex] : row?.[columnName]),
    header: String(columnName),
    minSize: MIN_COLUMN_SIZE,
    maxSize: MAX_COLUMN_SIZE,
    size: estimateColumnSize(columnName, columnIndex, rows),
    grow: true,
    Cell: ResultCell,
  }));
}

function getSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';

  return {
    width: '100%',
    maxWidth: '100%',
    mt: 1,
    mb: 2,
    overflow: 'hidden',
    borderRadius: INTERFACE_RADIUS.panel,
    border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08)}`,
    backgroundColor: 'transparent',
    boxShadow: 'none',
  };
}

function LoadingTable() {
  const theme = useTheme();
  const skeletonRows = Array.from({ length: 4 });
  const skeletonColumns = Array.from({ length: 3 });

  return (
    <Box role="status" aria-label="Loading query results" sx={getSurfaceSx(theme)}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '48px repeat(3, minmax(112px, 1fr))',
          px: 1.25,
          py: 1,
          bgcolor: 'background.paper',
        }}
      >
        <Skeleton variant="text" width={12} height={16} sx={{ mx: 'auto' }} />
        {skeletonColumns.map((_, index) => (
          <Skeleton
            key={`header-${index}`}
            variant="text"
            width={`${64 - index * 9}%`}
            height={16}
            sx={{ mx: 1 }}
          />
        ))}
      </Box>
      {skeletonRows.map((_, rowIndex) => (
        <Box
          key={`row-${rowIndex}`}
          sx={{
            minHeight: 38,
            display: 'grid',
            gridTemplateColumns: '48px repeat(3, minmax(112px, 1fr))',
            alignItems: 'center',
            px: 1.25,
            borderTop: `1px solid ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.055 : 0.045)}`,
          }}
        >
          <Skeleton variant="text" width={14} height={16} sx={{ mx: 'auto' }} />
          {skeletonColumns.map((_, columnIndex) => (
            <Skeleton
              key={`cell-${rowIndex}-${columnIndex}`}
              variant="text"
              width={`${72 - ((rowIndex + columnIndex) % 3) * 12}%`}
              height={16}
              sx={{ mx: 1 }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

function ResultState({ error }) {
  const theme = useTheme();
  const isError = Boolean(error);

  return (
    <Box
      role={isError ? 'alert' : 'status'}
      sx={{
        ...getSurfaceSx(theme),
        minHeight: 116,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 2,
        boxShadow: 'none',
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          borderRadius: '11px',
          color: isError ? 'error.main' : 'text.disabled',
          bgcolor: alpha(
            isError ? theme.palette.error.main : theme.palette.text.primary,
            theme.palette.mode === 'dark' ? 0.09 : 0.055,
          ),
        }}
      >
        {isError ? (
          <ErrorOutlineRoundedIcon sx={{ fontSize: 20 }} />
        ) : (
          <TableRowsOutlinedIcon sx={{ fontSize: 19 }} />
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ ...theme.typography.uiBodySm, fontWeight: 650, color: 'text.primary' }}>
          {isError ? 'Results unavailable' : 'No rows returned'}
        </Typography>
        <Typography
          sx={{
            ...theme.typography.uiCaptionSm,
            mt: 0.375,
            color: isError ? 'error.main' : 'text.secondary',
            overflowWrap: 'anywhere',
          }}
        >
          {isError ? error : 'The query completed successfully but returned no data.'}
        </Typography>
      </Box>
    </Box>
  );
}

export default function InlineExecutionTable({ conversationId, executionId }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function fetchResult() {
      if (!conversationId || !executionId) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await getExecutionResult(conversationId, executionId);

        if (mounted && response.status === 'success' && response.data) {
          const rawData = Array.isArray(response.data.data)
            ? response.data.data
            : Array.isArray(response.data.result)
              ? response.data.result
              : [];
          const providedColumns = Array.isArray(response.data.columns) ? response.data.columns : [];
          const columnNames =
            providedColumns.length > 0
              ? providedColumns
              : rawData.length > 0 && !Array.isArray(rawData[0])
                ? Object.keys(rawData[0])
                : [];

          setData(rawData);
          setColumns(createColumnDefinitions(columnNames, rawData));
        } else if (mounted) {
          setError(response.message || 'Could not load this query result.');
        }
      } catch (requestError) {
        if (mounted) setError(requestError.message || 'Could not load this query result.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchResult();

    return () => {
      mounted = false;
    };
  }, [conversationId, executionId]);

  const shouldVirtualizeRows = data.length > 50;
  const shouldVirtualizeColumns = columns.length > 12;
  const rowDivider = alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05);

  const table = useMaterialReactTable({
    columns,
    data,
    layoutMode: 'grid',
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: MIN_COLUMN_SIZE,
      maxSize: MAX_COLUMN_SIZE,
      size: 160,
      grow: true,
    },
    displayColumnDefOptions: {
      'mrt-row-numbers': {
        minSize: ROW_NUMBER_COLUMN_SIZE,
        maxSize: ROW_NUMBER_COLUMN_SIZE,
        size: ROW_NUMBER_COLUMN_SIZE,
        grow: false,
      },
    },
    enableBottomToolbar: false,
    enableColumnActions: false,
    enableColumnDragging: false,
    enableColumnResizing: true,
    enableColumnVirtualization: shouldVirtualizeColumns,
    enableDensityToggle: false,
    enableFilters: false,
    enableFullScreenToggle: false,
    enableGlobalFilter: false,
    enableHiding: false,
    enablePagination: false,
    enablePinning: false,
    enableRowNumbers: true,
    enableRowVirtualization: shouldVirtualizeRows,
    enableSorting: false,
    enableStickyHeader: true,
    enableTopToolbar: false,
    initialState: { density: 'compact' },
    localization: { rowNumber: '#' },
    mrtTheme: {
      baseBackgroundColor: 'rgba(0, 0, 0, 0)',
      cellNavigationOutlineColor: theme.palette.primary.main,
      draggingBorderColor: theme.palette.primary.main,
      matchHighlightColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
      menuBackgroundColor: theme.palette.background.paper,
      pinnedRowBackgroundColor: 'rgba(0, 0, 0, 0)',
      selectedRowBackgroundColor: alpha(theme.palette.primary.main, isDark ? 0.1 : 0.06),
    },
    muiTableContainerProps: {
      sx: {
        maxHeight: 420,
        overflow: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      },
    },
    muiTablePaperProps: {
      elevation: 0,
      sx: getSurfaceSx(theme),
    },
    muiTableProps: {
      sx: {
        width: '100%',
        minWidth: '100%',
      },
    },
    muiTableHeadProps: {
      sx: { bgcolor: 'background.paper' },
    },
    muiTableHeadRowProps: {
      sx: { boxShadow: 'none' },
    },
    muiTableHeadCellProps: ({ column }) => ({
      align: column.id === 'mrt-row-numbers' ? 'center' : 'left',
      sx: {
        minHeight: 39,
        px: column.id === 'mrt-row-numbers' ? 0.5 : 1.5,
        py: 0.75,
        borderBottom: `1px solid ${rowDivider}`,
        color: column.id === 'mrt-row-numbers' ? 'text.disabled' : 'text.secondary',
        bgcolor: 'background.paper',
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: '0.7rem',
        fontWeight: 650,
        letterSpacing: '0.01em',
        '& .Mui-TableHeadCell-Content-Actions': { display: 'none' },
        '& .Mui-TableHeadCell-ResizeHandle-Divider': {
          height: 20,
          borderColor: alpha(theme.palette.text.primary, isDark ? 0.14 : 0.1),
          borderWidth: '1px',
          opacity: 0,
        },
        '&:hover .Mui-TableHeadCell-ResizeHandle-Divider': {
          borderColor: theme.palette.primary.main,
          opacity: 1,
        },
      },
    }),
    muiTableBodyRowProps: ({ row }) => ({
      sx: {
        bgcolor:
          row.index % 2 === 1
            ? alpha(theme.palette.text.primary, isDark ? 0.012 : 0.009)
            : 'transparent',
        transition: theme.transitions.create('background-color', {
          duration: theme.transitions.duration.shorter,
        }),
        '&:hover > td': {
          bgcolor: alpha(theme.palette.text.primary, isDark ? 0.04 : 0.03),
        },
        '&:last-of-type > td': { borderBottom: 0 },
      },
    }),
    muiTableBodyCellProps: ({ column }) => ({
      align: column.id === 'mrt-row-numbers' ? 'center' : 'left',
      sx: {
        minHeight: 38,
        px: column.id === 'mrt-row-numbers' ? 0.5 : 1.5,
        py: 0.75,
        overflow: 'hidden',
        borderBottom: `1px solid ${rowDivider}`,
        color: column.id === 'mrt-row-numbers' ? 'text.disabled' : 'text.primary',
        bgcolor: 'inherit',
        fontFamily: theme.typography.fontFamilyMono,
        fontSize: column.id === 'mrt-row-numbers' ? '0.68rem' : '0.78rem',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.45,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    }),
    rowVirtualizerOptions: shouldVirtualizeRows ? { overscan: 6 } : undefined,
    columnVirtualizerOptions: shouldVirtualizeColumns ? { overscan: 2 } : undefined,
  });

  if (!conversationId || !executionId) return null;
  if (loading) return <LoadingTable />;
  if (error) return <ResultState error={error} />;
  if (data.length === 0) return <ResultState />;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <MaterialReactTable table={table} />
    </Box>
  );
}
