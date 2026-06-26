import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Skeleton,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";
import Fade from "@mui/material/Fade";
import InlineExecutionTable from "./InlineExecutionTable";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { useState, useMemo, useRef, useEffect, useCallback, memo } from "react";
import { copyToClipboard } from "@/utils/clipboard";
import {
  slideIn,
} from "@/features/chat/ai-response-steps/timelineShared";
import { StepsAccordion } from "@/features/chat/ai-response-steps";
import MarkdownRenderer from "@/features/chat/MarkdownRenderer";
import { MESSAGE_STATUS } from "@/utils/chatMessages";
import {
  HOVER_CAPABLE_QUERY,
  REDUCED_MOTION_QUERY,
} from "@/styles/mediaQueries";
import { UI_LAYOUT } from "@/styles/shared";

const COPY_FEEDBACK_DURATION = 2000;
const CANVAS_CODE_LANGUAGES = new Set(["diagram-flow"]);
const FENCED_CODE_BLOCK_PATTERN = /```([A-Za-z0-9_-]+)[^\n]*\n([\s\S]*?)```/g;

const softPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.76; }
`;

const messageActionsRowSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 0.5,
  flexWrap: "wrap",
  minHeight: 30,
  opacity: 0,
  transform: "translateY(-2px)",
  transition: "opacity 140ms ease, transform 140ms ease",
};

const turnGroupHoverSx = {
  [HOVER_CAPABLE_QUERY]: {
    "&:hover .msg-actions-row": { opacity: 1, transform: "translateY(0)" },
    "&:focus-within .msg-actions-row": {
      opacity: 1,
      transform: "translateY(0)",
    },
  },
  "@media (pointer: coarse)": {
    "& .msg-actions-row": { opacity: 1, transform: "translateY(0)" },
  },
};

const getMessageActionButtonSx = (theme, copied = false) => ({
  width: 30,
  height: 30,
  borderRadius: "8px",
  color: copied ? "success.main" : "text.secondary",
  transition: theme.transitions.create(["background-color", "color"], {
    duration: theme.transitions.duration.shorter,
  }),
  [HOVER_CAPABLE_QUERY]: {
    "&:hover": {
      color: "text.primary",
      bgcolor: alpha(theme.palette.text.primary, 0.045),
    },
  },
  "&:focus-visible": {
    outline: `2px solid ${alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.18 : 0.12)}`,
    outlineOffset: 2,
  },
});

function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const setCopiedWithTimeout = useCallback(() => {
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => setCopied(false),
      COPY_FEEDBACK_DURATION,
    );
  }, []);

  const copyText = useCallback(
    (text) => {
      copyToClipboard(text).then((ok) => {
        if (ok) setCopiedWithTimeout();
      });
    },
    [setCopiedWithTimeout],
  );

  const copyRich = useCallback(
    (htmlContent, plainText) => {
      const fallbackToText = () => {
        copyToClipboard(plainText).then((ok) => {
          if (ok) setCopiedWithTimeout();
        });
      };

      if (
        htmlContent &&
        navigator.clipboard?.write &&
        typeof ClipboardItem !== "undefined"
      ) {
        const htmlBlob = new Blob([htmlContent], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        navigator.clipboard
          .write([
            new ClipboardItem({
              "text/html": htmlBlob,
              "text/plain": textBlob,
            }),
          ])
          .then(setCopiedWithTimeout)
          .catch(fallbackToText);
      } else {
        fallbackToText();
      }
    },
    [setCopiedWithTimeout],
  );

  return { copied, copyText, copyRich };
}

const CopyButton = memo(function CopyButton({
  copied,
  onClick,
  className = "message-action-btn",
  sx = {},
  "data-testid": dataTestId,
}) {
  const theme = useTheme();

  return (
    <Tooltip title={copied ? "Copied!" : "Copy"}>
      <IconButton
        className={className}
        aria-label="Copy"
        data-testid={dataTestId}
        size="small"
        onClick={onClick}
        color="inherit"
        sx={{ ...getMessageActionButtonSx(theme, copied), ...sx }}
      >
        {copied ? (
          <CheckRoundedIcon sx={{ fontSize: 18 }} />
        ) : (
          <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
        )}
      </IconButton>
    </Tooltip>
  );
});

const UserMessage = memo(function UserMessage({ message }) {
  const { copied, copyText } = useCopyToClipboard();
  const theme = useTheme();
  const handleCopy = useCallback(() => copyText(message), [copyText, message]);
  const bubbleBg = alpha(
    theme.palette.text.primary,
    theme.palette.mode === "dark" ? 0.055 : 0.035,
  );
  const bubbleBorder = alpha(
    theme.palette.text.primary,
    theme.palette.mode === "dark" ? 0.1 : 0.075,
  );

  return (
    <Fade in timeout={180}>
      <Box
        sx={{
          mt: { xs: 2, sm: 2.25 },
          mb: 0,
          ...turnGroupHoverSx,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 0.5,
          }}
        >
          <Box
            sx={{
              display: "inline-flex",
              flexDirection: "column",
              maxWidth: { xs: "min(90%, 72ch)", sm: "min(78%, 75ch)" },
              borderRadius: "14px 14px 6px 14px",
              px: { xs: 1.5, sm: 1.75 },
              py: { xs: 1, sm: 1.1 },
              bgcolor: bubbleBg,
              border: "1px solid",
              borderColor: bubbleBorder,
              color: "text.primary",
            }}
          >
            <Typography
              component="div"
              data-testid="user-message"
              sx={{
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: { xs: "0.925rem", sm: "0.97rem" },
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
            <CopyButton
              copied={copied}
              onClick={handleCopy}
              data-testid="action-bar-copy"
            />
          </Box>
        </Box>
      </Box>
    </Fade>
  );
});

function parseJSON(value) {
  if (!value || value === "null") return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function getQueryExecutionMeta(step, fallbackConversationId = null) {
  if (
    step?.name !== "execute_query" ||
    step?.status !== "done" ||
    !step?.result
  ) {
    return null;
  }

  const parsedResult = parseJSON(step.result);
  const result =
    parsedResult && typeof parsedResult === "object" ? parsedResult : {};
  const nestedResult =
    result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? result.data
      : {};
  const executionId =
    result.execution_id ||
    result.executionId ||
    nestedResult.execution_id ||
    nestedResult.executionId;

  if (!executionId) return null;

  return {
    executionId,
    conversationId:
      result.conversation_id ||
      result.conversationId ||
      nestedResult.conversation_id ||
      nestedResult.conversationId ||
      fallbackConversationId,
  };
}

/**
 * Extracts completed canvas code blocks (both fences present) from markdown.
 * Used to populate DiagramArtifactCard.
 */
function extractCanvasCodeArtifacts(markdown) {
  const artifacts = [];
  String(markdown || "").replace(
    FENCED_CODE_BLOCK_PATTERN,
    (match, rawLanguage, code, offset) => {
      const language = String(rawLanguage || "").toLowerCase();
      if (CANVAS_CODE_LANGUAGES.has(language)) {
        artifacts.push({
          key: `${language}-${offset}`,
          type: "react-flow",
          title: "Diagram",
          props: {
            code: String(code || "").trim(),
          },
        });
      }
      return match;
    },
  );
  return artifacts;
}

/**
 * Returns true when the text contains an opening canvas code fence whose
 * closing fence has not yet arrived — i.e. the block is still streaming in.
 * Only used to show a "Building diagram…" placeholder card during streaming.
 */
function hasOpenCanvasBlock(markdown) {
  const src = String(markdown || "");
  for (const lang of CANVAS_CODE_LANGUAGES) {
    // Opening fence exists AND the closing ``` is not present after it
    const openPattern = new RegExp("```" + lang + "(?:\\s|\\n|$)", "i");
    if (!openPattern.test(src)) continue;
    // If a COMPLETE block is present, it's not partial
    const completePattern = new RegExp(
      "```" + lang + "[^\\n]*\\n[\\s\\S]*?```",
      "i",
    );
    if (!completePattern.test(src)) return true;
  }
  return false;
}

