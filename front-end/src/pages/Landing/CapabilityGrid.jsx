import { Box, Container, Typography } from '@mui/material';
import { AiContextIcon, ChatIcon, CredentialIcon, DiagramIcon } from '@/components/icons';
import { HOVER_CAPABLE_QUERY, REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';
import { LandingSection, SectionHeading } from './LandingSection';
import { CAPABILITIES } from './landingContent';

const ICONS = {
  ai: AiContextIcon,
  shield: CredentialIcon,
  chat: ChatIcon,
  diagram: DiagramIcon,
};

export default function CapabilityGrid() {
  return (
    <LandingSection id="capabilities">
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="Built for analysis"
          title="One focused workspace for the whole database conversation."
        />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 2,
            mt: { xs: 5, md: 8 },
          }}
        >
          {CAPABILITIES.map((capability, index) => {
            const Icon = ICONS[capability.icon];

            return (
              <Box
                key={capability.id}
                component="article"
                sx={{
                  minHeight: { md: 300 },
                  p: { xs: 3, md: 4 },
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid',
                  borderColor: 'border.subtle',
                  borderRadius: '12px',
                  backgroundColor: 'background.paper',
                  transition: 'transform 180ms ease, border-color 180ms ease',
                  [HOVER_CAPABLE_QUERY]: {
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: 'border.hover',
                    },
                  },
                  [REDUCED_MOTION_QUERY]: {
                    transition: 'none',
                    transform: 'none',
                    '&:hover': { transform: 'none' },
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      border: '1px solid',
                      borderColor: 'border.subtle',
                      borderRadius: '8px',
                      color: `identity.accent.${capability.accent}`,
                      backgroundColor: 'background.sunken',
                    }}
                  >
                    <Icon aria-hidden="true" sx={{ fontSize: 26 }} />
                  </Box>
                  <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}>
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                </Box>

                <Box sx={{ mt: 'auto', pt: 6 }}>
                  <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.secondary' })}>
                    {capability.eyebrow}
                  </Typography>
                  <Typography component="h3" sx={(theme) => ({ ...theme.typography.displaySm, mt: 1.5 })}>
                    {capability.title}
                  </Typography>
                  <Typography
                    sx={(theme) => ({ ...theme.typography.bodyMd, mt: 2, maxWidth: 520, color: 'text.secondary' })}
                  >
                    {capability.description}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Container>
    </LandingSection>
  );
}
