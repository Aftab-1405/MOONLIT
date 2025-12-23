import { useState, useEffect } from 'react';
import { Box, Typography, Collapse, useTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import DataArrayRoundedIcon from '@mui/icons-material/DataArrayRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

// Animations
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const dotPulse = keyframes`
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
`;

// Tool configurations
const TOOL_CONFIG = {
  'get_connection_status': { action: 'Checking connection', pastAction: 'Checked connection', icon: LinkRoundedIcon },
  'get_database_list': { action: 'Listing databases', pastAction: 'Listed databases', icon: StorageRoundedIcon },
  'get_database_schema': { action: 'Fetching schema', pastAction: 'Fetched schema', icon: TableChartRoundedIcon },
  'get_table_columns': { action: 'Getting table structure', pastAction: 'Got table structure', icon: ViewColumnRoundedIcon },
  'execute_query': { action: 'Running query', pastAction: 'Executed query', icon: PlayArrowRoundedIcon },
  'get_recent_queries': { action: 'Fetching query history', pastAction: 'Fetched query history', icon: HistoryRoundedIcon },
  'get_sample_data': { action: 'Getting sample data', pastAction: 'Got sample data', icon: DataArrayRoundedIcon },
};

// Animated dots for loading states
const AnimatedDots = () => (
  <Box component="span" sx={{ display: 'inline-flex', gap: '3px', ml: 0.75 }}>
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        component="span"
        sx={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          animation: `${dotPulse} 1.4s ease-in-out infinite`,
          animationDelay: `${i * 0.16}s`,
        }}
      />
    ))}
  </Box>
);

/**
 * Inline Thinking Block - Shows AI's reasoning process
 */
export const InlineThinkingBlock = ({ content, isActive, isFirst = false }) => {
  const [expanded, setExpanded] = useState(isActive);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    if (isActive) {
      setExpanded(true);
    } else if (content && !isActive) {
      const timer = setTimeout(() => setExpanded(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isActive, content]);

  if (!content && !isActive) return null;

  // TRUE MONOCHROME: Use theme's primary color for thinking state
  // Creates subtle, elegant distinction through opacity and borders
  const colors = {
    bg: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
    border: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1),
    icon: theme.palette.primary.main,
    text: theme.palette.text.primary,
  };

  return (
    <Box sx={{ my: isFirst ? 0 : 1.5, animation: `${fadeInUp} 0.3s ease-out` }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.625,
          borderRadius: 2,
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': { backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.06) },
        }}
      >
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 16,
            color: colors.icon,
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
          }}
        />
        <PsychologyRoundedIcon sx={{ fontSize: 15, color: colors.icon }} />
        <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 500, color: colors.text }}>
          {isActive ? 'Thinking' : 'Thought process'}
        </Typography>
        {isActive && <AnimatedDots />}
        {!expanded && content && (
          <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary', ml: 0.5 }}>
            ({content.length} chars)
          </Typography>
        )}
      </Box>

      <Collapse in={expanded} timeout={200}>
        <Box sx={{ mt: 0.75, ml: 1, pl: 1.5, borderLeft: `2px solid ${alpha(colors.icon, 0.3)}` }}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 1.5,
              backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.04 : 0.03),
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              fontSize: '0.72rem',
              lineHeight: 1.6,
              color: isDark ? alpha('#fff', 0.7) : alpha('#000', 0.6),
              maxHeight: 180,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {content || 'Processing...'}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

/**
 * Inline Tool Block - Shows tool execution inline
 */