/**
 * Diagram artifact card — shown in the AI message for react-flow diagrams.
 * Renders two states:
 *   - isGenerating=true  → quiet placeholder state
 *   - isGenerating=false → full text + interactive "View diagram" button
 */
const DiagramArtifactCard = memo(function DiagramArtifactCard({
  artifact,
  isGenerating = false,
  onOpen,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const panelBorder = alpha(theme.palette.text.primary, isDark ? 0.1 : 0.075);
  const panelBg = alpha(theme.palette.text.primary, isDark ? 0.028 : 0.018);
  const panelHoverBg = alpha(
    theme.palette.text.primary,
    isDark ? 0.045 : 0.03,
  );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 1.25, sm: 1.5 },
        py: { xs: 1.1, sm: 1.25 },
        borderRadius: "8px",
        border: "1px solid",
        borderColor: panelBorder,
        bgcolor: panelBg,
        transition: theme.transitions.create(["background-color", "border-color"], {
          duration: theme.transitions.duration.shorter,
        }),
        ...(!isGenerating && {
          [HOVER_CAPABLE_QUERY]: {
            "&:hover": {
              bgcolor: panelHoverBg,
              borderColor: alpha(theme.palette.text.primary, isDark ? 0.14 : 0.1),
            },
          },
        }),
      }}
    >
      <Box
        sx={{
          width: { xs: 36, sm: 40 },
          height: { xs: 36, sm: 40 },
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          bgcolor: alpha(theme.palette.text.primary, isDark ? 0.075 : 0.045),
          transition: "background-color 140ms ease",
          ...(isGenerating && {
            animation: `${softPulse} 2.2s ease-in-out infinite`,
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
            },
          }),
        }}
      >
        <AccountTreeOutlinedIcon
          sx={{
            fontSize: { xs: 18, sm: 20 },
            color: isGenerating
              ? alpha(theme.palette.text.primary, isDark ? 0.38 : 0.34)
              : alpha(theme.palette.text.primary, isDark ? 0.74 : 0.68),
            transition: "color 140ms ease",
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            ...theme.typography.uiBodySm,
            fontFamily: theme.typography.fontFamily,
            fontWeight: 650,
            lineHeight: 1.25,
            color: isGenerating
              ? alpha(theme.palette.text.primary, isDark ? 0.42 : 0.38)
              : "text.primary",
            transition: "color 140ms ease",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {artifact.title || "Diagram"}
        </Typography>

        <Typography
          sx={{
            ...theme.typography.uiCaptionMd,
            fontFamily: theme.typography.fontFamily,
            lineHeight: 1.4,
            mt: 0.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: isGenerating
              ? alpha(theme.palette.text.primary, isDark ? 0.34 : 0.3)
              : alpha(theme.palette.text.secondary, isDark ? 0.55 : 0.65),
          }}
        >
          {isGenerating ? "Generating diagram\u2026" : "Interactive node graph"}
        </Typography>
      </Box>

      {isGenerating ? (
        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            px: { xs: 1.75, sm: 2.25 },
            py: 0.625,
            borderRadius: "6px",
            bgcolor: alpha(theme.palette.text.primary, isDark ? 0.055 : 0.035),
          }}
        >
          <Typography
            sx={{
              ...theme.typography.uiBodySm,
              fontFamily: theme.typography.fontFamily,
              fontSize: { xs: "0.75rem", sm: "0.8125rem" },
              fontWeight: 600,
              userSelect: "none",
              color: alpha(theme.palette.text.primary, isDark ? 0.42 : 0.38),
            }}
          >
            Building\u2026
          </Typography>
        </Box>
      ) : (
        <Button
          size="small"
          variant="outlined"
          color="primary"
          disableElevation
          onClick={() => onOpen?.(artifact)}
          sx={{
            flexShrink: 0,
            borderRadius: "8px",
            textTransform: "none",
            ...theme.typography.uiBodySm,
            fontFamily: theme.typography.fontFamily,
            fontSize: { xs: "0.75rem", sm: "0.8125rem" },
            fontWeight: 650,
            px: { xs: 1.75, sm: 2.25 },
            py: 0.625,
            color: "text.primary",
            borderColor: alpha(theme.palette.text.primary, isDark ? 0.18 : 0.14),
            transition:
              "background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease",
            [HOVER_CAPABLE_QUERY]: {
              "&:hover": {
                borderColor: alpha(theme.palette.text.primary, isDark ? 0.24 : 0.18),
                bgcolor: alpha(theme.palette.text.primary, isDark ? 0.065 : 0.045),
                boxShadow: "none",
              },
            },
            "&:active": {
              transform: "translateY(1px)",
            },
          }}
        >
          View diagram
        </Button>
      )}
    </Box>
  );
});

