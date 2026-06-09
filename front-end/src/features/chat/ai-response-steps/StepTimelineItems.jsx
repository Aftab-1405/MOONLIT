import { useState, useMemo, memo, lazy, Suspense } from 'react';
import { Box, Typography, Collapse, useTheme, ButtonBase, Link } from '@mui/material';
import { MarkdownRenderer } from '@/features/chat';
import { alpha, keyframes } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import { registerMonacoThemes, getMonacoThemeName, TRANSITIONS } from '@/theme/index';
import { DetailLabel, ToolResultDetails } from '@/features/chat/ai-response-steps/ToolResultDetails';
import { slideIn, TIMELINE_LINE_X } from '@/features/chat/ai-response-steps/timelineShared';

const Editor = lazy(() => import('@monaco-editor/react'));

const spin = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
`;

const TIMELINE_CONTENT_PL = { xs: 3.5, sm: 4 };

let monacoTransparentThemesRegistered = false;

const MONACO_OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  lineNumbers: 'off',
  folding: false,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  wordWrap: 'on',
  padding: { top: 12, bottom: 12 },
  renderLineHighlight: 'none',
  scrollbar: {
    vertical: 'auto',
    horizontal: 'hidden',
    verticalScrollbarSize: 6,
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  guides: { indentation: false },
  contextmenu: false,
};

const registerTransparentMonacoThemes = (monaco) => {
  if (monacoTransparentThemesRegistered) return;
  registerMonacoThemes(monaco, { transparent: true });
  monacoTransparentThemesRegistered = true;
};

const getTimelineNodeSx = ({ isDark, color, isCurrent = false, shadowColor, animation }) => ({
  position: 'absolute',
  left: TIMELINE_LINE_X,
  top: '50%',
  transform: 'translate(-50%, -50%)',
  fontSize: { xs: 13, sm: 14 },
  zIndex: 1,
  // Transparent bg — node sits directly on the page surface
  backgroundColor: 'transparent',
  borderRadius: '50%',
  color,
  padding: '1px',
  boxShadow: isCurrent && shadowColor
    ? `0 0 0 3px ${alpha(shadowColor, isDark ? 0.15 : 0.12)}`
    : 'none',
  transition: 'box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  ...(animation ? { animation } : {}),
});

// ─── ThinkingStep ─────────────────────────────────────────────────────────────

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

  const nodeColor = alpha(theme.palette.text.secondary, isDark ? 0.45 : 0.38);

  const thinkingNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: nodeColor,
        isCurrent,
        shadowColor: theme.palette.text.secondary,
        animation: isActive ? `${pulse} 2s ease-in-out infinite` : undefined,
      }),
    [isActive, isCurrent, isDark, nodeColor, theme.palette.text.secondary]
  );

  return (
    <Box
      sx={{
        animation: `${slideIn} 0.38s cubic-bezier(0.4, 0, 0.2, 1) ${animDelay}ms both`,
        position: 'relative',
        pl: TIMELINE_CONTENT_PL,
        py: { xs: 0.875, sm: 1.125 },
      }}
    >
      <AccessTimeRoundedIcon sx={thinkingNodeSx} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {content ? (
          <>
            <Box
              sx={{
                color: alpha(theme.palette.text.primary, isDark ? 0.72 : 0.65),
                ...theme.typography.uiBodySm,
                fontFamily: theme.typography.fontFamily,
                lineHeight: { xs: 1.6, sm: 1.7 },
                letterSpacing: '0.008em',
                px: { xs: 1.1, sm: 1.25 },
                py: { xs: 0.7, sm: 0.875 },
                borderRadius: '3px 7px 7px 3px',
                borderLeft: '2px solid',
                borderColor: alpha(theme.palette.text.secondary, isDark ? 0.18 : 0.14),
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.4 : 0.6),
                backdropFilter: 'blur(12px)',
                boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, isDark ? 0.2 : 0.05)}`,
                transition: TRANSITIONS.default,
                '&:hover': {
                  borderColor: alpha(theme.palette.text.secondary, isDark ? 0.3 : 0.24),
                  boxShadow: `0 6px 20px ${alpha(theme.palette.common.black, isDark ? 0.25 : 0.08)}`,
                },
              }}
            >
              <MarkdownRenderer
                content={showMore || !isLong ? displayContent : displayContent + '\u2026'}
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
              color: alpha(theme.palette.text.secondary, 0.5),
              ...theme.typography.uiBodySm,
              fontFamily: theme.typography.fontFamily,
              fontStyle: 'italic',
              ...(isActive ? { animation: `${pulse} 2s ease-in-out infinite` } : {}),
            }}
          >
            {isActive ? 'Thinking…' : 'Thought process'}
          </Typography>
        )}
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

  const monacoOptions = useMemo(
    () => ({ ...MONACO_OPTIONS, fontSize: theme.typography.uiCode.fontSizePx }),
    [theme.typography.uiCode.fontSizePx]
  );

  const queryHeight = useMemo(() => {
    const query = parsedArgs?.query;
    if (!query) return 80;
    const lineCount = query.split('\n').length;
    return Math.min(Math.max(80, lineCount * 20 + 24), 300);
  }, [parsedArgs?.query]);

  const StatusIcon = isRunning
    ? AutorenewRoundedIcon
    : isError
      ? ErrorOutlineRoundedIcon
      : CheckCircleOutlineRoundedIcon;

  // Use vibrant primary color for running state to give a state-of-the-art feel
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
      }),
    [
      isCurrent,
      isDark,
      isError,
      isRunning,
      nodeColor,
      theme.palette.primary.main,
      theme.palette.error.main,
      theme.palette.text.secondary,
      theme.palette.success.main,
    ]
  );

  return (
    <Box
      sx={{
        animation: `${slideIn} 0.38s cubic-bezier(0.4, 0, 0.2, 1) ${animDelay}ms both`,
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
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: { xs: 0.75, sm: 1 },
          py: { xs: 0.3, sm: 0.35 },
          minHeight: 34,
          px: 0,
          cursor: hasDetails ? 'pointer' : 'default',
          borderRadius: 0,
          bgcolor: 'transparent',
          transition: TRANSITIONS.default,
          '&:hover .step-text': hasDetails
            ? { color: alpha(theme.palette.text.primary, isDark ? 0.9 : 0.8) }
            : {},
          '&:hover .step-arrow': hasDetails
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
              mt: 0.75,
              p: { xs: 1, sm: 1.25 },
              borderRadius: '8px',
              border: '1px solid',
              // Neutral border — no color tint
              borderColor: alpha(theme.palette.text.secondary, isDark ? 0.1 : 0.08),
              // Transparent — sits on whatever the page surface is
              bgcolor: 'transparent',
            }}
          >
            {isSqlTool && parsedArgs?.query && (
              <Box sx={{ mb: parsedResult && !isRunning ? 1.25 : 0 }}>
                <DetailLabel>Query</DetailLabel>
                <Box
                  sx={{
                    borderRadius: '7px',
                    overflow: 'hidden',
                    height: isCompactMobile ? Math.min(queryHeight, 220) : queryHeight,
                    border: '1px solid',
                    borderColor: alpha(theme.palette.text.secondary, isDark ? 0.1 : 0.08),
                  }}
                >
                  <Suspense
                    fallback={
                      <Box sx={{ p: 1.5, color: 'text.secondary', ...theme.typography.uiCaptionSm }}>
                        Loading editor…
                      </Box>
                    }
                  >
                    <Editor
                      height="100%"
                      language="sql"
                      theme={getMonacoThemeName(theme.palette.mode, true)}
                      value={parsedArgs.query}
                      options={monacoOptions}
                      beforeMount={registerTransparentMonacoThemes}
                      loading={
                        <Box sx={{ p: 1.5, color: 'text.secondary', ...theme.typography.uiCaptionSm }}>
                          Loading…
                        </Box>
                      }
                    />
                  </Suspense>
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

  const doneNodeSx = useMemo(
    () =>
      getTimelineNodeSx({
        isDark,
        color: alpha(theme.palette.success.main, isDark ? 0.55 : 0.48),
      }),
    [isDark, theme.palette.success.main]
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        pl: TIMELINE_CONTENT_PL,
        py: { xs: 0.6, sm: 0.75 },
        animation: `${slideIn} 0.38s cubic-bezier(0.4, 0, 0.2, 1) both`,
      }}
    >
      <CheckCircleOutlineRoundedIcon sx={doneNodeSx} />
      <Typography
        sx={{
          color: alpha(theme.palette.text.secondary, isDark ? 0.45 : 0.38),
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
