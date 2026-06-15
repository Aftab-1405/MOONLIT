import { Box, Typography, IconButton, Tooltip, Button, Skeleton, CircularProgress, useTheme, useMediaQuery } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Fade from '@mui/material/Fade';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import { StepsAccordion } from '@/features/chat/ai-response-steps';
import MarkdownRenderer from '@/features/chat/MarkdownRenderer';
import { MESSAGE_STATUS } from '@/utils/chatMessages';
import {
  HOVER_CAPABLE_QUERY,
  REDUCED_MOTION_QUERY,
} from '@/styles/mediaQueries';
import { UI_LAYOUT } from '@/styles/shared';

const COPY_FEEDBACK_DURATION = 2000;
const CANVAS_CODE_LANGUAGES = new Set(['diagram-flow']);
const FENCED_CODE_BLOCK_PATTERN = /```([A-Za-z0-9_-]+)[^\n]*\n([\s\S]*?)```/g;

const messageActionsRowSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 0.5,
  flexWrap: 'wrap',
  opacity: 0,
  transition: 'opacity 0.2s ease',
};

const turnGroupHoverSx = {
  [HOVER_CAPABLE_QUERY]: {
    '&:hover .msg-actions-row': { opacity: 1 },
    '&:focus-within .msg-actions-row': { opacity: 1 },
  },
  '@media (pointer: coarse)': {
    '& .msg-actions-row': { opacity: 1 },
  },
};

function fallbackCopyText(text) {
  if (typeof document === 'undefined') return false;
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textArea);
  return copied;
}

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const setCopiedWithTimeout = useCallback(() => {
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), COPY_FEEDBACK_DURATION);
  }, []);

  const safeWriteText = useCallback(async (text) => {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return fallbackCopyText(text);
      }
    }
    return fallbackCopyText(text);
  }, []);

  const copyText = useCallback((text) => {
    safeWriteText(text).then((didCopy) => {
      if (didCopy) setCopiedWithTimeout();
    });
  }, [safeWriteText, setCopiedWithTimeout]);

  const copyRich = useCallback((htmlContent, plainText) => {
    const fallbackToText = () => {
      safeWriteText(plainText).then((didCopy) => {
        if (didCopy) setCopiedWithTimeout();
      });
    };

    if (htmlContent && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      navigator.clipboard.write([new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })])
        .then(setCopiedWithTimeout)
        .catch(fallbackToText);
    } else {
      fallbackToText();
    }
  }, [safeWriteText, setCopiedWithTimeout]);

  return { copied, copyText, copyRich };
}

const CopyButton = memo(function CopyButton({ copied, onClick, className = 'message-action-btn', sx = {}, 'data-testid': dataTestId }) {
  return (
    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
      <IconButton
        className={className}
        aria-label="Copy"
        data-testid={dataTestId}
        size="small"
        onClick={onClick}
        color={copied ? 'success' : 'primary'}
        sx={sx}
      >
        {copied ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />}
      </IconButton>
    </Tooltip>
  );
});

