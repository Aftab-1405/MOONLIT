import { Box, keyframes, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

import { getMoonlitGradient } from '@/theme/index';

const breathe = keyframes`
  0%, 100% { opacity: 0.58; }
  50%       { opacity: 1; }
`;
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const horizonSweep = keyframes`
  0%   { transform: translateX(-130%); opacity: 0; }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { transform: translateX(230%); opacity: 0; }
`;

function PageLoader() {
  const theme = useTheme();
  const glowColor = alpha(
    theme.palette.primary.glow || theme.palette.primary.main,
    theme.palette.mode === 'dark' ? 0.24 : 0.12,
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        '@supports (height: 100dvh)': { minHeight: '100dvh' },
        display: 'grid',
        placeItems: 'center',
        backgroundColor: 'background.default',
        px: 3,
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading Moonlit"
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.75,
          animation: `${fadeIn} 420ms ease-out both`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      >
        <Typography
          sx={{
            ...theme.typography.uiLoaderWordmark,
            background: getMoonlitGradient(theme),
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: `drop-shadow(0 0 20px ${glowColor})`,
            letterSpacing: '-0.025em',
            animation: `${breathe} 2.4s ease-in-out infinite`,
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              opacity: 1,
            },
          }}
        >
          Moonlit
        </Typography>
        <Box
          sx={{
            position: 'relative',
            width: 112,
            height: 1,
            overflow: 'hidden',
            borderRadius: 999,
            backgroundColor: alpha(theme.palette.text.primary, 0.12),
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              width: '42%',
              borderRadius: 'inherit',
              backgroundColor: 'text.primary',
              boxShadow: `0 0 10px ${glowColor}`,
              animation: `${horizonSweep} 1.8s ease-in-out infinite`,
            },
            '@media (prefers-reduced-motion: reduce)': {
              '&::after': {
                width: '100%',
                opacity: 0.5,
                animation: 'none',
              },
            },
          }}
        />
      </Box>
    </Box>
  );
}

export default PageLoader;
