import { useState, useMemo, useCallback, memo } from 'react';
import { Box, Typography, Collapse, useTheme, ButtonBase, useMediaQuery } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { TRANSITIONS } from '../../../../theme';
import {
  ThinkingStep,
  ToolStep,
  DoneIndicator,
} from './StepTimelineItems';
import { TIMELINE_LINE_X, slideIn } from './timelineShared';
import {
  normalizeSteps,
  buildStepsSummary,
  getCurrentStepIndex,
  areAllStepsComplete,
  isAnyStepActive,
} from './stepUtils';

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
`;

export const StepsAccordion = memo(function StepsAccordion({ steps, isStreaming }) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark = theme.palette.mode === 'dark';

  const normalizedSteps = useMemo(() => normalizeSteps(steps), [steps]);
  const summaryText = useMemo(() => buildStepsSummary(normalizedSteps), [normalizedSteps]);
  const currentStepIndex = useMemo(() => getCurrentStepIndex(normalizedSteps), [normalizedSteps]);
  const isAllComplete = useMemo(
    () => areAllStepsComplete(normalizedSteps, isStreaming),
    [normalizedSteps, isStreaming]
  );
  const isLive = isStreaming && isAnyStepActive(normalizedSteps);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  if (normalizedSteps.length === 0) return null;

  const shimmerBase = alpha(theme.palette.text.secondary, isDark ? 0.65 : 0.55);
  const shimmerHighlight = alpha(theme.palette.text.primary, isDark ? 0.92 : 0.85);

  return (
    <Box
      sx={{
        width: '100%',
        textAlign: 'left',
        mb: 1.5,
        animation: `${slideIn} 0.3s cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* Toggle row */}
      <ButtonBase
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse reasoning steps' : 'Expand reasoning steps'}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: { xs: 0.75, sm: 1 },
          px: 0,
          py: { xs: 0.4, sm: 0.5 },
          minHeight: 36,
          minWidth: 0,
          borderRadius: 0,
          bgcolor: 'transparent',
          textAlign: 'left',
          transition: TRANSITIONS.default,
          '&:hover .summary-text': {
            color: alpha(theme.palette.text.primary, isDark ? 0.88 : 0.78),
          },
          '&:hover .summary-arrow': {
            color: alpha(theme.palette.text.secondary, 0.65),
          },
          '&:focus-visible': {
            outline: `1.5px solid ${alpha(theme.palette.primary.main, 0.45)}`,
            outlineOffset: '2px',
            borderRadius: '4px',
          },
        }}
        disableRipple
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, flex: 1, minWidth: 0 }}>
          <Typography
            className="summary-text"
            sx={{
              color: shimmerBase,
              ...theme.typography.uiBodySm,
              fontFamily: theme.typography.fontFamily,
              fontWeight: 500,
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
              lineHeight: 1.4,
              transition: TRANSITIONS.default,
              ...(isLive && {
                backgroundImage: `linear-gradient(90deg, ${shimmerBase} 0%, ${shimmerBase} 30%, ${shimmerHighlight} 50%, ${shimmerBase} 70%, ${shimmerBase} 100%)`,
                backgroundSize: '200% 100%',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                animation: `${shimmer} 2.4s linear infinite`,
              }),
            }}
          >
            {summaryText}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          {/* Step count */}
          <Typography
            sx={{
              color: alpha(theme.palette.text.secondary, isDark ? 0.45 : 0.38),
              fontSize: '11px',
              fontWeight: 500,
              lineHeight: 1,
              fontFamily: theme.typography.fontFamilyMono,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {normalizedSteps.length}
          </Typography>

          <KeyboardArrowDownIcon
            className="summary-arrow"
            sx={{
              fontSize: { xs: 15, sm: 16 },
              flexShrink: 0,
              color: alpha(theme.palette.text.secondary, isDark ? 0.38 : 0.32),
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s',
            }}
          />
        </Box>
      </ButtonBase>

      {/* Expanded content */}
      <Collapse in={expanded} timeout={220} unmountOnExit>
        <Box
          sx={{
            pt: 0.5,
            position: 'relative',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: TIMELINE_LINE_X,
              top: 8,
              bottom: 8,
              width: '1px',
              background: `linear-gradient(180deg,
                transparent,
                ${alpha(theme.palette.text.secondary, isDark ? 0.14 : 0.1)} 12%,
                ${alpha(theme.palette.text.secondary, isDark ? 0.14 : 0.1)} 85%,
                transparent
              )`,
            },
          }}
        >
          {normalizedSteps.map((step, idx) => {
            const animDelay = Math.min(idx * 50, 200);
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
            return null;
          })}
          {isAllComplete && <DoneIndicator />}
        </Box>
      </Collapse>
    </Box>
  );
});

StepsAccordion.displayName = 'StepsAccordion';
