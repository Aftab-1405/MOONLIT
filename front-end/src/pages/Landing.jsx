// Landing.jsx
import { useEffect, useMemo, useCallback } from 'react';
import {
  Box, Container, Stack, Typography, Button, Grid, Avatar, Link,
  useMediaQuery
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTheme, alpha } from '@mui/material/styles';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShieldIcon from '@mui/icons-material/Shield';
import InsightsIcon from '@mui/icons-material/Insights';
import StarfieldCanvas from '../components/StarfieldCanvas';

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

// ---------- Utility: SnapSection ----------
const SnapSection = ({ children, sx = {} }) => (
  <Box
    component="section"
    sx={{
      minHeight: '100vh',
      width: '100%',
      scrollSnapAlign: 'start',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      px: { xs: 3, md: 0 },
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
    <SnapSection>
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
            <Button aria-label="Watch demo" variant="outlined" size="large" startIcon={<PlayCircleOutlinedIcon />} sx={{ px: 5, borderRadius: 8 }}>
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

      <Box sx={{ position: 'absolute', bottom: 22, animation: 'bounce 2s infinite', '@keyframes bounce': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(8px)' } } }}>
        <ExpandMoreRoundedIcon sx={{ fontSize: 38, opacity: 0.5 }} aria-hidden />
      </Box>
    </SnapSection>
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
    <SnapSection sx={{ background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.info.main, 0.03)} 40%, transparent)` }}>
      <Container maxWidth="lg">
        <Box textAlign="center" mb={6}>
          <Typography variant="overline" color="primary.main" fontWeight="bold">How It Works</Typography>
          <Typography variant="h3" fontWeight="bold">Think. Query. <span style={{ color: theme.palette.primary.main }}>Deliver.</span></Typography>
        </Box>
        <Grid container spacing={2} justifyContent="center">
          {values.map((v) => (
            <Grid item xs={12} sm={4} key={v.title}>
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
            </Grid>
          ))}
        </Grid>
      </Container>
    </SnapSection>
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
    <SnapSection>
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
    </SnapSection>
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
    <SnapSection sx={{ background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.success.main, 0.02)} 40%, transparent)` }}>
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
    </SnapSection>
  );
}

function Testimonials() {
  const theme = useTheme();
  const tests = useMemo(() => ([
    { quote: "I just describe what I need and it figures out the joins. No more guessing table relationships.", author: 'Alex Thompson', role: 'Backend Developer', avatar: 'AT' },
    { quote: "Finally I can query our production data without bothering the DBA team. And it's read-only so nothing breaks.", author: 'Priya Sharma', role: 'Product Manager', avatar: 'PS' },
    { quote: "The schema analysis is solid. It understands foreign keys and suggests the right columns.", author: 'Marcus Chen', role: 'Data Analyst', avatar: 'MC' },
  ]), []);
  return (
    <SnapSection sx={{ background: `linear-gradient(180deg, transparent, ${alpha(theme.palette.info.main, 0.03)} 40%, transparent)` }}>
      <Container maxWidth="lg">
        <Box textAlign="center" mb={6}>
          <Typography variant="overline" color="primary.main" fontWeight="bold">What Users Say</Typography>
          <Typography variant="h3" fontWeight="bold">Built for Real Workflows</Typography>
        </Box>
        <Grid container spacing={3} justifyContent="center">
          {tests.map((t) => (
            <Grid item xs={12} md={4} key={t.author}>
              <Box sx={{ ...glassCard(theme), p: 4.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box>
                  <Typography
                    variant="body1"
                    sx={{
                      mb: 3,
                      fontStyle: 'italic',
                      lineHeight: 1.7,
                      color: 'text.primary',
                    }}
                  >
                    {t.quote}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 'auto' }}>
                  <Avatar
                    sx={{
                      bgcolor: 'primary.main',
                      fontWeight: 600,
                      width: 44,
                      height: 44,
                      fontSize: '0.875rem',
                    }}
                  >
                    {t.avatar}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: 'text.primary' }}>
                      {t.author}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      {t.role}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>
    </SnapSection>
  );
}

function FinalCTA({ onGetStarted }) {
  const theme = useTheme();
  return (
    <SnapSection sx={{ flexDirection: 'column', justifyContent: 'space-between' }}>
      <Box />
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Stack spacing={3} alignItems="center">
          <Typography variant="h2" fontWeight="bold">Stop Writing SQL. Start Asking Questions.</Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 480 }}>Connect your database. Describe what you need. Let the AI agent handle the rest.</Typography>
          <Button variant="contained" size="large" onClick={onGetStarted} sx={{ px: 6, py: 1.75, borderRadius: 8 }}>Try It Now</Button>
          <Typography variant="caption" color="text.secondary">Free to use \u2022 No signup required for demo</Typography>
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
    </SnapSection>
  );
}

// ---------- Main Landing ----------
export default function Landing() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => { document.title = 'DB-Genie - AI Database Assistant'; }, []);

  const handleGetStarted = useCallback(() => navigate('/auth'), [navigate]);

  return (
    <Box
      sx={{
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollSnapType: isMobile ? 'none' : 'y mandatory',
        backgroundColor: 'background.default',
        scrollBehavior: 'smooth',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
      role="main"
    >
      {/* Fixed background */}
      <Box sx={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <StarfieldCanvas active />
      </Box>

      <Hero onGetStarted={handleGetStarted} />
      <ValueGrid />
      <StepsGrid />
      <SupportedDatabases />
      <Testimonials />
      <FinalCTA onGetStarted={handleGetStarted} />
    </Box>
  );
}
