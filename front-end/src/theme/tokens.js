/**
 * Moonlit design tokens
 *
 * Brand palette: Moonlit Volt.
 * Monochrome surfaces carry the product; chartreuse marks identity and intent.
 *
 * Token scale convention:
 *   000 = most prominent / foreground
 *   200 = mid-weight
 *   400 = subtle / muted
 *   500 = near-invisible
 */

/** Converts HSL components (h: 0-360, s: 0-100, l: 0-100) to a hex color string. */
const hslToHex = (h, s, l) => {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/** Pre-computed hex values — light theme */
export const LIGHT = {
  // Backgrounds (lighter → darker)
  bg000: '#faf9f7', // app canvas
  bg100: '#f5f4f1', // panel plane
  bg200: '#f1f0ed', // sunken / input
  bg300: '#e9e7e2', // hover bg
  bg400: '#dbd8d1', // strongest neutral surface

  // Text (prominent → muted)
  text000: '#0f0f0f', // Cod Gray — primary
  text200: '#2f2f2f', // secondary
  text400: '#626262', // muted / hint

  // Brand — Monochrome base
  brand000: '#0f0f0f', // Cod Gray
  brand200: '#2f2f2f', // secondary
  brandDark: '#000000', // darkest shade
  brandGlow: '#626262', // muted

  // Accent — neutral support tone only
  accent000: '#242424',
  accentLight: '#4a4a4a',
  accentDark: '#000000',

  // Semantic info remains blue
  info000: hslToHex(210, 73.7, 40.2),
  infoLight: hslToHex(210, 73.7, 52),
  infoDark: hslToHex(210, 73.7, 28),

  // Semantic
  danger000: '#dc2626',
  dangerLight: '#ef4444',
  dangerDark: '#991b1b',
  success000: '#3d9a0e', // unified with brand
  successLight: '#57c218',
  successDark: '#2a6d09',
  warning000: '#b45309',
  warningLight: '#f59e0b',
  warningDark: '#92400e',

  // Border base (to be used with alpha in practice)
  border200: '#0f0f0f',
};

/** Pre-computed hex values — dark theme */
export const DARK = {
  // Backgrounds (lighter → darker)
  bg000: '#101010', // app canvas
  bg100: '#121212', // panel plane
  bg200: '#0d0d0d', // sunken / input
  bg300: '#181818', // hover bg
  bg400: '#222222', // strongest neutral surface

  // Text (prominent → muted)
  text000: '#f8f8f8', // Alabaster — primary
  text200: '#d8d8d8', // secondary
  text400: '#9a9a9a', // muted / hint

  // Brand — Monochrome base
  brand000: '#f8f8f8', // Alabaster
  brand200: '#d8d8d8', // secondary
  brandDark: '#ffffff', // pure white
  brandGlow: '#9a9a9a', // muted

  // Accent — neutral support tone only
  accent000: '#e8e8e8',
  accentLight: '#ffffff',
  accentDark: '#b8b8b8',

  // Semantic info remains blue
  info000: hslToHex(210, 65.5, 67.1),
  infoLight: hslToHex(210, 65.5, 76),
  infoDark: hslToHex(210, 65.5, 52),

  // Semantic
  danger000: hslToHex(0, 98.4, 75.1),
  dangerLight: '#ffaaaa',
  dangerDark: '#dc5f5f',
  success000: '#8cff5a', // unified with brand
  successLight: '#b6ff97',
  successDark: '#65d83d',
  warning000: hslToHex(40, 71, 50),
  warningLight: '#f0c65e',
  warningDark: '#aa7415',

  // Border base (used with alpha in practice)
  border200: '#f8f8f8',
};

/** Moonlit font stacks */
export const FONTS = {
  // JetBrains Mono loaded via Google Fonts in index.html
  mono: '"JetBrains Mono", ui-monospace, "Cascadia Code", "Fira Code", monospace',
  // Merriweather loaded via Google Fonts in index.html
  serif: '"Merriweather", Georgia, "Times New Roman", serif',
  // System sans-serif stack — no custom font loaded
  sans: '"Inter", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

/**
 * Moonlit brand accent color.
 *
 * The brand has ONE accent color: purple (#9c40ff). This is the single
 * color used across the product for identity moments and primary actions.
 *
 * The full orange→purple→pink gradient is reserved for ONE place only:
 * the welcome-screen name (the single identity moment on the empty chat
 * state). Everywhere else, solid purple is used.
 *
 * Design rules:
 *   - Body text, headings, borders, surfaces → monochrome (text.primary)
 *   - Wordmarks → solid text.primary (no color — premium, like Linear/Stripe)
 *   - Primary actions (send button, CTAs, tab indicator) → solid purple
 *   - Active/current states (active conversation, skill node) → solid purple
 *   - Focus rings on primary actions → solid purple at 50-60% alpha
 *   - Semantic states (success/error/warning) → their own palette colors
 *
 * Purple is mode-independent — brand identity doesn't change with theme.
 */
export const BRAND = Object.freeze({
  // The single brand color.
  main: '#9c40ff',
  // Lighter variant — used for solid fills in dark mode where the full
  // purple is too heavy against dark surfaces.
  light: '#b06aff',
  // Darker variant — used for hover states on solid purple fills.
  dark: '#7a1fdf',
  // The full brand gradient (orange → purple → pink). Reserved for the
  // welcome-screen name ONLY. Do not use elsewhere.
  shimmer: 'linear-gradient(to right, #ffaa40, #9c40ff, #ff5a8c, #ffaa40)',
  static: 'linear-gradient(to right, #ffaa40, #9c40ff, #ff5a8c)',
});

/** Shared MUI shape config */
export const SHAPE = {
  borderRadius: 8,
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
};

/** Shared MUI breakpoints */
export const BREAKPOINTS = {
  values: { xs: 0, sm: 600, md: 960, lg: 1200, xl: 1536 },
};
