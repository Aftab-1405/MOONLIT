import { Button, Container, Typography } from '@mui/material';
import { ArrowForwardIcon } from '@/components/icons';
import { LandingSection, Reveal } from './LandingSection';

function FinalCTA({ onGetStarted }) {
  return (
    <LandingSection sx={{ py: { xs: 10, md: 16 } }}>
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Reveal>
          <Typography sx={(theme) => ({ ...theme.typography.captionMono, color: 'text.secondary' })}>
            Start a conversation
          </Typography>
          <Typography component="h2" sx={(theme) => ({ ...theme.typography.displayLg, mt: 2, textWrap: 'balance' })}>
            Start exploring your data.
          </Typography>
          <Typography sx={(theme) => ({ ...theme.typography.bodyLg, mt: 2.5, color: 'text.secondary' })}>
            Connect a database and move from a plain-English question to a result you can inspect.
          </Typography>
          <Button variant="contained" size="large" onClick={onGetStarted} endIcon={<ArrowForwardIcon />} sx={{ mt: 4 }}>
            Get started
          </Button>
          <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, mt: 2, color: 'text.disabled' })}>
            No credit card required
          </Typography>
        </Reveal>
      </Container>
    </LandingSection>
  );
}

export default FinalCTA;
