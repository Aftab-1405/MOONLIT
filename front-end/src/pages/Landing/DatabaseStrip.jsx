import { Box, Container, Typography } from '@mui/material';
import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';
import { LandingSection, Reveal } from './LandingSection';
import { DATABASES } from './landingContent';

function DatabaseGroup({ hidden = false, sx = {} }) {
  return (
    <Box
      component="ul"
      aria-hidden={hidden || undefined}
      sx={{
        display: 'flex',
        flex: '0 0 auto',
        gap: { xs: 2, sm: 3 },
        m: 0,
        px: { xs: 1, sm: 1.5 },
        py: 0,
        listStyle: 'none',
        ...sx,
      }}
    >
      {DATABASES.map((database) => (
        <Box
          key={database.name}
          component="li"
          sx={{
            display: 'flex',
            flex: '0 0 auto',
            alignItems: 'center',
            gap: 1.25,
            minWidth: { xs: 156, sm: 184 },
            px: { xs: 2, sm: 2.5 },
            py: 1.5,
            border: '1px solid',
            borderColor: 'border.subtle',
            borderRadius: 2,
            bgcolor: 'background.paper',
          }}
        >
          <Box component="img" src={database.logo} alt={hidden ? '' : database.name} sx={{ width: 28, height: 28, objectFit: 'contain' }} />
          <Typography aria-hidden="true" sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.secondary', whiteSpace: 'nowrap' })}>
            {database.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function DatabaseStrip() {
  return (
    <LandingSection sx={{ py: { xs: 6, md: 8 }, overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <Reveal>
          <Typography component="h2" sx={(theme) => ({ ...theme.typography.captionMono, color: 'text.secondary', textAlign: 'center' })}>
            Works with the databases you already use
          </Typography>
          <Box sx={{ width: '100%', minWidth: 0, mt: 3.5, overflow: 'hidden' }}>
            <Box
              sx={{
                display: 'flex',
                width: 'max-content',
                maxWidth: 'none',
                animation: 'databaseMarquee 24s linear infinite',
                willChange: 'transform',
                '@keyframes databaseMarquee': {
                  from: { transform: 'translate3d(0, 0, 0)' },
                  to: { transform: 'translate3d(-50%, 0, 0)' },
                },
                [REDUCED_MOTION_QUERY]: {
                  animation: 'none',
                  display: 'block',
                  transform: 'none',
                  width: '100%',
                },
              }}
            >
              <DatabaseGroup
                sx={{
                  [REDUCED_MOTION_QUERY]: {
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
                    width: '100%',
                    gap: 2,
                    px: 0,
                    '& > li': {
                      minWidth: 0,
                      width: '100%',
                      px: { xs: 1.25, sm: 2 },
                    },
                  },
                }}
              />
              <DatabaseGroup hidden sx={{ [REDUCED_MOTION_QUERY]: { display: 'none' } }} />
            </Box>
          </Box>
        </Reveal>
      </Container>
    </LandingSection>
  );
}
