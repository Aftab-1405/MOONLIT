import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { Box, ButtonBase, Collapse, Link, Typography, useTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import { memo, useMemo, useState } from 'react';
import { CodeViewer } from '@/components';
import { MarkdownRenderer } from '@/features/chat';
import {
  DetailLabel,
  ToolResultDetails,
} from '@/features/chat/ai-response-steps/ToolResultDetails';
import {
  shimmer,
  slideIn,
  TIMELINE_LINE_X,
} from '@/features/chat/ai-response-steps/timelineShared';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import { TRANSITIONS } from '@/theme/index';
import { BRAND } from '@/theme/tokens';

/**
 * AI reasoning-step timeline primitives.
 *
 * Each step type renders as a vertical-timeline row with a node icon on the
 * left (anchored to the timeline line) and content on the right.
 *
 * Step types & their semantic iconography:
 *   - ThinkingStep   → AccessTimeRounded (clock) — "AI is thinking/working"
 *   - SkillStep      → AutoAwesomeRounded (sparkles) — "skill activated"
 *   - ToolStep (running)    → AutorenewRounded (spinning) — "tool executing"
 *   - ToolStep (done)       → CheckRounded (filled check) — "tool succeeded"
 *   - ToolStep (error)      → CancelRounded (filled x) — "tool failed"
 *   - DoneIndicator         → CheckRounded — "workflow complete"
 *
 * The thinking/skill icons are outline style (in-progress states). The
 * done/error icons are filled (terminal states) — filled reads as "this is
 * finished", outline reads as provisional.
 */

const spin = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
`;

// Gentle opacity oscillation — softer nadir keeps it from feeling too aggressive
// during long thinking sequences.
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.82; }
`;

const TIMELINE_CONTENT_PL = { xs: 3.5, sm: 4.25 };

const getTimelineNodeSx = ({
  isDark,
  color,
  isCurrent = false,
  shadowColor,
  animation,
  theme,
  top = { xs: 17, sm: 19 },
}) => ({
  position: 'absolute',
  left: TIMELINE_LINE_X,
  top,
  transform: 'translate(-50%, -50%)',
  fontSize: { xs: 18, sm: 20 },
  zIndex: 1,
  // Background matches the page so the node "punches through" the timeline
  // line cleanly — the line appears to flow behind the node, not through it.
  backgroundColor: theme.palette.background.default,
  borderRadius: '50%',
  color,
  padding: 0,
  border: 0,
  boxShadow:
    isCurrent && shadowColor ? `0 0 0 3px ${alpha(shadowColor, isDark ? 0.14 : 0.1)}` : 'none',
  opacity: 1,
  transition: 'border-color 140ms ease, box-shadow 140ms ease, color 140ms ease',
  ...(animation
    ? {
        animation,
        // Stop continuous animation for users who prefer reduced motion.
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }
    : {}),
});

const getStepButtonSx = (theme, { interactive = false } = {}) => {
  const isDark = theme.palette.mode === 'dark';

  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: { xs: 0.75, sm: 1 },
    py: { xs: 0.3, sm: 0.35 },
    px: 0,
    minHeight: 34,
    cursor: interactive ? 'pointer' : 'default',
    borderRadius: '8px',
    bgcolor: 'transparent',
    transition: TRANSITIONS.default,
    ...(interactive
      ? {
          [HOVER_CAPABLE_QUERY]: {
            '&:hover .step-text': {
              color: alpha(theme.palette.text.primary, isDark ? 0.9 : 0.8),
            },
            '&:hover .step-arrow': {
              color: alpha(theme.palette.text.secondary, isDark ? 0.82 : 0.72),
            },
          },
          '&:focus-visible': {
            outline: `2px solid ${alpha(theme.palette.text.primary, isDark ? 0.16 : 0.11)}`,
            outlineOffset: 2,
          },
        }
      : {}),
  };
};

