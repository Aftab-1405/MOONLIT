/**
 * SchemaSidebar - Database Schema Explorer
 * 
 * Displays database schemas, tables, and columns in a collapsible tree structure.
 */

import { useState, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import HighlightOffRounded from '@mui/icons-material/HighlightOffRounded';
import { getScrollbarStyles } from '../../../../styles/shared';

// Mock schema data - replace with actual API call
const MOCK_SCHEMA = [
  {
    name: 'public',
    tables: [
      {
        name: 'users',
        columns: ['id', 'email', 'name', 'created_at'],
      },
      {
        name: 'orders',
        columns: ['id', 'user_id', 'total', 'status', 'created_at'],
      },
      {
        name: 'products',
        columns: ['id', 'name', 'price', 'stock'],
      },
    ],
  },
];

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
        <StorageRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
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

  return (
    <Box>
      <Box
        onClick={() => setExpanded((v) => !v)}
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
        <TableChartRoundedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
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
          {table.columns.map((column) => (
            <Box
              key={column}
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
                {column}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

function SchemaSidebar({ width, isConnected, currentDatabase: _currentDatabase, onClose, onResizeStart }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
        {isConnected ? (
          MOCK_SCHEMA.map((schema) => (
            <SchemaItem key={schema.name} schema={schema} />
          ))
        ) : (
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
                color: 'text.disabled',
                textAlign: 'center',
              }}
            >
              Connect to a database to view schema
            </Typography>
          </Box>
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
