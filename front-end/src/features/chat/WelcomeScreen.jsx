import { memo } from 'react';
import { Box, Fade, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChatInput from '@/features/chat/ChatInput';
import { getWelcomeHeroSx } from '@/features/styles/interfaceChrome';
import { UI_LAYOUT } from '@/styles/shared';

function WelcomeScreen({ visible, user, chatInputProps }) {
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
            <ChatInput {...chatInputProps} />
          </Box>
        </Box>
      </Box>
    </Fade>
  );
}

export default memo(WelcomeScreen);
