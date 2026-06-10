import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Alert,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Divider,
  Chip,
  Collapse,
  useTheme,
  useMediaQuery,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import Editor from '@monaco-editor/react';
import { registerMonacoThemes, getMonacoThemeName } from '@/theme/index';
import { del, getUserContext } from '@/api';
import { USER } from '@/api/endpoints';
import { queryClient, queryKeys } from '@/api/queryClient';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import { getInteractionColors, getUtilityIconButtonSx } from '@/styles/shared';
import { ConfirmDialog } from '@/components';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import RecentChatIcon from '@/components/icons/RecentChatIcon';
import SchemaIcon from '@/components/icons/SchemaIcon';
const MONACO_QUERY_BASE_OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  lineNumbers: 'off',
  folding: false,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on',
  padding: { top: 12, bottom: 12 },
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  guides: { indentation: false },
  contextmenu: false,
};

const formatTimeAgo = (isoString) => {
  if (!isoString) return 'Unknown';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const registerOpaqueMonacoThemes = (monaco) => registerMonacoThemes(monaco);
function ContextCard({ children, sx = {} }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        borderRadius: '10px',
        border: '1px solid',
        borderColor: alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08),
        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.03 : 0.02),
        overflow: 'hidden',
        transition: 'border-color 150ms ease',
        [HOVER_CAPABLE_QUERY]: {
          '&:hover': {
            borderColor: alpha(theme.palette.text.primary, isDark ? 0.16 : 0.13),
          },
        },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function ContextLoadingSkeleton({ isCompactMobile }) {
  return (
    <Box>
      <Skeleton variant="rounded" height={66} sx={{ mb: 2.5, borderRadius: 2 }} />

      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 1.5 },
          mb: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', width: { xs: '100%', sm: 'auto' }, gap: 1 }}>
          <Skeleton variant="rounded" height={44} width={isCompactMobile ? '100%' : 124} sx={{ borderRadius: 1.25, flex: 1 }} />
          <Skeleton variant="rounded" height={44} width={isCompactMobile ? '100%' : 124} sx={{ borderRadius: 1.25, flex: 1 }} />
        </Box>
        <Skeleton
          variant="rounded"
          height={44}
          width={isCompactMobile ? '100%' : 116}
          sx={{ borderRadius: 1.25, alignSelf: { xs: 'stretch', sm: 'center' } }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {Array.from({ length: 3 }).map((_, index) => (
          <ContextCard key={`context-loading-${index}`} sx={{ p: 0, overflow: 'hidden' }}>
            <Box
              sx={{
                py: { xs: 1.25, sm: 1.5 },
                px: 2,
                minHeight: 52,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Skeleton variant="circular" width={20} height={20} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton variant="text" width="42%" height={20} />
                <Skeleton variant="text" width="66%" height={16} />
              </Box>
              <Skeleton variant="rounded" width={28} height={28} sx={{ borderRadius: 1 }} />
            </Box>
          </ContextCard>
        ))}
      </Box>
    </Box>
  );
}

function EmptyState({ icon: _Icon, title, subtitle }) {
  const Icon = _Icon;
  return (
    <ContextCard sx={{ textAlign: 'center', py: 4 }}>
      <Icon sx={{ fontSize: 44, color: 'text.disabled', mb: 1.5 }} />
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
          {subtitle}
        </Typography>
      )}
    </ContextCard>
  );
}
function UserDBContextManagerForAI() {
  const [loading, setLoading] = useState(true);
  const [schemas, setSchemas] = useState([]);
  const [queries, setQueries] = useState([]);
  const [activeView, setActiveView] = useState('schemas'); // 'schemas' | 'queries'
  const [expandedSchema, setExpandedSchema] = useState(null);
  const [expandedQuery, setExpandedQuery] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, type: null, target: null });
  const [error, setError] = useState(null);

  const theme = useTheme();
  const neutralInteraction = useMemo(() => getInteractionColors(theme), [theme]);
  const utilityIconButtonSx = useMemo(() => getUtilityIconButtonSx(theme), [theme]);
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog({ open: false, type: null, target: null });
  }, []);
  const queryMonacoOptions = useMemo(() => ({
    ...MONACO_QUERY_BASE_OPTIONS,
    fontSize: theme.typography.uiCodeCompact.fontSizePx,
    fontFamily: theme.typography.fontFamilyMono,
    scrollbar: {
      vertical: 'auto',
      horizontal: 'hidden',
      verticalScrollbarSize: isCompactMobile ? 4 : 6,
    },
  }), [theme.typography.fontFamilyMono, theme.typography.uiCodeCompact.fontSizePx, isCompactMobile]);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.userContext,
        queryFn: getUserContext,
        staleTime: 60 * 1000,
      });
      if (data.status === 'success') {
        setSchemas(data.schemas || []);
        setQueries(data.recent_queries || []);
      } else {
        setError(data.message || 'Failed to load context');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const handleDelete = useCallback(async () => {
    const { type, target } = deleteDialog;
    closeDeleteDialog();

    try {
      let url;
      if (type === 'schema') {
        url = USER.CONTEXT_DELETE_SCHEMA(target);
      } else if (type === 'all-schemas') {
        url = USER.CONTEXT_DELETE_ALL_SCHEMAS;
      } else if (type === 'queries') {
        url = USER.CONTEXT_DELETE_QUERIES;
      }
      if (!url) return;
      await del(url);
      await queryClient.invalidateQueries({ queryKey: queryKeys.userContext });
      fetchContext();
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  }, [closeDeleteDialog, deleteDialog, fetchContext]);

  const openDeleteDialog = useCallback((type, target = null) => {
    setDeleteDialog({ open: true, type, target });
  }, []);

  const toggleSchemaExpand = useCallback((database) => {
    setExpandedSchema(prev => prev === database ? null : database);
  }, []);

  const toggleQueryExpand = useCallback((index) => {
    setExpandedQuery(prev => prev === index ? null : index);
  }, []);

  const dialogContent = useMemo(() => {
    const { type } = deleteDialog;
    if (type === 'schema') {
      return {
        title: 'Delete schema context?',
        description: 'Are you sure you want to delete this schema context? This action cannot be undone.',
        confirmText: 'Delete',
      };
    }
    if (type === 'all-schemas') {
      return {
        title: 'Delete all schema context?',
        description: 'Are you sure you want to delete all saved schema context? This action cannot be undone.',
        confirmText: 'Delete all',
      };
    }
    if (type === 'queries') {
      return {
        title: 'Clear query history?',
        description: 'Are you sure you want to clear your query history? This action cannot be undone.',
        confirmText: 'Clear history',
      };
    }
    return {};
  }, [deleteDialog]);
  if (loading) {
    return <ContextLoadingSkeleton isCompactMobile={isCompactMobile} />;
  }

  return (
    <Box>
      {/* Info banner — subdued, inline style */}
      <Box
        sx={{
          display: 'flex',
          gap: 1.25,
          mb: 3,
          p: 0,
          color: 'text.secondary',
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 16, mt: '2px', flexShrink: 0, opacity: 0.7 }} />
        <Typography sx={{ ...theme.typography.uiCaptionMd, color: 'text.secondary', lineHeight: 1.5 }}>
          This is the AI's memory of your database structure. Delete only if your schema has changed.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Toolbar: segment control + clear action */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <ToggleButtonGroup
          value={activeView}
          exclusive
          onChange={(_e, v) => v && setActiveView(v)}
          size="small"
        >
          <ToggleButton value="schemas">
            <SchemaIcon sx={{ width: 15, height: 15 }} />
            Schemas
            {schemas.length > 0 && (
              <Box
                component="span"
                sx={{
                  ml: 0.5,
                  px: 0.75,
                  height: 18,
                  minWidth: 18,
                  borderRadius: '9px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: neutralInteraction.activeBackground,
                  ...theme.typography.uiCaptionMd,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {schemas.length}
              </Box>
            )}
          </ToggleButton>
          <ToggleButton value="queries">
            <RecentChatIcon sx={{ width: 15, height: 15 }} />
            Queries
            {queries.length > 0 && (
              <Box
                component="span"
                sx={{
                  ml: 0.5,
                  px: 0.75,
                  height: 18,
                  minWidth: 18,
                  borderRadius: '9px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: neutralInteraction.activeBackground,
                  ...theme.typography.uiCaptionMd,
                  fontWeight: 600,
                  lineHeight: 1,
                }}
              >
                {queries.length}
              </Box>
            )}
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Clear all — semantic danger action, only shown when there's data */}
        {((activeView === 'schemas' && schemas.length > 0) ||
          (activeView === 'queries' && queries.length > 0)) && (
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => openDeleteDialog(activeView === 'schemas' ? 'all-schemas' : 'queries')}
            sx={{
              ...theme.typography.uiNavItem,
              textTransform: 'none',
              fontWeight: 500,
              px: 1.5,
              height: 32,
              borderRadius: '8px',
              minWidth: 0,
            }}
          >
            Clear all
          </Button>
        )}
      </Box>
      {activeView === 'schemas' && (
        <>
          {schemas.length === 0 ? (
            <EmptyState
              icon={SchemaIcon}
              title="No cached schemas"
              subtitle="Connect to a database to cache its schema"
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {schemas.map((schema) => {
                const tableList = Array.isArray(schema.tables) ? schema.tables : [];
                const columnsByTable = schema.columns && typeof schema.columns === 'object' ? schema.columns : {};
                const tableCount = schema.table_count ?? tableList.length;
                return (
                  <ContextCard key={schema.database} sx={{ p: 0, overflow: 'hidden' }}>
                  <ListItemButton
                    onClick={() => toggleSchemaExpand(schema.database)}
                    sx={{ py: { xs: 1.25, sm: 1.5 }, px: 2, minHeight: 52 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <SchemaIcon sx={{ width: 20, height: 20, opacity: 0.78 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={600}>
                          {schema.database}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {tableCount} table{tableCount !== 1 ? 's' : ''} - {formatTimeAgo(schema.cached_at)}
                        </Typography>
                      }
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Tooltip title="Remove schema context">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); openDeleteDialog('schema', schema.database); }}
                          aria-label="Remove schema context"
                          sx={{
                            ...utilityIconButtonSx,
                            width: 32,
                            height: 32,
                            minWidth: 32,
                            minHeight: 32,
                            color: 'text.disabled',
                            [HOVER_CAPABLE_QUERY]: {
                              '&:hover': {
                                ...utilityIconButtonSx[HOVER_CAPABLE_QUERY]?.['&:hover'],
                                color: 'error.main',
                              },
                            },
                          }}
                        >
                          <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      </Tooltip>
                      <KeyboardArrowDownIcon
                        sx={{
                          fontSize: 20,
                          color: 'text.secondary',
                          transform: expandedSchema === schema.database ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </Box>
                  </ListItemButton>
                  <Collapse in={expandedSchema === schema.database} timeout={200}>
                    <Divider />
                    <Box sx={{ p: 2, backgroundColor: alpha(theme.palette.background.default, 0.5) }}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.secondary',
                          ...theme.typography.uiCaptionMd,
                          textTransform: 'none',
                          letterSpacing: 0,
                          fontWeight: 600,
                          mb: 1,
                          display: 'block',
                        }}
                      >
                        Tables
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                        {tableList.slice(0, 15).map((table) => (
                          <Chip
                            key={table}
                            size="small"
                            icon={<SchemaIcon sx={{ width: 12, height: 12 }} />}
                            label={table}
                            sx={{
                              height: 24,
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          />
                        ))}
                        {tableList.length > 15 && (
                          <Chip
                            size="small"
                            label={`+${tableList.length - 15} more`}
                            sx={{ height: 24 }}
                          />
                        )}
                      </Box>
                      {Object.entries(columnsByTable).slice(0, 2).map(([tableName, columns]) => (
                        <Box key={tableName} sx={{ mb: 1 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <ViewColumnRoundedIcon sx={{ fontSize: 12 }} />
                            {tableName} ({Array.isArray(columns) ? columns.length : 0} columns)
                          </Typography>
                          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', pl: 2 }}>
                            {Array.isArray(columns)
                              ? columns.slice(0, 6).map(c => typeof c === 'object' ? c.name : c).join(', ')
                              : 'No columns'}
                            {Array.isArray(columns) && columns.length > 6 && ` +${columns.length - 6} more`}
                          </Typography>
                        </Box>
                      ))}
                      {Object.keys(columnsByTable).length > 2 && (
                        <Typography variant="caption" color="text.disabled">
                          ...and {Object.keys(columnsByTable).length - 2} more tables
                        </Typography>
                      )}
                    </Box>
                  </Collapse>
                  </ContextCard>
                );
              })}
            </Box>
          )}
        </>
      )}
      {activeView === 'queries' && (
        <>
          {queries.length === 0 ? (
            <EmptyState
              icon={RecentChatIcon}
              title="No queries stored"
              subtitle="Run SQL queries to build history"
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {queries.map((query, index) => (
                <ContextCard key={`${query.executed_at || index}-${query.database || 'db'}`} sx={{ p: 0, overflow: 'hidden' }}>
                  <Box
                    onClick={() => toggleQueryExpand(index)}
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
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
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          icon={<DatabaseIcon sx={{ width: 12, height: 12 }} />}
                          label={query.database || 'Unknown DB'}
                          sx={{
                            height: 22,
                            fontWeight: 500,
                            '& .MuiChip-icon': { color: 'inherit' },
                          }}
                        />
                      <Typography variant="caption" color="text.secondary">
                        {query.row_count ?? 0} row{(query.row_count ?? 0) !== 1 ? 's' : ''}
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        - {formatTimeAgo(query.executed_at)}
                      </Typography>
                      </Box>
                    </Box>
                    <KeyboardArrowDownIcon
                      sx={{
                        fontSize: 20,
                        color: 'text.secondary',
                        transform: expandedQuery === index ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                      }}
                    />
                  </Box>
                  <Collapse in={expandedQuery === index} timeout={200}>
                    <Divider />
                    <Box sx={{ p: 2, backgroundColor: alpha(theme.palette.background.default, 0.5) }}>
                      <Box
                        sx={{
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'divider',
                          height: Math.min(
                            Math.max(80, (((query.query || '').split('\n').length || 1) * (isCompactMobile ? 18 : 20)) + 28),
                            isCompactMobile ? 180 : 200
                          ),
                        }}
                      >
                        <Editor
                          height="100%"
                          language="sql"
                          theme={getMonacoThemeName(theme.palette.mode)}
                          value={query.query || ''}
                          beforeMount={registerOpaqueMonacoThemes}
                          options={queryMonacoOptions}
                        />
                      </Box>
                    </Box>
                  </Collapse>
                </ContextCard>
              ))}
            </Box>
          )}
        </>
      )}
      <ConfirmDialog
        open={deleteDialog.open}
        onClose={closeDeleteDialog}
        onConfirm={handleDelete}
        title={dialogContent.title}
        description={dialogContent.description}
        confirmText={dialogContent.confirmText}
        intent="danger"
        maxWidth="xs"
      />
    </Box>
  );
}

export default memo(UserDBContextManagerForAI);
