import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo } from 'react';
import Hyperspeed from '@/components/Hyperspeed/Hyperspeed';
import { HOVER_CAPABLE_QUERY, REDUCED_MOTION_QUERY, Section } from '@/pages/Landing/index';
import { BRAND } from '@/theme/tokens';

const STATS = [
  { value: '10K+', label: 'Queries/day' },
  { value: '<100ms', label: 'Avg response' },
  { value: '4', label: 'DB engines' },
];

function Hero({ onGetStarted }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const hyperspeedOptions = useMemo(() => {
    const brandLeftCars = isDark ? [0x8cff5a, 0x6edb3b, 0x3d9a0e] : [0x3d9a0e, 0x2b6e0a, 0x56bc22];
    const brandRightCars = isDark ? [0x9c40ff, 0x80b0ff, 0xff5a8c] : [0x8050e0, 0x608df0, 0xd03070];
    const brandSticks = isDark ? 0x8cff5a : 0x3d9a0e;

    return {
      distortion: 'turbulentDistortion',
      length: 400,
      roadWidth: 10,
      islandWidth: 2,
      lanesPerRoad: 3,
      fov: 90,
      fovSpeedUp: 120,
      speedUp: 1.5,
      carLightsFade: 0.4,
      totalSideLightSticks: 15,
      lightPairsPerRoadWay: 30,
      shoulderLinesWidthPercentage: 0.05,
      brokenLinesWidthPercentage: 0.1,
      brokenLinesLengthPercentage: 0.5,
      lightStickWidth: [0.12, 0.5],
      lightStickHeight: [1.3, 1.7],
      movingAwaySpeed: [60, 80],
      movingCloserSpeed: [-120, -160],
      carLightsLength: [400 * 0.03, 400 * 0.15],
      carLightsRadius: [0.05, 0.14],
      carWidthPercentage: [0.3, 0.5],
      carShiftX: [-0.8, 0.8],
      carFloorSeparation: [0, 4],
      colors: {
        roadColor: isDark ? 0x0c0c0c : 0xebeae3,
        islandColor: isDark ? 0x0e0e0e : 0xf0efe8,
        background: isDark ? 0x101010 : 0xfaf9f7,
        shoulderLines: isDark ? 0x1a1a1a : 0xd5d2c8,
        brokenLines: isDark ? 0x1a1a1a : 0xd5d2c8,
        leftCars: brandLeftCars,
        rightCars: brandRightCars,
        sticks: brandSticks,
      },
    };
  }, [isDark]);

  return (
    <Section sx={{ py: { xs: 8, md: 6 }, position: 'relative', overflow: 'hidden' }}>
      {/* WebGL Hyperspeed — anchored to the lower 65% so it doesn't bleed over the headline */}
      <Box
        sx={{
          position: 'absolute',
          top: '35%',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          opacity: isDark ? 0.55 : 0.18,
          pointerEvents: 'none',
        }}
      >
        <Hyperspeed effectOptions={hyperspeedOptions} />
      </Box>

      {/* Radial vignette: fades the road edges so it blends seamlessly */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background: `radial-gradient(
            ellipse 90% 55% at 50% 105%,
            transparent 20%,
            ${alpha(theme.palette.background.default, 0.55)} 60%,
            ${theme.palette.background.default} 100%
          )`,
        }}
      />

      <Container maxWidth="md" sx={{ zIndex: 3, position: 'relative', textAlign: 'center' }}>
        <Stack spacing={3} alignItems="center">
          {/* Badge */}
          <Box
            sx={{
              px: 2,
              py: 0.625,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.045),
              border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.16 : 0.1)}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              animation: 'fadeIn 0.5s ease-out',
              [REDUCED_MOTION_QUERY]: { animation: 'none' },
            }}
          >
            {/* Pulsing dot */}
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'text.primary',
                animation: 'pulse-dot 2s ease-in-out infinite',
                flexShrink: 0,
                [REDUCED_MOTION_QUERY]: { animation: 'none' },
              }}
            />
            <Typography
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: 0,
                textTransform: 'none',
                ...theme.typography.uiCaptionSm,
              }}
            >
              AI-Powered Database Assistant
            </Typography>
          </Box>

          {/* Heading */}
          <Typography
            component="h1"
            sx={{
              fontWeight: 800,
              ...theme.typography.uiHeadingHero,
              textWrap: 'balance',
              lineHeight: 1.1,
              color: 'text.primary',
              animation: 'fadeIn 0.6s ease-out 0.1s both',
              [REDUCED_MOTION_QUERY]: { animation: 'none' },
            }}
          >
            Stop Writing SQL.
            <br />
            <Box
              component="span"
              sx={{
                color: BRAND.main,
              }}
            >
              Start Asking Questions.
            </Box>
          </Typography>

          {/* Subheading */}
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              maxWidth: 520,
              opacity: 0.85,
              ...theme.typography.uiBodyLg,
              animation: 'fadeIn 0.6s ease-out 0.2s both',
              [REDUCED_MOTION_QUERY]: { animation: 'none' },
            }}
          >
            Connect to your database, ask in plain English, and get instant results. No SQL
            expertise required. Your data never leaves your infrastructure.
          </Typography>

          {/* CTAs */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              pt: 0.5,
              animation: 'fadeIn 0.6s ease-out 0.3s both',
              [REDUCED_MOTION_QUERY]: { animation: 'none' },
            }}
          >
            <Button
              size="large"
              variant="contained"
              color="primary"
              onClick={onGetStarted}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                px: 3.5,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
                // Solid brand purple — consistent with auth CTAs and the
                // chat send button.
                backgroundColor: BRAND.main,
                '&:hover': {
                  backgroundColor: BRAND.dark,
                },
                boxShadow: `0 4px 14px ${alpha(BRAND.main, isDark ? 0.4 : 0.24)}`,
                transition: theme.transitions.create(
                  ['box-shadow', 'transform', 'background-color'],
                  { duration: 200 },
                ),
                [REDUCED_MOTION_QUERY]: { transition: 'none' },
                [HOVER_CAPABLE_QUERY]: {
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 22px ${alpha(BRAND.main, isDark ? 0.5 : 0.32)}`,
                  },
                },
                '&:active': { transform: 'scale(0.98)' },
              }}
            >
              Get Started Free
            </Button>
            <Button
              size="large"
              variant="outlined"
              startIcon={<PlayCircleRoundedIcon />}
              onClick={() => {
                const reduceMotion = window.matchMedia?.(
                  '(prefers-reduced-motion: reduce)',
                )?.matches;
                document.getElementById('demo-section')?.scrollIntoView({
                  behavior: reduceMotion ? 'auto' : 'smooth',
                });
              }}
              sx={{
                px: 3.5,
                py: 1.5,
                borderRadius: 2,
                borderColor: alpha(theme.palette.text.primary, 0.18),
                borderWidth: 1,
                color: 'text.primary',
                backgroundColor: alpha(theme.palette.background.default, isDark ? 0.4 : 0.6),
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                transition: theme.transitions.create(
                  ['border-color', 'background-color', 'color', 'transform'],
                  { duration: 200 },
                ),
                [REDUCED_MOTION_QUERY]: { transition: 'none' },
                [HOVER_CAPABLE_QUERY]: {
                  '&:hover': {
                    borderColor: alpha(theme.palette.text.primary, isDark ? 0.28 : 0.2),
                    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.05),
                    color: 'text.primary',
                    transform: 'translateY(-2px)',
                  },
                },
              }}
            >
              Watch Demo
            </Button>
          </Stack>

          {/* Stats strip — glassmorphic pill for legibility over the road */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0,
              px: 3,
              py: 1.5,
              borderRadius: '16px',
              border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.1 : 0.07)}`,
              backgroundColor: alpha(theme.palette.background.default, isDark ? 0.55 : 0.7),
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              animation: 'fadeIn 0.6s ease-out 0.4s both',
              [REDUCED_MOTION_QUERY]: { animation: 'none' },
            }}
          >
            {STATS.map((s, i) => (
              <Box
                key={s.label}
                textAlign="center"
                sx={{
                  px: 3,
                  borderRight:
                    i < STATS.length - 1
                      ? `1px solid ${alpha(theme.palette.text.primary, 0.1)}`
                      : 'none',
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: BRAND.main,
                    ...theme.typography.uiHeadingLandingMd,
                    fontSize: { xs: '1.1rem', md: '1.25rem' },
                    lineHeight: 1.2,
                    letterSpacing: 0,
                  }}
                >
                  {s.value}
                </Typography>
                <Typography
                  sx={{
                    color: 'text.secondary',
                    opacity: 0.65,
                    ...theme.typography.uiCaptionXs,
                    mt: 0.25,
                  }}
                >
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Stack>
      </Container>
    </Section>
  );
}

export default Hero;
