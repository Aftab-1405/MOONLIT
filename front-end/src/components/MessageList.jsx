import { Box, Typography, Avatar, IconButton, Tooltip, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import ToolStatusIndicator from './ToolStatusIndicator';
import ThinkingIndicator from './ThinkingIndicator';

/**
 * Robust parser for [[TOOL:name:status:args:result]] markers.
 * Uses a state machine approach to properly handle nested JSON braces.
 * Only shows each tool ONCE at its final (done) status.
 * 
 * @param {string} text - The message text containing tool markers
 * @returns {Array} - Array of {type: 'text'|'tool', ...} parts
 */
function parseToolMarkers(text) {
  // First pass: find all tool markers and their positions
  const markers = [];
  let parseIndex = 0;
  
  while (parseIndex < text.length) {
    const markerStart = text.indexOf('[[TOOL:', parseIndex);
    if (markerStart === -1) break;
    
    // Parse: [[TOOL:name:status:args:result]]
    const afterPrefix = markerStart + 7; // After "[[TOOL:"
    
    // Find name
    const nameEnd = text.indexOf(':', afterPrefix);
    if (nameEnd === -1) { parseIndex = markerStart + 1; continue; }
    const toolName = text.slice(afterPrefix, nameEnd);
    
    // Find status  
    const statusEnd = text.indexOf(':', nameEnd + 1);
    if (statusEnd === -1) { parseIndex = markerStart + 1; continue; }
    const status = text.slice(nameEnd + 1, statusEnd);
    
    // Parse args (JSON or "null")
    let argsEnd, argsValue;
    const argsStart = statusEnd + 1;
    
    if (text.slice(argsStart, argsStart + 4) === 'null') {
      argsEnd = argsStart + 3;  // Last char of 'null' is at index +3
      argsValue = 'null';
    } else if (text[argsStart] === '{') {
      argsEnd = findMatchingBrace(text, argsStart);
      if (argsEnd === -1) { parseIndex = markerStart + 1; continue; }
      argsValue = text.slice(argsStart, argsEnd + 1);
    } else {
      parseIndex = markerStart + 1;
      continue;
    }
    
    // Expect colon separator
    if (text[argsEnd + 1] !== ':') { parseIndex = markerStart + 1; continue; }
    
    // Parse result (JSON or "null")
    let resultEnd, resultValue;
    const resultStart = argsEnd + 2;
    
    if (text.slice(resultStart, resultStart + 4) === 'null') {
      resultEnd = resultStart + 3;  // Last char of 'null' is at index +3
      resultValue = 'null';
    } else if (text[resultStart] === '{') {
      resultEnd = findMatchingBrace(text, resultStart);
      if (resultEnd === -1) { parseIndex = markerStart + 1; continue; }
      resultValue = text.slice(resultStart, resultEnd + 1);
    } else {
      parseIndex = markerStart + 1;
      continue;
    }
    
    // Expect closing ]]
    if (text.slice(resultEnd + 1, resultEnd + 3) !== ']]') { 
      parseIndex = markerStart + 1; 
      continue; 
    }
    
    const markerEnd = resultEnd + 3;
    markers.push({
      start: markerStart,
      end: markerEnd,
      name: toolName,
      status,
      args: argsValue,
      result: resultValue
    });
    
    parseIndex = markerEnd;
  }
  
  // If no markers found, return original text
  if (markers.length === 0) {
    return [{ type: 'text', content: text }];
  }
  
  // Find the last occurrence of each tool (to show final status only)
  const lastIndexByTool = {};
  markers.forEach((marker, idx) => {
    lastIndexByTool[marker.name] = idx;
  });
  
  // Build final parts: text segments + tool UI (only for last occurrence of each tool)
  const parts = [];
  let lastEnd = 0;
  const toolsShown = new Set();
  
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    
    // Add text BEFORE this marker (text between previous marker and this one)
    if (marker.start > lastEnd) {
      const textContent = text.slice(lastEnd, marker.start).trim();
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }
    
    // Only add tool UI if this is the LAST occurrence of this tool name
    const isLastOccurrence = lastIndexByTool[marker.name] === i;
    if (isLastOccurrence && !toolsShown.has(marker.name)) {
      parts.push({
        type: 'tool',
        name: marker.name,
        status: marker.status,
        args: marker.args,
        result: marker.result
      });
      toolsShown.add(marker.name);
    }
    
    // Always move past this marker (skipping its raw text)
    lastEnd = marker.end;
  }
  
  // Add any remaining text after the last marker
  if (lastEnd < text.length) {
    const remaining = text.slice(lastEnd).trim();
    if (remaining) {
      parts.push({ type: 'text', content: remaining });
    }
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}

/**
 * Find the matching closing brace for an opening brace at startIndex.
 * Properly handles nested braces and strings.
 * 
 * @param {string} text - The text to search
 * @param {number} startIndex - Index of the opening brace '{'
 * @returns {number} - Index of matching '}' or -1 if not found
 */
function findMatchingBrace(text, startIndex) {
  if (text[startIndex] !== '{') return -1;
  
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return i;
        }
      }
    }
  }
  
  return -1; // No matching brace found
}

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
                  ? alpha(theme.palette.text.primary, 0.05)
                  : alpha(theme.palette.text.primary, 0.05),
                border: '1px solid',
                borderColor: isDarkMode 
                  ? alpha(theme.palette.text.primary, 0.1) 
                  : alpha(theme.palette.text.primary, 0.1),
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
                  color: copied ? 'text.primary' : 'text.secondary',
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
              
              // Parse tool markers using robust JSON-aware parser
              const parts = parseToolMarkers(cleanMessage);
              
              // Render thinking indicator + content
              return (
                <>
                  {/* Thinking section - shown first if present */}
                  {(thinkingContent || isThinking) && (
                    <ThinkingIndicator content={thinkingContent} isThinking={isThinking} />
                  )}
                  
                  {/* Main content */}
                  {parts.length === 1 && parts[0].type === 'text' && !parts[0].content.includes('[[TOOL:') ? (
                    <MarkdownRenderer content={parts[0].content} onRunQuery={onRunQuery} />
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
              color: copied ? 'text.primary' : 'text.secondary',
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
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  
  // Empty state - Grok style with centered large logo
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
          pb: 16, // Push up to leave room for input
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          {/* Large centered logo like Grok */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              mb: 2,
            }}
          >
            <Box
              component="img"
              src="/product-logo.png"
              alt="DB-Genie"
              sx={{ 
                width: { xs: 48, sm: 56 }, 
                height: { xs: 48, sm: 56 }, 
                opacity: 0.95,
              }}
            />
            <Typography 
              variant="h3" 
              sx={{ 
                fontWeight: 500,
                fontSize: { xs: '2rem', sm: '2.5rem' },
                color: 'text.primary',
                letterSpacing: '-0.02em',
              }}
            >
              DB-Genie
            </Typography>
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
