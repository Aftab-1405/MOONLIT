import { alpha } from '@mui/material/styles';
import { BRAND } from '@/theme/tokens';

export const TRANSITIONS = {
  default: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
};

const gradientCache = new WeakMap();
const moonlitBrandGradientCache = new WeakMap();

/**
 * Returns the Moonlit brand gradient pair.
 *
 * `static`  — the 3-stop brand gradient (orange → purple → pink).
 *             Used on tab indicators, control surfaces, the sidebar wordmark.
 *
 * `shimmer` — the 4-stop animated gradient (orange → purple → pink → orange).
 *             Used on hero text (welcome name, auth wordmark) where the
 *             gradient slowly cycles left → right.
 *
 * These are the ACTUAL brand colors, not a monochrome substitution. The
 * brand accent is intentionally distinct from the monochrome base palette
 * — it marks identity moments and primary actions.
 *
 * Brand colors do not change between light and dark mode.
 */
export const getMoonlitBrandGradients = (_theme) => {
  // Cache by the BRAND object reference (it's frozen, so identity is stable).
  // We don't need per-theme caching since brand colors are mode-independent.
  if (moonlitBrandGradientCache.has(BRAND)) return moonlitBrandGradientCache.get(BRAND);

  const gradients = Object.freeze({
    static: BRAND.static,
    shimmer: BRAND.shimmer,
  });

  moonlitBrandGradientCache.set(BRAND, gradients);
  return gradients;
};

/**
 * Legacy monochrome gradient — kept for backward compatibility with any
 * callers that haven't migrated to the brand gradient. Prefer
 * `getMoonlitBrandGradients` for identity moments.
 */
export const getMoonlitGradient = (theme) => {
  if (gradientCache.has(theme)) return gradientCache.get(theme);
  const isDark = theme.palette.mode === 'dark';
  const gradient = isDark
    ? `linear-gradient(135deg, ${alpha(theme.palette.text.primary, 0.96)} 8%, ${theme.palette.primary.light} 100%)`
    : `linear-gradient(135deg, ${theme.palette.text.primary} 18%, ${theme.palette.primary.main} 100%)`;
  gradientCache.set(theme, gradient);
  return gradient;
};
