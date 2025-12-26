// Landing.jsx
import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import {
  Box, Container, Stack, Typography, Button, Grid, Avatar, Link
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTheme, alpha } from '@mui/material/styles';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShieldIcon from '@mui/icons-material/Shield';
import InsightsIcon from '@mui/icons-material/Insights';
import StarfieldCanvas from '../components/StarfieldCanvas';

// ---------- Scroll Animation Hook ----------
function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.unobserve(element); // Only animate once
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px', ...options }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, isInView };
}

// ---------- Fade-in Animation Wrapper ----------
const FadeInSection = ({ children, delay = 0, direction = 'up' }) => {
  const { ref, isInView } = useInView();
  
  const transforms = {
    up: 'translateY(30px)',
    down: 'translateY(-30px)',
    left: 'translateX(30px)',
    right: 'translateX(-30px)',
    none: 'none',
  };

  return (
    <Box
      ref={ref}
      sx={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'none' : transforms[direction],
        transition: `opacity 0.6s ease-out ${delay}s, transform 0.6s ease-out ${delay}s`,
      }}
    >
      {children}
    </Box>
  );
};

// ---------- Shared styles ----------
const glassCard = (theme) => ({
  background: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.05 : 0.85),
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.08 : 0.12)}`,
  borderRadius: 3,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: theme.palette.mode === 'dark'
    ? `0 4px 20px ${alpha(theme.palette.common.black, 0.2)}`
    : `0 4px 20px ${alpha(theme.palette.common.black, 0.06)}`,
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: theme.palette.mode === 'dark'
      ? `0 8px 32px ${alpha(theme.palette.common.black, 0.3)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.1)}`
      : `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`,
    border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.3)}`,
  },
});

// ---------- Utility: Section ----------
const Section = ({ children, sx = {}, id, fullHeight = false }) => (
  <Box
    id={id}
    component="section"
    sx={{
      minHeight: fullHeight ? '100vh' : 'auto',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'visible',
      py: fullHeight ? 0 : { xs: 10, md: 14 },
      px: { xs: 2, md: 0 },
      ...sx,
    }}
  >
    {children}
  </Box>
);

