import { Box, Container, Typography } from '@mui/material';
import { LandingSection, SectionHeading } from './LandingSection';
import { CAPABILITIES } from './landingContent';

const LEDGER_SPANS = ['1 / -1', '1 / 7', '7 / -1', '1 / -1'];

export default function CapabilityGrid() {
  return (
    <LandingSection id="capabilities">
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="Technical ledger"
          title="The inspectable parts of the database conversation."
          description="Review schema context, visible SQL, conversation continuity, and integrated artifacts as distinct parts of one database workflow."
        />

        <Box
          component="ol"
          role="list"
          aria-label="Moonlit capability ledger"
          data-capability-layout="full-paired-full"
          data-mobile-topology="single-column"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(12, minmax(0, 1fr))' },
            m: 0,
            mt: { xs: 5, md: 8 },
            p: 0,
            listStyle: 'none',
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
          }}
        >
          {CAPABILITIES.map((capability, index) => {
            const fullWidth = index === 0 || index === CAPABILITIES.length - 1;

            return (
              <Box
                key={capability.id}
                component="li"
                data-capability-id={capability.id}
                data-ledger-span={fullWidth ? 'full' : 'paired'}
                sx={{
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: { xs: '44px minmax(0, 1fr)', md: '64px minmax(0, 1fr)' },
                  gridColumn: { xs: '1 / -1', md: LEDGER_SPANS[index] },
                  borderTop: '1px solid',
                  borderLeft: { xs: 0, md: index === 2 ? '1px solid' : 0 },
                  borderColor: 'border.subtle',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    pt: { xs: 2.5, md: 3 },
                  }}
                >
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '9999px',
                      backgroundColor: 'text.primary',
                    }}
                  />
                  <Typography
                    sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    minWidth: 0,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      md: fullWidth ? 'minmax(180px, 0.8fr) minmax(0, 1.2fr)' : 'minmax(0, 1fr)',
                    },
                    gap: { xs: 2, md: fullWidth ? 4 : 2 },
                    px: { xs: 0, md: 1 },
                    py: { xs: 2.5, md: 3 },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={(theme) => ({
                        ...theme.typography.captionMonoSm,
                        color: 'text.secondary',
                      })}
                    >
                      {capability.eyebrow}
                    </Typography>
                    <Typography
                      component="h3"
                      sx={(theme) => ({ ...theme.typography.displayXs, mt: 1 })}
                    >
                      {capability.title}
                    </Typography>
                  </Box>
                  <Typography
                    sx={(theme) => ({
                      ...theme.typography.bodyMd,
                      maxWidth: fullWidth ? 560 : 440,
                      color: 'text.secondary',
                    })}
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
