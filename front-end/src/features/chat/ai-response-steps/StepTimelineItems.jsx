import { useState, useMemo, memo } from "react";
import {
  Box,
  Typography,
  Collapse,
  useTheme,
  ButtonBase,
  Link,
} from "@mui/material";
import { MarkdownRenderer } from "@/features/chat";
import { alpha, keyframes } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import { TRANSITIONS } from "@/theme/index";
import SqlCodeViewer from "@/components/SqlCodeViewer";
import {
  DetailLabel,
  ToolResultDetails,
} from "@/features/chat/ai-response-steps/ToolResultDetails";
import {
  shimmer,
  slideIn,
  TIMELINE_LINE_X,
} from "@/features/chat/ai-response-steps/timelineShared";

const spin = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
`;

// Gentle opacity oscillation — softer nadir keeps it from feeling too aggressive
// during long thinking sequences.
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.62; }
`;

const TIMELINE_CONTENT_PL = { xs: 3.5, sm: 4 };

const getTimelineNodeSx = ({
  isDark,
  color,
  isCurrent = false,
  shadowColor,
  animation,
  theme,
  top = { xs: 20, sm: 22 },
}) => ({
  position: "absolute",
  left: TIMELINE_LINE_X,
  top,
  transform: "translate(-50%, -50%)",
  fontSize: { xs: 16, sm: 18 },
  zIndex: 1,
  // Mask the timeline line behind the icon
  backgroundColor: theme.palette.background.default,
  borderRadius: "50%",
  color,
  padding: "2px",
  boxShadow:
    isCurrent && shadowColor
      ? `0 0 0 3px ${alpha(shadowColor, isDark ? 0.15 : 0.12)}`
      : "none",
  transition: "box-shadow 140ms cubic-bezier(0.4, 0, 0.2, 1)",
  ...(animation
    ? {
        animation,
        // Stop continuous animation for users who prefer reduced motion.
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }
    : {}),
});

// ─── ThinkingStep ─────────────────────────────────────────────────────────────

export const ThinkingStep = memo(function ThinkingStep({
  content = "",
  isComplete,
  isCurrent = false,
  animDelay = 0,
}) {
  const [showMore, setShowMore] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isActive = !isComplete;

  const lines = content.split("\n");
  const isLong = lines.length > 6 || content.length > 400;
  const displayContent = showMore ? content : lines.slice(0, 6).join("\n");

  const nodeColor = alpha(theme.palette.text.secondary, isDark ? 0.45 : 0.38);

  const thinkingNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: nodeColor,
        isCurrent,
        shadowColor: theme.palette.text.secondary,
        animation: isActive ? `${pulse} 2s ease-in-out infinite` : undefined,
        theme,
      }),
    [isActive, isCurrent, isDark, nodeColor, theme],
  );

  return (
    <Box
      sx={{
        animation: `${slideIn} 0.22s ease-out ${animDelay}ms both`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        position: "relative",
        pl: TIMELINE_CONTENT_PL,
        py: { xs: 0.65, sm: 0.85 },
      }}
    >
      <AccessTimeRoundedIcon sx={thinkingNodeSx} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {content ? (
          <>
            <Box
              sx={{
                color: alpha(theme.palette.text.primary, isDark ? 0.76 : 0.68),
                ...theme.typography.uiBodySm,
                fontFamily: theme.typography.fontFamily,
                lineHeight: { xs: 1.55, sm: 1.62 },
                letterSpacing: 0,
                pl: { xs: 0.5, sm: 1 },
                pr: 0,
                py: { xs: 0.4, sm: 0.5 },
                transition: "color 140ms ease",
              }}
            >
              <MarkdownRenderer
                content={
                  showMore || !isLong
                    ? displayContent
                    : displayContent + "\u2026"
                }
              />
            </Box>
            {isLong && (
              <Link
                component="button"
                onClick={() => setShowMore(!showMore)}
                sx={{
                  mt: 0.6,
                  ...theme.typography.uiCaptionSm,
                  fontFamily: theme.typography.fontFamily,
                  fontWeight: 500,
                  color: alpha(theme.palette.text.secondary, 0.5),
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: TRANSITIONS.default,
                  "&:hover": {
                    color: alpha(theme.palette.text.secondary, 0.82),
                    textDecoration: "underline",
                  },
                }}
              >
                {showMore ? "Show less" : "Show more"}
              </Link>
            )}
          </>
        ) : (
          <Typography
            sx={{
              ...theme.typography.uiBodySm,
              fontFamily: theme.typography.fontFamily,
              fontStyle: "italic",
              ...(isActive
                ? {
                    // Shimmer sweep — same technique as StepsAccordion summary.
                    backgroundImage: `linear-gradient(90deg,
                      ${alpha(theme.palette.text.secondary, isDark ? 0.5 : 0.45)} 0%,
                      ${alpha(theme.palette.text.secondary, isDark ? 0.5 : 0.45)} 36%,
                      ${alpha(theme.palette.text.primary, isDark ? 0.88 : 0.72)} 50%,
                      ${alpha(theme.palette.text.secondary, isDark ? 0.5 : 0.45)} 64%,
                      ${alpha(theme.palette.text.secondary, isDark ? 0.5 : 0.45)} 100%)`,
                    backgroundSize: "220% 100%",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: `${shimmer} 2.4s linear infinite`,
                    "@media (prefers-reduced-motion: reduce)": {
                      backgroundImage: "none",
                      WebkitTextFillColor: "currentColor",
                      color: alpha(theme.palette.text.secondary, 0.5),
                      animation: "none",
                    },
                  }
                : { color: alpha(theme.palette.text.secondary, 0.5) }),
            }}
          >
            {isActive ? "Thinking\u2026" : "Thought process"}
          </Typography>
        )}
      </Box>
    </Box>
  );
});

