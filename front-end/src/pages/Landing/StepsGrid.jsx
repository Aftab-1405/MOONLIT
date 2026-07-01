import { Box, Container, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { HOVER_CAPABLE_QUERY, REDUCED_MOTION_QUERY, Section } from '@/pages/Landing/index';
import { getMoonlitBrandGradients } from '@/theme/themeEffects';

function StepsGrid() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const brandGradients = getMoonlitBrandGradients(theme);

  const steps = useMemo(
    () => [
      {
        num: '01',
        title: 'Connect',
        desc: 'Link your PostgreSQL, MySQL, SQL Server, or Oracle database in seconds.',
      },
      {
        num: '02',
        title: 'Ask',
        desc: 'Type your question in plain English. No SQL syntax needed.',
      },
      {
        num: '03',
        title: 'Get Answers',
        desc: 'View results as tables, visualize as charts, or export to CSV.',
      },
    ],
    [],
  );

  return (
    <Section tinted sx={{ py: { xs: 8, md: 10 } }}>
      <Container maxWidth="lg">
        <Box textAlign="center" mb={6}>
          <Typography
            sx={{
              ...theme.typography.uiCaptionSm,
              color: 'text.secondary',
              fontWeight: 600,
              letterSpacing: 0,
              textTransform: 'none',
              display: 'block',
              mb: 1.5,
            }}
          >
            How It Works
          </Typography>
          <Typography
            variant="h3"
            fontWeight="bold"
            sx={{ ...theme.typography.uiHeadingLandingLg }}
          >
            Three Steps.{' '}
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
              Zero Learning Curve.
            </Box>
          </Typography>
        </Box>

        {/* Steps layout */}
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 3,
              justifyContent: 'center',
            }}
          >
            {steps.map((s, i) => (
              <Box
                key={s.num}
                sx={{
                  flex: { xs: '1 1 auto', md: '1 1 0' },
                  minWidth: 0,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {/* Card */}
                <Box
                  component={motion.div}
                  // Animate into view when card enters the viewport (fixes mount-time animation bug)
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.12 }}
                  sx={{
                    p: { xs: 3, md: 4 },
                    pt: { xs: 4.5, md: 5 },
                    position: 'relative',
                    backgroundColor: isDark
                      ? alpha(theme.palette.text.primary, 0.03)
                      : alpha(theme.palette.text.primary, 0.02),
                    border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06)}`,
                    borderRadius: 3,
                    // will-change hints the browser to GPU-composite this layer before hover
                    willChange: 'transform',
                    transition: theme.transitions.create(
                      ['border-color', 'background-color', 'transform', 'box-shadow'],
                      { duration: 250 },
                    ),
                    [REDUCED_MOTION_QUERY]: {
                      transition: 'none',
                    },
                    [HOVER_CAPABLE_QUERY]: {
                      '&:hover': {
                        borderColor: alpha(theme.palette.text.primary, isDark ? 0.22 : 0.14),
                        backgroundColor: isDark
                          ? alpha(theme.palette.text.primary, 0.055)
                          : alpha(theme.palette.text.primary, 0.035),
                        transform: 'translateY(-5px)',
                        boxShadow: isDark
                          ? `0 20px 42px -18px ${alpha(theme.palette.common.black, 0.44)}`
                          : `0 20px 40px -18px ${alpha(theme.palette.common.black, 0.12)}`,
                      },
                    },
                  }}
                >
                  {/* Step badge */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: -22,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundImage: brandGradients.static,
                      backgroundColor: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 8px 22px ${alpha(theme.palette.common.black, isDark ? 0.34 : 0.12)}`,
                      border: `3px solid ${theme.palette.background.default}`,
                    }}
                  >
                    <Typography
                      sx={{
                        ...theme.typography.uiStepNumber,
                        fontWeight: 700,
                        color: theme.palette.primary.contrastText,
                        letterSpacing: 0,
                      }}
                    >
                      {s.num}
                    </Typography>
                  </Box>

                  <Stack spacing={1} alignItems="center" textAlign="center">
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      sx={{ ...theme.typography.uiCardTitle }}
                    >
                      {s.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ ...theme.typography.uiCardBody, opacity: 0.75 }}
                    >
                      {s.desc}
                    </Typography>
                  </Stack>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </Section>
  );
}

export default StepsGrid;
