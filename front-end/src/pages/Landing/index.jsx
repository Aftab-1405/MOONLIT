import { Box } from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import DemoSection from '@/pages/Landing/DemoSection';
import FinalCTA from '@/pages/Landing/FinalCTA';
import Hero from '@/pages/Landing/Hero';
import StepsGrid from '@/pages/Landing/StepsGrid';
import ValueGrid from '@/pages/Landing/ValueGrid';
import {
  HOVER_CAPABLE_QUERY as SHARED_HOVER_CAPABLE_QUERY,
  REDUCED_MOTION_QUERY as SHARED_REDUCED_MOTION_QUERY,
} from '@/styles/mediaQueries';

export const REDUCED_MOTION_QUERY = SHARED_REDUCED_MOTION_QUERY;
export const HOVER_CAPABLE_QUERY = SHARED_HOVER_CAPABLE_QUERY;

export const Section = ({ children, sx = {}, id, fullHeight = true, tinted = false }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      id={id}
      component="section"
      sx={{
        width: '100%',
        maxWidth: '100%',
        minHeight: fullHeight ? '100dvh' : 'auto',
        '@supports not (min-height: 100dvh)': {
          minHeight: fullHeight ? '100vh' : 'auto',
        },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        py: { xs: 6, sm: 8, md: 10, lg: 12 },
        px: { xs: 2, sm: 3, md: 4 },
        boxSizing: 'border-box',
        overflowX: 'clip',
        scrollSnapAlign: 'start',
        scrollSnapStop: 'always',
        ...(tinted && {
          backgroundColor: isDark
            ? alpha(theme.palette.text.primary, 0.015)
            : alpha(theme.palette.text.primary, 0.012),
        }),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};


const LANDING_KEYFRAMES = (
  <GlobalStyles
    styles={{
      '@keyframes fadeIn': {
        from: { opacity: 0, transform: 'translateY(10px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
      '@keyframes shimmer': {
        '0%': { backgroundPosition: '-200% center' },
        '100%': { backgroundPosition: '200% center' },
      },
      '@keyframes pulse-dot': {
        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
        '50%': { opacity: 0.4, transform: 'scale(0.85)' },
      },
    }}
  />
);

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    document.title = 'Moonlit - AI Database Assistant';
  }, []);

  const handleGetStarted = useCallback(() => {
    navigate(isAuthenticated ? '/chat' : '/auth');
  }, [navigate, isAuthenticated]);

  return (
    <>
      {LANDING_KEYFRAMES}
      <Box
        sx={{
          height: '100dvh',
          '@supports not (height: 100dvh)': { height: '100vh' },
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: 'transparent',
          scrollBehavior: 'smooth',
          scrollSnapType: { xs: 'y proximity', md: 'y mandatory' },
          position: 'relative',
          [REDUCED_MOTION_QUERY]: {
            scrollBehavior: 'auto',
            scrollSnapType: 'none',
            '& *': { animation: 'none !important', transition: 'none !important' },
          },
        }}
        role="main"
      >
        <Hero onGetStarted={handleGetStarted} />
        <ValueGrid />
        <DemoSection />
        <StepsGrid />
        <FinalCTA onGetStarted={handleGetStarted} />
      </Box>
    </>
  );
}
