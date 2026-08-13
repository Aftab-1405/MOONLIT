import { Box, Container, Typography } from '@mui/material';
import { ServerIcon, TimeIcon, UserIcon, VisibilityOnIcon } from '@/components/icons';
import { LandingSection, Reveal, SectionHeading } from './LandingSection';
import { SECURITY_POINTS } from './landingContent';

const SECURITY_ICONS = {
  auth: UserIcon,
  readonly: VisibilityOnIcon,
  limits: TimeIcon,
  server: ServerIcon,
};

export default function SecuritySection() {
  return (
    <LandingSection id="security">
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="Security"
          title="Designed for controlled access to real data."
        />

        <Reveal sx={{ mt: { xs: 5, md: 8 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {SECURITY_POINTS.map((point) => {
              const Icon = SECURITY_ICONS[point.icon];

              return (
                <Box
                  key={point.title}
                  component="article"
                  sx={{
                    minWidth: 0,
                    p: { xs: 3, md: 4 },
                    border: '1px solid',
                    borderColor: 'border.subtle',
                    borderRadius: '12px',
                    backgroundColor: 'background.paper',
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px solid',
                      borderColor: 'border.subtle',
                      borderRadius: '8px',
                      color: 'identity.accent.twilight',
                      backgroundColor: 'background.sunken',
                    }}
                  >
                    <Icon aria-hidden="true" sx={{ fontSize: 25 }} />
                  </Box>
                  <Typography component="h3" sx={(theme) => ({ ...theme.typography.displayXs, mt: 4 })}>
                    {point.title}
                  </Typography>
                  <Typography sx={(theme) => ({ ...theme.typography.bodyMd, mt: 2, color: 'text.secondary' })}>
                    {point.description}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Reveal>
      </Container>
    </LandingSection>
  );
}
