import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  CircularProgress,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Collapse,
  useTheme,
  Tabs,
  Tab,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import Editor from '@monaco-editor/react';

/**
 * UserDBContextManagerForAI - Granular control over stored database context for AI
 * 
 * Features:
 * - Sub-tabs: Stored Schemas | Query History
 * - View full schema data (tables, columns) in expandable accordions
 * - View actual queries with Monaco SQL editor
 * - Delete individual schemas or clear all
 */
function UserDBContextManagerForAI() {
  const [loading, setLoading] = useState(true);
  const [schemas, setSchemas] = useState([]);
  const [queries, setQueries] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState(0); // 0: Schemas, 1: Queries
  const [expandedSchema, setExpandedSchema] = useState(null);
  const [expandedQuery, setExpandedQuery] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, target: null });
  const [error, setError] = useState(null);
  
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Fetch context data on mount
  useEffect(() => {
    fetchContext();
  }, []);

  const fetchContext = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/user/context', { credentials: 'include' });
      const data = await response.json();
      if (data.status === 'success') {
        setSchemas(data.schemas || []);
        setQueries(data.queries || []);
      } else {
        setError(data.message || 'Failed to load context');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const { type, target } = deleteDialog;
    setDeleteDialog({ open: false, type: null, target: null });

    try {
      let url;
      if (type === 'schema') {
        url = `/api/user/context/schema/${encodeURIComponent(target)}`;
      } else if (type === 'all-schemas') {
        url = '/api/user/context/schemas';
      } else if (type === 'queries') {
        url = '/api/user/context/queries';
      }

      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchContext();
      } else {
        const data = await response.json();
        setError(data.message || 'Delete failed');
      }
    } catch (err) {
      setError('Failed to delete');
    }
  };

  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Unknown';
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const openDeleteDialog = (type, target = null) => {
    setDeleteDialog({ open: true, type, target });
  };

  const toggleSchemaExpand = useCallback((database) => {
    setExpandedSchema(prev => prev === database ? null : database);
  }, []);

  const toggleQueryExpand = useCallback((index) => {
    setExpandedQuery(prev => prev === index ? null : index);
  }, []);

  const getDialogContent = () => {
    const { type, target } = deleteDialog;
    if (type === 'schema') {
      const schema = schemas.find(s => s.database === target);
      return {
        title: 'Delete Schema Context?',
        database: target,
        tableCount: schema?.table_count || 0,
      };
    }
    if (type === 'all-schemas') {
      return {
        title: 'Delete All Schema Context?',
        database: `${schemas.length} database${schemas.length !== 1 ? 's' : ''}`,
        tableCount: schemas.reduce((sum, s) => sum + (s.table_count || 0), 0),
      };
    }
    if (type === 'queries') {
      return {
        title: 'Clear Query History?',
        database: null,
        tableCount: queries.length,
      };
    }
    return {};
  };

  const uiColors = useMemo(() => ({
    bg: alpha(theme.palette.text.primary, isDark ? 0.04 : 0.03),
    border: alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08),
  }), [theme.palette.text.primary, isDark]);

  if (loading) {
    return (
      <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ py: 0 }}>
      {/* Info Banner */}
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon />}
        sx={{ mb: 2, '& .MuiAlert-message': { fontSize: '0.8rem' } }}
      >
        This is the AI's memory of your database structure. Delete only if your schema has changed.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Sub-Tabs */}
      <Tabs
        value={activeSubTab}
        onChange={(e, v) => setActiveSubTab(v)}
        sx={{
          minHeight: 36,
          mb: 2,
          '& .MuiTabs-indicator': { height: 2 },
          '& .MuiTab-root': {
            minHeight: 36,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.8rem',
            px: 2,
          },
        }}
      >
        <Tab
          icon={<StorageRoundedIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              Schemas
              {schemas.length > 0 && (
                <Chip size="small" label={schemas.length} sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          }
        />
        <Tab
          icon={<HistoryRoundedIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              Queries
              {queries.length > 0 && (
                <Chip size="small" label={queries.length} sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          }
        />
      </Tabs>

      {/* === SCHEMAS TAB === */}
      {activeSubTab === 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Cached database structures for AI context
            </Typography>
            {schemas.length > 0 && (
              <Button
                size="small"
                color="error"
                onClick={() => openDeleteDialog('all-schemas')}
                sx={{ fontSize: '0.7rem' }}
              >
                Clear All
              </Button>
            )}
          </Box>

          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            {schemas.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <StorageRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No cached schemas
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Connect to a database to cache its schema
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {schemas.map((schema, index) => (
                  <Box key={schema.database}>
                    {index > 0 && <Divider />}
                    <ListItem
                      button
                      onClick={() => toggleSchemaExpand(schema.database)}
                      sx={{ py: 1.5 }}
                    >
                      <ListItemIcon sx={{ minWidth: 28 }}>
                        <KeyboardArrowDownIcon
                          sx={{
                            fontSize: 18,
                            transform: expandedSchema === schema.database ? 'rotate(0deg)' : 'rotate(-90deg)',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      </ListItemIcon>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <StorageRoundedIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={500}>{schema.database}</Typography>}
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {schema.table_count} table{schema.table_count !== 1 ? 's' : ''} • {formatTimeAgo(schema.cached_at)}
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); openDeleteDialog('schema', schema.database); }}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>

                    <Collapse in={expandedSchema === schema.database} timeout={200}>
                      <Box sx={{ px: 2, pb: 2, ml: 5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, mb: 1, display: 'block' }}>
                          Tables
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                          {schema.tables.slice(0, 20).map((table) => (
                            <Chip
                              key={table}
                              size="small"
                              icon={<TableChartRoundedIcon sx={{ fontSize: 12 }} />}
                              label={table}
                              sx={{ height: 24, fontSize: '0.7rem', backgroundColor: uiColors.bg, border: `1px solid ${uiColors.border}` }}
                            />
                          ))}
                          {schema.tables.length > 20 && (
                            <Chip size="small" label={`+${schema.tables.length - 20} more`} sx={{ height: 24, fontSize: '0.7rem', backgroundColor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }} />
                          )}
                        </Box>

                        {Object.entries(schema.columns || {}).slice(0, 3).map(([tableName, columns]) => (
                          <Box key={tableName} sx={{ mb: 1.5 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ViewColumnRoundedIcon sx={{ fontSize: 12 }} />
                              {tableName} ({Array.isArray(columns) ? columns.length : 0} columns)
                            </Typography>
                            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', pl: 2 }}>
                              {Array.isArray(columns) ? columns.slice(0, 8).map(c => typeof c === 'object' ? c.name : c).join(', ') : 'No columns'}
                              {Array.isArray(columns) && columns.length > 8 && ` +${columns.length - 8} more`}
                            </Typography>
                          </Box>
                        ))}
                        {Object.keys(schema.columns || {}).length > 3 && (
                          <Typography variant="caption" color="text.disabled">
                            ...and {Object.keys(schema.columns).length - 3} more tables
                          </Typography>
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                ))}
              </List>
            )}
          </Paper>
        </>
      )}

      {/* === QUERIES TAB === */}
      {activeSubTab === 1 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Recent SQL queries stored for AI context
            </Typography>
            {queries.length > 0 && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => openDeleteDialog('queries')}
                sx={{ fontSize: '0.7rem' }}
              >
                Clear All
              </Button>
            )}
          </Box>

          {queries.length === 0 ? (
            <Paper variant="outlined" sx={{ borderRadius: 2, p: 4, textAlign: 'center' }}>
              <HistoryRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
              <Typography variant="body1" color="text.secondary" fontWeight={500}>
                No queries stored
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                Run SQL queries to build history
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {queries.map((query, index) => (
                <Paper
                  key={index}
                  variant="outlined"
                  sx={{
                    borderRadius: 2.5,
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: isDark ? alpha('#fff', 0.15) : alpha('#000', 0.15),
                    },
                  }}
                >
                  {/* Query Header */}
                  <Box
                    onClick={() => toggleQueryExpand(index)}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2,
                      '&:hover': { backgroundColor: uiColors.bg },
                    }}
                  >
                    {/* Status Icon */}
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: query.status === 'success' 
                          ? alpha(theme.palette.success.main, 0.1)
                          : alpha(theme.palette.error.main, 0.1),
                        flexShrink: 0,
                      }}
                    >
                      {query.status === 'success' ? (
                        <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
                      ) : (
                        <ErrorRoundedIcon sx={{ fontSize: 18, color: 'error.main' }} />
                      )}
                    </Box>

                    {/* Query Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* Metadata Row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          icon={<StorageRoundedIcon sx={{ fontSize: 12 }} />}
                          label={query.database}
                          sx={{
                            height: 24,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            backgroundColor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                            '& .MuiChip-icon': { color: 'inherit' },
                          }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                          {query.row_count} row{query.row_count !== 1 ? 's' : ''}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          •
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatTimeAgo(query.executed_at)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Expand Icon */}
                    <KeyboardArrowDownIcon
                      sx={{
                        fontSize: 22,
                        color: 'text.secondary',
                        transform: expandedQuery === index ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }}
                    />
                  </Box>

                  {/* Expanded Monaco Editor */}
                  <Collapse in={expandedQuery === index} timeout={200}>
                    <Divider />
                    <Box sx={{ p: 2, backgroundColor: isDark ? alpha('#000', 0.3) : alpha('#000', 0.02) }}>
                      <Box
                        sx={{
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: `1px solid ${uiColors.border}`,
                          height: Math.min(Math.max(100, (query.query.split('\n').length * 22) + 32), 300),
                        }}
                      >
                        <Editor
                          height="100%"
                          language="sql"
                          theme={isDark ? 'vs-dark' : 'light'}
                          value={query.query}
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 13,
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                            lineNumbers: 'on',
                            folding: false,
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            wordWrap: 'on',
                            padding: { top: 16, bottom: 16 },
                            renderLineHighlight: 'none',
                            scrollbar: { vertical: 'auto', horizontal: 'hidden', verticalScrollbarSize: 8 },
                            overviewRulerLanes: 0,
                            hideCursorInOverviewRuler: true,
                            overviewRulerBorder: false,
                            guides: { indentation: false },
                            contextmenu: false,
                          }}
                        />
                      </Box>
                    </Box>
                  </Collapse>
                </Paper>
              ))}
            </Box>
          )}
        </>
      )}


      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, type: null, target: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRoundedIcon color="warning" />
          {getDialogContent().title}
        </DialogTitle>
        <DialogContent>
          {deleteDialog.type !== 'queries' && (
            <Box sx={{ mb: 2 }}>
              <Chip icon={<StorageRoundedIcon />} label={getDialogContent().database} sx={{ mr: 1 }} />
              <Typography variant="caption" color="text.secondary">
                ({getDialogContent().tableCount} table{getDialogContent().tableCount !== 1 ? 's' : ''})
              </Typography>
            </Box>
          )}

          <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
            {deleteDialog.type === 'queries' ? (
              'Query history helps the AI understand your recent work patterns.'
            ) : (
              <>
                After deletion, the AI will re-learn your database schema on next connection.
                <Box component="ul" sx={{ mt: 1, pl: 2, mb: 0 }}>
                  <li><strong>Schema OUTDATED?</strong> Delete and reconnect to sync.</li>
                  <li><strong>Schema CURRENT?</strong> Deleting is unnecessary.</li>
                </Box>
              </>
            )}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog({ open: false, type: null, target: null })} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default memo(UserDBContextManagerForAI);
