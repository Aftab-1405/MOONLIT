import { Box, Typography, Avatar, IconButton, Tooltip, useTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import Fade from '@mui/material/Fade';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { InlineThinkingBlock, InlineToolBlock } from './AIResponseSteps';
import MarkdownRenderer from './MarkdownRenderer';

// Constants
const COPY_FEEDBACK_DURATION = 2000; // ms to show "Copied!" feedback

// Spinner animation for AI avatar waiting state
const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/**
 * Reusable copy-to-clipboard hook with feedback state
 * Handles timeout cleanup automatically
 */
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copyText = useCallback((text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
  }, []);

  const copyRich = useCallback((htmlContent, plainText) => {
    const setCopiedWithTimeout = () => {
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
    };

    if (htmlContent && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])
        .then(setCopiedWithTimeout)
        .catch(() => {
          navigator.clipboard.writeText(plainText);
          setCopiedWithTimeout();
        });
    } else {
      navigator.clipboard.writeText(plainText);
      setCopiedWithTimeout();
    }
  }, []);

  return { copied, copyText, copyRich };
}

/**
 * Reusable copy button with feedback state (DRY)
 */
const CopyButton = memo(function CopyButton({ copied, onClick, className = 'copy-btn', sx = {} }) {
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
      <IconButton 
        className={className}
        size="small" 
        onClick={onClick} 
        sx={{ 
          opacity: 0, 
          color: copied ? 'text.primary' : 'text.secondary', 
          transition: 'opacity 0.2s', 
          '&:hover': { color: 'primary.main' },
          ...sx,
        }}
      >
        {copied ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
      </IconButton>
    </Tooltip>
  );
});

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
  const lastStateUpdateRef = useRef(0);  // Will be set on first animate call
  const revealedIndexRef = useRef(0);
  
  // Minimum time between React state updates (limits re-renders)
  const STATE_UPDATE_INTERVAL = 50; // 20 updates/sec max
  
  useEffect(() => {
    // If not streaming, show everything immediately
    if (!isStreaming) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: immediate reveal for non-streaming content
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset animation state on content change
      setRevealedContent('');
    }
  }, [content]);
  
  return revealedContent;
}

/**
 * Strip JSON objects from text that the LLM may echo (tool args/results).
 * Uses efficient bracket matching - O(n) single pass.
 * Handles: leading JSON, trailing JSON, multiple embedded objects.
 */
function stripJsonFromText(text) {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  let changed = true;
  
  // Iterate until no more JSON objects are found (handles multiple)
  while (changed && result.length > 0) {
    changed = false;
    const trimmed = result.trim();
    
    // Check for leading JSON object
    if (trimmed.startsWith('{')) {
      const endIdx = findJsonObjectEnd(trimmed, 0);
      if (endIdx !== -1) {
        // Verify it's valid JSON
        const jsonCandidate = trimmed.slice(0, endIdx + 1);
        try {
          JSON.parse(jsonCandidate);
          // Valid JSON - remove it and continue
          result = trimmed.slice(endIdx + 1).trim();
          changed = true;
          continue;
        } catch {
          // Not valid JSON, keep it
        }
      }
    }
    
    // Check for trailing JSON object
    const lastBrace = trimmed.lastIndexOf('}');
    if (lastBrace !== -1) {
      // Find matching opening brace by scanning backwards
      const startIdx = findJsonObjectStart(trimmed, lastBrace);
      if (startIdx !== -1 && startIdx > 0) {
        const jsonCandidate = trimmed.slice(startIdx, lastBrace + 1);
        try {
          JSON.parse(jsonCandidate);
          // Valid trailing JSON - remove it
          result = trimmed.slice(0, startIdx).trim();
          changed = true;
        } catch {
          // Not valid JSON, keep it
        }
      }
    }
  }
  
  return result;
}

/**
 * Find the end index of a JSON object starting at startIdx.
 * Uses bracket matching - handles nested objects and strings.
 */
function findJsonObjectEnd(text, startIdx) {
  if (text[startIdx] !== '{') return -1;
  
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = startIdx; i < text.length; i++) {
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
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  
  return -1; // Unbalanced
}

/**
 * Find the start index of a JSON object that ends at endIdx.
 * Scans backwards to find matching opening brace.
 */
