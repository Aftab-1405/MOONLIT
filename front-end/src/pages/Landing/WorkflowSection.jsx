import { Box, Container, Typography } from '@mui/material';
import { LandingSection, Reveal, SectionHeading } from './LandingSection';
import { WORKFLOW_STEPS } from './landingContent';

export default function WorkflowSection() {
  return (
    <LandingSection id="workflow">
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="Workflow"
          title="Connect once. Keep the whole investigation together."
        />

        <Reveal sx={{ mt: { xs: 5, md: 8 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              border: '1px solid',
              borderColor: 'border.subtle',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {WORKFLOW_STEPS.map((step, index) => (
              <Box
                key={step.number}
                component="article"
                sx={{
                  minWidth: 0,
                  p: { xs: 3, md: 4 },
                  borderRight: {
                    xs: 0,
                    md: index < WORKFLOW_STEPS.length - 1 ? '1px solid' : 0,
                  },
                  borderBottom: {
                    xs: index < WORKFLOW_STEPS.length - 1 ? '1px solid' : 0,
                    md: 0,
                  },
                  borderColor: 'border.subtle',
                }}
              >
                <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, color: 'text.disabled' })}>
                  {step.number}
                </Typography>
                <Typography component="h3" sx={(theme) => ({ ...theme.typography.displaySm, mt: 5 })}>
                  {step.title}
                </Typography>
                <Typography sx={(theme) => ({ ...theme.typography.bodyMd, mt: 2, color: 'text.secondary' })}>
                  {step.description}
                </Typography>
              </Box>
            ))}
          </Box>
        </Reveal>
      </Container>
    </LandingSection>
  );
}