const AIMessage = memo(function AIMessage({
  id,
  text,
  steps,
  timeline,
  status,
  onRunQuery,
  onOpenCanvasArtifact,
  conversationId,
}) {
  const { copied, copyRich } = useCopyToClipboard();
  const contentRef = useRef(null);
  const openedArtifactsRef = useRef(new Set());

  const isStreaming = status === MESSAGE_STATUS.STREAMING;
  const isWaiting = status === MESSAGE_STATUS.WAITING;
  const isPaused = status === MESSAGE_STATUS.PAUSED;

  const wasStreamingOrWaitingRef = useRef(false);
  useEffect(() => {
    if (isStreaming || isWaiting) {
      wasStreamingOrWaitingRef.current = true;
    }
  }, [isStreaming, isWaiting]);

  const displayText = text || "";
  const displaySteps = useMemo(
    () => (Array.isArray(steps) ? steps : []),
    [steps],
  );
  // Simple filter — no pre-stripping needed since MarkdownRenderer suppresses
  // canvas blocks itself.
  const displayTimeline = useMemo(
    () =>
      Array.isArray(timeline)
        ? timeline.filter((item) => item && item.type)
        : [],
    [timeline],
  );
  const hasTimeline = displayTimeline.length > 0;
  const showThinkingSpinner = useMemo(
    () =>
      (isWaiting || isStreaming) &&
      displaySteps.length === 0 &&
      !displayText.trim() &&
      !hasTimeline,
    [isWaiting, isStreaming, displaySteps, displayText, hasTimeline]
  );

  const effectiveTimeline = useMemo(() => {
    if (hasTimeline) return displayTimeline;
    if (showThinkingSpinner) {
      return [
        {
          id: "thinking-dummy",
          type: "thinking",
          content: "",
          isComplete: false,
        },
      ];
    }
    return [];
  }, [hasTimeline, displayTimeline, showThinkingSpinner]);

  const hasEffectiveTimeline = effectiveTimeline.length > 0;
  // Complete canvas code artifacts (both fences present)
  const artifacts = useMemo(
    () => extractCanvasCodeArtifacts(displayText),
    [displayText],
  );

  // Partial artifacts — opening fence detected but closing fence not yet
  // arrived. Shows a "Building diagram…" placeholder card during streaming.
  const generatingArtifacts = useMemo(() => {
    if (!isStreaming && !isWaiting) return [];
    if (artifacts.length > 0) return [];
    if (!hasOpenCanvasBlock(displayText)) return [];
    return Array.from(CANVAS_CODE_LANGUAGES).map((lang) => ({
      key: `partial-${lang}`,
      type: "react-flow",
      title: "Diagram",
      isGenerating: true,
      props: { code: "" },
    }));
  }, [displayText, isStreaming, isWaiting, artifacts]);

  // Union: partial (generating) artifacts always precede complete ones.
  // In practice exactly one side is non-empty at any given moment.
  const allArtifacts = useMemo(
    () => [...generatingArtifacts, ...artifacts],
    [generatingArtifacts, artifacts],
  );

  // The execute_query trigger has been removed since results are now displayed inline.

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



  const renderTextBlock = useCallback(
    (content, key) => {
      if (!content || !String(content).trim()) return null;
      return (
        <Box
          key={key}
          data-testid="assistant-text-chunk"
          sx={{
            pl: { xs: 0, sm: 0.5 },
            pr: { xs: 0.5, sm: 3 },
            minWidth: 0,
            py: 0.25,
            overflowAnchor: "none",
            // Same entry spec as StepsAccordion and timeline items — one
            // consistent fade-in for every piece of content that materialises.
            animation: `${slideIn} 0.22s ease-out both`,
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        >
          <MarkdownRenderer content={content} onRunQuery={onRunQuery} />
        </Box>
      );
    },
    [onRunQuery],
  );

  const renderStepBlock = useCallback(
    (step, key) => {
      const executionMeta = getQueryExecutionMeta(step, conversationId);

      return (
        <Box
          key={key}
          data-testid={`assistant-${step.type}-step`}
          sx={{ pl: { xs: 0, sm: 0.5 }, py: 0.5, minWidth: 0 }}
        >
          <StepsAccordion steps={[step]} isStreaming={isWaiting || isStreaming} />
          {executionMeta?.executionId && (
            <InlineExecutionTable
              conversationId={executionMeta.conversationId}
              executionId={executionMeta.executionId}
            />
          )}
        </Box>
      );
    },
    [isStreaming, isWaiting, conversationId],
  );

  return (
    <Fade in timeout={180}>
      <Box
        sx={{
          pb: { xs: 2.25, sm: 2.5 },
          minWidth: 0,
          ...turnGroupHoverSx,
        }}
      >
        <Box
          ref={contentRef}
          sx={{ position: "relative", lineHeight: 1.65, minWidth: 0 }}
        >
          {/* Fade in+out so it cross-fades with the first arriving step
               rather than instantly popping out when the accordion mounts. */}
          {hasEffectiveTimeline ? (
            effectiveTimeline.map((item, index) => {
              if (item.type === "text") {
                return renderTextBlock(
                  item.content || "",
                  item.id || `text-${index}`,
                );
              }
              if (
                item.type === "thinking" ||
                item.type === "tool" ||
                item.type === "skill"
              ) {
                return renderStepBlock(
                  item,
                  item.id || `${item.type}-${index}`,
                );
              }
              return null;
            })
          ) : (
            <>
              {displaySteps.map((step, index) =>
                renderStepBlock(step, step.id || `${step.type}-${index}`),
              )}

              {displayText.trim() &&
                renderTextBlock(displayText, "fallback-text")}
            </>
          )}

          {allArtifacts.length > 0 && (
            <Box
              sx={{
                pl: { xs: 0, sm: 0.5 },
                pr: { xs: 0.5, sm: 3 },
                mt: 1,
                mb: 1,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {allArtifacts.map((artifact) => (
                <DiagramArtifactCard
                  key={artifact.key}
                  artifact={artifact}
                  isGenerating={!!artifact.isGenerating}
                  onOpen={onOpenCanvasArtifact}
                />
              ))}
            </Box>
          )}
        </Box>

        {isPaused && (
          <Box
            role="status"
            aria-label="Task paused"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mt: 1,
              ml: { xs: 0, sm: 0.5 },
              py: 0.9,
              px: 1.5,
              borderRadius: "8px",
              bgcolor: (th) =>
                alpha(
                  th.palette.warning.main,
                  th.palette.mode === "dark" ? 0.1 : 0.06,
                ),
              border: "1px solid",
              borderColor: (th) =>
                alpha(
                  th.palette.warning.main,
                  th.palette.mode === "dark" ? 0.28 : 0.22,
                ),
              maxWidth: "max-content",
            }}
          >
            <PauseCircleOutlineRoundedIcon
              sx={{ fontSize: 16, color: "warning.main", flexShrink: 0 }}
            />
            <Typography
              variant="caption"
              sx={{
                color: "warning.main",
                fontWeight: 600,
                letterSpacing: 0.1,
              }}
            >
              Agent paused — step limit reached.
            </Typography>
          </Box>
        )}

        <Box
          className="msg-actions-row"
          role="group"
          aria-label="Message actions"
          sx={{
            ...messageActionsRowSx,
            width: "100%",
            mt: 0,
            pl: { xs: 0, sm: 0.5 },
          }}
        >
          <CopyButton
            copied={copied}
            onClick={handleCopy}
            data-testid="action-bar-copy"
          />
        </Box>
      </Box>
    </Fade>
  );
});

const ConversationLoadingSkeleton = memo(
  function ConversationLoadingSkeleton() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
    const animation = prefersReducedMotion ? false : "wave";
    const skBg = alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06);
    const skBgLight = alpha(theme.palette.text.primary, isDark ? 0.05 : 0.04);

    return (
      <Box
        role="status"
        aria-label="Loading conversation"
        sx={{ flex: 1, py: { xs: 1.25, sm: 1.75 }, overflowAnchor: "none" }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: UI_LAYOUT.chatInputMaxWidth,
            mx: "auto",
            px: { xs: 1.25, sm: 2 },
            pt: 0.25,
            display: "flex",
            flexDirection: "column",
            gap: { xs: 2.25, sm: 2.75 },
          }}
        >
          {/* First exchange — user bubble */}
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Skeleton
              variant="rounded"
              animation={animation}
              sx={{
                width: { xs: 148, sm: 210 },
                height: { xs: 30, sm: 38 },
                borderRadius: "10px",
                bgcolor: skBg,
              }}
            />
          </Box>

          {/* First exchange — AI response with fake step row */}
          <Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                pl: { xs: 0, sm: 0.5 },
                mb: 1.5,
              }}
            >
              <Skeleton
                variant="circular"
                animation={animation}
                width={13}
                height={13}
                sx={{ flexShrink: 0, bgcolor: skBgLight }}
              />
              <Skeleton
                variant="rounded"
                animation={animation}
                sx={{
                  width: "38%",
                  maxWidth: 196,
                  height: 9,
                  borderRadius: 999,
                  bgcolor: skBgLight,
                }}
              />
            </Box>
            {["100%", "92%", "100%", "84%", "100%", "76%", "46%"].map(
              (width, idx) => (
                <Skeleton
                  key={idx}
                  variant="rounded"
                  animation={animation}
                  sx={{
                    width,
                    height: { xs: 10, sm: 12 },
                    mb: { xs: 0.85, sm: 1 },
                    borderRadius: 999,
                    bgcolor: skBg,
                  }}
                />
              ),
            )}
          </Box>

          {/* Second exchange — shorter user bubble */}
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Skeleton
              variant="rounded"
              animation={animation}
              sx={{
                width: { xs: 100, sm: 148 },
                height: { xs: 30, sm: 38 },
                borderRadius: "10px",
                bgcolor: skBg,
              }}
            />
          </Box>

          {/* Second exchange — AI response text lines */}
          <Box>
            {["100%", "90%", "68%"].map((width, idx) => (
              <Skeleton
                key={idx}
                variant="rounded"
                animation={animation}
                sx={{
                  width,
                  height: { xs: 10, sm: 12 },
                  mb: { xs: 0.85, sm: 1 },
                  borderRadius: 999,
                  bgcolor: skBg,
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>
    );
  },
);

function normalizeAssistantMessage(message) {
  return {
    id: message.id,
    text: message.text || "",
    steps: message.steps || [],
    timeline: message.timeline || [],
    status: message.status || MESSAGE_STATUS.DONE,
  };
}

const MessageList = memo(function MessageList({
  messages = [],
  isLoadingConversation = false,
  loadError = false,
  conversationId = null,
  onRunQuery,
  onOpenCanvasArtifact,
}) {
  const [visibleCount, setVisibleCount] = useState(60);
  const normalizedMessages = useMemo(
    () =>
      messages.map((message, index) => {
        const id = message.id || `message-${index}`;
        if (message.role === "user") {
          return { id, role: "user", text: message.text };
        }
        return { id, role: "assistant", ...normalizeAssistantMessage(message) };
      }),
    [messages],
  );
  const effectiveVisibleCount =
    normalizedMessages.length <= 50 ? 60 : visibleCount;
  const hiddenCount = Math.max(
    0,
    normalizedMessages.length - effectiveVisibleCount,
  );
  const visibleMessages =
    hiddenCount > 0
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 4,
          textAlign: "center",
        }}
      >
        <Box
          role="status"
          aria-live="polite"
          sx={{
            maxWidth: 380,
            px: { xs: 2, sm: 2.5 },
            py: { xs: 2, sm: 2.5 },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.75,
            textAlign: "center",
            bgcolor: "transparent",
          }}
        >
          <ErrorOutlineRoundedIcon
            sx={{ fontSize: 20, color: "text.secondary", mb: 0.25 }}
          />
          <Typography
            sx={(th) => ({
              ...th.typography.uiBodySm,
              color: "text.primary",
              fontWeight: 600,
            })}
          >
            Couldn&apos;t load conversation
          </Typography>
          <Typography
            sx={(th) => ({
              ...th.typography.uiCaptionMd,
              color: "text.secondary",
            })}
          >
            Select it again from the sidebar.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        py: { xs: 1.25, sm: 1.75 },
        overflowAnchor: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: UI_LAYOUT.chatInputMaxWidth,
          mx: "auto",
          px: { xs: 1.25, sm: 2 },
          pt: 0.25,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {hiddenCount > 0 && (
          <Box sx={{ pb: 1.5, display: "flex", justifyContent: "center" }}>
            <Button
              size="small"
              onClick={() => setVisibleCount((c) => c + 50)}
              sx={(th) => ({
                minHeight: 28,
                borderRadius: "6px",
                color: "text.secondary",
                backgroundColor: alpha(
                  th.palette.text.primary,
                  th.palette.mode === "dark" ? 0.05 : 0.03,
                ),
                ...th.typography.uiCaptionSm,
                px: 1.5,
                textTransform: "none",
                fontWeight: 500,
                letterSpacing: 0,
                transition: th.transitions.create(
                  ["background-color", "color"],
                  {
                    duration: th.transitions.duration.shorter,
                  },
                ),
                [HOVER_CAPABLE_QUERY]: {
                  "&:hover": {
                    backgroundColor: alpha(
                      th.palette.text.primary,
                      th.palette.mode === "dark" ? 0.08 : 0.05,
                    ),
                    color: "text.primary",
                  },
                },
              })}
            >
              Load {Math.min(50, hiddenCount)} older messages
            </Button>
          </Box>
        )}
        {visibleMessages.map((message) =>
          message.role === "user" ? (
            <UserMessage key={message.id} message={message.text} />
          ) : (
            <AIMessage
              key={message.id}
              id={message.id}
              text={message.text}
              steps={message.steps}
              timeline={message.timeline}
              status={message.status}
              onRunQuery={onRunQuery}
              onOpenCanvasArtifact={onOpenCanvasArtifact}
              conversationId={conversationId}
            />
          ),
        )}
      </Box>
    </Box>
  );
});

export default MessageList;