const UserMessage = memo(function UserMessage({ message }) {
  const { copied, copyText } = useCopyToClipboard();
  const theme = useTheme();
  const handleCopy = useCallback(() => copyText(message), [copyText, message]);
  const bubbleBg = alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.06);

  return (
    <Fade in timeout={300}>
      <Box
        sx={{
          mt: 3,
          mb: 0.25,
          ...turnGroupHoverSx,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Box
            sx={{
              display: 'inline-flex',
              flexDirection: 'column',
              maxWidth: 'min(85%, 75ch)',
              borderRadius: '12px',
              px: 2,
              py: 1.25,
              bgcolor: bubbleBg,
              border: '1px solid',
              borderColor: alpha(theme.palette.divider, 0.85),
              color: 'text.primary',
            }}
          >
            <Typography
              component="div"
              data-testid="user-message"
              sx={{
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: { xs: '0.9375rem', sm: '1rem' },
              }}
            >
              {message}
            </Typography>
          </Box>
          <Box
            className="msg-actions-row"
            role="group"
            aria-label="Message actions"
            sx={messageActionsRowSx}
          >
            <CopyButton copied={copied} onClick={handleCopy} data-testid="action-bar-copy" />
          </Box>
        </Box>
      </Box>
    </Fade>
  );
});

function parseJSON(value) {
  if (!value || value === 'null') return null;
  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function extractCanvasCodeArtifacts(markdown) {
  const artifacts = [];
  String(markdown || '').replace(FENCED_CODE_BLOCK_PATTERN, (match, rawLanguage, code, offset) => {
    const language = String(rawLanguage || '').toLowerCase();
    if (CANVAS_CODE_LANGUAGES.has(language)) {
      artifacts.push({
        key: `${language}-${offset}`,
        type: 'react-flow',
        title: 'Diagram',
        props: {
          code: String(code || '').trim(),
        },
      });
    }
    return match;
  });
  return artifacts;
}

function stripCanvasCodeArtifacts(markdown) {
  return String(markdown || '').replace(FENCED_CODE_BLOCK_PATTERN, (match, rawLanguage) => {
    const language = String(rawLanguage || '').toLowerCase();
    return CANVAS_CODE_LANGUAGES.has(language) ? '' : match;
  });
}

const AIMessage = memo(function AIMessage({
  id,
  text,
  steps,
  timeline,
  status,
  onRunQuery,
  onOpenSqlEditor,
  onOpenCanvasArtifact,
}) {
  const { copied, copyRich } = useCopyToClipboard();
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const contentRef = useRef(null);
  const sqlEditorTimeoutRef = useRef(null);
  const openedToolsRef = useRef(new Set());
  const openedArtifactsRef = useRef(new Set());

  const isStreaming = status === MESSAGE_STATUS.STREAMING;
  const isWaiting = status === MESSAGE_STATUS.WAITING;

  const wasStreamingOrWaitingRef = useRef(false);
  useEffect(() => {
    if (isStreaming || isWaiting) {
      wasStreamingOrWaitingRef.current = true;
    }
  }, [isStreaming, isWaiting]);

  const displayText = text || '';
  const chatDisplayText = useMemo(() => stripCanvasCodeArtifacts(displayText), [displayText]);
  const displaySteps = useMemo(() => (Array.isArray(steps) ? steps : []), [steps]);
  const displayTimeline = useMemo(() => (
    Array.isArray(timeline)
      ? timeline.filter((item) => item && item.type)
      : []
  ), [timeline]);
  const hasTimeline = displayTimeline.length > 0;
  const artifacts = useMemo(() => extractCanvasCodeArtifacts(displayText), [displayText]);

  useEffect(() => {
    return () => {
      if (sqlEditorTimeoutRef.current) clearTimeout(sqlEditorTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!onOpenSqlEditor || isWaiting || isStreaming) return;

    displaySteps.forEach((step, idx) => {
      if (step.type !== 'tool' || step.name !== 'execute_query' || step.status !== 'done') return;
      const stepKey = `${id}-${step.id || idx}`;
      if (openedToolsRef.current.has(stepKey)) return;

      const parsedArgs = parseJSON(step.args);
      const parsedResult = parseJSON(step.result);
      if (!parsedResult || parsedResult.success === false || parsedResult.error) return;

      openedToolsRef.current.add(stepKey);

      const query = parsedArgs?.query || '';
      const resultRows = Array.isArray(parsedResult?.data)
        ? parsedResult.data
        : (Array.isArray(parsedResult?.preview) ? parsedResult.preview : []);
      const normalizedResults = {
        columns: parsedResult?.columns || [],
        result: resultRows,
        row_count: parsedResult?.row_count || 0,
        total_rows: parsedResult?.total_rows || parsedResult?.row_count || 0,
        truncated: parsedResult?.truncated || false,
      };

      if (sqlEditorTimeoutRef.current) clearTimeout(sqlEditorTimeoutRef.current);
      sqlEditorTimeoutRef.current = setTimeout(() => {
        onOpenSqlEditor(query, normalizedResults);
      }, 100);
    });
  }, [displaySteps, id, isStreaming, isWaiting, onOpenSqlEditor]);

  useEffect(() => {
    if (!onOpenCanvasArtifact || isWaiting || isStreaming) return;
    
    // Only auto-trigger the artifact loader if the message was actively streamed/generated in this session
    if (!wasStreamingOrWaitingRef.current) return;

    const artifactsList = extractCanvasCodeArtifacts(text);
    artifactsList.forEach((artifact) => {
      const artifactKey = `${id}-${artifact.key}`;
      if (openedArtifactsRef.current.has(artifactKey)) return;
      openedArtifactsRef.current.add(artifactKey);
      onOpenCanvasArtifact(artifact);
    });
  }, [id, isStreaming, isWaiting, onOpenCanvasArtifact, text]);

  const handleCopy = useCallback(() => {
    const container = contentRef.current;
    const htmlContent = container?.innerHTML;
    const plainTextContent = container?.innerText || displayText;
    copyRich(htmlContent, plainTextContent);
  }, [copyRich, displayText]);

  const showThinkingSpinner = isWaiting && displaySteps.length === 0 && !chatDisplayText.trim() && !hasTimeline;

  const renderTextBlock = useCallback((content, key) => {
    const blockText = stripCanvasCodeArtifacts(content);
    if (!blockText.trim()) return null;

    return (
      <Box
        key={key}
        data-testid="assistant-text-chunk"
        sx={{
          pl: 1,
          pr: { xs: 2, sm: 4 },
          minWidth: 0,
          py: 0.5,
          overflowAnchor: 'none',
        }}
      >
        <MarkdownRenderer content={blockText} onRunQuery={onRunQuery} />
      </Box>
    );
  }, [onRunQuery]);

  const renderStepBlock = useCallback((step, key) => (
    <Box
      key={key}
      data-testid={`assistant-${step.type}-step`}
      sx={{ pl: 1, py: 0.75, minWidth: 0 }}
    >
      <StepsAccordion steps={[step]} isStreaming={isWaiting || isStreaming} />
    </Box>
  ), [isStreaming, isWaiting]);

  return (
    <Fade in timeout={300}>
      <Box
        sx={{
          pb: 3,
          minWidth: 0,
          ...turnGroupHoverSx,
        }}
      >
        <Box ref={contentRef} sx={{ position: 'relative', lineHeight: 1.65, minWidth: 0 }}>
          {showThinkingSpinner && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1, py: 0.75, color: 'text.secondary' }}>
              {prefersReducedMotion ? (
                <Typography component="span" variant="body2" color="text.secondary" aria-hidden>
                  …
                </Typography>
              ) : (
                <CircularProgress size={16} thickness={4} sx={{ color: 'primary.main' }} />
              )}
            </Box>
          )}

          {hasTimeline
            ? displayTimeline.map((item, index) => {
              if (item.type === 'text') {
                return renderTextBlock(item.content || '', item.id || `text-${index}`);
              }
              if (item.type === 'thinking' || item.type === 'tool') {
                return renderStepBlock(item, item.id || `${item.type}-${index}`);
              }
              return null;
            })
            : (
              <>
                {displaySteps.length > 0 && (
                  <Box sx={{ pl: 1, py: 0.75, minWidth: 0 }}>
                    <StepsAccordion steps={displaySteps} isStreaming={isWaiting || isStreaming} />
                  </Box>
                )}

                {chatDisplayText.trim() && renderTextBlock(chatDisplayText, 'legacy-text')}
              </>
            )}

          {artifacts.length > 0 && (
            <Box
              sx={{
                pl: 1,
                pr: { xs: 2, sm: 4 },
                mt: 1.5,
                mb: 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
              }}
            >
              {artifacts.map((artifact) => (
                <Box
                  key={artifact.key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    p: 1.75,
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: theme.palette.border?.subtle || (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.0305 : 0.015),
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      borderColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.32 : 0.24),
                      bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.055 : 0.025),
                      boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.04)}`,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                    <AccountTreeOutlinedIcon sx={{ color: 'primary.main', fontSize: 22, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 650, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {artifact.title || 'React Flow Diagram'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Interactive node graph visualization
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={() => onOpenCanvasArtifact(artifact)}
                    sx={{
                      borderRadius: '6px',
                      textTransform: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 650,
                      flexShrink: 0,
                      px: 2.25,
                      py: 0.5,
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                      },
                    }}
                  >
                    View Diagram
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box
          className="msg-actions-row"
          role="group"
          aria-label="Message actions"
          sx={{
            ...messageActionsRowSx,
            width: '100%',
            mt: 0.25,
          }}
        >
          <CopyButton copied={copied} onClick={handleCopy} data-testid="action-bar-copy" />
        </Box>
      </Box>
    </Fade>
  );
});

const ConversationLoadingSkeleton = memo(function ConversationLoadingSkeleton() {
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const animation = prefersReducedMotion ? false : 'wave';
  const lineWidths = [
    '100%',
    '91%',
    '100%',
    '82%',
    '91%',
    '100%',
    '73%',
    '91%',
    '82%',
    '73%',
    '35%',
  ];

  return (
    <Box sx={{ flex: 1, py: { xs: 1.5, sm: 2 }, overflowAnchor: 'none' }}>
      <Box
        sx={{
          width: '100%',
          maxWidth: UI_LAYOUT.chatInputMaxWidth,
          mx: 'auto',
          px: 2,
          pt: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: { xs: 1.5, sm: 2.25 } }}>
          <Skeleton
            variant="rounded"
            animation={animation}
            sx={{
              width: { xs: 112, sm: 168 },
              height: { xs: 26, sm: 34 },
              borderRadius: '12px',
            }}
          />
        </Box>

        {lineWidths.map((width, idx) => (
          <Skeleton
            key={`line-skeleton-${idx}`}
            variant="rounded"
            animation={animation}
            sx={{
              width,
              height: { xs: 10, sm: 12 },
              mb: { xs: 0.85, sm: 1 },
              borderRadius: 999,
            }}
          />
        ))}
      </Box>
    </Box>
  );
});

function normalizeAssistantMessage(message) {
  return {
    id: message.id,
    text: message.text || '',
    steps: message.steps || [],
    timeline: message.timeline || [],
    status: message.status || MESSAGE_STATUS.DONE,
  };
}

const MessageList = memo(function MessageList({
  messages = [],
  isLoadingConversation = false,
  loadError = false,
  onRunQuery,
  onOpenSqlEditor,
  onOpenCanvasArtifact,
}) {
  const [visibleCount, setVisibleCount] = useState(60);
  const normalizedMessages = useMemo(() => (
    messages.map((message, index) => {
      const id = message.id || `message-${index}`;
      if (message.role === 'user') {
        return { id, role: 'user', text: message.text };
      }
      return { id, role: 'assistant', ...normalizeAssistantMessage(message) };
    })
  ), [messages]);
  const effectiveVisibleCount = normalizedMessages.length <= 50 ? 60 : visibleCount;
  const hiddenCount = Math.max(0, normalizedMessages.length - effectiveVisibleCount);
  const visibleMessages = hiddenCount > 0
    ? normalizedMessages.slice(-effectiveVisibleCount)
    : normalizedMessages;

  if (isLoadingConversation) {
    return <ConversationLoadingSkeleton />;
  }

  if (loadError && messages.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 4,
          textAlign: 'center',
        }}
      >
        <Typography sx={{ color: 'text.secondary', maxWidth: 420 }}>
          This conversation could not be loaded. Try selecting it again from the sidebar.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        py: 2,
        overflowAnchor: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: UI_LAYOUT.chatInputMaxWidth,
          mx: 'auto',
          px: 2,
          pt: 0.5,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {hiddenCount > 0 && (
          <Box sx={{ pb: 1 }}>
            <Button
              color="secondary"
              size="small"
              onClick={() => setVisibleCount((c) => c + 50)}
              sx={{ minHeight: { xs: 36, sm: 'auto' }, borderRadius: '8px' }}
            >
              Load {Math.min(50, hiddenCount)} older messages
            </Button>
          </Box>
        )}
        {visibleMessages.map((message) => (
          message.role === 'user'
            ? <UserMessage key={message.id} message={message.text} />
            : (
              <AIMessage
                key={message.id}
                id={message.id}
                text={message.text}
                steps={message.steps}
                timeline={message.timeline}
                status={message.status}
                onRunQuery={onRunQuery}
                onOpenSqlEditor={onOpenSqlEditor}
                onOpenCanvasArtifact={onOpenCanvasArtifact}
              />
            )
        ))}
      </Box>
    </Box>
  );
});

export default MessageList;
