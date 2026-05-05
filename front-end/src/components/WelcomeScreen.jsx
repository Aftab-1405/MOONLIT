import { memo } from 'react';
import { Box, Fade, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChatInput from './ChatInput';
import { UI_LAYOUT } from '../styles/shared';

function WelcomeScreen({ visible, user, chatInputProps, starfieldFocus = false }) {
  const theme = useTheme();
  const firstName = user?.displayName?.split(' ')[0];

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
              opacity: starfieldFocus ? 0 : 1,
              transform: starfieldFocus ? 'translateY(-8px) scale(0.985)' : 'translateY(0) scale(1)',
              transition: 'opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 700ms cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: starfieldFocus ? 'none' : 'auto',
            }}
          >
            <Typography
              component="h1"
              sx={{
                fontFamily: theme.typography.fontFamily,
                fontSize: { xs: '2rem', sm: '2.5rem' },
                fontWeight: 500,
                lineHeight: 1.15,
                letterSpacing: '-0.03em',
                color: 'text.primary',
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
              opacity: starfieldFocus ? 0 : 1,
              transform: starfieldFocus ? 'translateY(10px) scale(0.99)' : 'translateY(0) scale(1)',
              transition: 'opacity 760ms cubic-bezier(0.22, 1, 0.36, 1), transform 760ms cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: starfieldFocus ? 'none' : 'auto',
            }}
          >
            <ChatInput {...chatInputProps} />
          </Box>
        </Box>

        <Fade in={starfieldFocus} timeout={{ enter: 900, exit: 260 }} unmountOnExit>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: { xs: 3, sm: 4 },
              pointerEvents: 'none',
            }}
          >
            <Typography
              sx={{
                maxWidth: 420,
                color: theme.palette.mode === 'dark' ? 'rgba(242, 240, 236, 0.72)' : 'text.secondary',
                fontFamily: theme.typography.fontFamily,
                fontSize: { xs: '0.95rem', sm: '1.05rem' },
                fontWeight: theme.typography.fontWeightRegular,
                lineHeight: 1.7,
                letterSpacing: '0.01em',
                textAlign: 'center',
                textShadow: theme.palette.mode === 'dark'
                  ? '0 1px 18px rgba(0, 0, 0, 0.32)'
                  : 'none',
              }}
            >
              Take a quiet moment with the stars. Move your cursor or start typing whenever you are ready to continue.
            </Typography>
          </Box>
        </Fade>
      </Box>
    </Fade>
  );
}

export default memo(WelcomeScreen);
