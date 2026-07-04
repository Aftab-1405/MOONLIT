import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { Box, ButtonBase, Collapse, Typography, useMediaQuery, useTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  DoneIndicator,
  SkillStep,
  ThinkingStep,
  ToolStep,
} from '@/features/chat/ai-response-steps/StepTimelineItems';
import {
  areAllStepsComplete,
  buildStepsSummary,
  getCurrentStepIndex,
  isAnyStepActive,
  normalizeSteps,
} from '@/features/chat/ai-response-steps/stepUtils';
import {
  shimmer,
  slideIn,
  TIMELINE_LINE_X,
} from '@/features/chat/ai-response-steps/timelineShared';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import { TRANSITIONS } from '@/theme/index';

/**
 * StepsAccordion — collapsible summary of the AI's reasoning steps.
 *
 * Renders a single-line summary that, when expanded, shows the full timeline
 * of thinking + tool steps (delegated to StepTimelineItems).
 *
 * Visual states:
 *   - Live (streaming + active step): summary text shimmers; small pulsing
 *     dot before the text signals "work in progress".
 *   - Idle (not streaming, all complete): static summary; subtle check mark
 *     before the text signals "done".
 *   - Single workflow step (e.g. summarization): not expandable, renders as
 *     a plain status line.
 *
 * The accordion starts collapsed and only opens when the user clicks it —
 * there is no auto-expand or auto-collapse behavior. The live shimmer and
 * status dot still update during streaming so the user can see progress is
 * happening, but the timeline details are hidden until the user opts in.
 */

