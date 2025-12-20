import { 
  Box, 
  Typography, 
  Button, 
  Container, 
  Stack, 
  Paper, 
  Grid,
  Avatar,
  Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

// Icons
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

// Full-screen section wrapper
const FullScreenSection = ({ children, sx = {}, ...props }) => (
  <Box
    component="section"
    sx={{
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      scrollSnapAlign: 'start',
      scrollSnapStop: 'always',
      overflow: 'hidden',
      ...sx,
    }}
    {...props}
  >
    {children}
  </Box>
);

// Glassmorphism styles
const glassCard = {
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 4,
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: 'rgba(148, 163, 184, 0.06)',
    border: '1px solid rgba(148, 163, 184, 0.15)',
    transform: 'translateY(-4px)',
  },
};

function Landing() {
  const navigate = useNavigate();

  const valueProps = [
    {
      icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: 28 }} />,
      title: 'AI-Powered Queries',
      description: 'Describe what you need in plain English and get optimized SQL instantly.',
    },
    {
      icon: <ShieldOutlinedIcon sx={{ fontSize: 28 }} />,
      title: 'Completely Secure',
      description: 'Read-only mode. We never store your credentials or query results.',
    },
    {
      icon: <InsightsIcon sx={{ fontSize: 28 }} />,
      title: 'Instant Insights',
      description: 'Auto-generated ER diagrams and beautiful data visualizations.',
    },
  ];

  const steps = [
    { number: '01', title: 'Connect', description: 'Link your MySQL, PostgreSQL, or SQLite database.' },
    { number: '02', title: 'Ask', description: 'Type your question in natural language.' },
    { number: '03', title: 'Get Results', description: 'Receive perfect SQL and instant visualizations.' },
  ];

  const testimonials = [
    { quote: "DB-Genie cut our reporting time by 80%.", author: 'Sarah Chen', role: 'Head of Marketing', avatar: 'SC' },
    { quote: "Like having a senior DBA on call 24/7.", author: 'Marcus Rodriguez', role: 'Founder & CEO', avatar: 'MR' },
    { quote: "Saved us weeks of documentation work.", author: 'Priya Patel', role: 'Data Engineer', avatar: 'PP' },
  ];

  return (
    <Box
      sx={{
        backgroundColor: 'background.default',
        height: '100vh',
        overflowY: 'scroll',
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth',
        '&::-webkit-scrollbar': { width: 0 },
      }}
    >
      {/* ===== SECTION 1: HERO ===== */}
      <FullScreenSection>
        {/* Background Effects */}
        <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(6, 182, 212, 0.15), transparent)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: '-30%', right: '-20%', width: 600, height: 600, background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Stack spacing={4} alignItems="center">
            {/* Brand Logo at TOP */}
            <Box
              component="img"
              src="/brand-logo.png"
              alt="DB-Genie"
              sx={{
                width: { xs: 80, md: 100 },
                height: 'auto',
                filter: 'drop-shadow(0 20px 40px rgba(6, 182, 212, 0.3))',
                animation: 'float 3s ease-in-out infinite',
                '@keyframes float': {
                  '0%, 100%': { transform: 'translateY(0)' },
                  '50%': { transform: 'translateY(-8px)' },
                },
              }}
            />

            {/* Headline */}
            <Typography
              component="h1"
              variant="h1"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.03em',
              }}
            >
              Query Your Database{' '}
              <Box
                component="span"
                sx={{
                  display: 'block',
                  background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Using Plain English
              </Box>
            </Typography>

            {/* Subtitle */}
            <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 500 }}>
              Stop wrestling with SQL. Let AI generate perfect queries and beautiful visualizations.
            </Typography>

            {/* CTA Buttons */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => navigate('/auth')}
                sx={{
                  px: 5,
                  py: 1.75,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 0 40px rgba(16, 185, 129, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                    boxShadow: '0 0 60px rgba(16, 185, 129, 0.5)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                Get Started Free
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<PlayCircleOutlinedIcon />}
                sx={{
                  px: 5,
                  py: 1.75,
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  '&:hover': { borderColor: 'secondary.main', backgroundColor: 'rgba(6, 182, 212, 0.1)' },
                }}
              >
                Watch Demo
              </Button>
            </Stack>

            {/* Stats */}
            <Stack direction="row" spacing={6} sx={{ pt: 3 }}>
              {[
                { value: '10K+', label: 'Queries' },
                { value: '500+', label: 'Users' },
                { value: '99.9%', label: 'Uptime' },
              ].map((stat) => (
                <Box key={stat.label} textAlign="center">
                  <Typography variant="h5" color="primary.main">{stat.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Container>

        {/* Scroll Indicator */}
        <Box sx={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', animation: 'bounce 2s infinite' }}>
          <ExpandMoreRoundedIcon sx={{ fontSize: 32, color: 'text.secondary', '@keyframes bounce': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(8px)' } } }} />
        </Box>
      </FullScreenSection>

      {/* ===== SECTION 2: VALUE PROPOSITION ===== */}
      <FullScreenSection sx={{ background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.02) 0%, transparent 100%)' }}>
        <Container maxWidth="lg" sx={{ textAlign: 'center' }}>
          <Stack spacing={6} alignItems="center">
            <Box>
              <Typography variant="overline" color="primary.main">
                Why Choose DB-Genie
              </Typography>
              <Typography component="h2" variant="h2" sx={{ mt: 1 }}>
                Database Intelligence, <Box component="span" sx={{ color: 'primary.main' }}>Simplified</Box>
              </Typography>
            </Box>

            <Grid container spacing={4} justifyContent="center">
              {valueProps.map((prop, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Box sx={{ ...glassCard, p: 4, height: '100%', textAlign: 'center' }}>
                    <Box sx={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(20, 184, 166, 0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2, color: 'secondary.main' }}>
                      {prop.icon}
                    </Box>
                    <Typography variant="h6" sx={{ mb: 1 }}>{prop.title}</Typography>
                    <Typography variant="body2" color="text.secondary">{prop.description}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Container>
      </FullScreenSection>

      {/* ===== SECTION 3: HOW IT WORKS ===== */}
      <FullScreenSection>
        <Container maxWidth="lg" sx={{ textAlign: 'center' }}>
          <Stack spacing={6} alignItems="center">
            <Box>
              <Typography variant="overline" color="secondary.main">
                How It Works
              </Typography>
              <Typography component="h2" variant="h2" sx={{ mt: 1 }}>
                Three Simple Steps
              </Typography>
            </Box>

            <Grid container spacing={4} justifyContent="center">
              {steps.map((step, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Box sx={{ ...glassCard, p: 4, height: '100%', textAlign: 'center', position: 'relative' }}>
                    <Typography variant="h1" sx={{ fontWeight: 800, background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.4), rgba(20, 184, 166, 0.25))', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', position: 'absolute', top: 12, right: 20 }}>
                      {step.number}
                    </Typography>
                    <Box sx={{ pt: 2 }}>
                      <Typography variant="h6" sx={{ mb: 1 }}>{step.title}</Typography>
                      <Typography variant="body2" color="text.secondary">{step.description}</Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Container>
      </FullScreenSection>

      {/* ===== SECTION 4: TESTIMONIALS ===== */}
      <FullScreenSection sx={{ background: 'linear-gradient(180deg, transparent 0%, rgba(6, 182, 212, 0.02) 100%)' }}>
        <Container maxWidth="lg" sx={{ textAlign: 'center' }}>
          <Stack spacing={6} alignItems="center">
            <Box>
              <Typography variant="overline" color="primary.main">
                Testimonials
              </Typography>
              <Typography component="h2" variant="h2" sx={{ mt: 1 }}>
                Loved by Data Teams
              </Typography>
            </Box>

            <Grid container spacing={4} justifyContent="center">
              {testimonials.map((t, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Box sx={{ ...glassCard, p: 4, height: '100%', position: 'relative' }}>
                    <FormatQuoteRoundedIcon sx={{ position: 'absolute', top: 16, right: 16, fontSize: 32, color: 'secondary.main', opacity: 0.25 }} />
                    <Typography variant="body1" sx={{ mb: 3, fontStyle: 'italic' }}>"{t.quote}"</Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Avatar sx={{ bgcolor: 'primary.main' }}>{t.avatar}</Avatar>
                      <Box textAlign="left">
                        <Typography variant="subtitle2">{t.author}</Typography>
                        <Typography variant="caption" color="text.secondary">{t.role}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </Container>
      </FullScreenSection>

      {/* ===== SECTION 5: FINAL CTA ===== */}
      <FullScreenSection>
        <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(6, 182, 212, 0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <Container maxWidth="md" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <Stack spacing={4} alignItems="center">
            <Typography component="h2" variant="h2">
              Ready to Transform Your Workflow?
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 450 }}>
              Join thousands who query smarter, not harder.
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => navigate('/auth')}
              sx={{
                px: 6,
                py: 2,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 0 60px rgba(16, 185, 129, 0.5)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                  boxShadow: '0 0 80px rgba(16, 185, 129, 0.6)',
                  transform: 'translateY(-3px)',
                },
              }}
            >
              Start Free Today
            </Button>
            <Typography variant="body2" color="text.secondary">No credit card required</Typography>
          </Stack>
        </Container>

        {/* Footer */}
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, py: 4, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Container maxWidth="lg">
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={1} alignItems="center">
                <Box component="img" src="/product-logo.png" alt="DB-Genie" sx={{ width: 24, height: 24 }} />
                <Typography variant="subtitle2">DB-Genie</Typography>
              </Stack>
              <Stack direction="row" spacing={3}>
                {['About', 'Docs', 'Privacy', 'Terms'].map((l) => (
                  <Link key={l} href="#" underline="hover" color="text.secondary" variant="body2">{l}</Link>
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary">© {new Date().getFullYear()} ABN Alliance</Typography>
            </Stack>
          </Container>
        </Box>
      </FullScreenSection>
    </Box>
  );
}

export default Landing;
