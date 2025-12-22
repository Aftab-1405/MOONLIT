import { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Tooltip, 
  Typography, 
  Chip, 
  useTheme,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CableOutlinedIcon from '@mui/icons-material/CableOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

function ChatInput({ 
  onSend, 
  disabled = false, 
  // Schema props
  isConnected = false,
  dbType = null,
  currentDatabase = null,
  // Control suggestions visibility
  showSuggestions = true,
}) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // Schema state
  const [schemas, setSchemas] = useState([]);
  const [currentSchema, setCurrentSchema] = useState('public');
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaAnchor, setSchemaAnchor] = useState(null);

  const isPostgreSQL = dbType?.toLowerCase() === 'postgresql';
  const showSchemaSelector = isConnected && isPostgreSQL && schemas.length > 0;

  // Fetch schemas when connected to PostgreSQL
  useEffect(() => {
    if (isConnected && currentDatabase && isPostgreSQL) {
      fetchSchemas();
    } else {
      setSchemas([]);
      setCurrentSchema('public');
    }
  }, [isConnected, currentDatabase, isPostgreSQL]);

  const fetchSchemas = async () => {
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
  };

  const handleSchemaChange = async (schema) => {
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
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasText = message.trim().length > 0;

  // Suggestion chips with proper content
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
      {/* Input Container - Pill shaped like Grok */}
      <Box
        sx={{
          maxWidth: 760,
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1, sm: 1.25 },
          borderRadius: '28px',
          border: '1px solid',
          borderColor: isFocused 
            ? (isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')
            : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
          },
        }}
      >
        {/* Attachment icon (placeholder) */}
        <IconButton
          size="small"
          sx={{
            color: 'text.secondary',
            opacity: 0.6,
            '&:hover': {
              opacity: 1,
              backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            }
          }}
        >
          <AttachFileRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>

        {/* Input */}
        <TextField
          fullWidth
          multiline
          maxRows={5}
          placeholder="What do you want to know?"
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

        {/* Schema Selector Button - Only for PostgreSQL */}
        {showSchemaSelector && (
          <Tooltip title="Switch schema">
            <Box
              onClick={(e) => setSchemaAnchor(e.currentTarget)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.5,
                borderRadius: '16px',
                cursor: 'pointer',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: '1px solid',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                transition: 'all 0.15s ease',
                flexShrink: 0,
                '&:hover': {
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                },
              }}
            >
              <AccountTreeOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.75rem',
                  color: 'text.secondary',
                  maxWidth: 80,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {schemaLoading ? '...' : currentSchema}
              </Typography>
              <KeyboardArrowDownRoundedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Box>
          </Tooltip>
        )}

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

        {/* Send Button */}
        <Tooltip title={hasText ? 'Send message' : 'Type a message'}>
          <span>
            <IconButton
              type="submit"
              disabled={!hasText || disabled}
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: hasText 
                  ? (isDarkMode ? '#ffffff' : '#000000')
                  : 'transparent',
                color: hasText 
                  ? (isDarkMode ? '#000000' : '#ffffff')
                  : 'text.disabled',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                '&:hover': {
                  backgroundColor: hasText 
                    ? (isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)')
                    : (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                },
                '&.Mui-disabled': {
                  backgroundColor: 'transparent',
                  color: 'text.disabled',
                },
              }}
            >
              <SendRoundedIcon sx={{ fontSize: 18, ml: 0.25 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Suggestion Chips - Below input (only when empty) */}
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
              borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
              color: 'text.secondary',
              fontSize: '0.8rem',
              height: 30,
              backgroundColor: 'transparent',
              transition: 'all 0.15s ease',
              '& .MuiChip-icon': {
                color: 'inherit',
                ml: 0.5,
              },
              '&:hover': {
                borderColor: isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
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

export default ChatInput;
