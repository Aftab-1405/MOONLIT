import { Box, Container, Stack, Typography, Button } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Section, REDUCED_MOTION_QUERY, HOVER_CAPABLE_QUERY } from './index';
import { getMoonlitBrandGradients } from '../../styles/themeEffects';

function FinalCTA({ onGetStarted }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const brandGradients = getMoonlitBrandGradients(theme);

  return (
    <Section sx={{ flexDirection: 'column', py: { xs: 6, md: 8 } }}>
      <Container maxWidth="md" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <Stack spacing={3} alignItems="center">
          <Typography
            variant="h2"
            fontWeight="bold"
            sx={{ ...theme.typography.uiHeadingLandingLg, lineHeight: 1.2 }}
          >
            Ready to Talk to{' '}
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
              Your Database?
            </Box>
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 420, opacity: 0.7 }}
          >
            Join developers and analysts who've simplified their database workflows. Start free, no credit card required.
          </Typography>

          <Button
            size="large"
            onClick={onGetStarted}
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{
              px: 5,
              py: 1.75,
              borderRadius: 2,
              fontWeight: 600,
              backgroundImage: brandGradients.static,
              backgroundColor: 'transparent',
              color: theme.palette.primary.contrastText,
              border: 'none',
              boxShadow: `0 10px 28px ${alpha(theme.palette.common.black, isDark ? 0.32 : 0.12)}`,
              transition: theme.transitions.create(['filter', 'transform', 'box-shadow'], { duration: 200 }),
              [REDUCED_MOTION_QUERY]: { transition: 'none' },
              [HOVER_CAPABLE_QUERY]: {
                '&:hover': {
                  filter: 'brightness(1.12)',
                  transform: 'translateY(-2px)',
                  boxShadow: `0 14px 34px ${alpha(theme.palette.common.black, isDark ? 0.38 : 0.16)}`,
                },
              },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            Get Started Free
          </Button>

          {/* Trust badges */}
          <Stack
            direction="row"
            spacing={0}
            alignItems="center"
            divider={
              <Box
                sx={{
                  width: '1px',
                  height: 12,
                  backgroundColor: alpha(theme.palette.text.primary, 0.12),
                  mx: 2,
                }}
              />
            }
          >
            {['No credit card', 'Your existing databases', 'Cancel anytime'].map((item) => (
              <Typography
                key={item}
                variant="caption"
                color="text.secondary"
                sx={{ opacity: 0.5, ...theme.typography.uiCaptionXs }}
              >
                {item}
              </Typography>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Section>
  );
}

export default FinalCTA;
