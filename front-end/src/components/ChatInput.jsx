import { useState } from 'react';
import { Box, TextField, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
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
          alignItems: 'flex-end',
          gap: 1.5,
          px: { xs: 2, sm: 2.5 },
          py: { xs: 1, sm: 1.25 },
          borderRadius: 3,
          border: '1.5px solid',
          borderColor: isFocused 
            ? 'primary.main' 
            : isDarkMode ? alpha(theme.palette.common.white, 0.1) : alpha(theme.palette.common.black, 0.1),
          backgroundColor: isDarkMode ? 'background.paper' : '#ffffff',
          boxShadow: isFocused 
            ? isDarkMode 
              ? `0 0 0 3px ${alpha(theme.palette.success.main, 0.12)}`
              : `0 0 0 3px ${alpha(theme.palette.success.main, 0.08)}`
            : 'none',
          transition: 'all 0.2s ease',
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
              fontSize: '0.95rem',
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
                opacity: 0.6,
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
                width: 38,
                height: 38,
                borderRadius: 2,
                backgroundColor: hasText 
                  ? 'primary.main'
                  : isDarkMode ? alpha(theme.palette.common.white, 0.05) : alpha(theme.palette.common.black, 0.04),
                color: hasText ? 'white' : 'text.disabled',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                '&:hover': {
                  backgroundColor: hasText 
                    ? 'primary.dark'
                    : (isDarkMode ? alpha(theme.palette.common.white, 0.1) : alpha(theme.palette.common.black, 0.08)),
                },
                '&.Mui-disabled': {
                  backgroundColor: isDarkMode ? alpha(theme.palette.common.white, 0.03) : alpha(theme.palette.common.black, 0.04),
                  color: 'text.disabled',
                },
              }}
            >
              <SendRoundedIcon sx={{ fontSize: 18, ml: 0.25 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Footer - properly centered */}
      <Box
        sx={{
          maxWidth: 720,
          mx: 'auto',
          mt: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          px: 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{ 
            color: 'text.secondary', 
            opacity: 0.5,
            fontSize: '0.7rem',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <KeyboardReturnRoundedIcon sx={{ fontSize: 11 }} />
          Enter to send • Shift+Enter for new line
        </Typography>
        <Typography
          variant="caption"
          sx={{ 
            color: 'text.secondary', 
            opacity: 0.5,
            fontSize: '0.7rem',
            display: { xs: 'none', sm: 'block' },
          }}
        >
          •
        </Typography>
        <Typography
          variant="caption"
          sx={{ 
            color: 'text.secondary', 
            opacity: 0.5,
            fontSize: '0.7rem',
            display: { xs: 'none', sm: 'block' },
          }}
        >
          AI-powered • Always verify queries
        </Typography>
      </Box>
    </Box>
  );
}

export default ChatInput;
