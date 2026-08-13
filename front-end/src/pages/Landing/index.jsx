import { Box, Button, Container, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseIcon, MenuIcon } from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import CapabilityGrid from '@/pages/Landing/CapabilityGrid';
import DatabaseStrip from '@/pages/Landing/DatabaseStrip';
import FaqSection from '@/pages/Landing/FaqSection';
import FinalCTA from '@/pages/Landing/FinalCTA';
import Hero from '@/pages/Landing/Hero';
import ProductShowcase from '@/pages/Landing/ProductShowcase';
import SecuritySection from '@/pages/Landing/SecuritySection';
import WorkflowSection from '@/pages/Landing/WorkflowSection';
import { getLandingDestination, NAV_LINKS } from '@/pages/Landing/landingContent';
import { REDUCED_MOTION_QUERY } from '@/styles/mediaQueries';

const navLinkSx = (theme) => ({
  minHeight: 36,
  px: 1.5,
  color: theme.palette.common.white,
  borderColor: 'transparent',
  '&:hover': {
    borderColor: 'transparent',
    backgroundColor: alpha(theme.palette.common.white, 0.08),
  },
});

function MoonlitBrand({ onClick, color = 'text.primary' }) {
  return (
    <Box
      component="a"
      href="#top"
      onClick={onClick}
      sx={(theme) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        color,
        textDecoration: 'none',
        '&:focus-visible': {
          outline: `2px solid ${theme.palette.border.focus}`,
          outlineOffset: 2,
        },
      })}
    >
      <Box component="img" src="/moonlit.svg" alt="" sx={{ width: 32, height: 32 }} />
      <Typography component="span" sx={(theme) => theme.typography.uiBrandWordmark}>
        Moonlit
      </Typography>
    </Box>
  );
}

function LandingNav({ onGetStarted }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);
  const handleMobileSignIn = () => {
    closeMobile();
    navigate('/auth');
  };
  const handleMobileGetStarted = () => {
    closeMobile();
    onGetStarted();
  };

  return (
    <>
      <Box
        component="header"
        sx={(theme) => ({
          position: 'sticky',
          top: 0,
          zIndex: 20,
          backgroundColor: alpha(theme.palette.common.black, 0.84),
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        })}
      >
        <Container
          maxWidth="lg"
          sx={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <MoonlitBrand color="common.white" />

          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
            {NAV_LINKS.map((link) => (
              <Button key={link.href} component="a" href={link.href} variant="text" sx={navLinkSx}>
                {link.label}
              </Button>
            ))}
            <Button
              variant="outlined"
              onClick={() => navigate('/auth')}
              sx={(theme) => ({
                ml: 1,
                color: theme.palette.common.white,
                borderColor: alpha(theme.palette.common.white, 0.5),
                '&:hover': {
                  borderColor: theme.palette.common.white,
                  backgroundColor: alpha(theme.palette.common.white, 0.08),
                },
              })}
            >
              Sign in
            </Button>
            <Button
              variant="contained"
              onClick={onGetStarted}
              sx={(theme) => ({
                ml: 0.5,
                color: theme.palette.common.black,
                backgroundColor: theme.palette.common.white,
                '&:hover': { backgroundColor: alpha(theme.palette.common.white, 0.88) },
              })}
            >
              Get started
            </Button>
          </Stack>

          <IconButton
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            sx={{
              display: { xs: 'inline-flex', md: 'none' },
              width: 44,
              height: 44,
              color: 'common.white',
            }}
          >
            <MenuIcon />
          </IconButton>
        </Container>
      </Box>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={closeMobile}
        slotProps={{
          paper: {
            sx: {
              width: 'min(88vw, 360px)',
              borderRadius: 0,
              borderLeft: '1px solid',
              borderColor: 'border.subtle',
              backgroundColor: 'background.default',
              p: 2,
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <MoonlitBrand onClick={closeMobile} />
          <IconButton aria-label="Close navigation" onClick={closeMobile} sx={{ width: 44, height: 44 }}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Stack spacing={1} alignItems="stretch">
          {NAV_LINKS.map((link) => (
            <Button
              key={link.href}
              component="a"
              href={link.href}
              variant="text"
              onClick={closeMobile}
              sx={{ minHeight: 44, justifyContent: 'flex-start' }}
            >
              {link.label}
            </Button>
          ))}
          <Button variant="outlined" onClick={handleMobileSignIn} sx={{ minHeight: 44 }}>
            Sign in
          </Button>
          <Button variant="contained" onClick={handleMobileGetStarted} sx={{ minHeight: 44 }}>
            Get started
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

function LandingFooter({ onGetStarted }) {
  const navigate = useNavigate();

  return (
    <Box
      component="footer"
      sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 6, md: 8 },
        borderTop: '1px solid',
        borderColor: 'border.subtle',
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 4,
          }}
        >
          <Box>
            <MoonlitBrand />
            <Typography sx={{ mt: 1.5, color: 'text.secondary', maxWidth: 420 }}>
              Ask questions. Inspect SQL. Ship answers.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            {NAV_LINKS.map((link) => (
              <Button key={link.href} component="a" href={link.href} variant="text">
                {link.label}
              </Button>
            ))}
            <Button variant="text" onClick={() => navigate('/auth')}>
              Sign in
            </Button>
            <Button variant="outlined" onClick={onGetStarted}>
              Get started
            </Button>
          </Box>
        </Box>
        <Typography sx={(theme) => ({ ...theme.typography.captionMonoSm, mt: 5, color: 'text.disabled' })}>
          © {new Date().getFullYear()} Moonlit
        </Typography>
      </Container>
    </Box>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    document.title = 'Moonlit - AI Database Assistant';
  }, []);

  const handleGetStarted = useCallback(() => {
    navigate(getLandingDestination({ loading, isAuthenticated }));
  }, [navigate, isAuthenticated, loading]);

  return (
    <Box
      sx={{
        height: '100dvh',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: 'background.default',
        color: 'text.primary',
        scrollBehavior: 'smooth',
        [REDUCED_MOTION_QUERY]: { scrollBehavior: 'auto' },
      }}
    >
      <Box id="top" aria-hidden="true" sx={{ height: 0 }} />
      <LandingNav onGetStarted={handleGetStarted} />
      <Box component="main">
        <Hero onGetStarted={handleGetStarted} />
        <DatabaseStrip />
        <ProductShowcase />
        <CapabilityGrid />
        <WorkflowSection />
        <SecuritySection />
        <FaqSection />
        <FinalCTA onGetStarted={handleGetStarted} />
      </Box>
      <LandingFooter onGetStarted={handleGetStarted} />
    </Box>
  );
}