// ---------- Subsections ----------
function Hero({ onGetStarted }) {
  const theme = useTheme();
  return (
    <Section fullHeight>
      <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${alpha(theme.palette.info.main, 0.12)}, transparent)`, pointerEvents: 'none' }} />
      <Container maxWidth="md" sx={{ zIndex: 2, textAlign: 'center' }}>
        <Stack spacing={4} alignItems="center">
          <Box component="img" src="/brand-logo.png" alt="DB-Genie logo" sx={{ width: { xs: 72, md: 100 }, animation: 'float 4s ease-in-out infinite', '@keyframes float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } } }} />
          <Typography component="h1" variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '2rem', md: '3.75rem' } }}>
            Your AI Database Agent
            <br />
            <Box component="span" sx={{ background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.primary.main})`, backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              That Thinks and Acts
            </Box>
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 560 }}>
            A web-based agentic AI that understands your questions, reasons through your schema, writes SQL, executes queries, and delivers results — all in one conversation.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button aria-label="Get started" variant="contained" size="large" onClick={onGetStarted} endIcon={<ArrowForwardRoundedIcon />} sx={{ px: 5, borderRadius: 8 }}>
              Get Started Free
            </Button>
            <Button 
              aria-label="Watch demo" 
              variant="outlined" 
              size="large" 
              startIcon={<PlayCircleOutlinedIcon />} 
              onClick={() => document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })}
              sx={{ px: 5, borderRadius: 8 }}
            >
              Watch Demo
            </Button>
          </Stack>
          <Stack direction="row" spacing={6} sx={{ pt: 3 }}>
            {[
              { value: '5', label: 'Databases' },
              { value: '20+', label: 'Cloud Providers' },
              { value: 'Read-Only', label: 'Safe Mode' },
            ].map((s) => (
              <Box key={s.label} textAlign="center">
                <Typography variant="h5" color="primary.main" fontWeight="bold">{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Section>
  );
}

function ValueGrid() {
  const theme = useTheme();
  const values = useMemo(() => [
    { Icon: AutoAwesomeIcon, title: 'Agentic Reasoning', desc: 'The AI analyzes your schema, understands relationships, and plans multi-step queries autonomously.', color: theme.palette.primary.main },
    { Icon: ShieldIcon, title: 'Read-Only Execution', desc: 'Queries run in your browser session. No data stored. Dangerous operations blocked at 3 layers.', color: theme.palette.success.main },
    { Icon: InsightsIcon, title: 'Live Results', desc: 'See SQL, run it instantly, view formatted tables \u2014 or ask for ER diagrams and charts.', color: theme.palette.info.main },
  ], [theme.palette]);

  return (
    <Section sx={{ background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.info.main, 0.03)} 40%, transparent)` }}>
      <Container maxWidth="lg">
        <FadeInSection>
          <Box textAlign="center" mb={6}>
            <Typography variant="overline" color="primary.main" fontWeight="bold">How It Works</Typography>
            <Typography variant="h3" fontWeight="bold">Think. Query. <span style={{ color: theme.palette.primary.main }}>Deliver.</span></Typography>
          </Box>
        </FadeInSection>
        <Grid container spacing={2} justifyContent="center">
          {values.map((v, i) => (
            <Grid item xs={12} sm={4} key={v.title}>
              <FadeInSection delay={i * 0.1}>
                <Box sx={{ ...glassCard(theme), p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${alpha(v.color, 0.25)}, ${alpha(v.color, 0.15)})`,
                      border: `2px solid ${alpha(v.color, 0.3)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                      transition: 'transform 0.3s ease',
                      '&:hover': {
                        transform: 'scale(1.1) rotate(5deg)',
                        background: `linear-gradient(135deg, ${alpha(v.color, 0.35)}, ${alpha(v.color, 0.25)})`,
                        border: `2px solid ${alpha(v.color, 0.5)}`,
                      },
                    }}
                  >
                    <v.Icon sx={{ fontSize: 24, color: v.color }} aria-hidden />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, color: 'text.primary' }}>
                    {v.title}
                  </Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ lineHeight: 1.6, fontSize: '0.8rem' }}>
                    {v.desc}
                  </Typography>
                </Box>
              </FadeInSection>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}

function DemoSection() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  return (
    <Section id="demo-section" sx={{ background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.primary.main, 0.02)} 50%, transparent)` }}>
      <Container maxWidth="lg">
        <FadeInSection>
          <Box textAlign="center" mb={3}>
            <Typography variant="overline" color="secondary.main" fontWeight="bold">See It In Action</Typography>
            <Typography variant="h4" fontWeight="bold">
              From Question to <span style={{ color: theme.palette.secondary.main }}>Answer</span>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 450, mx: 'auto' }}>
              Watch how DB-Genie transforms natural language into SQL and returns live results.
            </Typography>
          </Box>
        </FadeInSection>
        
        {/* Video Container with Browser Chrome */}
        <FadeInSection delay={0.2}>
          <Box
            sx={{
              position: 'relative',
              maxWidth: { xs: '100%', sm: 650, md: 750 },
              mx: 'auto',
            }}
        >
          {/* Browser chrome effect */}
          <Box
            sx={{
              borderRadius: '12px 12px 0 0',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
              borderBottom: 'none',
              px: 2,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#FF5F56' }} />
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#FFBD2E' }} />
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#27C93F' }} />
            </Box>
            <Box
              sx={{
                flex: 1,
                ml: 2,
                px: 2,
                py: 0.5,
                borderRadius: 1,
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                fontSize: '0.7rem',
                color: 'text.secondary',
              }}
            >
              db-genie.app/chat
            </Box>
          </Box>
          
          {/* Video Player */}
          <Box
            component="video"
            autoPlay
            loop
            muted
            playsInline
            sx={{
              width: '100%',
              display: 'block',
              borderRadius: '0 0 12px 12px',
              border: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
              borderTop: 'none',
              backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5',
            }}
          >
            <source src="/db-genie-demo.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </Box>
          
          {/* Glow effect */}
          <Box
            sx={{
              position: 'absolute',
              inset: -30,
              background: `radial-gradient(ellipse at center, ${alpha(theme.palette.primary.main, 0.12)}, transparent 70%)`,
              pointerEvents: 'none',
              zIndex: -1,
              filter: 'blur(30px)',
            }}
          />
        </Box>
        </FadeInSection>
      </Container>
    </Section>
  );
}

