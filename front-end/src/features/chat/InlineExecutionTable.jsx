import React, { useEffect, useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import { getExecutionResult } from '@/api/conversations';
import { INTERFACE_RADIUS, getAppDividerColor } from '@/features/styles/interfaceChrome';

export default function InlineExecutionTable({ conversationId, executionId }) {
  const theme = useTheme();
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
        const res = await getExecutionResult(conversationId, executionId);
        
        if (mounted && res.status === 'success' && res.data) {
          const rawData = Array.isArray(res.data.data)
            ? res.data.data
            : Array.isArray(res.data.result)
              ? res.data.result
              : [];
          const rawColumns = res.data.columns || [];
          
          setData(rawData);
          
          // Generate material-react-table columns from the raw columns
          const generatedCols = rawColumns.map((col) => ({
            accessorKey: col,
            header: col,
            size: 150,
          }));
          
          // Fallback if no columns provided but data exists
          if (generatedCols.length === 0 && rawData.length > 0) {
              const keys = Object.keys(rawData[0]);
              setColumns(keys.map(k => ({ accessorKey: k, header: k, size: 150 })));
          } else {
              setColumns(generatedCols);
          }
        }
      } catch (err) {
        if (mounted) {
            setError(err.message || 'Failed to load execution result');
        }
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
  const dividerColor = getAppDividerColor(theme);

  const table = useMaterialReactTable({
    columns,
    data,
    enableBottomToolbar: false,
    enableColumnResizing: true,
    enableColumnVirtualization: shouldVirtualizeColumns,
    enableGlobalFilterModes: false,
    enablePagination: false,
    enablePinning: true,
    enableRowNumbers: true,
    enableRowVirtualization: shouldVirtualizeRows,
    enableTopToolbar: false,
    enableSorting: false,
    enableFilters: false,
    enableHiding: false,
    muiTableContainerProps: { sx: { maxHeight: '400px' } },
    muiTablePaperProps: {
        sx: {
            boxShadow: 'none',
            border: `1px solid ${dividerColor}`,
            borderRadius: INTERFACE_RADIUS.row,
            overflow: 'hidden',
            backgroundColor: 'transparent',
            mt: 1,
            mb: 2,
        }
    },
    muiTableHeadCellProps: {
        sx: {
            backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.05 : 0.035),
            fontWeight: 600,
            fontSize: '0.85rem',
            padding: '8px 16px',
            borderColor: dividerColor,
        }
    },
    muiTableBodyCellProps: {
        sx: {
            fontSize: '0.85rem',
            padding: '6px 16px',
            fontFamily: theme.typography.fontFamilyMono,
            borderColor: dividerColor,
        }
    },
    rowVirtualizerOptions: shouldVirtualizeRows ? { overscan: 5 } : undefined,
    columnVirtualizerOptions: shouldVirtualizeColumns ? { overscan: 2 } : undefined,
  });

  if (!conversationId || !executionId) {
      return null;
  }

  if (loading) {
    const skeletonRows = Array.from({ length: 5 });
    const skeletonColumns = Array.from({ length: 4 });

    return (
        <Box
          role="status"
          aria-label="Loading query results"
          sx={{
            border: '1px solid',
            borderColor: dividerColor,
            borderRadius: INTERFACE_RADIUS.row,
            overflow: 'hidden',
            mt: 1,
            mb: 2,
            bgcolor: 'transparent',
          }}
        >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '44px repeat(4, minmax(96px, 1fr))',
                gap: 0,
                bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.05 : 0.035),
                borderBottom: '1px solid',
                borderColor: dividerColor,
                px: 1.5,
                py: 1.1,
              }}
            >
              <Skeleton variant="text" width={16} height={20} />
              {skeletonColumns.map((_, index) => (
                <Skeleton
                  key={`header-${index}`}
                  variant="text"
                  width={`${68 - index * 7}%`}
                  height={20}
                  sx={{ mx: 1 }}
                />
              ))}
            </Box>

            {skeletonRows.map((_, rowIndex) => (
              <Box
                key={`row-${rowIndex}`}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '44px repeat(4, minmax(96px, 1fr))',
                  alignItems: 'center',
                  px: 1.5,
                  py: 0.9,
                  borderBottom: rowIndex === skeletonRows.length - 1 ? 0 : '1px solid',
                  borderColor: dividerColor,
                }}
              >
                <Skeleton variant="text" width={18} height={18} />
                {skeletonColumns.map((_, columnIndex) => (
                  <Skeleton
                    key={`cell-${rowIndex}-${columnIndex}`}
                    variant="text"
                    width={`${76 - ((rowIndex + columnIndex) % 3) * 12}%`}
                    height={18}
                    sx={{ mx: 1 }}
                  />
                ))}
              </Box>
            ))}
        </Box>
    );
  }

  if (error) {
    return (
        <Box sx={{ p: 2, color: 'error.main', border: '1px solid', borderColor: alpha(theme.palette.error.main, 0.28), borderRadius: INTERFACE_RADIUS.row, mt: 1, mb: 2, bgcolor: alpha(theme.palette.error.main, 0.06) }}>
            <Typography variant="body2">Error loading results: {error}</Typography>
        </Box>
    );
  }
  
  if (data.length === 0) {
    return (
        <Box sx={{ p: 2, border: '1px solid', borderColor: dividerColor, borderRadius: INTERFACE_RADIUS.row, mt: 1, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Query returned 0 rows.</Typography>
        </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'auto' }}>
      <MaterialReactTable table={table} />
    </Box>
  );
}
