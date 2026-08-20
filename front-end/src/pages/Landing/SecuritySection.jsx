import { Box, Container, Typography } from '@mui/material';
import { LandingSection, SectionHeading } from './LandingSection';
import { TRUST_PATH } from './landingContent';

export default function SecuritySection() {
  return (
    <LandingSection id="security">
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(240px, 0.7fr) minmax(0, 1.3fr)',
            },
            gap: { xs: 5, md: 8 },
            alignItems: 'start',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <SectionHeading
              eyebrow="Control path"
              title="From authenticated access to an inspectable result."
              description="A factual view of the application path around a database read."
            />
            <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid', borderColor: 'border.subtle' }}>
              <Typography
                sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
              >
                06 stages · one configured connection
              </Typography>
              <Typography
                sx={(theme) => ({ ...theme.typography.bodySm, mt: 1, color: 'text.secondary' })}
              >
                Read-only validation, row limits, and timeouts sit on the execution path before rows
                return.
              </Typography>
            </Box>
          </Box>

          <Box
            component="ol"
            role="list"
            aria-label="Database read control path"
            data-control-flow="authenticated-user>configured-connection>schema-context>readonly-validation>bounded-execution>result"
            data-control-stage-count={TRUST_PATH.length}
            data-mobile-topology="single-column"
            sx={{
              m: 0,
              p: 0,
              listStyle: 'none',
              borderTop: '1px solid',
              borderColor: 'border.subtle',
            }}
          >
            {TRUST_PATH.map((stage, index) => (
              <Box
                key={stage.id}
                component="li"
                data-control-stage={stage.id}
                data-control-index={index}
                sx={{
                  minWidth: 0,
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '40px minmax(0, 1fr)',
                    md: '48px minmax(160px, 0.72fr) minmax(0, 1.28fr)',
                  },
                  borderBottom: '1px solid',
                  borderColor: 'border.subtle',
                }}
              >
                <Box
                  aria-hidden="true"
                  data-control-marker="full-stage"
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    gridRow: { xs: '1 / span 2', md: 'auto' },
                    justifyContent: 'center',
                    pt: 3,
                    '&::before': {
                      content: '""',
                      position: 'relative',
                      zIndex: 1,
                      width: 8,
                      height: 8,
                      border: '1px solid',
                      borderColor:
                        index === TRUST_PATH.length - 1 ? 'text.primary' : 'text.secondary',
                      borderRadius: '9999px',
                      backgroundColor:
                        index === TRUST_PATH.length - 1 ? 'text.primary' : 'background.default',
                    },
                    '&::after':
                      index === TRUST_PATH.length - 1
                        ? undefined
                        : {
                            content: '""',
                            position: 'absolute',
                            top: 34,
                            bottom: -25,
                            left: '50%',
                            width: '1px',
                            backgroundColor: 'border.subtle',
                          },
                  }}
                />

                <Box sx={{ minWidth: 0, py: { xs: 2.5, md: 3 } }}>
                  <Typography
                    sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}
                  >
                    Stage {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <Typography
                    component="h3"
                    sx={(theme) => ({ ...theme.typography.displayXs, mt: 0.75 })}
                  >
                    {stage.label}
                  </Typography>
                </Box>

                <Typography
                  sx={(theme) => ({
                    ...theme.typography.bodySm,
                    gridColumn: { xs: '2', md: '3' },
                    minWidth: 0,
                    mb: { xs: 2.5, md: 0 },
                    py: { md: 3 },
                    pl: { md: 3 },
                    borderLeft: { md: '1px solid' },
                    borderColor: 'border.subtle',
                    color: 'text.secondary',
                  })}
                >
                  {stage.description}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </LandingSection>
  );
}
