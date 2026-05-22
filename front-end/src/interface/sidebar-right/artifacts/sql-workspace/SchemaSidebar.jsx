/**
 * SchemaSidebar - Database Schema Explorer
 * 
 * Displays database schemas, tables, and columns in a collapsible tree structure.
 */

import { useState, memo, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import HighlightOffRounded from '@mui/icons-material/HighlightOffRounded';
import { getScrollbarStyles } from '../../../../styles/shared';
import SchemaIcon from '../../../../components/icons/SchemaIcon';
import { getTables, getTableSchema } from '../../../../api';

function getColumnLabel(column) {
  if (typeof column === 'string') return column;
  if (!column || typeof column !== 'object') return '';

  const name = column.name || column.column_name || '';
  const dataType = column.data_type || column.type || '';
  return dataType ? `${name} ${dataType}` : name;
}

function SchemaItem({ schema }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);

  return (
    <Box>
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.75,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': {
            bgcolor: alpha(theme.palette.text.primary, 0.04),
          },
        }}
      >
        {expanded ? (
          <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        ) : (
          <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        )}
        <SchemaIcon sx={{ width: 14, height: 14, opacity: 0.78 }} />
        <Typography
          sx={{
            ...theme.typography.uiCaptionMd,
            fontWeight: 600,
            color: 'text.primary',
          }}
        >
          {schema.name}
        </Typography>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ pl: 1.5 }}>
          {schema.tables.map((table) => (
            <TableItem key={table.name} table={table} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function TableItem({ table }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [columns, setColumns] = useState([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState('');

  const handleToggle = useCallback(async () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);

    if (!nextExpanded || columns.length > 0 || columnsLoading) return;

    setColumnsLoading(true);
    setColumnsError('');
    try {
      const response = await getTableSchema(table.name);
      if (response.status === 'success') {
        setColumns(response.data?.columns || []);
      } else {
        setColumnsError(response.message || 'Columns unavailable');
      }
    } catch (error) {
      setColumnsError(error.message || 'Columns unavailable');
    } finally {
      setColumnsLoading(false);
    }
  }, [columns.length, columnsLoading, expanded, table.name]);

  return (
    <Box>
      <Box
        onClick={handleToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.625,
          cursor: 'pointer',
          userSelect: 'none',
          borderRadius: '6px',
          '&:hover': {
            bgcolor: alpha(theme.palette.text.primary, 0.04),
          },
        }}
      >
        {expanded ? (
          <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        ) : (
          <KeyboardArrowRightRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        )}
        <SchemaIcon sx={{ width: 13, height: 13, opacity: 0.78 }} />
        <Typography
          sx={{
            ...theme.typography.uiCaptionSm,
            color: 'text.primary',
          }}
        >
          {table.name}
        </Typography>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ pl: 2.5 }}>
          {columnsLoading ? (
            <Box sx={{ px: 1, py: 0.5 }}>
              <Typography
                sx={{
                  ...theme.typography.uiCaptionXs,
                  color: 'text.disabled',
                  fontFamily: theme.typography.fontFamilyMono,
                }}
              >
                Loading columns...
              </Typography>
            </Box>
          ) : columnsError ? (
            <Box sx={{ px: 1, py: 0.5 }}>
              <Typography
                sx={{
                  ...theme.typography.uiCaptionXs,
                  color: 'error.main',
                  fontFamily: theme.typography.fontFamilyMono,
                }}
              >
                {columnsError}
              </Typography>
            </Box>
          ) : columns.length === 0 ? (
            <Box sx={{ px: 1, py: 0.5 }}>
              <Typography
                sx={{
                  ...theme.typography.uiCaptionXs,
                  color: 'text.disabled',
                  fontFamily: theme.typography.fontFamilyMono,
                }}
              >
                No columns
              </Typography>
            </Box>
          ) : columns.map((column) => (
            <Box
              key={getColumnLabel(column)}
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: '4px',
                '&:hover': {
                  bgcolor: alpha(theme.palette.text.primary, 0.03),
                },
              }}
            >
              <Typography
                sx={{
                  ...theme.typography.uiCaptionXs,
                  color: 'text.secondary',
                  fontFamily: theme.typography.fontFamilyMono,
                }}
              >
                {getColumnLabel(column)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function SchemaSidebar({ width, isConnected, currentDatabase, onClose, onResizeStart }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [schemaInfo, setSchemaInfo] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState('');

  const loadSchema = useCallback((isCancelled) => {
    setSchemaLoading(true);
    setSchemaError('');

    getTables()
      .then((response) => {
        if (isCancelled()) return;
        if (response.status === 'success') {
          const tables = (response.data?.tables || []).map((tableName) => ({ name: tableName }));
          setSchemaInfo({
            name: response.data?.schema || currentDatabase || 'Schema',
            tables,
          });
        } else {
          setSchemaError(response.message || 'Schema unavailable');
        }
      })
      .catch((error) => {
        if (!isCancelled()) setSchemaError(error.message || 'Schema unavailable');
      })
      .finally(() => {
        if (!isCancelled()) setSchemaLoading(false);
      });
  }, [currentDatabase]);

  useEffect(() => {
    if (!isConnected) return undefined;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) loadSchema(() => cancelled);
    });

    return () => {
      cancelled = true;
    };
  }, [isConnected, loadSchema]);

  const schemaContent = useMemo(() => {
    if (!isConnected) {
      return {
        message: 'Connect to a database to view schema',
        tone: 'disabled',
      };
    }

    if (schemaLoading) {
      return {
        message: 'Loading schema...',
        tone: 'disabled',
      };
    }

    if (schemaError) {
      return {
        message: schemaError,
        tone: 'error',
      };
    }

    if (!schemaInfo || schemaInfo.tables.length === 0) {
      return {
        message: 'No tables found for this database',
        tone: 'disabled',
      };
    }

    return null;
  }, [isConnected, schemaError, schemaInfo, schemaLoading]);

  return (
    <Box
      sx={{
        gridColumn: '1',
        gridRow: '1 / -1',
        width,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderRight: '1px solid',
        borderColor: theme.palette.border.subtle,
        bgcolor: 'background.paper',
        position: 'relative',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.25,
          py: 1,
          borderBottom: '1px solid',
          borderColor: theme.palette.border.subtle,
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            ...theme.typography.uiCaptionMd,
            fontWeight: 650,
            color: 'text.primary',
          }}
        >
          Schema
        </Typography>
        <Tooltip title="Close sidebar">
          <IconButton size="small" onClick={onClose} sx={{ border: 'none' }}>
            <HighlightOffRounded sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Schema tree */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          py: 0.5,
          ...getScrollbarStyles(theme),
        }}
      >
        {schemaContent ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              px: 2,
              py: 4,
            }}
          >
            <Typography
              sx={{
                ...theme.typography.uiCaptionSm,
                color: schemaContent.tone === 'error' ? 'error.main' : 'text.disabled',
                textAlign: 'center',
              }}
            >
              {schemaContent.message}
            </Typography>
          </Box>
        ) : (
          <SchemaItem schema={schemaInfo} />
        )}
      </Box>

      {/* Resize handle */}
      <Box
        onMouseDown={(e) => {
          e.preventDefault();
          onResizeStart(e);
        }}
        sx={{
          position: 'absolute',
          top: 0,
          right: -3,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 10,
          transition: 'background-color 0.15s ease',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.25 : 0.15),
          },
          '&:active': {
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.35 : 0.25),
          },
        }}
      />
    </Box>
  );
}

export default memo(SchemaSidebar);
