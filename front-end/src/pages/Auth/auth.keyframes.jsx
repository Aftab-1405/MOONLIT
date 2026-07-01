/**
 * Auth page keyframe animations.
 * Exported as a JSX constant so they can be rendered once at the page root
 * without being co-located with either the form logic or the decorative mockup.
 */

import GlobalStyles from '@mui/material/GlobalStyles';

// eslint-disable-next-line react-refresh/only-export-components -- Module-level JSX constant, not a component
export const AUTH_KEYFRAMES = (
  <GlobalStyles
    styles={{
      '@keyframes authSlideIn': {
        from: { opacity: 0, transform: 'translateX(20px)' },
        to: { opacity: 1, transform: 'translateX(0)' },
      },
      '@keyframes authFadeUp': {
        from: { opacity: 0, transform: 'translateY(10px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
      '@keyframes mockupReveal': {
        '0%, 55%': { opacity: 0, transform: 'translateY(8px)' },
        '75%, 100%': { opacity: 1, transform: 'translateY(0)' },
      },
      '@keyframes pulse-dot': {
        '0%, 100%': { opacity: 1, transform: 'scale(1)' },
        '50%': { opacity: 0.3, transform: 'scale(0.8)' },
      },
      // Honour the OS motion preference — collapse all auth animations to instant.
      '@media (prefers-reduced-motion: reduce)': {
        '[data-auth-page] *, [data-auth-page] *::before, [data-auth-page] *::after': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
        },
      },
    }}
  />
);
