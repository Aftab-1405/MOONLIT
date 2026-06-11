import { memo, useMemo, useCallback } from 'react';
import { Box, Fade, Typography, Chip } from '@mui/material';
import { alpha, useTheme, keyframes } from '@mui/material/styles';
import ChatInput from '@/features/chat/ChatInput';
import { getWelcomeHeroSx } from '@/features/styles/interfaceChrome';
import { UI_LAYOUT, getInteractionColors } from '@/styles/shared';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import CodeEditorIcon from '@/components/icons/CodeEditorIcon';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import SchemaIcon from '@/components/icons/SchemaIcon';

const blurReveal = keyframes`
  0% {
    opacity: 0;
    filter: blur(12px);
    transform: translateY(8px) scale(0.98);
  }
  100% {
    opacity: 1;
    filter: blur(0px);
    transform: translateY(0) scale(1);
  }
`;

function WelcomeScreen({ visible, user, chatInputProps }) {
  const theme = useTheme();
  const firstName = user?.displayName?.split(' ')[0];
  const neutralInteraction = useMemo(() => getInteractionColors(theme), [theme]);

  const suggestions = useMemo(() => [
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
  ], []);

  const { onSend } = chatInputProps || {};

  const handleSuggestionClick = useCallback((prompt) => {
    onSend?.(prompt);
  }, [onSend]);

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
          py: { xs: 3, sm: 4 },
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
            gap: { xs: 2.5, sm: 3 },
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              opacity: 1,
              transform: 'translateY(0) scale(1)',
              transition: 'opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: 'auto',
            }}
          >
            <Typography
              component="h1"
              sx={{
                ...getWelcomeHeroSx(theme),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4em',
                flexWrap: 'wrap',
              }}
            >
              <span>{firstName ? `How can I help today, ${firstName}?` : 'How can I help you today?'}</span>
            </Typography>
          </Box>

          <Box
            sx={{
              width: '100%',
              opacity: 1,
              transform: 'translateY(0) scale(1)',
              transition: 'opacity 760ms cubic-bezier(0.22, 1, 0.36, 1), transform 760ms cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: 'auto',
            }}
          >
            <ChatInput {...chatInputProps}>
              {/* Suggestion Chips */}
              <Box
                sx={{
                  width: '100%',
                  maxWidth: UI_LAYOUT.chatInputMaxWidth,
                  mx: 'auto',
                  mt: 1.25,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 0.75,
                  flexWrap: 'wrap',
                }}
              >
                {suggestions.map((chip, index) => (
                  <Box
                    key={chip.label}
                    sx={{
                      opacity: visible ? 0 : 1,
                      animation: visible
                        ? `${blurReveal} 0.65s cubic-bezier(0.16, 1, 0.3, 1) both`
                        : 'none',
                      animationDelay: visible ? `${120 + index * 60}ms` : '0ms',
                      '@media (prefers-reduced-motion: reduce)': {
                        opacity: 1,
                        filter: 'none',
                        transform: 'none',
                        animation: 'none',
                      },
                    }}
                  >
                    <Chip
                      icon={chip.icon}
                      label={chip.label}
                      onClick={() => handleSuggestionClick(chip.prompt)}
                      size="small"
                      sx={{
                        height: 32,
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: neutralInteraction.border,
                        color: 'text.secondary',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        transition: theme.transitions.create(['background-color', 'border-color', 'color', 'transform'], {
                          duration: theme.transitions.duration.shorter,
                        }),
                        '&:active': { transform: 'scale(0.995)' },
                        '& .MuiChip-label': {
                          px: 1.25,
                          ...theme.typography.uiCaptionSm,
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                        '& .MuiChip-icon': {
                          color: alpha(theme.palette.text.primary, 0.45),
                          ml: 1,
                          mr: -0.25,
                          fontSize: 16,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                        },
                        [HOVER_CAPABLE_QUERY]: {
                          '&:hover': {
                            borderColor: neutralInteraction.hoverBorder,
                            backgroundColor: neutralInteraction.hoverBackground,
                            color: 'text.primary',
                            '& .MuiChip-icon': {
                              color: alpha(theme.palette.text.primary, 0.65),
                            },
                          },
                        },
                      }}
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