function findJsonObjectStart(text, endIdx) {
  let depth = 0;
  let inString = false;
  
  for (let i = endIdx; i >= 0; i--) {
    const char = text[i];
    
    // Simple backwards scan - less precise with strings but works for validation
    if (char === '"') {
      // Check if escaped (look for odd number of preceding backslashes)
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 0) inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '}') depth++;
      else if (char === '{') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  
  return -1;
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
      const cleanedText = stripJsonFromText(remainingText);
      if (cleanedText) {
        segments.push({ type: 'text', content: cleanedText });
      }
      break;
    }
    
    if (nextMarkerStart > currentIndex) {
      const textContent = text.slice(currentIndex, nextMarkerStart);
      const cleanedText = stripJsonFromText(textContent);
      if (cleanedText) {
        segments.push({ type: 'text', content: cleanedText });
      }
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
      
      // Safety: ensure forward progress even if no chunks/end were found
      if (!isThinkingComplete && thinkingContent === '') {
        const nextEnd = text.indexOf('[[THINKING:end]]', currentIndex);
        currentIndex = nextEnd !== -1 ? nextEnd + '[[THINKING:end]]'.length : text.length;
      }
      
      segments.push({ type: 'thinking', content: thinkingContent, isComplete: isThinkingComplete });
    } else if (markerType === 'tool') {
      const parsed = parseToolMarker(text, nextMarkerStart);
      if (parsed) {
        segments.push(parsed.segment);
        currentIndex = parsed.endIndex;
      } else {
        // If parsing fails, skip to the end of this marker to avoid leaking raw text
        const failEnd = text.indexOf(']]', nextMarkerStart);
        currentIndex = failEnd !== -1 ? failEnd + 2 : text.length;
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
    argsEnd = findJsonObjectEnd(text, argsStart);
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
    resultEnd = findJsonObjectEnd(text, resultStart);
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


/**
 * Filter redundant tools - only removes duplicate running/done pairs at the same position.
 * 
 * When a tool transitions from running → done, we get two markers at nearby positions.
 * We keep only the 'done' one. But we preserve ALL distinct tool calls (even if same name).
 */
function filterRedundantTools(segments) {
  const result = [];
  const seenToolsAtPosition = new Map(); // Track tool calls by approximate position
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    
    if (seg.type !== 'tool') {
      result.push(seg);
      continue;
    }
    
    // Create a unique key based on tool name and args to identify the same logical call
    const argsKey = seg.args || 'null';
    const toolKey = `${seg.name}:${argsKey}`;
    
    // Check if we've seen this exact tool call before
    const existing = seenToolsAtPosition.get(toolKey);
    
    if (existing) {
      // Same tool call - prefer 'done' status over 'running'
      if (seg.status === 'done' && existing.status === 'running') {
        // Replace running with done in result
        const existingIdx = result.indexOf(existing);
        if (existingIdx !== -1) {
          result[existingIdx] = seg;
        }
        seenToolsAtPosition.set(toolKey, seg);
      }
      // If existing is already 'done' or both are same status, keep existing
    } else {
      // New tool call - add it
      result.push(seg);
      seenToolsAtPosition.set(toolKey, seg);
    }
  }
  
  return result;
}

const TypingIndicator = memo(function TypingIndicator() {
  const theme = useTheme();
  return (
    <Box sx={{ py: 2.5, px: { xs: 2, sm: 4, md: 6 } }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 2 }}>
        <Avatar src="/product-logo.png" sx={{ width: 24, height: 24, bgcolor: 'transparent', border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}` }} />
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
  const { copied, copyText } = useCopyToClipboard();
  const theme = useTheme();

  const handleCopy = useCallback(() => copyText(message), [copyText, message]);

  return (
    <Fade in timeout={300}>
    <Box sx={{ py: 1.5, px: { xs: 2, sm: 4, md: 6 } }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
        <Box sx={{ display: 'flex', gap: 1.5, maxWidth: '80%', flexDirection: 'row-reverse', '&:hover .copy-btn': { opacity: 1 } }}>
          <Avatar src={userAvatar} sx={{ width: 24, height: 24, bgcolor: 'primary.main', fontSize: '0.75rem', fontWeight: 600, alignSelf: 'flex-start', mt: 0.5 }}>
            {!userAvatar && (userName?.charAt(0).toUpperCase() || 'U')}
          </Avatar>
          <Box sx={{ px: 2, py: 1.25, borderRadius: '16px 16px 4px 16px', backgroundColor: alpha(theme.palette.text.primary, 0.05), border: '1px solid', borderColor: alpha(theme.palette.text.primary, 0.1) }}>
            <Typography sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'text.primary', fontSize: '0.925rem' }}>
              {message}
            </Typography>
          </Box>
          <CopyButton copied={copied} onClick={handleCopy} sx={{ alignSelf: 'center' }} />
        </Box>
      </Box>
    </Box>
    </Fade>
  );
});

const AIMessage = memo(function AIMessage({ message, onRunQuery, onOpenSqlEditor, isStreaming, isWaiting }) {
  const { copied, copyRich } = useCopyToClipboard();
  const theme = useTheme();

  const contentRef = useRef(null);
  const sqlEditorTimeoutRef = useRef(null);

  // Apply typing animation to raw message before parsing
  // This creates smooth reveal of all content (text, thinking, tools)
  const revealedMessage = useTypingAnimation(message, isStreaming, 35);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
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
        } catch {
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
    copyRich(htmlContent, plainTextContent);
  }, [getCleanContent, copyRich]);

  return (
    <Fade in timeout={300}>
    <Box sx={{ py: 1.5, px: { xs: 2, sm: 4, md: 6 }, '&:hover .copy-btn': { opacity: 1 } }}>
      <Box sx={{ maxWidth: 800, mx: 'auto', display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {/* Avatar with spinner animation when waiting */}
        <Avatar 
          src="/product-logo.png" 
          sx={{ 
            width: 24, 
            height: 24, 
            bgcolor: 'transparent', 
            flexShrink: 0,
            alignSelf: 'flex-start',
            mt: 0.5,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            // Spinner animation when waiting
            animation: isWaiting ? `${spin} 1s linear infinite` : 'none',
          }} 
        />
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
        <CopyButton copied={copied} onClick={handleCopy} sx={{ alignSelf: 'flex-start', mt: 0.5 }} />
      </Box>
    </Box>
    </Fade>
  );
});

function MessageList({ messages = [], user, onRunQuery, onOpenSqlEditor }) {
  return (
    <Box sx={{ flex: 1, overflow: 'auto', py: 2 }}>
      {messages.map((msg, index) => (
        msg.sender === 'user'
          ? <UserMessage key={index} message={msg.content} userAvatar={user?.photoURL} userName={user?.displayName} />
          : <AIMessage key={index} message={msg.content} onRunQuery={onRunQuery} onOpenSqlEditor={onOpenSqlEditor} isStreaming={msg.isStreaming} isWaiting={msg.isWaiting} />
      ))}
    </Box>
  );
}

export default MessageList;
