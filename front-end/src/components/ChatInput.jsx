import { useState, useEffect, useCallback, memo } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Tooltip, 
  Typography, 
  Chip, 
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CableOutlinedIcon from '@mui/icons-material/CableOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import { useTheme } from '@mui/material/styles';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';

function ChatInput({ 
  onSend,
  onStop,
  isStreaming = false,
  disabled = false, 
  // Database/Schema props
  isConnected = false,
  dbType = null,
  currentDatabase = null,
  availableDatabases = [],
  onDatabaseSwitch,
  // Control suggestions visibility
  showSuggestions = true,
  // SQL Editor toggle
  onOpenSqlEditor,
}) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Use ThemeContext for reasoning state (syncs with Settings Modal)
  const { settings, updateSetting } = useCustomTheme();
  const reasoningEnabled = settings.enableReasoning ?? true;

  // Schema state
  const [schemas, setSchemas] = useState([]);
  const [currentSchema, setCurrentSchema] = useState('public');
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaAnchor, setSchemaAnchor] = useState(null);

  // Database menu anchor
  const [dbAnchor, setDbAnchor] = useState(null);

  const isPostgreSQL = dbType?.toLowerCase() === 'postgresql';
  const showSchemaSelector = isConnected && isPostgreSQL && schemas.length > 0;
  const showDatabaseSelector = isConnected && availableDatabases.length > 1;

  // Toggle reasoning via ThemeContext (syncs everywhere)
  const toggleReasoning = useCallback(() => {
    updateSetting('enableReasoning', !reasoningEnabled);
  }, [updateSetting, reasoningEnabled]);

  // Fetch schemas function
  const fetchSchemas = useCallback(async () => {
    setSchemaLoading(true);
    try {
      const response = await fetch('/get_schemas');
      const data = await response.json();
      
      if (data.status === 'success') {
        setSchemas(data.schemas || []);
        setCurrentSchema(data.current_schema || 'public');
      }
    } catch (err) {
      console.error('Failed to fetch schemas:', err);
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  // Fetch schemas when connected to PostgreSQL
  useEffect(() => {
    if (isConnected && currentDatabase && isPostgreSQL) {
      fetchSchemas();
    } else {
      setSchemas([]);
      setCurrentSchema('public');
    }
  }, [isConnected, currentDatabase, isPostgreSQL, fetchSchemas]);

  const handleSchemaChange = useCallback(async (schema) => {
    setSchemaAnchor(null);
    if (schema === currentSchema) return;
    
    setSchemaLoading(true);
    try {
      const response = await fetch('/select_schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schema }),
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        setCurrentSchema(schema);
      }
    } catch (err) {
      console.error('Failed to select schema:', err);
    } finally {
      setSchemaLoading(false);
    }
  }, [currentSchema]);

  const handleDatabaseChange = useCallback((dbName) => {
    setDbAnchor(null);
    if (dbName === currentDatabase) return;
    onDatabaseSwitch?.(dbName);
  }, [currentDatabase, onDatabaseSwitch]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  }, [message, disabled, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const hasText = message.trim().length > 0;

  // Suggestion chips
  const suggestions = [
    { 
      label: 'Check Connection', 
      icon: <CableOutlinedIcon sx={{ fontSize: 14 }} />, 
      action: () => onSend?.('Check my database connection status and show connection details') 
    },
    { 
      label: 'Schema Details', 
      icon: <AccountTreeOutlinedIcon sx={{ fontSize: 14 }} />, 
      action: () => onSend?.('Show me the database schema with all tables and their columns') 
    },
    { 
      label: 'Recent Queries', 
      icon: <HistoryOutlinedIcon sx={{ fontSize: 14 }} />, 
      action: () => onSend?.('Show me the most recently executed SQL queries in this session') 
    },
  ];

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ 
        p: { xs: 2, sm: 3 },
        pb: { xs: 2, sm: 2.5 },
      }}
    >
      {/* Toolbar - Compact row above input */}
      {(showDatabaseSelector || showSchemaSelector || onOpenSqlEditor) && (
        <Box
          sx={{
            maxWidth: 760,
            mx: 'auto',
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            flexWrap: 'wrap',
          }}
        >
          {/* Database Selector */}
          {showDatabaseSelector && (
            <Tooltip title={`Database: ${currentDatabase}`}>
              <Chip
                icon={<StorageOutlinedIcon sx={{ fontSize: 14 }} />}
                label={currentDatabase}
                onClick={(e) => setDbAnchor(e.currentTarget)}
                size="small"
                variant="outlined"
                sx={{
                  height: 26,
                  fontSize: '0.75rem',
                  borderColor: alpha(theme.palette.text.primary, 0.12),
                  backgroundColor: alpha(theme.palette.text.primary, 0.03),
                  '&:hover': {
                    borderColor: alpha(theme.palette.text.primary, 0.2),
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                  },
                }}
              />
            </Tooltip>
          )}

          {/* Schema Selector */}
          {showSchemaSelector && (
            <Tooltip title={`Schema: ${schemaLoading ? '...' : currentSchema}`}>
              <Chip
                icon={<AccountTreeOutlinedIcon sx={{ fontSize: 14 }} />}
                label={currentSchema}
                onClick={(e) => setSchemaAnchor(e.currentTarget)}
                size="small"
                variant="outlined"
                sx={{
                  height: 26,
                  fontSize: '0.75rem',
                  borderColor: alpha(theme.palette.text.primary, 0.12),
                  backgroundColor: alpha(theme.palette.text.primary, 0.03),
                  '&:hover': {
                    borderColor: alpha(theme.palette.text.primary, 0.2),
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                  },
                }}
              />
            </Tooltip>
          )}

          {/* SQL Editor Toggle */}
          {onOpenSqlEditor && (
            <Tooltip title="Open SQL Editor">
              <Chip
                icon={<CodeRoundedIcon sx={{ fontSize: 14 }} />}
                label="SQL Editor"
                onClick={onOpenSqlEditor}
                size="small"
                variant="outlined"
                sx={{
                  height: 26,
                  fontSize: '0.75rem',
                  borderColor: alpha(theme.palette.text.primary, 0.12),
                  backgroundColor: alpha(theme.palette.text.primary, 0.03),
                  '&:hover': {
                    borderColor: alpha(theme.palette.text.primary, 0.2),
                    backgroundColor: alpha(theme.palette.text.primary, 0.05),
                  },
                }}
              />
            </Tooltip>
          )}
        </Box>
      )}

      {/* Database Menu */}
      <Menu
        anchorEl={dbAnchor}
        open={Boolean(dbAnchor)}
        onClose={() => setDbAnchor(null)}
        PaperProps={{
          sx: {
            minWidth: 180,
            maxHeight: 320,
          }
        }}
      >
        <Typography 
          variant="overline" 
          sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary' }}
        >
          Switch Database
        </Typography>
        {availableDatabases.map((db) => (
          <MenuItem
            key={db}
            onClick={() => handleDatabaseChange(db)}
            selected={db === currentDatabase}
            sx={{ fontSize: '0.85rem' }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {db === currentDatabase ? (
                <CheckRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <StorageOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              )}
            </ListItemIcon>
            <ListItemText primary={db} />
          </MenuItem>
        ))}
      </Menu>

      {/* Schema Menu */}
      <Menu
        anchorEl={schemaAnchor}
        open={Boolean(schemaAnchor)}
        onClose={() => setSchemaAnchor(null)}
        PaperProps={{
          sx: {
            minWidth: 160,
            maxHeight: 280,
          }
        }}
      >
        <Typography 
          variant="overline" 
          sx={{ px: 2, py: 0.5, display: 'block', color: 'text.secondary' }}
        >
          PostgreSQL Schema
        </Typography>
        {schemas.map((schema) => (
          <MenuItem
            key={schema}
            onClick={() => handleSchemaChange(schema)}
            selected={schema === currentSchema}
            sx={{ fontSize: '0.85rem' }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              {schema === currentSchema ? (
                <CheckRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
              ) : (
                <AccountTreeOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              )}
            </ListItemIcon>
            <ListItemText primary={schema} />
          </MenuItem>
        ))}
      </Menu>

      {/* Input Container - Clean pill shaped */}
      <Box
        sx={{
          maxWidth: 760,
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1, sm: 1.25 },
          borderRadius: '28px',
          border: '1px solid',
          borderColor: isFocused 
            ? alpha(theme.palette.text.primary, 0.2)
            : alpha(theme.palette.text.primary, 0.1),
          backgroundColor: alpha(theme.palette.text.primary, 0.04),
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: (theme) => theme.transitions.create(
            ['border-color', 'background-color', 'box-shadow'],
            { duration: theme.transitions.duration.short }
          ),
          '&:hover': {
            borderColor: alpha(theme.palette.text.primary, 0.15),
          },
        }}
      >
        {/* Left Actions - Grouped */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          {/* Attachment icon - Coming soon */}
          <Tooltip title="Attach file (coming soon)">
            <span>
              <IconButton
                size="small"
                disabled
                sx={{
                  color: 'text.secondary',
                  opacity: 0.4,
                  width: 32,
                  height: 32,
                }}
              >
                <AttachFileRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>

          {/* Reasoning Toggle */}
          <Tooltip title={reasoningEnabled ? 'Thinking enabled (click to disable)' : 'Thinking disabled (click to enable)'}>
            <IconButton
              size="small"
              onClick={toggleReasoning}
              sx={{
                color: reasoningEnabled ? '#A855F7' : 'text.secondary',  // Purple when enabled
                opacity: reasoningEnabled ? 1 : 0.5,
                width: 32,
                height: 32,
                backgroundColor: reasoningEnabled 
                  ? alpha('#A855F7', isDarkMode ? 0.15 : 0.1)
                  : 'transparent',
                border: '1px solid',
                borderColor: reasoningEnabled 
                  ? alpha('#A855F7', 0.3)
                  : 'transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  opacity: 1,
                  backgroundColor: reasoningEnabled 
                    ? alpha('#A855F7', isDarkMode ? 0.2 : 0.15)
                    : alpha(theme.palette.text.primary, 0.06),
                }
              }}
            >
              {reasoningEnabled ? (
                <NoiseAwareIcon sx={{ fontSize: 18 }} />
              ) : (
                <RecordVoiceOverOutlinedIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Input Field */}
        <TextField
          fullWidth
          multiline
          maxRows={5}
          placeholder="Ask anything..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          variant="standard"
          InputProps={{
            disableUnderline: true,
            sx: { 
              fontSize: '0.95rem',
              lineHeight: 1.6,
              py: 0.5,
              color: 'text.primary',
            },
          }}
          sx={{ 
            '& .MuiInputBase-root': { 
              p: 0,
              alignItems: 'center',
            },
            '& .MuiInputBase-input': {
              py: 0,
              '&::placeholder': {
                color: 'text.secondary',
                opacity: 0.7,
              }
            },
          }}
        />

        {/* Send/Stop Button */}
        <Tooltip title={isStreaming ? 'Stop generating' : (hasText ? 'Send message' : 'Type a message')}>
          <span>
            <IconButton
              type={isStreaming ? 'button' : 'submit'}
              onClick={isStreaming ? onStop : undefined}
              disabled={!isStreaming && (!hasText || disabled)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: (hasText || isStreaming)
                  ? (isStreaming 
                      ? theme.palette.error.main
                      : (isDarkMode ? '#ffffff' : '#000000'))
                  : 'transparent',
                color: (hasText || isStreaming)
                  ? (isStreaming ? '#ffffff' : (isDarkMode ? '#000000' : '#ffffff'))
                  : 'text.disabled',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                '&:hover': {
                  backgroundColor: (hasText || isStreaming)
                    ? (isStreaming 
                        ? theme.palette.error.dark
                        : alpha(theme.palette.text.primary, 0.9))
                    : alpha(theme.palette.text.primary, 0.06),
                },
                '&.Mui-disabled': {
                  backgroundColor: 'transparent',
                  color: 'text.disabled',
                },
              }}
            >
              {isStreaming ? (
                <StopRoundedIcon sx={{ fontSize: 18 }} />
              ) : (
                <SendRoundedIcon sx={{ fontSize: 18, ml: 0.25 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Suggestion Chips - Below input */}
      {showSuggestions && (
      <Box
        sx={{
          maxWidth: 760,
          mx: 'auto',
          mt: 1.5,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {suggestions.map((chip) => (
          <Chip
            key={chip.label}
            icon={chip.icon}
            label={chip.label}
            onClick={chip.action}
            size="small"
            variant="outlined"
            sx={{
              borderRadius: '16px',
              borderColor: alpha(theme.palette.text.primary, 0.12),
              color: 'text.secondary',
              fontSize: '0.8rem',
              height: 30,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '& .MuiChip-icon': {
                color: 'inherit',
                ml: 0.5,
              },
              '&:hover': {
                borderColor: alpha(theme.palette.text.primary, 0.25),
                backgroundColor: alpha(theme.palette.text.primary, 0.04),
                color: 'text.primary',
              },
            }}
          />
        ))}
      </Box>
      )}

      {/* Footer hint */}
      <Typography
        variant="caption"
        sx={{ 
          display: 'block',
          textAlign: 'center',
          mt: 1.5,
          color: 'text.secondary', 
          opacity: 0.4,
          fontSize: '0.7rem',
        }}
      >
        AI-powered • Always verify SQL queries before running
      </Typography>
    </Box>
  );
}

export default memo(ChatInput);