export const ThinkingStep = memo(function ThinkingStep({
  content = '',
  isComplete,
  isCurrent = false,
  animDelay = 0,
}) {
  const [showMore, setShowMore] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isActive = !isComplete;

  const lines = content.split('\n');
  const isLong = lines.length > 6 || content.length > 400;
  const displayContent = showMore ? content : lines.slice(0, 6).join('\n');

  // Thinking node uses the muted text color — thinking is "internal" and
  // shouldn't compete with tool/done nodes for attention. When active, the
  // icon gently pulses to signal "work in progress".
  const nodeColor = theme.palette.text.secondary;

  const thinkingNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: nodeColor,
        isCurrent,
        shadowColor: theme.palette.text.secondary,
        animation: isActive ? `${pulse} 2s ease-in-out infinite` : undefined,
        theme,
        top: { xs: 18.5, sm: 21 },
      }),
    [isActive, isCurrent, isDark, nodeColor, theme],
  );

  return (
    <Box
      sx={{
        animation: `${slideIn} 0.22s ease-out ${animDelay}ms both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        position: 'relative',
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
                pl: 0,
                pr: 0,
                py: { xs: 0.4, sm: 0.5 },
                transition: 'color 140ms ease',
              }}
            >
              <MarkdownRenderer
                content={showMore || !isLong ? displayContent : `${displayContent}\u2026`}
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
                  color: alpha(theme.palette.text.secondary, isDark ? 0.72 : 0.62),
                  textDecoration: 'none',
                  cursor: 'pointer',
                  transition: TRANSITIONS.default,
                  '&:hover': {
                    color: alpha(theme.palette.text.secondary, 0.82),
                    textDecoration: 'underline',
                  },
                }}
              >
                {showMore ? 'Show less' : 'Show more'}
              </Link>
            )}
          </>
        ) : (
          <Typography
            sx={{
              ...theme.typography.uiBodySm,
              fontFamily: theme.typography.fontFamily,
              fontStyle: 'italic',
              ...(isActive
                ? {
                    // Shimmer sweep — same technique as StepsAccordion summary.
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
                    animation: `${shimmer} 2.4s linear infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                      backgroundImage: 'none',
                      WebkitTextFillColor: 'currentColor',
                      color: alpha(theme.palette.text.secondary, isDark ? 0.72 : 0.62),
                      animation: 'none',
                    },
                  }
                : { color: alpha(theme.palette.text.secondary, isDark ? 0.72 : 0.62) }),
            }}
          >
            {isActive ? 'Thinking\u2026' : 'Thought process'}
          </Typography>
        )}
      </Box>
    </Box>
  );
});

// ─── SkillStep ─────────────────────────────────────────────────────────────────

