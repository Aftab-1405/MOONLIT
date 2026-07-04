import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { REDUCED_MOTION_QUERY, Section } from '@/pages/Landing/index';
import { BRAND } from '@/theme/tokens';

function FinalCTA({ onGetStarted }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
                color: BRAND.main,
              }}
            >
              Your Database?
            </Box>
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, opacity: 0.7 }}>
            Join developers and analysts who've simplified their database workflows. Start free, no
            credit card required.
          </Typography>

          <Button
            size="large"
            variant="contained"
            color="primary"
            onClick={onGetStarted}
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{
              px: 5,
              py: 1.75,
              borderRadius: 2,
              fontWeight: 600,
              // Solid brand purple — matches the hero CTA.
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
              '@media (hover: hover)': {
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
