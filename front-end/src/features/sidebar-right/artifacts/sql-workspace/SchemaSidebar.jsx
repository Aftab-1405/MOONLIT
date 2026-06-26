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
  Fade,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import HighlightOffRounded from '@mui/icons-material/HighlightOffRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded';
import { getInteractionColors, getScrollbarStyles } from '@/styles/shared';
import SchemaIcon from '@/components/icons/SchemaIcon';
import { useDatabaseConnection } from '@/contexts/DatabaseContext';
import { getArtifactActionButtonSx } from '@/features/sidebar-right/artifact-loader';
import {
  getAppBarSurfaceSx,
  getAppDividerColor,
  getAppPanelSurfaceSx,
} from '@/features/styles/interfaceChrome';

const SCHEMA_ROW_HEIGHT = 32;
const SCHEMA_ICON_SLOT = 24;

function getSchemaBarSx(theme) {
  return {
    borderColor: getAppDividerColor(theme),
    ...getAppBarSurfaceSx(theme),
  };
}

function getColumnLabel(column) {
  if (typeof column === 'string') return column;
  if (!column || typeof column !== 'object') return '';

  const name = column.name || column.column_name || '';
  const dataType = column.data_type || column.type || '';
  return dataType ? `${name} ${dataType}` : name;
}

function getSchemaTreeRowSx(theme, interaction, { radius = '6px' } = {}) {
  return {
    minHeight: SCHEMA_ROW_HEIGHT,
    transition: theme.transitions.create(['background-color'], {
      duration: theme.transitions.duration.shortest,
    }),
    borderRadius: radius,
    '&:hover': {
      bgcolor: interaction.hoverBackground,
    },
  };
}

function SchemaStatusText({ children, color = 'text.secondary' }) {
  const theme = useTheme();

  return (
    <Fade in timeout={160}>
      <Box
        sx={{
          minHeight: 28,
          display: 'flex',
          alignItems: 'center',
          px: 0.75,
          py: 0,
        }}
      >
        <Typography
          sx={{
            ...theme.typography.uiCaptionXs,
            color,
            fontFamily: theme.typography.fontFamilyMono,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
            maskImage: 'linear-gradient(to right, black 84%, transparent 98%)',
            WebkitMaskImage: 'linear-gradient(to right, black 84%, transparent 98%)',
          }}
        >
          {children}
        </Typography>
      </Box>
    </Fade>
  );
}

