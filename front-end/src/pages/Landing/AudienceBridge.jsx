import { Box, Container, Typography } from '@mui/material';
import { Fragment } from 'react';
import { LandingSection, SectionHeading } from './LandingSection';
import { AUDIENCE_POINTS } from './landingContent';

export default function AudienceBridge() {
  return (
    <LandingSection>
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="A shared database conversation"
          title="Natural-language access meets visible technical control."
          description="The interface broadens how a question begins while preserving the schema, SQL, and returned rows that technical review depends on."
          align="center"
        />

        <Box
          data-audience-layout="access-trace-control"
          data-mobile-topology="stacked"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 72px minmax(0, 1fr)' },
            mt: { xs: 5, md: 8 },
            borderTop: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'border.subtle',
          }}
        >
          {AUDIENCE_POINTS.map((point, index) => (
            <Fragment key={point.id}>
              {index === 1 ? (
                <Box
                  data-audience-trace="access-to-control"
                  aria-hidden="true"
                  sx={{
                    position: 'relative',
                    minHeight: { xs: 56, md: 'auto' },
                    borderTop: { xs: '1px solid', md: 0 },
                    borderBottom: { xs: '1px solid', md: 0 },
                    borderColor: 'border.subtle',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: { xs: '50%', md: 0 },
                      bottom: { md: 0 },
                      left: { xs: 0, md: '50%' },
                      right: { xs: 0, md: 'auto' },
                      width: { md: '1px' },
                      height: { xs: '1px', md: 'auto' },
                      backgroundColor: 'border.subtle',
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      width: 32,
                      height: 32,
                      border: '1px solid',
                      borderColor: 'border.subtle',
                      borderRadius: '9999px',
                      backgroundColor: 'background.default',
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <Typography
                      component="span"
                      sx={(theme) => ({
                        ...theme.typography.captionMonoSm,
                        display: { xs: 'none', md: 'block' },
                        color: 'text.primary',
                      })}
                    >
                      →
                    </Typography>
                    <Typography
                      component="span"
                      sx={(theme) => ({
                        ...theme.typography.captionMonoSm,
                        display: { xs: 'block', md: 'none' },
                        color: 'text.primary',
                      })}
                    >
                      ↓
                    </Typography>
                  </Box>
                </Box>
              ) : null}

              <Box
                component="article"
                data-audience-side={point.id}
                data-audience-index={index}
                sx={{
                  minWidth: 0,
                  py: { xs: 4, md: 6 },
                  pr: { md: index === 0 ? 5 : 0 },
                  pl: { md: index === 1 ? 5 : 0 },
                  textAlign: { xs: 'left', md: index === 0 ? 'right' : 'left' },
                }}
              >
                <Typography
                  sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.secondary' })}
                >
                  {String(index + 1).padStart(2, '0')} / {point.eyebrow}
                </Typography>
                <Typography
                  component="h3"
                  sx={(theme) => ({ ...theme.typography.displaySm, mt: 1.5 })}
                >
                  {point.title}
                </Typography>
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.bodyMd,
                    maxWidth: 480,
                    mt: 2,
                    ml: { md: index === 0 ? 'auto' : 0 },
                    color: 'text.secondary',
                  })}
                >
                  {point.description}
                </Typography>
              </Box>
            </Fragment>
          ))}
        </Box>
      </Container>
    </LandingSection>
  );
}