// ─── SkillStep ─────────────────────────────────────────────────────────────────

function humanizeSkillName(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Renders activated skills in the timeline.
 * Consistent with thinking and tool steps.
 */
export const SkillStep = memo(function SkillStep({
  skills = [],
  isStreaming = false,
  animDelay = 0,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!skills.length) return null;

  const SKILL_LABELS = {
    database_querying: 'Database',
    react_flow_diagram: 'Diagram',
    web_research: 'Web Research',
    query_history: 'Query History',
  };

  const label = skills
    .map((s) => SKILL_LABELS[s] || humanizeSkillName(s))
    .join(', ');

  const nodeColor = alpha(theme.palette.text.secondary, isDark ? 0.45 : 0.38);

  const skillNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: nodeColor,
        isCurrent: isStreaming,
        shadowColor: theme.palette.text.secondary,
        animation: isStreaming ? `${pulse} 2s ease-in-out infinite` : undefined,
        theme,
      }),
    [isStreaming, isDark, nodeColor, theme],
  );

  return (
    <Box
      sx={{
        animation: `${slideIn} 0.22s ease-out ${animDelay}ms both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        position: 'relative',
        pl: TIMELINE_CONTENT_PL,
        py: { xs: 0.6, sm: 0.75 },
      }}
    >
      <MenuBookRoundedIcon sx={skillNodeSx} />
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: { xs: 0.75, sm: 1 },
          py: { xs: 0.3, sm: 0.35 },
          minHeight: 34,
          minWidth: 0,
        }}
      >
        <Typography
          sx={{
            ...theme.typography.uiBodySm,
            fontFamily: theme.typography.fontFamily,
            fontWeight: 500,
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            lineHeight: 1.4,
            ...(isStreaming
              ? {
                  backgroundImage: `linear-gradient(90deg,
                    ${alpha(theme.palette.text.secondary, isDark ? 0.5 : 0.45)} 0%,
                    ${alpha(theme.palette.text.secondary, isDark ? 0.5 : 0.45)} 36%,
                    ${alpha(theme.palette.text.primary, isDark ? 0.88 : 0.72)} 50%,
                    ${alpha(theme.palette.text.secondary, isDark ? 0.5 : 0.45)} 64%,
                    ${alpha(theme.palette.text.secondary, isDark ? 0.5 : 0.45)} 100%)`,
                  backgroundSize: '220% 100%',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  animation: `${shimmer} 2.8s linear infinite`,
                  '@media (prefers-reduced-motion: reduce)': {
                    backgroundImage: 'none',
                    WebkitTextFillColor: 'currentColor',
                    color: alpha(theme.palette.text.secondary, 0.5),
                    animation: 'none',
                  },
                }
              : { color: alpha(theme.palette.text.primary, isDark ? 0.72 : 0.65) }),
          }}
        >
          {`Loaded ${label} skill${skills.length > 1 ? 's' : ''}`}
        </Typography>
      </Box>
    </Box>
  );
});

// ─── ToolStep ─────────────────────────────────────────────────────────────────

export const ToolStep = memo(function ToolStep({
  stepName,
  actionText,
  parsedArgs,
  parsedResult,
  isError,
  isRunning,
  isCurrent = false,
  isCompactMobile = false,
  animDelay = 0,
}) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isSqlTool = stepName === "execute_query";
  const hasDetails = Boolean((isSqlTool && parsedArgs?.query) || parsedResult);

  const queryHeight = useMemo(() => {
    const query = parsedArgs?.query;
    if (!query) return 80;
    const lineCount = query.split("\n").length;
    return Math.min(Math.max(80, lineCount * 20 + 24), 300);
  }, [parsedArgs?.query]);

  const StatusIcon = isRunning
    ? AutorenewRoundedIcon
    : isError
      ? ErrorOutlineRoundedIcon
      : CheckCircleOutlineRoundedIcon;

  const nodeColor = isRunning
    ? theme.palette.primary.main
    : isError
      ? alpha(theme.palette.error.main, isDark ? 0.65 : 0.55)
      : alpha(theme.palette.success.main, isDark ? 0.55 : 0.48);

  const statusNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: nodeColor,
        isCurrent,
        shadowColor: isRunning
          ? theme.palette.primary.main
          : isError
            ? theme.palette.error.main
            : theme.palette.success.main,
        animation: isRunning ? `${spin} 1s linear infinite` : undefined,
        theme,
      }),
    [
      isCurrent,
      isDark,
      isError,
      isRunning,
      nodeColor,
      theme,
    ],
  );

  return (
    <Box
      sx={{
        animation: `${slideIn} 0.22s ease-out ${animDelay}ms both`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        position: "relative",
        pl: TIMELINE_CONTENT_PL,
        py: { xs: 0.6, sm: 0.75 },
      }}
    >
      <StatusIcon sx={statusNodeSx} />

      <ButtonBase
        onClick={() => hasDetails && setExpanded(!expanded)}
        disabled={!hasDetails}
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: { xs: 0.75, sm: 1 },
          py: { xs: 0.3, sm: 0.35 },
          minHeight: 34,
          px: 0,
          cursor: hasDetails ? "pointer" : "default",
          borderRadius: 0,
          bgcolor: "transparent",
          transition: TRANSITIONS.default,
          "&:hover .step-text": hasDetails
            ? { color: alpha(theme.palette.text.primary, isDark ? 0.9 : 0.8) }
            : {},
          "&:hover .step-arrow": hasDetails
            ? { color: alpha(theme.palette.text.secondary, 0.6) }
            : {},
        }}
        disableRipple
      >
        <Typography
          className="step-text"
          sx={{
            color: alpha(theme.palette.text.primary, isDark ? 0.72 : 0.65),
            ...theme.typography.uiBodySm,
            fontFamily: theme.typography.fontFamily,
            fontWeight: 500,
            transition: TRANSITIONS.default,
          }}
        >
          {actionText}
        </Typography>
        {hasDetails && (
          <KeyboardArrowDownIcon
            className="step-arrow"
            sx={{
              fontSize: { xs: 13, sm: 15 },
              color: alpha(theme.palette.text.secondary, isDark ? 0.32 : 0.28),
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition:
                "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s",
              ml: "auto",
            }}
          />
        )}
      </ButtonBase>

      {hasDetails && (
        <Collapse in={expanded} timeout={200} unmountOnExit>
          <Box
            sx={{
              mt: 0.5,
              pl: { xs: 1, sm: 1.5 },
              pr: 0,
              pb: 0.5,
              bgcolor: "transparent",
            }}
          >
            {isSqlTool && parsedArgs?.query && (
              <Box sx={{ mb: parsedResult && !isRunning ? 1.25 : 0 }}>
                <DetailLabel>Query</DetailLabel>
                <Box
                  sx={{
                    overflow: "hidden",
                    height: isCompactMobile
                      ? Math.min(queryHeight, 220)
                      : queryHeight,
                  }}
                >
                  <SqlCodeViewer
                    value={parsedArgs.query}
                    height="100%"
                    transparent
                  />
                </Box>
              </Box>
            )}
            {parsedResult && !isRunning && (
              <Box>
                <DetailLabel>Result</DetailLabel>
                <ToolResultDetails
                  stepName={stepName}
                  result={parsedResult}
                  args={parsedArgs}
                  isError={isError}
                />
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
});

// ─── DoneIndicator ────────────────────────────────────────────────────────────

export const DoneIndicator = memo(function DoneIndicator() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const doneNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: alpha(theme.palette.success.main, isDark ? 0.55 : 0.48),
        theme,
        top: "50%",
      }),
    [isDark, theme],
  );

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        position: "relative",
        pl: TIMELINE_CONTENT_PL,
        py: { xs: 0.6, sm: 0.75 },
        animation: `${slideIn} 0.22s ease-out both`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      <CheckCircleOutlineRoundedIcon sx={doneNodeSx} />
      <Typography
        sx={{
          color: alpha(theme.palette.text.secondary, isDark ? 0.45 : 0.38),
          ...theme.typography.uiCaptionSm,
          fontFamily: theme.typography.fontFamily,
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        Done
      </Typography>
    </Box>
  );
});