function humanizeSkillName(name) {
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Renders activated skills in the timeline.
 * Uses the brand purple as the node color — skill activation is a "moment"
 * worth highlighting, and the brand color marks it as an identity-level
 * event (consistent with the welcome name, sidebar wordmark, etc.).
 */
export const SkillStep = memo(function SkillStep({
  skills = [],
  isStreaming = false,
  animDelay = 0,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const SKILL_LABELS = {
    database_querying: 'Database',
    'database-querying': 'Database',
    react_flow_diagram: 'Diagram',
    'react-flow-diagram': 'Diagram',
    web_research: 'Web Research',
    'web-research': 'Web Research',
    query_history: 'Query History',
    'query-history': 'Query History',
  };

  const label = skills.map((s) => SKILL_LABELS[s] || humanizeSkillName(s)).join(', ');

  // Brand purple node — skills are identity moments.
  const nodeColor = BRAND.main;

  const skillNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: nodeColor,
        isCurrent: isStreaming,
        shadowColor: BRAND.main,
        animation: isStreaming ? `${pulse} 2s ease-in-out infinite` : undefined,
        theme,
        top: { xs: 22, sm: 23 },
      }),
    [isStreaming, isDark, nodeColor, theme],
  );

  if (!skills.length) return null;

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
      <AutoAwesomeRoundedIcon sx={skillNodeSx} />
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: { xs: 0.75, sm: 1 },
          py: { xs: 0.3, sm: 0.35 },
          px: 0,
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
                    color: alpha(theme.palette.text.secondary, isDark ? 0.72 : 0.62),
                    animation: 'none',
                  },
                }
              : { color: alpha(theme.palette.text.primary, isDark ? 0.72 : 0.65) }),
          }}
        >
          {`Using ${label} skill${skills.length > 1 ? 's' : ''}`}
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
  const isDark = theme.palette.mode === 'dark';
  const isSqlTool = stepName === 'execute_query';
  const hasDetails = Boolean((isSqlTool && parsedArgs?.query) || parsedResult);

  const queryHeight = useMemo(() => {
    const query = parsedArgs?.query;
    if (!query) return 80;
    const lineCount = query.split('\n').length;
    return Math.min(Math.max(80, lineCount * 20 + 24), 300);
  }, [parsedArgs?.query]);

  // Status iconography — filled icons for terminal states (done/error),
  // outline + spin for in-progress. Filled reads as "this is finished";
  // outline reads as "this is in progress".
  const StatusIcon = isRunning
    ? AutorenewRoundedIcon
    : isError
      ? CancelRoundedIcon
      : CheckRoundedIcon;

  // Semantic node colors:
  //   - running → text.primary (neutral, "working")
  //   - error   → error.main (red, "failed")
  //   - done    → success.main (green, "succeeded")
  // Done uses GREEN instead of primary because green is the universal
  // "success" semantic color. The previous version used primary (monochrome)
  // which made success and running states look identical.
  const nodeColor = isRunning
    ? theme.palette.text.primary
    : isError
      ? theme.palette.error.main
      : theme.palette.success.main;

  const statusNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: nodeColor,
        isCurrent,
        shadowColor: isRunning
          ? theme.palette.text.primary
          : isError
            ? theme.palette.error.main
            : theme.palette.success.main,
        animation: isRunning ? `${spin} 1s linear infinite` : undefined,
        theme,
        top: { xs: 22, sm: 23 },
      }),
    [isCurrent, isDark, isError, isRunning, nodeColor, theme],
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
      <StatusIcon sx={statusNodeSx} />

      <ButtonBase
        onClick={() => hasDetails && setExpanded(!expanded)}
        disabled={!hasDetails}
        sx={{
          ...getStepButtonSx(theme, { interactive: hasDetails }),
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
            lineHeight: 1.4,
            minWidth: 0,
            overflowWrap: 'anywhere',
            transition: TRANSITIONS.default,
          }}
        >
          {actionText}
        </Typography>
        {hasDetails && (
          <KeyboardArrowDownRoundedIcon
            className="step-arrow"
            sx={{
              fontSize: { xs: 13, sm: 15 },
              color: alpha(theme.palette.text.secondary, isDark ? 0.68 : 0.58),
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s',
              ml: 'auto',
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
              bgcolor: 'transparent',
            }}
          >
            {isSqlTool && parsedArgs?.query && (
              <Box sx={{ mb: parsedResult && !isRunning ? 1.25 : 0 }}>
                <DetailLabel>Query</DetailLabel>
                <Box
                  sx={{
                    overflow: 'hidden',
                    height: isCompactMobile ? Math.min(queryHeight, 220) : queryHeight,
                  }}
                >
                  <CodeViewer value={parsedArgs.query} height="100%" transparent simple />
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
  const isDark = theme.palette.mode === 'dark';

  // Done = green check. Universal "success" semantic color.
  const doneNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: theme.palette.success.main,
        theme,
        top: '50%',
      }),
    [isDark, theme],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        pl: TIMELINE_CONTENT_PL,
        py: { xs: 0.6, sm: 0.75 },
        animation: `${slideIn} 0.22s ease-out both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <CheckRoundedIcon sx={doneNodeSx} />
      <Typography
        sx={{
          color: alpha(theme.palette.text.secondary, isDark ? 0.74 : 0.64),
          ...theme.typography.uiCaptionSm,
          fontFamily: theme.typography.fontFamily,
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        Done
      </Typography>
    </Box>
  );
});
