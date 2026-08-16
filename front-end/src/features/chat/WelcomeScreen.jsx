import { Box, Chip, Fade, Typography } from '@mui/material';
import { keyframes, useTheme } from '@mui/material/styles';
import { memo, useCallback, useMemo } from 'react';
import { CodeEditorIcon, DatabaseIcon, SchemaIcon } from '@/components/icons';
import ChatInput from '@/features/chat/ChatInput';
import {
  getResponsivePillControlSx,
  getWelcomeHeroSx,
  getWelcomeLayoutSx,
} from '@/features/styles/interfaceChrome';
import { UI_LAYOUT } from '@/styles/shared';

/**
 * WelcomeScreen — empty-state hero shown when no conversation is selected.
 *
 * Renders the greeting headline + composer + suggestion chips. The greeting
 * stays monochrome so the composer remains the visual anchor.
 */

/** Soft entrance animation — fades content up from 4px below. */
const softReveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const WELCOME_PREFIX = 'How can I help today';

const SUGGESTIONS = [
  {
    label: 'Check Connection',
    icon: <DatabaseIcon sx={{ width: 16, height: 16 }} />,
    prompt: 'Check my database connection status and show connection details',
  },
  {
    label: 'Schema Details',
    icon: <SchemaIcon sx={{ width: 16, height: 16 }} />,
    prompt: 'Show me the database schema with all tables and their columns',
  },
  {
    label: 'Draft SQL Query',
    icon: <CodeEditorIcon sx={{ width: 16, height: 16 }} />,
    prompt: 'Help me draft a SQL query for my database',
  },
];

const WELCOME_LAYOUT = getWelcomeLayoutSx();

function WelcomeScreen({ visible, user, chatInputProps }) {
  const theme = useTheme();
  const firstName = user?.displayName?.split(' ')[0];
  const suggestionChipSx = useMemo(
    () => ({
      ...getResponsivePillControlSx(theme, {
        desktopHeight: 34,
        mobileHeight: UI_LAYOUT.touchTarget,
      }),
      border: `1px solid ${theme.palette.border.idle}`,
      bgcolor: 'transparent',
      color: 'text.secondary',
      '& .MuiChip-icon': { color: 'inherit', ml: 1 },
      '& .MuiChip-label': { px: 1.5, ...theme.typography.buttonMd },
      '&:hover': {
        bgcolor: theme.palette.action.selected,
        color: 'text.primary',
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.palette.border.focus}`,
        outlineOffset: 2,
      },
    }),
    [theme],
  );

  const { onSend } = chatInputProps || {};

  const handleSuggestionClick = useCallback(
    (prompt) => {
      onSend?.(prompt);
    },
    [onSend],
  );

  const nameAccentSx = useMemo(
    () => ({
      display: 'inline-block',
      color: 'text.primary',
      fontWeight: 400,
    }),
    [],
  );

  return (
    <Fade in={visible} timeout={300} unmountOnExit>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',
          ...WELCOME_LAYOUT.outer,
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: UI_LAYOUT.chatInputMaxWidth,
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            ...WELCOME_LAYOUT.content,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              animation: visible ? `${softReveal} 200ms ease-out both` : 'none',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <Typography
              component="h1"
              sx={{
                ...getWelcomeHeroSx(theme),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25em',
                flexWrap: 'wrap',
                maxWidth: { xs: 'min(100%, 680px)', md: 720 },
              }}
            >
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  color: 'text.primary',
                }}
              >
                {WELCOME_PREFIX}
                {firstName ? ',' : ''}
              </Box>
              {firstName ? (
                <Box component="span" sx={nameAccentSx}>
                  {` ${firstName}?`}
                </Box>
              ) : (
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    color: 'text.primary',
                  }}
                >
                  ?
                </Box>
              )}
            </Typography>
          </Box>

          <Box
            sx={{
              width: '100%',
              animation: visible ? `${softReveal} 240ms ease-out both` : 'none',
              animationDelay: visible ? '45ms' : '0ms',
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          >
            <ChatInput {...chatInputProps}>
              <Box
                sx={{
                  width: '100%',
                  maxWidth: UI_LAYOUT.chatInputMaxWidth,
                  mx: 'auto',
                  mt: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  ...WELCOME_LAYOUT.suggestions,
                  flexWrap: 'wrap',
                }}
              >
                {SUGGESTIONS.map(({ label, icon, prompt }, index) => (
                  <Box
                    key={label}
                    sx={{
                      animation: visible ? `${softReveal} 220ms ease-out both` : 'none',
                      animationDelay: visible ? `${70 + index * 35}ms` : '0ms',
                      '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none',
                      },
                    }}
                  >
                    <Chip
                      icon={icon}
                      label={label}
                      onClick={() => handleSuggestionClick(prompt)}
                      size="small"
                      sx={suggestionChipSx}
                    />
                  </Box>
                ))}
              </Box>
            </ChatInput>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
}

export default memo(WelcomeScreen);
