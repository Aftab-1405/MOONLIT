import { Box, Container, Stack, Typography, Button } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import { Section, REDUCED_MOTION_QUERY, HOVER_CAPABLE_QUERY } from './index';
import { getMoonlitBrandGradients } from '../../styles/themeEffects';

const STATS = [
  { value: '10K+', label: 'Queries/day' },
  { value: '<100ms', label: 'Avg response' },
  { value: '4', label: 'DB engines' },
];

function Hero({ onGetStarted }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const brandGradients = getMoonlitBrandGradients(theme);

  return (
    <Section sx={{ py: { xs: 8, md: 6 } }}>
      <Container maxWidth="md" sx={{ zIndex: 2, textAlign: 'center' }}>
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
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                ...theme.typography.uiCaptionXs,
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
                background: brandGradients.shimmer,
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'shimmer 5s linear infinite',
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
              opacity: 0.75,
              ...theme.typography.uiBodyLg,
              animation: 'fadeIn 0.6s ease-out 0.2s both',
              [REDUCED_MOTION_QUERY]: { animation: 'none' },
            }}
          >
            Connect to your database, ask in plain English, and get instant results.
            No SQL expertise required. Your data never leaves your infrastructure.
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
              variant="outlined"
              color="primary"
              onClick={onGetStarted}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                px: 3.5,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
                transition: theme.transitions.create(['background-color', 'border-color', 'color', 'transform'], { duration: 200 }),
                [REDUCED_MOTION_QUERY]: { transition: 'none' },
                [HOVER_CAPABLE_QUERY]: {
                  '&:hover': {
                    transform: 'translateY(-2px)',
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
              startIcon={<PlayCircleOutlinedIcon />}
              onClick={() => {
                const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
                document.getElementById('demo-section')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
              }}
              sx={{
                px: 3.5,
                py: 1.5,
                borderRadius: 2,
                borderColor: alpha(theme.palette.text.primary, 0.18),
                borderWidth: 1,
                color: 'text.primary',
                transition: theme.transitions.create(['border-color', 'background-color', 'color', 'transform'], { duration: 200 }),
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

          {/* Stats strip */}
          <Stack
            direction="row"
            spacing={0}
            divider={
              <Box
                sx={{
                  width: '1px',
                  height: 28,
                  backgroundColor: alpha(theme.palette.text.primary, 0.1),
                  mx: 3,
                  alignSelf: 'center',
                }}
              />
            }
            sx={{
              pt: 1,
              animation: 'fadeIn 0.6s ease-out 0.4s both',
              [REDUCED_MOTION_QUERY]: { animation: 'none' },
            }}
          >
            {STATS.map((s) => (
              <Box key={s.label} textAlign="center">
                <Typography
                  sx={{
                    fontWeight: 700,
                    background: brandGradients.static,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    ...theme.typography.uiHeadingLandingMd,
                    fontSize: { xs: '1.1rem', md: '1.25rem' },
                    lineHeight: 1.2,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {s.value}
                </Typography>
                <Typography
                  sx={{
                    color: 'text.secondary',
                    opacity: 0.6,
                    ...theme.typography.uiCaptionXs,
                    mt: 0.25,
                  }}
                >
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Stack>

          {/* DB logos */}
          <Stack spacing={1.25} alignItems="center" sx={{ pt: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                opacity: 0.4,
                ...theme.typography.uiCaption2xs,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Works with your favorite databases
            </Typography>
            <Stack
              direction="row"
              spacing={{ xs: 2.5, md: 4 }}
              alignItems="center"
              justifyContent="center"
              sx={{
                opacity: 0.65,
                transition: 'opacity 0.3s ease',
                [HOVER_CAPABLE_QUERY]: { '&:hover': { opacity: 0.9 } },
              }}
            >
              {[
                { src: '/logo-postgresql.svg', alt: 'PostgreSQL' },
                { src: '/logo-mysql.svg', alt: 'MySQL' },
{ src: '/logo-microsoft-sql-server.svg', alt: 'SQL Server', hideXs: true },
                { src: '/logo-oracle.svg', alt: 'Oracle', hideXs: true },
              ].map((db) => (
                <Box
                  key={db.alt}
                  sx={{
                    width: { xs: 30, md: 38 },
                    height: { xs: 30, md: 38 },
                    display: db.hideXs ? { xs: 'none', sm: 'flex' } : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.25s ease',
                    [HOVER_CAPABLE_QUERY]: { '&:hover': { transform: 'scale(1.18)' } },
                  }}
                >
                  <Box
                    component="img"
                    src={db.src}
                    alt={db.alt}
                    loading="lazy"
                    decoding="async"
                    sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </Box>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Section>
  );
}

export default Hero;