function StepsGrid() {
  const theme = useTheme();
  const steps = useMemo(() => [
    { num: '01', title: 'Connect', desc: 'Securely link MySQL, PostgreSQL, SQL Server, Oracle, or SQLite \u2014 local or cloud.' },
    { num: '02', title: 'Ask', desc: 'Describe what you need. The AI reasons through your schema automatically.' },
    { num: '03', title: 'Execute', desc: 'Review the generated SQL, run it with one click, see results instantly.' },
  ], []);

  return (
    <Section>
      <Container maxWidth="lg">
        <Box textAlign="center" mb={6}>
          <Typography variant="overline" color="secondary.main" fontWeight="bold">Getting Started</Typography>
          <Typography variant="h3" fontWeight="bold">From Question to Answer in Seconds</Typography>
        </Box>
        <Grid container spacing={3} justifyContent="center">
          {steps.map((s) => (
            <Grid item xs={12} md={4} key={s.num}>
              <Box sx={{ ...glassCard(theme), p: 4.5, position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
                <Typography
                  sx={{
                    position: 'absolute',
                    top: 12,
                    left: 16,
                    opacity: theme.palette.mode === 'dark' ? 0.06 : 0.05,
                    fontSize: '3.5rem',
                    fontWeight: 900,
                    lineHeight: 1,
                    color: 'primary.main',
                    pointerEvents: 'none',
                  }}
                >
                  {s.num}
                </Typography>
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{
                      mb: 1.5,
                      color: 'text.primary',
                      fontSize: '1.25rem',
                    }}
                  >
                    {s.title}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    variant="body2"
                    sx={{
                      lineHeight: 1.7,
                    }}
                  >
                    {s.desc}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}

function SupportedDatabases() {
  const theme = useTheme();
  
  const databases = useMemo(() => [
    {
      name: 'MySQL',
      color: '#00758F',
      providers: ['Local', 'PlanetScale', 'TiDB Cloud', 'Aiven', 'AWS RDS', 'Google Cloud SQL'],
    },
    {
      name: 'PostgreSQL',
      color: '#336791',
      providers: ['Local', 'Neon', 'Supabase', 'Railway', 'Render', 'AWS RDS', 'Azure'],
    },
    {
      name: 'SQL Server',
      color: '#CC2927',
      providers: ['Local', 'Azure SQL', 'AWS RDS', 'Google Cloud SQL'],
    },
    {
      name: 'Oracle',
      color: '#F80000',
      providers: ['Local', 'AWS RDS', 'Oracle Cloud*'],
    },
    {
      name: 'SQLite',
      color: '#003B57',
      providers: ['Local File'],
    },
  ], []);

  return (
    <Section sx={{ background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.success.main, 0.02)} 40%, transparent)` }}>
      <Container maxWidth="lg">
        <Box textAlign="center" mb={6}>
          <Typography variant="overline" color="success.main" fontWeight="bold">Universal Compatibility</Typography>
          <Typography variant="h3" fontWeight="bold">
            5 Major Databases, <span style={{ color: theme.palette.success.main }}>One Platform</span>
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 2, maxWidth: 600, mx: 'auto' }}>
            Connect to any major relational database — local or cloud. We support all major providers.
          </Typography>
        </Box>
        
        {/* Infinite Scroll Carousel */}
        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 80,
              zIndex: 2,
              pointerEvents: 'none',
            },
            '&::before': {
              left: 0,
              background: `linear-gradient(to right, ${theme.palette.background.default}, transparent)`,
            },
            '&::after': {
              right: 0,
              background: `linear-gradient(to left, ${theme.palette.background.default}, transparent)`,
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              animation: 'scroll 25s linear infinite',
              '@keyframes scroll': {
                '0%': { transform: 'translateX(0)' },
                '100%': { transform: 'translateX(-50%)' },
              },
              '&:hover': {
                animationPlayState: 'paused',
              },
            }}
          >
            {/* Duplicate items for infinite scroll effect */}
            {[...databases, ...databases].map((db, index) => (
              <Box
                key={`${db.name}-${index}`}
                sx={{
                  ...glassCard(theme),
                  p: 3,
                  minWidth: 280,
                  flexShrink: 0,
                  textAlign: 'center',
                  cursor: 'default',
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${alpha(db.color, 0.2)}, ${alpha(db.color, 0.1)})`,
                    border: `2px solid ${alpha(db.color, 0.3)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: db.color }}>
                    {db.name.slice(0, 2).toUpperCase()}
                  </Typography>
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: 'text.primary' }}>
                  {db.name}
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="center" gap={0.5}>
                  {db.providers.map((provider) => (
                    <Box
                      key={provider}
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        backgroundColor: alpha(db.color, 0.08),
                        border: `1px solid ${alpha(db.color, 0.15)}`,
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        {provider}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>
        
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
          * Oracle Cloud Autonomous DB requires wallet authentication
        </Typography>
      </Container>
    </Section>
  );
}

function FinalCTA({ onGetStarted }) {
  const theme = useTheme();
  return (
    <Section fullHeight sx={{ flexDirection: 'column', justifyContent: 'space-between' }}>
      <Box />
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Stack spacing={3} alignItems="center">
          <Typography variant="h2" fontWeight="bold">Stop Writing SQL. Start Asking Questions.</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 480 }}>Connect your database. Describe what you need. Let the AI agent handle the rest.</Typography>
          <Button variant="contained" size="large" onClick={onGetStarted} sx={{ px: 6, py: 1.75, borderRadius: 8 }}>Try It Now</Button>
          <Typography variant="caption" color="text.secondary">Free to use • No signup required for demo</Typography>
        </Stack>
      </Container>

      <Box component="footer" sx={{ width: '100%', py: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`, background: alpha(theme.palette.background.paper, 0.5), backdropFilter: 'blur(8px)' }}>
        <Container maxWidth="lg">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box component="img" src="/product-logo.png" alt="DB-Genie" sx={{ width: 24, height: 24 }} />
              <Typography variant="subtitle2" fontWeight="bold">DB-Genie</Typography>
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
    </Section>
  );
}

// ---------- Main Landing ----------
export default function Landing() {
  const navigate = useNavigate();
  const theme = useTheme();

  useEffect(() => { document.title = 'DB-Genie - AI Database Assistant'; }, []);

  const handleGetStarted = useCallback(() => navigate('/auth'), [navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        overflowX: 'hidden',
        backgroundColor: 'background.default',
        scrollBehavior: 'smooth',
      }}
      role="main"
    >
      {/* Fixed background */}
      <Box sx={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <StarfieldCanvas active />
      </Box>

      <Hero onGetStarted={handleGetStarted} />
      <ValueGrid />
      <DemoSection />
      <StepsGrid />
      <SupportedDatabases />
      <FinalCTA onGetStarted={handleGetStarted} />
    </Box>
  );
}
