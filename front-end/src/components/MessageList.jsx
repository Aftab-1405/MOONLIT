import { Box, Typography, Avatar, IconButton, Tooltip, useTheme as useMuiTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { InlineThinkingBlock, InlineToolBlock } from './AIResponseSteps';
import MarkdownRenderer from './MarkdownRenderer';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

/**
 * Hook for progressive word-by-word typing animation
 * Reveals content at controlled speed regardless of how fast backend sends it
 * 
 * Performance optimized:
 * - Uses requestAnimationFrame (syncs with browser paint cycle)
 * - Batches state updates to reduce React re-renders (~20/sec instead of 35)
 * - Uses refs for internal tracking to avoid unnecessary renders
 * - Skips over tool/thinking markers to prevent partial marker display
 * 
 * @param {string} content - Full content to reveal
 * @param {boolean} isStreaming - Whether content is still streaming
 * @param {number} wordsPerSecond - Target reveal speed (default: 35 words/sec)
 * @returns {string} - Revealed content so far
 */
function useTypingAnimation(content, isStreaming, wordsPerSecond = 35) {
  const [revealedContent, setRevealedContent] = useState('');
  const animationRef = useRef(null);
  const lastStateUpdateRef = useRef(Date.now());
  const revealedIndexRef = useRef(0);
  
  // Minimum time between React state updates (limits re-renders)
  const STATE_UPDATE_INTERVAL = 50; // 20 updates/sec max
  
  useEffect(() => {
    // If not streaming, show everything immediately
    if (!isStreaming) {
      setRevealedContent(content);
      revealedIndexRef.current = content.length;
      return;
    }
    
    // If already fully revealed, no need to animate
    if (revealedIndexRef.current >= content.length) {
      return;
    }
    
    const msPerWord = 1000 / wordsPerSecond;
    let lastWordTime = Date.now();
    
    /**
     * Find the safe reveal point - avoiding partial markers
     * Returns the safe index to reveal up to
     */
    const findSafeRevealPoint = (targetIdx) => {
      // Check if we're about to enter a marker
      const markerStarts = ['[[TOOL:', '[[THINKING:'];
      
      for (const marker of markerStarts) {
        // Look for marker start before targetIdx
        let searchStart = Math.max(0, targetIdx - 100); // Look back reasonable distance
        let markerPos = content.indexOf(marker, searchStart);
        
        while (markerPos !== -1 && markerPos < targetIdx) {
          // Found a marker that starts before target
          // Find its end
          const markerEnd = content.indexOf(']]', markerPos);
          
          if (markerEnd === -1) {
            // Marker not complete yet - don't reveal into it
            return Math.min(targetIdx, markerPos);
          } else if (targetIdx <= markerEnd + 2) {
            // Target is inside the marker - skip to end of marker
            return markerEnd + 2;
          }
          
          // Check for next marker
          markerPos = content.indexOf(marker, markerPos + 1);
        }
        
        // Check if targetIdx is about to enter a new marker
        const nextMarker = content.indexOf(marker, targetIdx);
        if (nextMarker !== -1 && nextMarker < targetIdx + 20) {
          // Very close to a marker start - check if it's complete
          const markerEnd = content.indexOf(']]', nextMarker);
          if (markerEnd === -1) {
            // Incomplete marker ahead - stop before it
            return nextMarker;
          }
        }
      }
      
      return targetIdx;
    };
    
    const animate = () => {
      const now = Date.now();
      const wordElapsed = now - lastWordTime;
      
      // Move reveal pointer forward based on elapsed time (smooth internal tracking)
      if (wordElapsed >= msPerWord) {
        let nextIdx = revealedIndexRef.current;
        const wordsToReveal = Math.max(1, Math.floor(wordElapsed / msPerWord));
        
        for (let w = 0; w < wordsToReveal && nextIdx < content.length; w++) {
          // Skip to next word boundary
          while (nextIdx < content.length && !/\s/.test(content[nextIdx])) {
            nextIdx++;
          }
          // Skip whitespace
          while (nextIdx < content.length && /\s/.test(content[nextIdx])) {
            nextIdx++;
          }
        }
        
        // Adjust to safe point (avoiding partial markers)
        nextIdx = findSafeRevealPoint(nextIdx);
        
        revealedIndexRef.current = nextIdx;
        lastWordTime = now;
      }
      
      // Only update React state at throttled interval to reduce re-renders
      const stateElapsed = now - lastStateUpdateRef.current;
      if (stateElapsed >= STATE_UPDATE_INTERVAL || revealedIndexRef.current >= content.length) {
        setRevealedContent(content.slice(0, revealedIndexRef.current));
        lastStateUpdateRef.current = now;
      }
      
      // Continue animating if not fully revealed
      if (revealedIndexRef.current < content.length) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [content, isStreaming, wordsPerSecond]);
  
  // Reset when content is reset (new message)
  useEffect(() => {
    if (content.length < revealedIndexRef.current) {
      revealedIndexRef.current = 0;
      setRevealedContent('');
    }
  }, [content]);
  
  return revealedContent;
}

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

const TypingIndicator = memo(function TypingIndicator() {
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
});

const UserMessage = memo(function UserMessage({ message, userAvatar, userName }) {
  const [copied, setCopied] = useState(false);
  const muiTheme = useMuiTheme();
  const copyTimeoutRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [message]);

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
});

const AIMessage = memo(function AIMessage({ message, onRunQuery, onOpenSqlEditor, isStreaming }) {
  const [copied, setCopied] = useState(false);
  const muiTheme = useMuiTheme();
  const theme = muiTheme;
  const contentRef = useRef(null);
  const copyTimeoutRef = useRef(null);
  const sqlEditorTimeoutRef = useRef(null);

  // Apply typing animation to raw message before parsing
  // This creates smooth reveal of all content (text, thinking, tools)
  const revealedMessage = useTypingAnimation(message, isStreaming, 35);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (sqlEditorTimeoutRef.current) clearTimeout(sqlEditorTimeoutRef.current);
    };
  }, []);

  const getCleanContent = useCallback(() => message
    .replace(/\[\[THINKING:start\]\]/g, '')
    .replace(/\[\[THINKING:chunk:[^\]]*\]\]/g, '')
    .replace(/\[\[THINKING:end\]\]/g, '')
    .replace(/\[\[TOOL:[^\]]*\]\]/g, ''), [message]);

  // Parse the REVEALED content (not full message) for progressive appearance
  const segments = useMemo(() => filterRedundantTools(parseMessageSegments(revealedMessage)), [revealedMessage]);
  const textOnlySegments = useMemo(
    () => segments.filter((segment) => segment.type === 'text' && segment.content.trim()),
    [segments]
  );

  // Track which execute_query tools we've already auto-opened to prevent duplicates
  const openedToolsRef = useRef(new Set());
  // Track if this message was ever streaming (to distinguish from loaded history)
  const wasStreamingRef = useRef(false);
  
  // Update wasStreaming when isStreaming changes
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
    }
  }, [isStreaming]);

  // Auto-open SQL editor when execute_query tool completes successfully
  // ONLY for messages that were actively streaming (not loaded from history)
  useEffect(() => {
    // Only trigger if:
    // 1. We have the callback
    // 2. Message is NOT currently streaming
    // 3. Message WAS streaming at some point (not loaded from history)
    if (!onOpenSqlEditor || isStreaming || !wasStreamingRef.current) return;

    segments.forEach((segment, idx) => {
      if (
        segment.type === 'tool' &&
        segment.name === 'execute_query' &&
        segment.status === 'done' &&
        !openedToolsRef.current.has(idx)
      ) {
        // Mark as opened to prevent re-triggering
        openedToolsRef.current.add(idx);

        // Parse the tool result to get query and results
        let parsedArgs = null;
        let parsedResult = null;
        try {
          parsedArgs = segment.args && segment.args !== 'null' ? JSON.parse(segment.args) : null;
          parsedResult = segment.result && segment.result !== 'null' ? JSON.parse(segment.result) : null;
        } catch (e) {
          // Ignore parse errors
        }

        // Only auto-open if we have successful results
        if (parsedResult && parsedResult.success !== false && !parsedResult.error) {
          const query = parsedArgs?.query || '';
          
          // Parse full data directly from tool result (no cache fetch needed)
          // Backend now embeds full data in the streamed tool result
          const results = {
            columns: parsedResult?.columns || [],
            data: parsedResult?.data || parsedResult?.preview || [],
            row_count: parsedResult?.row_count || 0,
            truncated: parsedResult?.truncated || false,
          };
          
          // Normalize: SQLResultsTable expects 'result' not 'data'
          const normalizedResults = {
            columns: results.columns || [],
            result: results.data || [],
            row_count: results.row_count || 0,
            truncated: results.truncated || false,
          };
          
          // Small delay to ensure UI is ready
          if (sqlEditorTimeoutRef.current) clearTimeout(sqlEditorTimeoutRef.current);
          sqlEditorTimeoutRef.current = setTimeout(() => {
            onOpenSqlEditor(query, normalizedResults);
          }, 100);
        }
      }
    });
  }, [segments, isStreaming, onOpenSqlEditor]);

  const handleCopy = useCallback(() => {
    const container = contentRef.current;
    const htmlContent = container?.innerHTML;
    const cleanContent = getCleanContent();
    const plainTextContent = container?.innerText || cleanContent;

    const setCopiedWithTimeout = () => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    };

    // Prefer copying rendered HTML + plaintext; fallback to plaintext only
    if (htmlContent && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainTextContent], { type: 'text/plain' });
      navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])
        .then(setCopiedWithTimeout)
        .catch(() => {
          navigator.clipboard.writeText(plainTextContent);
          setCopiedWithTimeout();
        });
    } else {
      navigator.clipboard.writeText(plainTextContent);
      setCopiedWithTimeout();
    }
  }, [getCleanContent]);

  return (
    <Box sx={{ py: 1.5, px: { xs: 2, sm: 4, md: 6 }, '&:hover .copy-btn': { opacity: 1 }, animation: `${fadeIn} 0.3s ease-out` }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <Avatar src="/product-logo.png" sx={{ width: 32, height: 32, bgcolor: 'transparent', flexShrink: 0, border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}` }} />
        <Box sx={{ flex: 1, minWidth: 0, pt: 0 }}>
          {segments.map((segment, idx) => {
            const isLast = idx === segments.length - 1;
            const key = `${idx}-${segment.type}`;

            if (segment.type === 'thinking') {
              return (
                <InlineThinkingBlock
                  key={key}
                  content={segment.content}
                  isActive={!segment.isComplete && isStreaming && isLast}
                  isFirst={idx === 0}
                />
              );
            }
            if (segment.type === 'tool') {
              return (
                <InlineToolBlock
                  key={`${key}-${segment.name}`}
                  tool={segment}
                  isFirst={idx === 0}
                  onOpenSqlEditor={onOpenSqlEditor}
                />
              );
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
});

function MessageList({ messages = [], user, onRunQuery, onOpenSqlEditor }) {
  return (
    <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
      {messages.map((msg, index) => (
        msg.sender === 'user'
          ? <UserMessage key={index} message={msg.content} userAvatar={user?.photoURL} userName={user?.displayName} />
          : <AIMessage key={index} message={msg.content} onRunQuery={onRunQuery} onOpenSqlEditor={onOpenSqlEditor} isStreaming={msg.isStreaming} />
      ))}
    </Box>
  );
}

export default MessageList;
