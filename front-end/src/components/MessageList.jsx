import { Box, Typography, Avatar, IconButton, Tooltip, useTheme as useMuiTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useState, useMemo, useRef } from 'react';
import { InlineThinkingBlock, InlineToolBlock } from './AIResponseSteps';
import MarkdownRenderer from './MarkdownRenderer';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

/**
 * Parses message content into segments: 'text', 'thinking', 'tool'
 * Segments are returned in EXACT order for true inline rendering.
 */
function parseMessageSegments(text) {
  const segments = [];
  let currentIndex = 0;
  
  while (currentIndex < text.length) {
    const toolStart = text.indexOf('[[TOOL:', currentIndex);
    const thinkingStart = text.indexOf('[[THINKING:start]]', currentIndex);
    
    let nextMarkerStart = -1;
    let markerType = null;
    
    if (toolStart !== -1 && thinkingStart !== -1) {
      nextMarkerStart = toolStart < thinkingStart ? toolStart : thinkingStart;
      markerType = toolStart < thinkingStart ? 'tool' : 'thinking';
    } else if (toolStart !== -1) {
      nextMarkerStart = toolStart;
      markerType = 'tool';
    } else if (thinkingStart !== -1) {
      nextMarkerStart = thinkingStart;
      markerType = 'thinking';
    }
    
    if (nextMarkerStart === -1) {
      const remainingText = text.slice(currentIndex);
      if (remainingText) segments.push({ type: 'text', content: remainingText });
      break;
    }
    
    if (nextMarkerStart > currentIndex) {
      const textContent = text.slice(currentIndex, nextMarkerStart);
      if (textContent.trim()) segments.push({ type: 'text', content: textContent });
    }
    
    if (markerType === 'thinking') {
      currentIndex = nextMarkerStart + '[[THINKING:start]]'.length;
      let thinkingContent = '';
      let isThinkingComplete = false;
      
      while (currentIndex < text.length) {
        const chunkStart = text.indexOf('[[THINKING:chunk:', currentIndex);
        const endStart = text.indexOf('[[THINKING:end]]', currentIndex);
        
        if (endStart !== -1 && (chunkStart === -1 || endStart < chunkStart)) {
          isThinkingComplete = true;
          currentIndex = endStart + '[[THINKING:end]]'.length;
          break;
        }
        
        if (chunkStart !== -1) {
          const chunkEnd = text.indexOf(']]', chunkStart);
          if (chunkEnd === -1) break;
          thinkingContent += text.slice(chunkStart + 17, chunkEnd);
          currentIndex = chunkEnd + 2;
          continue;
        }
        break;
      }
      
      segments.push({ type: 'thinking', content: thinkingContent, isComplete: isThinkingComplete });
    } else if (markerType === 'tool') {
      const parsed = parseToolMarker(text, nextMarkerStart);
      if (parsed) {
        segments.push(parsed.segment);
        currentIndex = parsed.endIndex;
      } else {
        currentIndex = nextMarkerStart + 1;
      }
    }
  }
  
  return segments;
}

function parseToolMarker(text, markerStart) {
  const afterPrefix = markerStart + 7;
  const nameEnd = text.indexOf(':', afterPrefix);
  if (nameEnd === -1) return null;
  
  const toolName = text.slice(afterPrefix, nameEnd);
  const statusEnd = text.indexOf(':', nameEnd + 1);
  if (statusEnd === -1) return null;
  
  const status = text.slice(nameEnd + 1, statusEnd);
  const argsStart = statusEnd + 1;
  
  let argsEnd;
  if (text.slice(argsStart, argsStart + 4) === 'null') {
    argsEnd = argsStart + 3;
  } else if (text[argsStart] === '{') {
    argsEnd = findMatchingBrace(text, argsStart);
    if (argsEnd === -1) return null;
  } else {
    return null;
  }
  
  if (text[argsEnd + 1] !== ':') return null;
  
  const resultStart = argsEnd + 2;
  let resultEnd;
  
  if (text.slice(resultStart, resultStart + 4) === 'null') {
    resultEnd = resultStart + 3;
  } else if (text[resultStart] === '{') {
    resultEnd = findMatchingBrace(text, resultStart);
    if (resultEnd === -1) return null;
  } else {
    return null;
  }
  
  if (text.slice(resultEnd + 1, resultEnd + 3) !== ']]') return null;
  
  return {
    segment: {
      type: 'tool',
      name: toolName,
      status,
      args: text.slice(argsStart, argsEnd + 1),
      result: text.slice(resultStart, resultEnd + 1),
    },
    endIndex: resultEnd + 3,
  };
}

function findMatchingBrace(text, startIndex) {
  if (text[startIndex] !== '{') return -1;
  let depth = 0, inString = false, escapeNext = false;
  
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (char === '\\' && inString) { escapeNext = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (!inString) {
      if (char === '{') depth++;
      else if (char === '}' && --depth === 0) return i;
    }
  }
  return -1;
}

function filterRedundantTools(segments) {
  const lastIndex = {};
  segments.forEach((seg, idx) => {
    if (seg.type === 'tool') lastIndex[seg.name] = idx;
  });
  return segments.filter((seg, idx) => seg.type !== 'tool' || idx === lastIndex[seg.name]);
}