export const InlineToolBlock = ({ tool, isFirst = false, onOpenSqlEditor }) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const isRunning = tool.status === 'running';
  const parsedResult = parseJSON(tool.result);
  const parsedArgs = parseJSON(tool.args);
  // Check for error using structured output format (success: false or error field)
  const isError = tool.status === 'error' || parsedResult?.success === false || parsedResult?.error;
  
  const config = TOOL_CONFIG[tool.name] || {
    action: formatToolName(tool.name),
    pastAction: formatToolName(tool.name),
    icon: CodeRoundedIcon,
  };
  
  const Icon = config.icon;
  const displayName = isRunning ? config.action : config.pastAction;

  // NOW USING THEME SYSTEM - Colors come from theme.palette
  const colors = {
    running: {
      bg: alpha(theme.palette.info.main, isDark ? 0.1 : 0.08),
      border: alpha(theme.palette.info.main, isDark ? 0.25 : 0.2),
      text: theme.palette.info.main,
      icon: theme.palette.info.main,
    },
    success: {
      bg: alpha(theme.palette.success.main, isDark ? 0.08 : 0.06),
      border: alpha(theme.palette.success.main, isDark ? 0.2 : 0.15),
      text: theme.palette.success.main,
      icon: theme.palette.success.main,
    },
    error: {
      bg: alpha(theme.palette.error.main, isDark ? 0.1 : 0.08),
      border: alpha(theme.palette.error.main, isDark ? 0.25 : 0.2),
      text: theme.palette.error.main,
      icon: theme.palette.error.main,
    },
  };

  const scheme = isError ? colors.error : isRunning ? colors.running : colors.success;

  return (
    <Box sx={{ my: isFirst ? 0 : 1.5, animation: `${fadeInUp} 0.3s ease-out` }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.625,
          borderRadius: 2,
          backgroundColor: scheme.bg,
          border: `1px solid ${scheme.border}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': { backgroundColor: isDark ? alpha(scheme.icon, 0.15) : alpha(scheme.icon, 0.1) },
        }}
      >
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 16,
            color: scheme.icon,
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
          }}
        />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isRunning ? (
            <AutorenewRoundedIcon sx={{ fontSize: 15, color: scheme.icon, animation: `${spin} 1s linear infinite` }} />
          ) : isError ? (
            <ErrorRoundedIcon sx={{ fontSize: 15, color: scheme.icon }} />
          ) : (
            <CheckCircleRoundedIcon sx={{ fontSize: 15, color: scheme.icon }} />
          )}
        </Box>
        <Icon sx={{ fontSize: 14, color: scheme.text }} />
        <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 500, color: scheme.text }}>
          {displayName}
        </Typography>
        {isRunning && <AnimatedDots />}
        {!isRunning && !expanded && parsedResult && (
          <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.secondary', ml: 0.25 }}>
            • {getResultSummary(tool.name, parsedResult)}
          </Typography>
        )}
      </Box>

      <Collapse in={expanded} timeout={200}>
        <Box sx={{ mt: 0.75, ml: 1, pl: 1.5, borderLeft: `2px solid ${scheme.border}` }}>
          <Box sx={{ p: 1.25, borderRadius: 1.5, backgroundColor: isDark ? alpha(scheme.icon, 0.05) : alpha(scheme.icon, 0.03) }}>
            {parsedArgs?.sql_query && (
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  Query
                </Typography>
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    backgroundColor: isDark ? alpha('#000', 0.3) : alpha('#000', 0.04),
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    fontSize: '0.72rem',
                    color: isDark ? '#e2e8f0' : '#1e293b',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    border: `1px solid ${isDark ? alpha('#fff', 0.06) : alpha('#000', 0.06)}`,
                  }}
                >
                  {parsedArgs.sql_query}
                </Box>
              </Box>
            )}

            {parsedArgs && Object.keys(parsedArgs).filter(k => !['sql_query', 'rationale'].includes(k)).length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  Parameters
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {Object.entries(parsedArgs)
                    .filter(([key]) => !['sql_query', 'rationale'].includes(key))
                    .map(([key, value]) => (
                      <Box
                        key={key}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 0.75,
                          py: 0.25,
                          borderRadius: 1,
                          backgroundColor: isDark ? alpha('#fff', 0.05) : alpha('#000', 0.04),
                          fontSize: '0.7rem',
                        }}
                      >
                        <span style={{ color: theme.palette.text.secondary }}>{key}:</span>
                        <span style={{ fontWeight: 500 }}>{String(value)}</span>
                      </Box>
                    ))}
                </Box>
              </Box>
            )}

            {parsedResult && !isRunning && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Result
                  </Typography>
                  {tool.name === 'execute_query' && !isError && parsedResult?.success !== false && onOpenSqlEditor && (
                    <Box
                      component="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const query = parsedArgs?.query || '';
                        const results = {
                          columns: parsedResult?.columns || [],
                          result: parsedResult?.data || [],
                          row_count: parsedResult?.row_count || 0,
                          truncated: parsedResult?.truncated || false,
                        };
                        onOpenSqlEditor(query, results);
                      }}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1,
                        py: 0.25,
                        border: 'none',
                        borderRadius: 1,
                        backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1),
                        color: 'primary.main',
                        fontSize: '0.65rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.25 : 0.15),
                        },
                      }}
                    >
                      <OpenInNewRoundedIcon sx={{ fontSize: 12 }} />
                      Open in Editor
                    </Box>
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: isError ? 'error.main' : 'text.primary' }}>
                  {getDetailedResult(tool.name, parsedResult)}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

// Helpers
function parseJSON(str) {
  if (!str || str === 'null' || str === '{}') return null;
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch {
    return null;
  }
}

function formatToolName(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getResultSummary(name, result) {
  if (!result) return '';
  if (!result.success || result.error) return 'failed';
  
  // Uses new structured output format from backend
  const summaries = {
    'get_connection_status': () => result.connected ? `${result.database || 'connected'}` : 'not connected',
    'get_database_list': () => `${result.count ?? result.databases?.length ?? 0} found`,
    'get_database_schema': () => `${result.table_count ?? result.tables?.length ?? 0} tables`,
    'get_table_columns': () => `${result.column_count ?? result.columns?.length ?? 0} columns`,
    'execute_query': () => `${result.row_count ?? 0} rows`,
    'get_recent_queries': () => `${result.count ?? 0} queries`,
    'get_sample_data': () => `${result.row_count ?? 0} rows`,
  };
  
  return summaries[name]?.() || 'done';
}

function getDetailedResult(name, result) {
  if (!result) return 'No result';
  if (!result.success || result.error) return `Error: ${result.error}`;

  // Uses new structured output format from backend
  const details = {
    'get_connection_status': () => {
      if (!result.connected) return 'Not connected to any database';
      let msg = `Connected to ${result.database || 'database'}`;
      if (result.db_type) msg += ` (${result.db_type.toUpperCase()})`;
      if (result.host) msg += ` on ${result.host}`;
      return msg;
    },
    'get_database_list': () => {
      const count = result.count ?? result.databases?.length ?? 0;
      return `Found ${count} database${count !== 1 ? 's' : ''} available`;
    },
    'get_database_schema': () => {
      const count = result.table_count ?? result.tables?.length ?? 0;
      const tables = result.tables?.slice(0, 5).join(', ') || '';
      return `Retrieved ${count} tables${tables ? `: ${tables}${count > 5 ? '...' : ''}` : ''}`;
    },
    'get_table_columns': () => {
      const count = result.column_count ?? result.columns?.length ?? 0;
      const cols = result.columns?.slice(0, 5).join(', ') || '';
      return `Table has ${count} columns${cols ? `: ${cols}${count > 5 ? '...' : ''}` : ''}`;
    },
    'execute_query': () => {
      let msg = `Query returned ${result.row_count ?? 0} rows`;
      if (result.truncated) msg += ' (truncated)';
      if (result.column_count) msg += ` with ${result.column_count} columns`;
      return msg;
    },
    'get_recent_queries': () => `Found ${result.count ?? 0} recent queries`,
    'get_sample_data': () => {
      const count = result.row_count ?? 0;
      return `Retrieved ${count} sample row${count !== 1 ? 's' : ''} from ${result.table || 'table'}`;
    },
  };

  return details[name]?.() || 'Completed successfully';
}
