// GuidedConfirmationPrompt — compact "Task Paused" strip that slides UP from
// behind the composer, overlaying the chat instead of pushing it.
//
// Used for agent interrupts (e.g. "execute_query") and step-limit pauses.
// Design goals:
//   1. No layout shift — the banner is absolutely positioned over the chat,
//      so chat messages don't jump when it appears.
//   2. Compact single-line text ("⏸ Step limit reached · 5 steps used") —
//      the buttons speak for themselves.
//   3. Slides up from behind the composer's top edge (translateY animation).
//   4. Composer stays fully interactive (zIndex above the banner).
//   5. A subtle gradient fade at the banner's top edge so the chat content
//      behind it fades out gracefully.
//
// Layering:
//   - Banner zIndex: 3  (above chat messages, below composer)
//   - Composer zIndex: 4 (always on top, always interactive)

import { Box, Button, Collapse, Fade, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { memo } from 'react';
import { getAppPanelSurfaceSx } from '@/features/styles/interfaceChrome';
import { UI_LAYOUT } from '@/styles/shared';

const GuidedConfirmationPrompt = memo(function GuidedConfirmationPrompt({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onCancel,
  onConfirm,
  theme,
}) {
  const isDark = theme.palette.mode === 'dark';
  const compactMessage = message || 'Task paused';

  return (
    <Collapse
      in={open}
      timeout={250}
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '100%',
        zIndex: 3,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <Fade in={open} timeout={250}>
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={title ? `${title}: ${compactMessage}` : compactMessage}
          sx={{
            width: '100%',
            maxWidth: UI_LAYOUT.chatInputMaxWidth,
            mx: 'auto',
            px: { xs: 1, sm: 0 },
            transform: open ? 'translateY(0)' : 'translateY(8px)',
            transition: theme.transitions.create(['transform', 'opacity'], {
              duration: 250,
              easing: theme.transitions.easing.easeOut,
            }),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: { xs: 1, sm: 1.5 },
              borderTopLeftRadius: '14px',
              borderTopRightRadius: '14px',
              border: '1px solid',
              borderColor: alpha(theme.palette.warning.main, isDark ? 0.32 : 0.24),
              borderBottom: 0,
              ...getAppPanelSurfaceSx(theme),
              px: { xs: 1.75, sm: 2.25 },
              py: 1,
              bgcolor: (th) =>
                alpha(th.palette.warning.main, th.palette.mode === 'dark' ? 0.08 : 0.05),
              boxShadow: `0 -4px 16px ${alpha(theme.palette.common.black, isDark ? 0.3 : 0.08)}`,
            }}
          >
            {/* Compact single-line message with icon */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Box
                aria-hidden
                component="span"
                sx={{
                  fontSize: 14,
                  lineHeight: 1,
                  flexShrink: 0,
                  color: 'warning.main',
                }}
              >
                ⏸
              </Box>
              <Typography
                sx={{
                  ...theme.typography.uiBodySm,
                  color: 'text.primary',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  overflowWrap: 'anywhere',
                  maxHeight: '2.6em',
                  overflow: 'hidden',
                }}
              >
                {compactMessage}
              </Typography>
            </Box>

            {/* Action buttons — compact, single row */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                flexShrink: 0,
                alignSelf: { xs: 'flex-end', sm: 'center' },
              }}
            >
              <Button
                size="small"
                onClick={onCancel}
                sx={{
                  minHeight: 28,
                  borderRadius: '6px',
                  textTransform: 'none',
                  color: 'text.secondary',
                  px: 1.25,
                  ...theme.typography.uiCaptionMd,
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                  },
                  '&.Mui-focusVisible': {
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.text.primary, isDark ? 0.18 : 0.12)}`,
                    outline: 'none',
                  },
                }}
              >
                {cancelText || 'Stop'}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={onConfirm}
                sx={{
                  minHeight: 28,
                  borderRadius: '6px',
                  textTransform: 'none',
                  px: 1.5,
                  ...theme.typography.uiCaptionMd,
                  fontWeight: 700,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                    boxShadow: 'none',
                  },
                  '&.Mui-focusVisible': {
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, isDark ? 0.28 : 0.2)}`,
                    outline: 'none',
                  },
                }}
              >
                {confirmText || 'Continue'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Fade>
    </Collapse>
  );
});

export default GuidedConfirmationPrompt;
