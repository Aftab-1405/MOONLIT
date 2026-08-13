import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { ArrowForwardIcon } from '@/components/icons';
import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';
import { Reveal } from './LandingSection';
import WorkspaceMockup from './WorkspaceMockup';

function Hero({ onGetStarted }) {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        minHeight: { md: '100dvh' },
        px: { xs: 2, sm: 3 },
        pt: { xs: 14, md: 18 },
        pb: { xs: 8, md: 12 },
        overflow: 'clip',
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          width: 560,
          height: 420,
          left: '50%',
          top: 250,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'linear-gradient(90deg, #7c3aed, #336791 55%, #a0c3ec)',
          filter: 'blur(110px)',
          opacity: 0.28,
        }}
      />
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <Reveal>
          <Typography sx={(theme) => ({ ...theme.typography.captionMono, color: 'text.secondary' })}>
            AI database assistant
          </Typography>
          <Typography
            component="h1"
            sx={(theme) => ({
              ...theme.typography.displayXl,
              mt: 2.5,
              mx: 'auto',
              maxWidth: 1040,
              textTransform: 'uppercase',
              textWrap: 'balance',
              background: 'linear-gradient(100deg, #ffffff 15%, #a3a6aa 72%)',
              backgroundClip: 'text',
              color: 'transparent',
            })}
          >
            Your database, understood.
          </Typography>
          <Typography sx={(theme) => ({ ...theme.typography.bodyLg, mt: 3, mx: 'auto', maxWidth: 650, color: 'text.secondary' })}>
            Ask in plain English, inspect the generated SQL, and move from schema to verified result in one focused workspace.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 4.5 }}>
            <Button variant="contained" size="large" onClick={onGetStarted} endIcon={<ArrowForwardIcon />}>
              Get started
            </Button>
            <Button component="a" href="#product" variant="outlined" size="large">
              See how it works
            </Button>
          </Stack>
        </Reveal>
        <Reveal delay={0.12} sx={{ mt: { xs: 8, md: 10 }, perspective: '1400px' }}>
          <Box
            sx={{
              transform: 'rotateX(8deg) scale(0.96)',
              transformOrigin: 'center top',
              [REDUCED_MOTION_QUERY]: { transform: 'none' },
            }}
          >
            <WorkspaceMockup />
          </Box>
        </Reveal>
      </Container>
    </Box>
  );
}

export default Hero;