// Soft pulse for the "live" status dot. Kept subtle so it doesn't compete
// with the shimmer on the summary text.
const dotPulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.85); }
`;

export const StepsAccordion = memo(function StepsAccordion({
  steps,
  isStreaming,
}) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark = theme.palette.mode === 'dark';

  // Skill items are filtered out upstream (MessageList renders them directly).
  // normalizedSteps here will only ever contain thinking + tool steps.
  const normalizedSteps = useMemo(() => normalizeSteps(steps), [steps]);
  const summaryText = useMemo(() => buildStepsSummary(normalizedSteps), [normalizedSteps]);
  const currentStepIndex = useMemo(() => getCurrentStepIndex(normalizedSteps), [normalizedSteps]);
  const isAllComplete = useMemo(
    () => areAllStepsComplete(normalizedSteps, isStreaming),
    [normalizedSteps, isStreaming],
  );
  // Shimmer is "live" when the outer turn is streaming AND this accordion
  // still has active work (a running tool or an incomplete thinking step).
  const hasActiveStep = useMemo(() => isAnyStepActive(normalizedSteps), [normalizedSteps]);
  const isLive = isStreaming && hasActiveStep;
  // Error state — if any tool step errored, the summary dot turns red.
  const hasError = useMemo(
    () => normalizedSteps.some((s) => s.type === 'tool' && s.isError),
    [normalizedSteps],
  );

  const isSingleWorkflowStep =
    normalizedSteps.length === 1 && normalizedSteps[0].id?.startsWith('workflow-');
  const isExpandable = normalizedSteps.length > 0 && !isSingleWorkflowStep;

  const handleToggle = useCallback(() => {
    if (isExpandable) {
      setExpanded((prev) => !prev);
    }
  }, [isExpandable]);

  if (normalizedSteps.length === 0) return null;

  const summaryColor = alpha(theme.palette.text.secondary, isDark ? 0.65 : 0.55);
  const summaryHighlight = alpha(theme.palette.text.primary, isDark ? 0.92 : 0.82);

  // Status dot color reflects the accordion's overall state.
  //   - Live (streaming + active)  → text.primary (neutral, "working")
  //   - Error                      → error.main (red, "failed")
  //   - Done (all complete)        → success.main (green, "succeeded")
  //   - Default                    → text.secondary (muted)
  const statusDotColor = hasError
    ? theme.palette.error.main
    : isLive
      ? theme.palette.text.primary
      : isAllComplete
        ? theme.palette.success.main
        : theme.palette.text.secondary;

  return (
    <Box
      sx={{
        width: '100%',
        textAlign: 'left',
        mb: 1.5,
        // Unified entry spec — matches timeline items and text blocks.
        animation: `${slideIn} 0.22s ease-out both`,
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      <ButtonBase
        onClick={isExpandable ? handleToggle : undefined}
        disabled={!isExpandable}
        aria-expanded={isExpandable ? expanded : undefined}
        aria-label={
          isExpandable
            ? expanded
              ? 'Collapse reasoning steps'
              : 'Expand reasoning steps'
            : undefined
        }
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: { xs: 0.75, sm: 1 },
          px: 0,
          py: { xs: 0.35, sm: 0.45 },
          minHeight: 32,
          minWidth: 0,
          borderRadius: isExpandable ? '6px' : 0,
          bgcolor: 'transparent',
          textAlign: 'left',
          cursor: isExpandable ? 'pointer' : 'default',
          transition: TRANSITIONS.default,
          ...(isExpandable && {
            [HOVER_CAPABLE_QUERY]: {
              '&:hover .summary-text': {
                color: theme.palette.text.primary,
              },
              '&:hover .summary-arrow': {
                color: theme.palette.text.primary,
              },
            },
            '&:focus-visible': {
              outline: `2px solid ${alpha(theme.palette.text.primary, isDark ? 0.16 : 0.11)}`,
              outlineOffset: '2px',
            },
          }),
        }}
        disableRipple
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Status dot — small (6px) indicator before the summary text.
              Color reflects the overall state (live/error/done/idle).
              Pulses when live. */}
          <Box
            aria-hidden
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: statusDotColor,
              flexShrink: 0,
              transition: 'background-color 200ms ease',
              ...(isLive && {
                animation: `${dotPulse} 1.8s ease-in-out infinite`,
                '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
              }),
            }}
          />
          <Typography
            className="summary-text"
            sx={{
              color: summaryColor,
              ...theme.typography.uiBodySm,
              fontFamily: theme.typography.fontFamily,
              fontWeight: 500,
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
              lineHeight: 1.4,
              transition: 'color 140ms ease',
              ...(isLive && {
                backgroundImage: `linear-gradient(90deg, ${summaryColor} 0%, ${summaryColor} 36%, ${summaryHighlight} 50%, ${summaryColor} 64%, ${summaryColor} 100%)`,
                backgroundSize: '220% 100%',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `${shimmer} 2.8s linear infinite`,
                '@media (prefers-reduced-motion: reduce)': {
                  backgroundImage: 'none',
                  WebkitTextFillColor: 'currentColor',
                  color: summaryColor,
                  animation: 'none',
                },
              }),
            }}
          >
            {summaryText}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          {isExpandable && (
            <>
              {/* Step count badge — small monospace pill. Shows the number
                  of steps inside the accordion so users know what they're
                  expanding. */}
              <Typography
                sx={{
                  color: alpha(theme.palette.text.secondary, isDark ? 0.62 : 0.54),
                  fontSize: '11px',
                  fontWeight: 500,
                  lineHeight: 1,
                  fontFamily: theme.typography.fontFamilyMono,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 18,
                  height: 18,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06),
                }}
              >
                {normalizedSteps.length}
              </Typography>

              <KeyboardArrowDownRoundedIcon
                className="summary-arrow"
                sx={{
                  fontSize: { xs: 15, sm: 16 },
                  flexShrink: 0,
                  color: alpha(theme.palette.text.secondary, isDark ? 0.68 : 0.58),
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 140ms cubic-bezier(0.4, 0, 0.2, 1), color 140ms',
                }}
              />
            </>
          )}
        </Box>
      </ButtonBase>

      {/* Expanded content */}
      {isExpandable && (
        <Collapse in={expanded} timeout={160} unmountOnExit>
          <Box
            sx={{
              pt: 0.5,
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                left: TIMELINE_LINE_X,
                transform: 'translateX(-50%)',
                top: 16,
                bottom: 16,
                width: '1.5px',
                backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.05),
              },
            }}
          >
            {normalizedSteps.map((step, idx) => {
              const animDelay = Math.min(idx * 25, 100);
              if (step.type === 'thinking') {
                return (
                  <ThinkingStep
                    key={step.id}
                    content={step.content}
                    isComplete={step.isComplete}
                    isCurrent={idx === currentStepIndex}
                    animDelay={animDelay}
                  />
                );
              }
              if (step.type === 'tool') {
                return (
                  <ToolStep
                    key={step.id}
                    stepName={step.name}
                    actionText={step.actionText}
                    parsedArgs={step.parsedArgs}
                    parsedResult={step.parsedResult}
                    isError={step.isError}
                    isRunning={step.isRunning}
                    isCurrent={idx === currentStepIndex}
                    isCompactMobile={isCompactMobile}
                    animDelay={animDelay}
                  />
                );
              }
              if (step.type === 'skill') {
                return (
                  <SkillStep
                    key={step.id}
                    skills={step.skills}
                    isStreaming={isStreaming}
                    animDelay={animDelay}
                  />
                );
              }
              return null;
            })}
            {isAllComplete && <DoneIndicator />}
          </Box>
        </Collapse>
      )}
    </Box>
  );
});

StepsAccordion.displayName = 'StepsAccordion';