function SchemaItem({ schema, currentDatabase, fetchTableSchema }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  const interaction = getInteractionColors(theme);

  return (
    <Box>
      <Box
        onClick={() => setExpanded((v) => !v)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          px: 0.75,
          py: 0,
          cursor: 'pointer',
          userSelect: 'none',
          ...getSchemaTreeRowSx(theme, interaction),
        }}
      >
        <Box sx={{ width: SCHEMA_ICON_SLOT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {expanded ? (
            <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          ) : (
            <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          )}
        </Box>
        <Box sx={{ width: SCHEMA_ICON_SLOT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'text.secondary' }}>
          <SchemaIcon sx={{ width: 16, height: 16 }} />
        </Box>
        <Typography
          sx={{
            ...theme.typography.uiCaptionMd,
            fontWeight: 600,
            color: 'text.primary',
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
            maskImage: 'linear-gradient(to right, black 82%, transparent 98%)',
            WebkitMaskImage: 'linear-gradient(to right, black 82%, transparent 98%)',
          }}
        >
          {schema.name}
        </Typography>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ pl: 1 }}>
          {schema.tables.map((table) => (
            <TableItem
              key={`${currentDatabase || 'db'}-${table.name}`}
              table={table}
              currentDatabase={currentDatabase}
              fetchTableSchema={fetchTableSchema}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function TableItem({ table, currentDatabase, fetchTableSchema }) {
  const theme = useTheme();
  const interaction = getInteractionColors(theme);
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
      const response = await fetchTableSchema({
        database: currentDatabase,
        tableName: table.name,
      });
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
  }, [columns.length, columnsLoading, currentDatabase, expanded, fetchTableSchema, table.name]);

  return (
    <Box>
      <Box
        onClick={handleToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          px: 0.75,
          py: 0,
          cursor: 'pointer',
          userSelect: 'none',
          ...getSchemaTreeRowSx(theme, interaction),
        }}
      >
        <Box sx={{ width: SCHEMA_ICON_SLOT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {expanded ? (
            <KeyboardArrowDownRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          ) : (
            <KeyboardArrowRightRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
          )}
        </Box>
        <Box sx={{ width: SCHEMA_ICON_SLOT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'text.secondary' }}>
          <TableChartRoundedIcon sx={{ fontSize: 17 }} />
        </Box>
        <Typography
          sx={{
            ...theme.typography.uiCaptionSm,
            color: 'text.primary',
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'clip',
            maskImage: 'linear-gradient(to right, black 82%, transparent 98%)',
            WebkitMaskImage: 'linear-gradient(to right, black 82%, transparent 98%)',
          }}
        >
          {table.name}
        </Typography>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ pl: 4 }}>
          {columnsLoading ? (
            <SchemaStatusText key="columns-loading">Loading columns...</SchemaStatusText>
          ) : columnsError ? (
            <SchemaStatusText key="columns-error" color="error.main">{columnsError}</SchemaStatusText>
          ) : columns.length === 0 ? (
            <SchemaStatusText key="columns-empty">No columns</SchemaStatusText>
          ) : columns.map((column) => (
            <Box
              key={getColumnLabel(column)}
              sx={{
                minHeight: 28,
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                px: 0.75,
                py: 0,
                ...getSchemaTreeRowSx(theme, interaction, { radius: '4px' }),
              }}
            >
              <Box
                sx={{
                  width: SCHEMA_ICON_SLOT,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'text.secondary',
                }}
              >
                <ViewColumnRoundedIcon sx={{ fontSize: 15 }} />
              </Box>
              <Typography
                sx={{
                  ...theme.typography.uiCaptionXs,
                  color: 'text.secondary',
                  fontFamily: theme.typography.fontFamilyMono,
                  minWidth: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'clip',
                  maskImage: 'linear-gradient(to right, black 84%, transparent 98%)',
                  WebkitMaskImage: 'linear-gradient(to right, black 84%, transparent 98%)',
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

function SchemaSidebar({ width, _open = true, isConnected, currentDatabase, onClose, onResizeStart, _resizing = false }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { fetchSchemaTables, fetchTableSchema, invalidateSchemaTables } = useDatabaseConnection();
  const [schemaInfo, setSchemaInfo] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState('');

  const loadSchema = useCallback(async (isCancelled, { force = false } = {}) => {
    setSchemaLoading(true);
    setSchemaError('');

    try {
      const response = await fetchSchemaTables({
        database: currentDatabase,
        force,
      });

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
    } catch (error) {
      if (!isCancelled()) setSchemaError(error.message || 'Schema unavailable');
    } finally {
      if (!isCancelled()) setSchemaLoading(false);
    }
  }, [currentDatabase, fetchSchemaTables]);

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

  const handleRefreshSchema = useCallback(() => {
    if (!isConnected || schemaLoading) return;

    let cancelled = false;
    invalidateSchemaTables(currentDatabase);
    loadSchema(() => cancelled, { force: true });
  }, [currentDatabase, invalidateSchemaTables, isConnected, loadSchema, schemaLoading]);

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
        width,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        minHeight: 0,
        borderRight: '1px solid',
        borderColor: getAppDividerColor(theme),
        ...getAppPanelSurfaceSx(theme),
        position: 'relative',
        transition: 'none',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.25,
          py: 0.75,
          borderBottom: '1px solid',
          ...getSchemaBarSx(theme),
          flexShrink: 0,
          minHeight: 46,
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Tooltip title="Refresh schema">
            <span>
              <IconButton
                size="small"
                onClick={handleRefreshSchema}
                disabled={!isConnected || schemaLoading}
                aria-label="Refresh schema"
                sx={getArtifactActionButtonSx(theme, { size: 30 })}
              >
                <RefreshRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Close sidebar">
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Close schema sidebar"
              sx={getArtifactActionButtonSx(theme, { size: 30 })}
            >
              <HighlightOffRounded sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
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
          <Fade in timeout={180} key={schemaContent.message}>
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
                  color: schemaContent.tone === 'error' ? 'error.main' : 'text.secondary',
                  textAlign: 'center',
                }}
              >
                {schemaContent.message}
              </Typography>
            </Box>
          </Fade>
        ) : (
          <SchemaItem
            schema={schemaInfo}
            currentDatabase={currentDatabase}
            fetchTableSchema={fetchTableSchema}
          />
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
