import { Box, Chip, Fade, Typography } from '@mui/material';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import { memo, useCallback, useMemo } from 'react';
import CodeEditorIcon from '@/components/icons/CodeEditorIcon';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import SchemaIcon from '@/components/icons/SchemaIcon';
import ChatInput from '@/features/chat/ChatInput';
import { getWelcomeHeroSx } from '@/features/styles/interfaceChrome';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import { getInteractionColors, getPillSx, UI_LAYOUT } from '@/styles/shared';
import { BRAND } from '@/theme/tokens';

/**
 * WelcomeScreen — empty-state hero shown when no conversation is selected.
 *
 * Renders the greeting headline + composer + suggestion chips. The user's
 * first name uses the Moonlit brand gradient (orange → purple → pink) as an
 * identity moment — this is the only place in the chat interface where the
 * brand color appears at full saturation.
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

/** Subtle gradient drift on the highlighted first-name (8s loop). */
const gradientFlow = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
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

/**
 * Build the sx for a suggestion chip.
 * Uses the shared `getPillSx` from styles/shared.js so every pill/chip in
 * the app has identical geometry and interaction states.
 */
const getSuggestionChipSx = (theme, interaction) => getPillSx(theme, interaction);

function WelcomeScreen({ visible, user, chatInputProps }) {
  const theme = useTheme();
  const firstName = user?.displayName?.split(' ')[0];
  const neutralInteraction = useMemo(() => getInteractionColors(theme), [theme]);
  const suggestionChipSx = useMemo(
    () => getSuggestionChipSx(theme, neutralInteraction),
    [theme, neutralInteraction],
  );

  const { onSend } = chatInputProps || {};

  const handleSuggestionClick = useCallback(
    (prompt) => {
      onSend?.(prompt);
    },
    [onSend],
  );

  // Brand gradient for the user's first name. This is the Moonlit brand
  // accent — orange → purple → pink — used as an identity moment on the
  // welcome hero. The gradient slowly shimmers (cycles left → right) to
  // give the empty state a sense of life without being distracting.
  const nameGradientSx = useMemo(
    () => ({
      display: 'inline-block',
      // Brand shimmer gradient (orange → purple → pink → orange). The 4th
      // stop matches the 1st so the loop is seamless.
      backgroundImage: BRAND.shimmer,
      backgroundSize: '300% 100%',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      animation: `${gradientFlow} 6s linear infinite`,
      fontWeight: 600,
      '@media (prefers-reduced-motion: reduce)': {
        animation: 'none',
        // Fall back to the static 3-stop gradient (no animation).
        backgroundImage: BRAND.static,
      },
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
          px: { xs: 1, sm: 3 },
          py: { xs: 2.5, sm: 4 },
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
            gap: { xs: 1.75, sm: 2.25 },
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
                // Use the new display-weight hero variant for an editorial
                // "moment" feel — tighter letter-spacing, serif face, heavier
                // weight. Falls back gracefully on small screens.
                ...theme.typography.uiDisplayMd,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.24em',
                flexWrap: 'wrap',
                maxWidth: { xs: 'min(100%, 680px)', sm: 720 },
                // Override uiDisplayMd's font-size with the responsive scale
                // we already tuned for this hero.
                fontSize: { xs: '1.65rem', sm: '2.05rem', md: '2.55rem' },
                fontWeight: 500,
                lineHeight: 1.18,
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
                <Box component="span" sx={nameGradientSx}>
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
                  gap: 0.75,
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
