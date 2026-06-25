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
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { useState, useMemo, useRef, useEffect, useCallback, memo } from "react";
import { copyToClipboard } from "@/utils/clipboard";
import {
  shimmer,
  slideIn,
} from "@/features/chat/ai-response-steps/timelineShared";
import { StepsAccordion } from "@/features/chat/ai-response-steps";
import {
  ThinkingStep,
  ToolStep,
} from "@/features/chat/ai-response-steps/StepTimelineItems";
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
  50% { opacity: 0.58; }
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
  return (
    <Tooltip title={copied ? "Copied!" : "Copy"}>
      <IconButton
        className={className}
        aria-label="Copy"
        data-testid={dataTestId}
        size="small"
        onClick={onClick}
        color={copied ? "success" : "primary"}
        sx={sx}
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
    theme.palette.mode === "dark" ? 0.08 : 0.06,
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
              borderRadius: "12px",
              px: { xs: 1.5, sm: 1.75 },
              py: { xs: 1, sm: 1.1 },
              bgcolor: bubbleBg,
              border: "1px solid",
              borderColor: alpha(
                theme.palette.text.primary,
                theme.palette.mode === "dark" ? 0.1 : 0.08,
              ),
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

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 1.5, sm: 2 },
        px: { xs: 1.25, sm: 1.5 },
        py: { xs: 1.1, sm: 1.25 },
        borderRadius: "10px",
        border: "1px solid",
        borderColor: isGenerating
          ? alpha(theme.palette.primary.main, isDark ? 0.14 : 0.1)
          : alpha(theme.palette.primary.main, isDark ? 0.26 : 0.18),
        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.038 : 0.022),
        transition:
          "border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease",
        ...(!isGenerating && {
          "&:hover": {
            borderColor: alpha(
              theme.palette.primary.main,
              isDark ? 0.42 : 0.32,
            ),
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.068 : 0.04),
            boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, isDark ? 0.18 : 0.07)}`,
          },
        }),
      }}
    >
      {/* ── Icon container ─────────────────────────────────── */}
      <Box
        sx={{
          width: { xs: 36, sm: 40 },
          height: { xs: 36, sm: 40 },
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.09),
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
              ? alpha(theme.palette.primary.main, isDark ? 0.5 : 0.55)
              : theme.palette.primary.main,
            transition: "color 140ms ease",
          }}
        />
      </Box>

      {/* ── Text ───────────────────────────────────────────── */}
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
              ? alpha(theme.palette.primary.main, 0.45)
              : alpha(theme.palette.text.secondary, isDark ? 0.55 : 0.65),
          }}
        >
          {isGenerating ? "Generating diagram\u2026" : "Interactive node graph"}
        </Typography>
      </Box>

      {/* ── Action ─────────────────────────────────────────── */}
      {isGenerating ? (
        <Box
          aria-hidden
          sx={{
            flexShrink: 0,
            px: { xs: 1.75, sm: 2.25 },
            py: 0.625,
            borderRadius: "8px",
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, isDark ? 0.1 : 0.08),
          }}
        >
          <Typography
            sx={{
              ...theme.typography.uiBodySm,
              fontFamily: theme.typography.fontFamily,
              fontSize: { xs: "0.75rem", sm: "0.8125rem" },
              fontWeight: 600,
              userSelect: "none",
              color: alpha(theme.palette.primary.main, 0.45),
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
            borderColor: alpha(theme.palette.primary.main, 0.28),
            transition:
              "background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease",
            "&:hover": {
              borderColor: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              boxShadow: "none",
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
}) {
  const { copied, copyRich } = useCopyToClipboard();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const contentRef = useRef(null);
  const sqlEditorTimeoutRef = useRef(null);
  const openedToolsRef = useRef(new Set());
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

  useEffect(() => {
    return () => {
      if (sqlEditorTimeoutRef.current)
        clearTimeout(sqlEditorTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!onOpenCanvasArtifact || isWaiting || isStreaming) return;

    // Only auto-trigger the results loader if the message was actively streamed/generated in this session
    if (!wasStreamingOrWaitingRef.current) return;

    displaySteps.forEach((step, idx) => {
      if (
        step.type !== "tool" ||
        step.name !== "execute_query" ||
        step.status !== "done"
      )
        return;
      const stepKey = `${id}-${step.id || idx}`;
      if (openedToolsRef.current.has(stepKey)) return;

      const parsedArgs = parseJSON(step.args);
      const parsedResult = parseJSON(step.result);
      if (!parsedResult || parsedResult.success === false || parsedResult.error)
        return;

      openedToolsRef.current.add(stepKey);

      const query = parsedArgs?.query || "";
      const resultRows = Array.isArray(parsedResult?.data)
        ? parsedResult.data
        : Array.isArray(parsedResult?.preview)
          ? parsedResult.preview
          : [];
      const normalizedResults = {
        columns: parsedResult?.columns || [],
        result: resultRows,
        row_count: parsedResult?.row_count || 0,
        total_rows: parsedResult?.total_rows || parsedResult?.row_count || 0,
        truncated: parsedResult?.truncated || false,
      };

      if (sqlEditorTimeoutRef.current)
        clearTimeout(sqlEditorTimeoutRef.current);
      sqlEditorTimeoutRef.current = setTimeout(() => {
        onOpenCanvasArtifact({
          type: "results",
          title: "Query results",
          props: {
            data: normalizedResults,
            sourceQuery: query,
            sourceType: "sql-editor",
          },
        });
      }, 100);
    });
  }, [displaySteps, id, isStreaming, isWaiting, onOpenCanvasArtifact]);

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

  const showThinkingSpinner =
    isWaiting &&
    displaySteps.length === 0 &&
    !displayText.trim() &&
    !hasTimeline;

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
    (step, key) => (
      <Box
        key={key}
        data-testid={`assistant-${step.type}-step`}
        sx={{ pl: { xs: 0, sm: 0.5 }, py: 0.5, minWidth: 0 }}
      >
        <StepsAccordion steps={[step]} isStreaming={isWaiting || isStreaming} />
      </Box>
    ),
    [isStreaming, isWaiting],
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
          <Fade in={showThinkingSpinner} timeout={220} unmountOnExit>
            <Box sx={{ pl: { xs: 0, sm: 0.5 }, py: 0.5, minWidth: 0 }}>
              <Typography
                component="span"
                aria-label="Thinking"
                sx={{
                  ...theme.typography.uiBodySm,
                  fontFamily: theme.typography.fontFamily,
                  fontWeight: 500,
                  // Shimmer sweep — consistent with ThinkingStep and StepsAccordion.
                  backgroundImage: `linear-gradient(90deg,
                    ${alpha(theme.palette.text.secondary, isDark ? 0.55 : 0.48)} 0%,
                    ${alpha(theme.palette.text.secondary, isDark ? 0.55 : 0.48)} 36%,
                    ${alpha(theme.palette.text.primary, isDark ? 0.9 : 0.75)} 50%,
                    ${alpha(theme.palette.text.secondary, isDark ? 0.55 : 0.48)} 64%,
                    ${alpha(theme.palette.text.secondary, isDark ? 0.55 : 0.48)} 100%)`,
                  backgroundSize: "220% 100%",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  animation: `${shimmer} 2.4s linear infinite`,
                  "@media (prefers-reduced-motion: reduce)": {
                    backgroundImage: "none",
                    WebkitTextFillColor: "currentColor",
                    color: alpha(
                      theme.palette.text.secondary,
                      isDark ? 0.58 : 0.5,
                    ),
                    animation: "none",
                  },
                }}
              >
                Thinking…
              </Typography>
            </Box>
          </Fade>

          {hasTimeline ? (
            displayTimeline.map((item, index) => {
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
              {displaySteps.length > 0 && (
                <Box
                  sx={{
                    pl: { xs: 0, sm: 0.5 },
                    py: 0.5,
                    minWidth: 0,
                    animation: `${slideIn} 0.22s ease-out both`,
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
                    },
                  }}
                >
                  <StepsAccordion
                    steps={displaySteps}
                    isStreaming={isWaiting || isStreaming}
                  />
                </Box>
              )}

              {displayText.trim() &&
                renderTextBlock(displayText, "legacy-text")}
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
                borderRadius: "12px",
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
                borderRadius: "12px",
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
            borderRadius: "12px",
            border: "1px solid",
            borderColor: (th) => th.palette.border.subtle,
            bgcolor: (th) =>
              alpha(
                th.palette.background.paper,
                th.palette.mode === "dark" ? 0.55 : 0.8,
              ),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.75,
            textAlign: "center",
          }}
        >
          <ErrorOutlineRoundedIcon
            sx={{ fontSize: 20, color: "text.disabled", mb: 0.25 }}
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
                borderRadius: "8px",
                border: "1px solid",
                borderColor: alpha(
                  th.palette.text.primary,
                  th.palette.mode === "dark" ? 0.1 : 0.08,
                ),
                color: "text.secondary",
                backgroundColor: "transparent",
                ...th.typography.uiCaptionSm,
                px: 1.5,
                textTransform: "none",
                fontWeight: 500,
                letterSpacing: 0,
                transition: th.transitions.create(
                  ["background-color", "border-color", "color"],
                  {
                    duration: th.transitions.duration.shorter,
                  },
                ),
                [HOVER_CAPABLE_QUERY]: {
                  "&:hover": {
                    borderColor: alpha(
                      th.palette.text.primary,
                      th.palette.mode === "dark" ? 0.16 : 0.14,
                    ),
                    backgroundColor: alpha(
                      th.palette.text.primary,
                      th.palette.mode === "dark" ? 0.04 : 0.03,
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
            />
          ),
        )}
      </Box>
    </Box>
  );
});

export default MessageList;
