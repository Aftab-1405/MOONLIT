import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import { Box, Container, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { HOVER_CAPABLE_QUERY, REDUCED_MOTION_QUERY, Section } from '@/pages/Landing/index';
import { BRAND } from '@/theme/tokens';

function ValueGrid() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Value-prop cards. Icons are chosen for exact semantic meaning:
  //   - Natural Language Queries → Chat (conversation = natural language)
  //   - Instant Results → Bolt (lightning = speed/instant)
  //   - Visualize Instantly → Insights (chart with trend = visualization)
  // The previous AutoAwesome/Speed/Visibility set was generic and didn't
  // communicate the specific value of each card.
  const values = useMemo(
    () => [
      {
        Icon: ChatRoundedIcon,
        title: 'Natural Language Queries',
        desc: 'Just ask what you want to know. The AI translates your questions into optimized SQL automatically.',
      },
      {
        Icon: BoltRoundedIcon,
        title: 'Instant Results',
        desc: 'Get answers in seconds, not hours. View as tables, charts, or export to CSV with one click.',
      },
      {
        Icon: InsightsRoundedIcon,
        title: 'Visualize Instantly',
        desc: 'Turn query results into beautiful charts. Bar, line, pie, or doughnut — generated on the fly.',
      },
    ],
    [],
  );

  return (
    <Section id="features-section" tinted sx={{ py: { xs: 8, md: 10 } }}>
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
            Why Moonlit
          </Typography>
          <Typography
            variant="h3"
            fontWeight="bold"
            sx={{ ...theme.typography.uiHeadingLandingLg }}
          >
            Built for{' '}
            <Box
              component="span"
              sx={{
                color: BRAND.main,
              }}
            >
              Everyone.
            </Box>
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1.5, maxWidth: 480, mx: 'auto', opacity: 0.7 }}
          >
            Everything you need to explore, query, and visualize your databases — without writing a
            single line of SQL.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
            },
            gap: 2.5,
          }}
        >
          {values.map((v, i) => (
            <Box
              key={v.title}
              component={motion.div}
              // Animate into view when the card enters the viewport (fixes mount-time animation bug)
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, ease: 'easeOut', delay: i * 0.08 }}
              sx={{
                p: { xs: 3, md: 4 },
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
                    '& .icon-container': {
                      transform: 'scale(1.06)',
                      // Icon container picks up a subtle brand-purple border on
                      // hover — connects the card to the brand color story
                      // without overwhelming the monochrome base.
                      borderColor: alpha(BRAND.main, isDark ? 0.4 : 0.32),
                    },
                    '& .card-number': { opacity: 0.5 },
                  },
                },
              }}
            >
              <Typography
                className="card-number"
                sx={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  fontFamily: theme.typography.fontFamilyMono || 'monospace',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: 0,
                  color: 'text.secondary',
                  opacity: 0.2,
                  transition: theme.transitions.create('opacity', {
                    duration: 250,
                  }),
                  userSelect: 'none',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </Typography>

              <Stack spacing={2} alignItems="flex-start">
                <Box
                  className="icon-container"
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    backgroundColor: isDark
                      ? alpha(theme.palette.text.primary, 0.09)
                      : alpha(theme.palette.text.primary, 0.055),
                    border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.16 : 0.1)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: theme.transitions.create('transform', {
                      duration: 250,
                    }),
                    boxShadow: isDark
                      ? `inset 0 1px 0 ${alpha(theme.palette.text.primary, 0.1)}`
                      : `inset 0 1px 0 ${alpha(theme.palette.common.white, 0.85)}`,
                  }}
                >
                  <v.Icon sx={{ fontSize: 22, color: 'text.primary' }} />
                </Box>

                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ mb: 0.75, ...theme.typography.uiCardTitle }}
                  >
                    {v.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ ...theme.typography.uiCardBody, opacity: 0.75 }}
                  >
                    {v.desc}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Box>
      </Container>
    </Section>
  );
}

export default ValueGrid;
