import { Box, Typography, Avatar, IconButton, Tooltip, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import ToolStatusIndicator from './ToolStatusIndicator';
import ThinkingIndicator from './ThinkingIndicator';

// Typing indicator animation
function TypingIndicator() {
  const theme = useTheme();
  return (
    <Box sx={{ py: 2.5, px: { xs: 2, sm: 4, md: 6 } }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 2 }}>
        <Avatar
          src="/product-logo.png"
          sx={{ 
            width: 32, 
            height: 32, 
            bgcolor: 'transparent',
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          }}
        />
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 0.5,
            pt: 1,
          }}
        >
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'text.secondary',
                animation: 'typing 1.4s infinite',
                animationDelay: `${i * 0.2}s`,
                '@keyframes typing': {
                  '0%, 60%, 100%': { opacity: 0.3 },
                  '30%': { opacity: 1 },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

// Chat message component - clean, minimal design
function ChatMessage({ message, isUser, userAvatar, userName, onRunQuery }) {
  const [copied, setCopied] = useState(false);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // User message
  if (isUser) {
    return (
      <Box
        sx={{
          py: 1.5,
          px: { xs: 2, sm: 4, md: 6 },
        }}
      >
        <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              maxWidth: '80%',
              flexDirection: 'row-reverse',
              '&:hover .copy-btn': { opacity: 1 },
            }}
          >
            {/* User Avatar */}
            <Avatar
              src={userAvatar}
              sx={{
                width: 32,
                height: 32,
                bgcolor: 'primary.main',
                fontSize: '0.85rem',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {!userAvatar && (userName?.charAt(0).toUpperCase() || 'U')}
            </Avatar>

            {/* Message Bubble */}
            <Box
              sx={{
                px: 2,
                py: 1.25,
                borderRadius: '16px 16px 4px 16px',
                backgroundColor: isDarkMode
                  ? alpha(theme.palette.success.main, 0.15)
                  : alpha(theme.palette.success.main, 0.1),
                border: '1px solid',
                borderColor: isDarkMode 
                  ? alpha(theme.palette.success.main, 0.2) 
                  : alpha(theme.palette.success.main, 0.15),
              }}
            >
              <Typography 
                sx={{ 
                  lineHeight: 1.6, 
                  whiteSpace: 'pre-wrap',
                  color: 'text.primary',
                  fontSize: '0.925rem',
                }}
              >
                {message}
              </Typography>
            </Box>

            {/* Copy Button */}
            <Tooltip title={copied ? 'Copied!' : 'Copy'}>
              <IconButton
                className="copy-btn"
                size="small"
                onClick={handleCopy}
                sx={{
                  opacity: 0,
                  alignSelf: 'center',
                  color: copied ? 'success.main' : 'text.secondary',
                  transition: 'opacity 0.2s',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {copied ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    );
  }

  // AI message - clean, no label
  return (
    <Box
      sx={{
        py: 1.5,
        px: { xs: 2, sm: 4, md: 6 },
        '&:hover .copy-btn': { opacity: 1 },
      }}
    >
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 2 }}>
        {/* AI Avatar */}
        <Avatar
          src="/product-logo.png"
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'transparent',
            flexShrink: 0,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          }}
        />

        {/* Content Container */}
        <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
          {/* Message Content */}
          <Box sx={{ color: 'text.primary' }}>
            {(() => {
              // First, extract and process thinking content
              let thinkingContent = '';
              let isThinking = message.includes('[[THINKING:start]]') && !message.includes('[[THINKING:end]]');
              
              // Collect all thinking chunks
              const thinkingChunkRegex = /\[\[THINKING:chunk:([\s\S]*?)\]\]/g;
              let thinkMatch;
              while ((thinkMatch = thinkingChunkRegex.exec(message)) !== null) {
                thinkingContent += thinkMatch[1];
              }
              
              // Remove thinking markers from main content for parsing
              let cleanMessage = message
                .replace(/\[\[THINKING:start\]\]/g, '')
                .replace(/\[\[THINKING:chunk:[\s\S]*?\]\]/g, '')
                .replace(/\[\[THINKING:end\]\]/g, '');
              
              // Parse [[TOOL:name:status:args:result]] markers (4 groups)
              // Use a more robust regex that handles nested JSON
              const toolMarkerRegex = /\[\[TOOL:(\w+):(\w+):(\{.*?\}|null):(\{.*?\}|null)\]\]/g;
              const parts = [];
              let lastIndex = 0;
              let match;
              
              // Track tools to deduplicate - only show latest status per tool
              const toolStates = new Map();
              const toolPositions = [];
              
              while ((match = toolMarkerRegex.exec(cleanMessage)) !== null) {
                const toolName = match[1];
                const status = match[2];
                const args = match[3];
                const result = match[4];
                
                // Store position for ordering
                toolPositions.push({
                  index: match.index,
                  endIndex: match.index + match[0].length,
                  name: toolName
                });
                
                // Update state - later matches (done) replace earlier (running)
                toolStates.set(toolName, { name: toolName, status, args, result });
              }
              
              // Rebuild parts, but only show each tool ONCE at its LAST position
              const toolLastPositions = {};
              toolPositions.forEach(pos => {
                toolLastPositions[pos.name] = pos;
              });
              
              // Now parse and build parts, skipping duplicate tool markers
              const shownTools = new Set();
              toolMarkerRegex.lastIndex = 0; // Reset regex
              
              while ((match = toolMarkerRegex.exec(cleanMessage)) !== null) {
                const toolName = match[1];
                const isLastOccurrence = toolLastPositions[toolName]?.index === match.index;
                
                if (match.index > lastIndex) {
                  const textContent = cleanMessage.slice(lastIndex, match.index).trim();
                  if (textContent) {
                    parts.push({ type: 'text', content: textContent });
                  }
                }
                
                // Only show the tool if this is its last occurrence
                if (isLastOccurrence && !shownTools.has(toolName)) {
                  const toolState = toolStates.get(toolName);
                  parts.push({
                    type: 'tool',
                    ...toolState
                  });
                  shownTools.add(toolName);
                }
                
                lastIndex = match.index + match[0].length;
              }
              
              if (lastIndex < cleanMessage.length) {
                const remainingText = cleanMessage.slice(lastIndex).trim();
                if (remainingText) {
                  parts.push({ type: 'text', content: remainingText });
                }
              }
              
              // Render thinking indicator + content
              return (
                <>
                  {/* Thinking section - shown first if present */}
                  {(thinkingContent || isThinking) && (
                    <ThinkingIndicator content={thinkingContent} isThinking={isThinking} />
                  )}
                  
                  {/* Main content */}
                  {parts.length === 0 ? (
                    <MarkdownRenderer content={cleanMessage} onRunQuery={onRunQuery} />
                  ) : (
                    parts.map((part, idx) => {
                      if (part.type === 'text') {
                        return <MarkdownRenderer key={idx} content={part.content} onRunQuery={onRunQuery} />;
                      } else {
                        return (
                          <Box key={idx} sx={{ my: 1 }}>
                            <ToolStatusIndicator 
                              tools={[{ 
                                name: part.name, 
                                status: part.status,
                                args: part.args,
                                result: part.result 
                              }]} 
                            />
                          </Box>
                        );
                      }
                    })
                  )}
                </>
              );
            })()}
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
              mt: 0.5,
              color: copied ? 'success.main' : 'text.secondary',
              transition: 'opacity 0.2s',
              '&:hover': { color: 'primary.main' },
            }}
          >
            {copied ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
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
          pb: 8,
        }}
      >
        <Box sx={{ textAlign: 'center', maxWidth: 500 }}>
          <Box
            component="img"
            src="/product-logo.png"
            alt="DB-Genie"
            sx={{ 
              width: 40, 
              height: 40, 
              mb: 3,
              opacity: 0.9,
            }}
          />

          <Typography 
            variant="h6" 
            fontWeight={500} 
            color="text.secondary"
            sx={{ mb: 3 }}
          >
            How can I help you today?
          </Typography>

          {/* Suggestion Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
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
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <Typography sx={{ mb: 0.5 }}>{item.icon}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                  {item.text}
                </Typography>
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
          tools={msg.tools}
        />
      ))}
      
      {/* Typing indicator */}
      {isTyping && messages[messages.length - 1]?.sender === 'user' && (
        <TypingIndicator />
      )}
    </Box>
  );
}

export default MessageList;
