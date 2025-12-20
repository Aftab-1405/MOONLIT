import { useState } from 'react';
import { Box, TextField, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import KeyboardReturnRoundedIcon from '@mui/icons-material/KeyboardReturnRounded';

function ChatInput({ onSend, disabled = false }) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

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

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ p: 2 }}
    >
      <Box
        sx={{
          maxWidth: 720,
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 2, sm: 2.5 },
          py: { xs: 1, sm: 1.25 },
          borderRadius: 6,
          border: '2px solid',
          borderColor: isFocused 
            ? 'primary.main' 
            : isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          backgroundColor: isDarkMode ? 'background.paper' : '#ffffff',
          boxShadow: isFocused 
            ? isDarkMode 
              ? '0 0 0 4px rgba(16, 185, 129, 0.15), 0 8px 30px rgba(0,0,0,0.25)' 
              : '0 0 0 4px rgba(5, 150, 105, 0.1), 0 4px 20px rgba(0,0,0,0.08)'
            : isDarkMode 
              ? '0 4px 20px rgba(0,0,0,0.25)' 
              : '0 2px 12px rgba(0,0,0,0.08)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isFocused ? 'translateY(-2px)' : 'none',
        }}
      >
        {/* Input */}
        <TextField
          fullWidth
          multiline
          maxRows={5}
          placeholder="Ask about your database..."
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
              fontSize: '1rem',
              lineHeight: 1.6,
              py: 0.5,
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

        {/* Send Button */}
        <Tooltip title={hasText ? 'Send (Enter)' : 'Type a message'}>
          <span>
            <IconButton
              type="submit"
              disabled={!hasText || disabled}
              sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                backgroundColor: hasText 
                  ? 'primary.main' 
                  : isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                color: hasText ? 'white' : 'text.disabled',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
                '&:hover': {
                  backgroundColor: hasText ? 'primary.dark' : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                  transform: hasText ? 'scale(1.05)' : 'none',
                },
                '&.Mui-disabled': {
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
                  color: 'text.disabled',
                },
              }}
            >
              <SendRoundedIcon sx={{ fontSize: 18, ml: 0.25 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Footer with keyboard hint */}
      <Box
        sx={{
          maxWidth: 720,
          mx: 'auto',
          mt: 1,
          display: 'flex',
          justifyContent: { xs: 'center', sm: 'space-between' },
          alignItems: 'center',
          px: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{ 
            color: 'text.secondary', 
            opacity: 0.6,
            fontSize: '0.7rem',
            display: { xs: 'none', sm: 'flex' }, // Hide on mobile
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <KeyboardReturnRoundedIcon sx={{ fontSize: 12 }} />
          Enter to send • Shift+Enter for new line
        </Typography>
        <Typography
          variant="caption"
          sx={{ 
            color: 'text.secondary', 
            opacity: 0.5,
            fontSize: { xs: '0.65rem', sm: '0.65rem' },
            textAlign: { xs: 'center', sm: 'right' },
            width: { xs: '100%', sm: 'auto' }
          }}
        >
          AI-powered • Always verify queries
        </Typography>
      </Box>
    </Box>
  );
}

export default ChatInput;
