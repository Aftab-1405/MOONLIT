import { useState } from 'react';
import { Box, TextField, IconButton, Tooltip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

function ChatInput({ onSend, disabled = false }) {
  const [message, setMessage] = useState('');

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
      sx={{
        p: 2, // Compact padding
        // Removed borderTop to enhance uniformity
      }}
    >
      <Box
        sx={{
          maxWidth: 700, // Reduced from 800 to 700
          mx: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5, // slightly more side padding
          py: 1, // slightly taller
          borderRadius: 6, // Pill-like shape for modern classic look
          border: '1px solid',
          borderColor: 'rgba(255,255,255,0.08)',
          backgroundColor: 'background.paper',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', // Modern shadow
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:focus-within': {
            borderColor: 'primary.main',
            boxShadow: '0 8px 30px rgba(139, 92, 246, 0.15)', // Enhanced shadow on focus
            transform: 'translateY(-1px)',
          },
        }}
      >
        {/* Input */}
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder="Message DB-Genie..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          variant="standard"
          InputProps={{
            disableUnderline: true,
            sx: { 
              fontSize: '1rem', // Slightly larger font for readability
              lineHeight: 1.5,
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
        <Tooltip title={hasText ? 'Send message' : ''}>
          <span>
            <IconButton
              type="submit"
              disabled={!hasText || disabled}
              sx={{
                width: 32, // Perfect circle
                height: 32,
                borderRadius: '50%', // Ensure circularity
                backgroundColor: hasText ? 'primary.main' : 'rgba(255,255,255,0.05)',
                color: hasText ? 'white' : 'text.disabled',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                flexShrink: 0,
                alignSelf: 'center', // Center vertically relative to input
                '&:hover': {
                  backgroundColor: hasText ? 'primary.dark' : 'rgba(255,255,255,0.1)',
                  transform: 'scale(1.05)',
                },
                '&.Mui-disabled': {
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  color: 'text.disabled',
                },
              }}
            >
              <SendIcon sx={{ fontSize: 16, ml: 0.25 }} /> {/* Optical centering */}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Helper - minimalist */}
      <Box
        sx={{
          maxWidth: 800,
          mx: 'auto',
          mt: 1,
          textAlign: 'center',
        }}
      >
        <Box
          component="span"
          sx={{ fontSize: '0.7rem', color: 'text.secondary', opacity: 0.5 }}
        >
          DB-Genie may produce inaccurate information.
        </Box>
      </Box>
    </Box>
  );
}

export default ChatInput;
