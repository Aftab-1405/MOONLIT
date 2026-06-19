import { useState, useMemo, useCallback, memo } from "react";
import {
  Box,
  Typography,
  Collapse,
  useTheme,
  ButtonBase,
  useMediaQuery,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { TRANSITIONS } from "@/theme/index";
import {
  ThinkingStep,
  ToolStep,
  DoneIndicator,
} from "@/features/chat/ai-response-steps/StepTimelineItems";
import {
  TIMELINE_LINE_X,
  slideIn,
  shimmer,
} from "@/features/chat/ai-response-steps/timelineShared";
import {
  normalizeSteps,
  buildStepsSummary,
  getCurrentStepIndex,
  areAllStepsComplete,
} from "@/features/chat/ai-response-steps/stepUtils";

export const StepsAccordion = memo(function StepsAccordion({
  steps,
  isStreaming,
}) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const isCompactMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDark = theme.palette.mode === "dark";

  const normalizedSteps = useMemo(() => normalizeSteps(steps), [steps]);
  const summaryText = useMemo(
    () => buildStepsSummary(normalizedSteps),
    [normalizedSteps],
  );
  const currentStepIndex = useMemo(
    () => getCurrentStepIndex(normalizedSteps),
    [normalizedSteps],
  );
  const isAllComplete = useMemo(
    () => areAllStepsComplete(normalizedSteps, isStreaming),
    [normalizedSteps, isStreaming],
  );
  // Shimmer runs for the entire duration the response is streaming — not just
  // while a step is active. This keeps the accordion header visually alive while
  // tool steps finish and the text body continues to stream in below.
  const isLive = isStreaming;
  const isSingleWorkflowStep =
    normalizedSteps.length === 1 &&
    normalizedSteps[0].id?.startsWith("workflow-");
  const isExpandable = !isSingleWorkflowStep;

  const handleToggle = useCallback(() => {
    if (isExpandable) {
      setExpanded((prev) => !prev);
    }
  }, [isExpandable]);

  if (normalizedSteps.length === 0) return null;

  const summaryColor = alpha(
    theme.palette.text.secondary,
    isDark ? 0.65 : 0.55,
  );
  const summaryHighlight = alpha(
    theme.palette.text.primary,
    isDark ? 0.92 : 0.82,
  );

  return (
    <Box
      sx={{
        width: "100%",
        textAlign: "left",
        mb: 1.5,
        // Unified entry spec — matches timeline items and text blocks.
        animation: `${slideIn} 0.22s ease-out both`,
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      {/* Toggle row */}
      <ButtonBase
        onClick={isExpandable ? handleToggle : undefined}
        disabled={!isExpandable}
        aria-expanded={isExpandable ? expanded : undefined}
        aria-label={
          isExpandable
            ? expanded
              ? "Collapse reasoning steps"
              : "Expand reasoning steps"
            : undefined
        }
        sx={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: { xs: 0.75, sm: 1 },
          px: 0,
          py: { xs: 0.3, sm: 0.4 },
          minHeight: 32,
          minWidth: 0,
          borderRadius: 0,
          bgcolor: "transparent",
          textAlign: "left",
          cursor: isExpandable ? "pointer" : "default",
          transition: TRANSITIONS.default,
          ...(isExpandable && {
            "&:hover .summary-text": {
              color: alpha(theme.palette.text.primary, isDark ? 0.88 : 0.78),
            },
            "&:hover .summary-arrow": {
              color: alpha(theme.palette.text.secondary, 0.65),
            },
          }),
          "&:focus-visible": {
            outline: `1.5px solid ${alpha(theme.palette.primary.main, 0.45)}`,
            outlineOffset: "2px",
            borderRadius: "4px",
          },
        }}
        disableRipple
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.875,
            flex: 1,
            minWidth: 0,
          }}
        >
          <Typography
            className="summary-text"
            sx={{
              color: summaryColor,
              ...theme.typography.uiBodySm,
              fontFamily: theme.typography.fontFamily,
              fontWeight: 500,
              flex: 1,
              minWidth: 0,
              textAlign: "left",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              lineHeight: 1.4,
              transition: "color 140ms ease",
              ...(isLive && {
                backgroundImage: `linear-gradient(90deg, ${summaryColor} 0%, ${summaryColor} 36%, ${summaryHighlight} 50%, ${summaryColor} 64%, ${summaryColor} 100%)`,
                backgroundSize: "220% 100%",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: "transparent",
                animation: `${shimmer} 2.8s linear infinite`,
                "@media (prefers-reduced-motion: reduce)": {
                  backgroundImage: "none",
                  WebkitTextFillColor: "currentColor",
                  color: summaryColor,
                  animation: "none",
                },
              }),
            }}
          >
            {summaryText}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          {isExpandable && (
            <>
              {/* Step count */}
              <Typography
                sx={{
                  color: alpha(
                    theme.palette.text.secondary,
                    isDark ? 0.45 : 0.38,
                  ),
                  fontSize: "11px",
                  fontWeight: 500,
                  lineHeight: 1,
                  fontFamily: theme.typography.fontFamilyMono,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {normalizedSteps.length}
              </Typography>

              <KeyboardArrowDownIcon
                className="summary-arrow"
                sx={{
                  fontSize: { xs: 15, sm: 16 },
                  flexShrink: 0,
                  color: alpha(
                    theme.palette.text.secondary,
                    isDark ? 0.38 : 0.32,
                  ),
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition:
                    "transform 140ms cubic-bezier(0.4, 0, 0.2, 1), color 140ms",
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
              position: "relative",
              "&::before": {
                content: '""',
                position: "absolute",
                left: TIMELINE_LINE_X,
                top: 8,
                bottom: 8,
                width: "1px",
                backgroundColor: alpha(
                  theme.palette.text.primary,
                  isDark ? 0.14 : 0.1,
                ),
              },
            }}
          >
            {normalizedSteps.map((step, idx) => {
              const animDelay = Math.min(idx * 25, 100);
              if (step.type === "thinking") {
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
              if (step.type === "tool") {
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
      )}
    </Box>
  );
});

StepsAccordion.displayName = "StepsAccordion";
