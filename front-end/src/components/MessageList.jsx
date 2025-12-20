import { Box, Typography, Avatar, IconButton, Tooltip } from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

// Typing indicator animation...
function TypingIndicator() {
  return (
    <Box sx={{ py: 3, px: { xs: 2, sm: 4, md: 6 } }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 2 }}>
        <Avatar
          src="/product-logo.png"
          sx={{ width: 28, height: 28, bgcolor: 'transparent', border: '1px solid rgba(6, 182, 212, 0.3)' }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                animation: 'typing 1.4s infinite',
                animationDelay: `${i * 0.2}s`,
                '@keyframes typing': {
                  '0%, 60%, 100%': { opacity: 0.3, transform: 'scale(0.8)' },
                  '30%': { opacity: 1, transform: 'scale(1)' },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// Chat message component
function ChatMessage({ message, isUser, userAvatar, userName, onRunQuery }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      sx={{
        py: 2, // Reduced padding
        px: { xs: 2, sm: 4, md: 6 },
        '&:hover .copy-btn': { opacity: 1 },
      }}
    >
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 1.5 }}>
        {/* Avatar */}
        <Avatar
          src={isUser ? userAvatar : '/product-logo.png'}
          sx={{
            width: 28, // Reduced size
            height: 28,
            bgcolor: isUser ? 'primary.main' : 'transparent',
            fontSize: '0.875rem',
            fontWeight: 600,
            flexShrink: 0,
            border: isUser ? 'none' : '1px solid rgba(6, 182, 212, 0.3)',
          }}
        >
          {isUser && !userAvatar && (userName?.charAt(0).toUpperCase() || 'U')}
        </Avatar>

        {/* Content */}
        <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}> {/* Align text with avatar */}
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{ mb: 0.5, color: isUser ? 'text.primary' : 'primary.light', fontSize: '0.85rem' }}
          >
            {isUser ? 'You' : 'DB-Genie'}
          </Typography>

          <Box sx={{ color: 'text.primary', fontSize: '0.95rem' }}>
            {isUser ? (
              <Typography sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {message}
              </Typography>
            ) : (
              <MarkdownRenderer content={message} onRunQuery={onRunQuery} />
            )}
          </Box>
        </Box>

        {/* Copy Button */}
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton
            className="copy-btn"
            size="small"
            onClick={handleCopy}
            sx={{
              opacity: 0,
              alignSelf: 'flex-start',
              mt: 2,
              color: copied ? 'success.main' : 'text.secondary',
              transition: 'all 0.2s',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function MessageList({ messages = [], user, onRunQuery, onSuggestionClick, isTyping = false }) {
  // Empty state
  if (messages.length === 0 && !isTyping) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          pb: 8, // Added bottom padding to move content slightly up visually
        }}
      >
        <Box sx={{ textAlign: 'center', maxWidth: 600 }}>
          <Box
            component="img"
            src="/product-logo.png"
            alt="DB-Genie"
            sx={{ 
              width: 32, // Consistent small size
              height: 32, 
              mb: 3, 
              opacity: 0.9 
            }}
          />

          <Typography 
            variant="h6" 
            fontWeight={500} 
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            How can I help you today?
          </Typography>

          {/* Removed verbose description text */}

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5, // Reduced gap between cards
            }}
          >
            {[
              { text: 'Show me all tables', icon: '📋' },
              { text: 'Write a SELECT query', icon: '✍️' },
              { text: 'Explain the schema', icon: '🔍' },
              { text: 'Visualize relationships', icon: '🔗' },
            ].map((item) => (
              <Box
                key={item.text}
                onClick={() => onSuggestionClick?.(item.text)}
                sx={{
                  p: 1.5, // Compact padding
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper', // Use theme color
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <Typography variant="body2" sx={{ mb: 0.5 }}>{item.icon}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>{item.text}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  // Messages view
  return (
    <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
      {messages.map((msg, index) => (
        <ChatMessage
          key={index}
          message={msg.content}
          isUser={msg.sender === 'user'}
          userAvatar={user?.photoURL}
          userName={user?.displayName}
          onRunQuery={onRunQuery}
        />
      ))}
      
      {/* Typing indicator - shown when AI is responding */}
      {isTyping && messages[messages.length - 1]?.sender === 'user' && (
        <TypingIndicator />
      )}
    </Box>
  );
}

export default MessageList;
