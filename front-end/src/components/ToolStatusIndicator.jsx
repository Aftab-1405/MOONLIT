import { useState } from 'react';
import { Box, Typography, Collapse, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import ErrorIcon from '@mui/icons-material/Error';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HistoryIcon from '@mui/icons-material/History';
import DataArrayIcon from '@mui/icons-material/DataArray';
import LinkIcon from '@mui/icons-material/Link';

/**
 * Clean Tool Status Indicator
 */
const ToolStatusIndicator = ({ tools = [] }) => {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();

  if (!tools || tools.length === 0) return null;

  const tool = tools[0];

  // Get tool-specific icon
  const getToolIcon = (name) => {
    const iconProps = { sx: { fontSize: 14 } };
    switch (name) {
      case 'get_connection_status':
        return <LinkIcon {...iconProps} />;
      case 'get_database_list':
        return <StorageIcon {...iconProps} />;
      case 'get_database_schema':
        return <TableChartIcon {...iconProps} />;
      case 'get_table_columns':
        return <ViewColumnIcon {...iconProps} />;
      case 'execute_query':
        return <PlayArrowIcon {...iconProps} />;
      case 'get_recent_queries':
        return <HistoryIcon {...iconProps} />;
      case 'get_sample_data':
        return <DataArrayIcon {...iconProps} />;
      default:
        return <StorageIcon {...iconProps} />;
    }
  };

  // Get friendly display name
  const getToolDisplayName = (name) => {
    const displayNames = {
      'get_connection_status': 'Checking connection',
      'get_database_list': 'Listing databases',
      'get_database_schema': 'Fetching schema',
      'get_table_columns': 'Getting table structure',
      'execute_query': 'Executing query',
      'get_recent_queries': 'Fetching query history',
      'get_sample_data': 'Getting sample data'
    };
    return displayNames[name] || name.replace(/_/g, ' ');
  };

  // Parse result
  const parseResult = (result) => {
    if (!result || result === 'null') return null;
    try {
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch {
      return null;
    }
  };

  // Parse tool arguments (NEW)
  const parseArgs = (args) => {
    if (!args || args === 'null' || args === '{}') return null;
    try {
      return typeof args === 'string' ? JSON.parse(args) : args;
    } catch {
      return null;
    }
  };

  // Get inline summary
  const getInlineSummary = (name, result) => {
    const parsed = parseResult(result);
    if (!parsed) return null;
    if (parsed.error) return 'error';
    
    switch (name) {
      case 'get_connection_status':
        if (parsed.connected) {
          return parsed.database ? `${parsed.database}` : 'connected';
        }
        return 'not connected';
      case 'get_database_list':
        return parsed.databases ? `${parsed.databases} found` : null;
      case 'get_database_schema':
        return parsed.tables ? `${parsed.tables} tables` : null;
      case 'get_table_columns':
        return parsed.columns ? `${parsed.columns} columns` : null;
      case 'execute_query':
        return parsed.rows ? `${parsed.rows} rows` : (parsed.columns ? `${parsed.columns} cols` : null);
      case 'get_recent_queries':
        return parsed.count ? `${parsed.count} queries` : null;
      case 'get_sample_data':
        return parsed.rows ? `${parsed.rows} rows` : null;
      default:
        return null;
    }
  };

  // Get expanded details
  const getExpandedDetails = (name, result) => {
    const parsed = parseResult(result);
    if (!parsed) return { description: 'No data available', details: [] };

    if (parsed.error) {
      return {
        description: 'An error occurred',
        details: [{ label: 'Error', value: parsed.message || parsed.error, isError: true }]
      };
    }

    switch (name) {
      case 'get_connection_status':
        return {
          description: 'Database connection verification',
          details: [
            { label: 'Status', value: parsed.connected ? '✓ Connected' : '✗ Disconnected', highlight: parsed.connected },
            parsed.database && { label: 'Database', value: parsed.database },
            parsed.db_type && { label: 'Type', value: parsed.db_type.toUpperCase() },
            parsed.host && { label: 'Host', value: parsed.host }
          ].filter(Boolean)
        };

      case 'get_database_list':
        return {
          description: 'Available databases on server',
          details: [
            { label: 'Count', value: `${parsed.databases || 0} databases` },
            parsed.current && { label: 'Active', value: parsed.current }
          ].filter(Boolean)
        };

      case 'get_database_schema':
        return {
          description: 'Database schema structure',
          details: [
            { label: 'Tables', value: `${parsed.tables || 0} tables found` },
            parsed.database && { label: 'Database', value: parsed.database }
          ].filter(Boolean)
        };

      case 'get_table_columns':
        return {
          description: 'Table column information',
          details: [
            { label: 'Columns', value: `${parsed.columns || 0} columns` },
            parsed.table && { label: 'Table', value: parsed.table }
          ].filter(Boolean)
        };

      case 'execute_query':
        return {
          description: 'SQL query execution result',
          details: [
            { label: 'Results', value: `${parsed.rows || parsed.columns || 0} rows returned` }
          ]
        };

      case 'get_recent_queries':
        return {
          description: 'Recent query history',
          details: [
            { label: 'Found', value: `${parsed.count || 0} recent queries` }
          ]
        };

      case 'get_sample_data':
        return {
          description: 'Sample data preview',
          details: [
            { label: 'Rows', value: `${parsed.rows || 0} sample rows` },
            parsed.table && { label: 'Table', value: parsed.table }
          ].filter(Boolean)
        };

      default:
        return {
          description: 'Tool executed successfully',
          details: [{ label: 'Status', value: 'Complete' }]
        };
    }
  };

  const parsed = parseResult(tool.result);
  const parsedArgs = parseArgs(tool.args);  // NEW: parse arguments
  const isError = parsed?.error || tool.status === 'error';
  const isRunning = tool.status === 'running';
  const inlineSummary = isRunning ? null : getInlineSummary(tool.name, tool.result);
  const expandedInfo = getExpandedDetails(tool.name, tool.result);

  // Simple color scheme
  const colors = {
    success: { 
      bg: alpha(theme.palette.primary.main, 0.08), 
      border: alpha(theme.palette.primary.main, 0.2), 
      text: theme.palette.primary.main 
    },
    running: { 
      bg: alpha(theme.palette.secondary.main, 0.08), 
      border: alpha(theme.palette.secondary.main, 0.2), 
      text: theme.palette.secondary.main 
    },
    error: { 
      bg: alpha(theme.palette.error.main, 0.08), 
      border: alpha(theme.palette.error.main, 0.2), 
      text: theme.palette.error.main 
    }
  };
  const colorScheme = isError ? colors.error : isRunning ? colors.running : colors.success;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        borderRadius: 2,
        bgcolor: colorScheme.bg,
        border: `1px solid ${colorScheme.border}`,
        transition: 'all 0.2s ease',
        overflow: 'hidden',
        maxWidth: '100%',
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          py: 0.75,
          px: 1.25,
          cursor: 'pointer',
          '&:hover': {
            bgcolor: alpha(theme.palette.common.white, 0.03)
          }
        }}
      >
        {/* Expand Arrow */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)'
          }}
        >
          <KeyboardArrowDownIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        </Box>

        {/* Tool Icon */}
        <Box sx={{ color: colorScheme.text, display: 'flex', alignItems: 'center' }}>
          {getToolIcon(tool.name)}
        </Box>

        {/* Status Icon */}
        {isError ? (
          <ErrorIcon sx={{ fontSize: 14, color: colors.error.text }} />
        ) : isRunning ? (
          <AutorenewIcon 
            sx={{ 
              fontSize: 14, 
              color: colors.running.text,
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }} 
          />
        ) : (
          <CheckCircleIcon sx={{ fontSize: 14, color: colors.success.text }} />
        )}

        {/* Tool Name */}
        <Typography
          component="span"
          sx={{
            color: colorScheme.text,
            fontWeight: 500,
            fontSize: '0.8rem',
          }}
        >
          {getToolDisplayName(tool.name)}
        </Typography>

        {/* Inline Summary */}
        {inlineSummary && !expanded && (
          <Typography
            component="span"
            sx={{
              color: 'text.secondary',
              fontSize: '0.75rem',
              opacity: 0.8,
            }}
          >
            • {inlineSummary}
          </Typography>
        )}
      </Box>

      {/* Expanded Panel */}
      <Collapse in={expanded} timeout={200}>
        <Box
          sx={{
            px: 1.5,
            pb: 1.25,
            pt: 0.75,
            borderTop: `1px solid ${colorScheme.border}`,
          }}
        >
          {/* Arguments Section (NEW) */}
          {parsedArgs && Object.keys(parsedArgs).length > 0 && (
            <Box sx={{ mb: 1 }}>
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  color: 'text.secondary',
                  mb: 0.5,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Arguments
              </Typography>
              
              {/* Special formatting for SQL queries */}
              {parsedArgs.sql_query && (
                <Box
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.common.black, 0.2),
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    color: 'text.primary',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    mb: 0.75,
                  }}
                >
                  {parsedArgs.sql_query}
                </Box>
              )}
              
              {/* Other arguments as key-value pairs */}
              {Object.entries(parsedArgs)
                .filter(([key]) => key !== 'sql_query' && key !== 'rationale')
                .map(([key, value]) => (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.25,
                      px: 0.75,
                      borderRadius: 1,
                      bgcolor: alpha(theme.palette.common.white, 0.03),
                    }}
                  >
                    <Typography
                      component="span"
                      sx={{ fontSize: '0.7rem', color: 'text.secondary', minWidth: 55 }}
                    >
                      {key}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{ fontSize: '0.75rem', color: 'text.primary', fontWeight: 500 }}
                    >
                      {String(value)}
                    </Typography>
                  </Box>
                ))}
            </Box>
          )}

          {/* Description */}
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: 'text.secondary',
              mb: 1,
              fontStyle: 'italic',
            }}
          >
            {isRunning ? 'Executing...' : expandedInfo.description}
          </Typography>

          {/* Detail Grid - only show when not running */}
          {!isRunning && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {expandedInfo.details.map((detail, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: 0.25,
                    px: 0.75,
                    borderRadius: 1,
                    bgcolor: detail.isError ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.common.white, 0.03)
                  }}
                >
                  <Typography
                    component="span"
                    sx={{ 
                      fontSize: '0.7rem', 
                      color: 'text.secondary',
                      minWidth: 55,
                    }}
                  >
                    {detail.label}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{ 
                      fontSize: '0.75rem', 
                      color: detail.highlight ? colors.success.text : detail.isError ? colors.error.text : 'text.primary',
                      fontWeight: 500
                    }}
                  >
                    {detail.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Tool ID Footer */}
          <Typography
            sx={{
              fontSize: '0.6rem',
              color: 'text.secondary',
              mt: 1,
              pt: 0.5,
              borderTop: '1px solid rgba(255,255,255,0.05)',
              opacity: 0.5,
              fontFamily: 'monospace'
            }}
          >
            {tool.name}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

export default ToolStatusIndicator;
