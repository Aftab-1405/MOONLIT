/**
 * Moonlit design tokens
 *
 * Brand palette: strict CRED-inspired monochrome
 *   Cod Gray:  #0f0f0f
 *   Alabaster: #f8f8f8
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
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/** Pre-computed hex values — light theme */
export const LIGHT = {
  // Backgrounds (lighter → darker)
  bg000:      '#f8f8f8',                    // Alabaster — default canvas
  bg100:      '#ffffff',                    // elevated paper
  bg200:      '#eeeeee',                    // sunken / input
  bg300:      '#e4e4e4',                    // hover bg
  bg400:      '#d8d8d8',                    // strongest neutral surface

  // Text (prominent → muted)
  text000:    '#0f0f0f',                    // Cod Gray — primary
  text200:    '#2f2f2f',                    // secondary
  text400:    '#6f6f6f',                    // muted / hint

  // Brand — monochrome, no decorative hue
  brand000:   '#0f0f0f',
  brand200:   '#2f2f2f',
  brandDark:  '#000000',

  // Accent — neutral support tone only
  accent000:  '#242424',
  accentLight:'#4a4a4a',
  accentDark: '#000000',

  // Semantic info remains blue
  info000:    hslToHex(210, 73.7, 40.2),
  infoLight:  hslToHex(210, 73.7, 52),
  infoDark:   hslToHex(210, 73.7, 28),

  // Semantic
  danger000:  hslToHex(0,   58.6, 34.1),   // #8a2424  — error.main
  success000: hslToHex(125, 100,  18),      // #005c08  — success.main
  warning000: hslToHex(45,  91.8, 19),      // #5c4500  — warning.main

  // Border base (to be used with alpha in practice)
  border200:  '#0f0f0f',
};

/** Pre-computed hex values — dark theme */
export const DARK = {
  // Backgrounds (lighter → darker)
  bg000:      '#0f0f0f',                    // Cod Gray — default canvas
  bg100:      '#171717',                    // paper
  bg200:      '#080808',                    // sunken / input
  bg300:      '#000000',                    // near black
  bg400:      hslToHex(0,   0,    0),       // #000000

  // Text (prominent → muted)
  text000:    '#f8f8f8',                    // Alabaster — primary
  text200:    '#d4d4d4',                    // secondary
  text400:    '#8a8a8a',                    // muted / hint

  // Brand — monochrome, inverted against dark canvas
  brand000:   '#f8f8f8',
  brand200:   '#d4d4d4',
  brandDark:  '#b8b8b8',

  // Accent — neutral support tone only
  accent000:  '#e8e8e8',
  accentLight:'#ffffff',
  accentDark: '#b8b8b8',

  // Semantic info remains blue
  info000:    hslToHex(210, 65.5, 67.1),
  infoLight:  hslToHex(210, 65.5, 76),
  infoDark:   hslToHex(210, 65.5, 52),

  // Semantic
  danger000:  hslToHex(0,   98.4, 75.1),   // #fe8181  — error.main
  success000: hslToHex(97,  59.1, 46.1),   // #65bb30  — success.main
  warning000: hslToHex(40,  71,   50),      // #da9e25  — warning.main

  // Border base (used with alpha in practice)
  border200:  '#f8f8f8',
};

/** Moonlit font stacks */
export const FONTS = {
  // JetBrains Mono loaded via Google Fonts in index.html
  mono:  '"JetBrains Mono", ui-monospace, "Cascadia Code", "Fira Code", monospace',
  // Merriweather loaded via Google Fonts in index.html
  serif: '"Merriweather", Georgia, "Times New Roman", serif',
  // System sans-serif stack — no custom font loaded
  sans:  'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

/** Shared MUI shape config */
export const SHAPE = {
  borderRadius: 8,
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
};

/** Shared MUI breakpoints */
export const BREAKPOINTS = {
  values: { xs: 0, sm: 600, md: 960, lg: 1200, xl: 1536 },
};