function TypingIndicator() {
  const muiTheme = useMuiTheme();
  return (
    <Box sx={{ py: 2.5, px: { xs: 2, sm: 4, md: 6 } }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 2 }}>
        <Avatar src="/product-logo.png" sx={{ width: 32, height: 32, bgcolor: 'transparent', border: `1px solid ${alpha(muiTheme.palette.primary.main, 0.3)}` }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pt: 1 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 6, height: 6, borderRadius: '50%', backgroundColor: 'text.secondary',
                animation: 'typing 1.4s infinite', animationDelay: `${i * 0.2}s`,
                '@keyframes typing': { '0%, 60%, 100%': { opacity: 0.3 }, '30%': { opacity: 1 } },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function UserMessage({ message, userAvatar, userName }) {
  const [copied, setCopied] = useState(false);
  const muiTheme = useMuiTheme();

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box sx={{ py: 1.5, px: { xs: 2, sm: 4, md: 6 }, animation: `${fadeIn} 0.3s ease-out` }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
        <Box sx={{ display: 'flex', gap: 1.5, maxWidth: '80%', flexDirection: 'row-reverse', '&:hover .copy-btn': { opacity: 1 } }}>
          <Avatar src={userAvatar} sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem', fontWeight: 600 }}>
            {!userAvatar && (userName?.charAt(0).toUpperCase() || 'U')}
          </Avatar>
          <Box sx={{ px: 2, py: 1.25, borderRadius: '16px 16px 4px 16px', backgroundColor: alpha(muiTheme.palette.text.primary, 0.05), border: '1px solid', borderColor: alpha(muiTheme.palette.text.primary, 0.1) }}>
            <Typography sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'text.primary', fontSize: '0.925rem' }}>
              {message}
            </Typography>
          </Box>
          <Tooltip title={copied ? 'Copied!' : 'Copy'}>
            <IconButton className="copy-btn" size="small" onClick={handleCopy} sx={{ opacity: 0, alignSelf: 'center', color: copied ? 'text.primary' : 'text.secondary', transition: 'opacity 0.2s', '&:hover': { color: 'primary.main' } }}>
              {copied ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

function AIMessage({ message, onRunQuery, isStreaming }) {
  const [copied, setCopied] = useState(false);
  const muiTheme = useMuiTheme();
  const theme = muiTheme;
  const contentRef = useRef(null);

  const getCleanContent = () => message
    .replace(/\[\[THINKING:start\]\]/g, '')
    .replace(/\[\[THINKING:chunk:[^\]]*\]\]/g, '')
    .replace(/\[\[THINKING:end\]\]/g, '')
    .replace(/\[\[TOOL:[^\]]*\]\]/g, '');

  const segments = useMemo(() => filterRedundantTools(parseMessageSegments(message)), [message]);
  const textOnlySegments = useMemo(
    () => segments.filter((segment) => segment.type === 'text' && segment.content.trim()),
    [segments]
  );

  const handleCopy = () => {
    const container = contentRef.current;
    const htmlContent = container?.innerHTML;
    const plainTextContent = (textOnlySegments.length
      ? textOnlySegments.map((s) => s.content.trim()).filter(Boolean).join('\n\n')
      : null) || container?.innerText || getCleanContent();

    // Prefer copying rendered HTML + plaintext; fallback to plaintext only
    if (htmlContent && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainTextContent], { type: 'text/plain' });
      navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          navigator.clipboard.writeText(plainTextContent);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    } else {
      navigator.clipboard.writeText(plainTextContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Box sx={{ py: 1.5, px: { xs: 2, sm: 4, md: 6 }, '&:hover .copy-btn': { opacity: 1 }, animation: `${fadeIn} 0.3s ease-out` }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Avatar src="/product-logo.png" sx={{ width: 32, height: 32, bgcolor: 'transparent', flexShrink: 0, border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}` }} />
        <Box sx={{ flex: 1, minWidth: 0, pt: 0 }}>
          {segments.map((segment, idx) => {
            const isLast = idx === segments.length - 1;
            const key = `${idx}-${segment.type}`;

            if (segment.type === 'thinking') {
              return <InlineThinkingBlock key={key} content={segment.content} isActive={!segment.isComplete && isStreaming && isLast} />;
            }
            if (segment.type === 'tool') {
              return <InlineToolBlock key={`${key}-${segment.name}`} tool={segment} />;
            }
            if (segment.type === 'text' && segment.content.trim()) {
              // Display content immediately - industry standard approach (no typing animation)
              return <MarkdownRenderer key={key} content={segment.content} onRunQuery={onRunQuery} />;
            }
            return null;
          })}
          {/* Hidden text-only rendering used for clipboard copy (excludes tool/reasoning UI) */}
          <Box ref={contentRef} sx={{ display: 'none' }} aria-hidden>
            {textOnlySegments.map((segment, idx) => (
              <MarkdownRenderer key={`copy-${idx}`} content={segment.content} onRunQuery={onRunQuery} />
            ))}
          </Box>
        </Box>
        <Tooltip title={copied ? 'Copied!' : 'Copy'}>
          <IconButton className="copy-btn" size="small" onClick={handleCopy} sx={{ opacity: 0, alignSelf: 'flex-start', mt: 0.5, color: copied ? 'text.primary' : 'text.secondary', transition: 'opacity 0.2s', '&:hover': { color: 'primary.main' } }}>
            {copied ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function MessageList({ messages = [], user, onRunQuery }) {
  return (
    <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
      {messages.map((msg, index) => (
        msg.sender === 'user'
          ? <UserMessage key={index} message={msg.content} userAvatar={user?.photoURL} userName={user?.displayName} />
          : <AIMessage key={index} message={msg.content} onRunQuery={onRunQuery} isStreaming={msg.isStreaming} />
      ))}
    </Box>
  );
}

export default MessageList;
