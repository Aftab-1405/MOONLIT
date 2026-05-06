import { alpha } from '@mui/material/styles';
import { BACKDROP_FILTER_FALLBACK_QUERY } from './mediaQueries';

export const TRANSITIONS = {
  default: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  smooth: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  fade: 'opacity 200ms ease-in-out',
  fast: 'all 120ms cubic-bezier(0.4, 0, 0.2, 1)',
  enter: 'all 220ms ease-in',
  exit: 'all 180ms ease-out',
};

export const KEYFRAMES = {
  '@keyframes float': {
    '0%, 100%': { transform: 'translateY(0) scale(1)' },
    '50%': { transform: 'translateY(30px) scale(1.05)' },
  },
  '@keyframes shimmer': {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
  '@keyframes fadeIn': {
    from: { opacity: 0, transform: 'translateY(8px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },
  '@keyframes slideIn': {
    from: { transform: 'translateX(-100%)' },
    to: { transform: 'translateX(0)' },
  },
  '@keyframes slideUp': {
    from: { opacity: 0, transform: 'translateY(20px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
  '@keyframes spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
  '@keyframes scaleIn': {
    from: { opacity: 0, transform: 'scale(0.92)' },
    to: { opacity: 1, transform: 'scale(1)' },
  },
  '@keyframes scaleOut': {
    from: { opacity: 1, transform: 'scale(1)' },
    to: { opacity: 0, transform: 'scale(0.92)' },
  },
};

const gradientCache = new WeakMap();
const moonlitBrandGradientCache = new WeakMap();

export const getMoonlitBrandGradients = (theme) => {
  if (moonlitBrandGradientCache.has(theme)) return moonlitBrandGradientCache.get(theme);

  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.text.primary;
  const secondary = theme.palette.text.secondary;
  const gradients = Object.freeze({
    static: isDark
      ? `linear-gradient(135deg, ${primary}, ${secondary})`
      : `linear-gradient(135deg, ${primary}, ${alpha(primary, 0.82)})`,
    shimmer: isDark
      ? `linear-gradient(to right, ${secondary}, ${primary}, ${secondary})`
      : `linear-gradient(to right, ${primary}, ${alpha(primary, 0.68)}, ${primary})`,
  });

  moonlitBrandGradientCache.set(theme, gradients);
  return gradients;
};

export const getMoonlitGradient = (theme) => {
  if (gradientCache.has(theme)) return gradientCache.get(theme);
  const isDark = theme.palette.mode === 'dark';
  const gradient = isDark
    ? `linear-gradient(135deg, ${alpha(theme.palette.text.primary, 0.94)}, ${alpha(theme.palette.text.secondary, 0.78)})`
    : `linear-gradient(135deg, ${theme.palette.text.primary}, ${alpha(theme.palette.text.primary, 0.72)})`;
  gradientCache.set(theme, gradient);
  return gradient;
};


