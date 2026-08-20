import { Box, Container, Typography } from '@mui/material';
import { LandingSection, Reveal } from './LandingSection';
import { DATABASES } from './landingContent';

export default function DatabaseStrip() {
  return (
    <LandingSection sx={{ py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        <Reveal>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: 'minmax(220px, 0.7fr) minmax(0, 1.3fr)',
              },
              alignItems: 'end',
              gap: { xs: 1.5, md: 5 },
            }}
          >
            <Typography
              component="h2"
              sx={(theme) => ({ ...theme.typography.captionMono, color: 'text.primary' })}
            >
              Supported database connections
            </Typography>
            <Typography sx={(theme) => ({ ...theme.typography.bodySm, color: 'text.secondary' })}>
              Configure PostgreSQL, MySQL, SQL Server, or Oracle as the source for schema context
              and database reads.
            </Typography>
          </Box>

          <Box
            component="ul"
            role="list"
            aria-label="Supported database connections"
            data-database-layout="compatibility-rail"
            data-mobile-topology="two-by-two"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))',
              },
              m: 0,
              mt: 3.5,
              p: 0,
              listStyle: 'none',
              borderTop: '1px solid',
              borderBottom: '1px solid',
              borderColor: 'border.subtle',
            }}
          >
            {DATABASES.map((database, index) => (
              <Box
                key={database.name}
                component="li"
                data-database-engine={database.name}
                sx={{
                  minWidth: 0,
                  minHeight: { xs: 84, md: 96 },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: { xs: 1, md: 1.5 },
                  px: { xs: 1, md: 2 },
                  borderTop: { xs: index >= 2 ? '1px solid' : 0, md: 0 },
                  borderLeft: {
                    xs: index % 2 === 1 ? '1px solid' : 0,
                    md: index > 0 ? '1px solid' : 0,
                  },
                  borderColor: 'border.subtle',
                }}
              >
                <Box
                  component="img"
                  src={database.logo}
                  alt=""
                  sx={{
                    width: { xs: 26, md: 30 },
                    height: { xs: 26, md: 30 },
                    objectFit: 'contain',
                  }}
                />
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.captionMonoSm,
                    minWidth: 0,
                    color: 'text.secondary',
                    textAlign: 'center',
                  })}
                >
                  {database.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </Reveal>
      </Container>
    </LandingSection>
  );
}
