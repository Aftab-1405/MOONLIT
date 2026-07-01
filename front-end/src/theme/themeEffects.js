import { alpha } from '@mui/material/styles';

export const TRANSITIONS = {
  default: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
};




const gradientCache = new WeakMap();
const moonlitBrandGradientCache = new WeakMap();

export const getMoonlitBrandGradients = (theme) => {
  if (moonlitBrandGradientCache.has(theme)) return moonlitBrandGradientCache.get(theme);

  const isDark = theme.palette.mode === 'dark';
  const foreground = theme.palette.text.primary;
  const brand = theme.palette.primary.main;
  const brandSoft = theme.palette.primary.light;
  const gradients = Object.freeze({
    static: isDark
      ? `linear-gradient(135deg, ${foreground} 8%, ${brandSoft} 100%)`
      : `linear-gradient(135deg, ${foreground} 18%, ${brand} 100%)`,
    shimmer: `linear-gradient(to right, ${brand}, ${foreground}, ${brand})`,
  });

  moonlitBrandGradientCache.set(theme, gradients);
  return gradients;
};

export const getMoonlitGradient = (theme) => {
  if (gradientCache.has(theme)) return gradientCache.get(theme);
  const isDark = theme.palette.mode === 'dark';
  const gradient = isDark
    ? `linear-gradient(135deg, ${alpha(theme.palette.text.primary, 0.96)} 8%, ${theme.palette.primary.light} 100%)`
    : `linear-gradient(135deg, ${theme.palette.text.primary} 18%, ${theme.palette.primary.main} 100%)`;
  gradientCache.set(theme, gradient);
  return gradient;
};
