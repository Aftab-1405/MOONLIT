import { darkComponentTokens } from './tokens/component.js';

/**
 * Compatibility view for the existing centralized MUI component overrides.
 * Every value below is semantic; raw values remain isolated in primitives.js.
 */
export const DARK = darkComponentTokens;

/** Moonlit font stacks. */
export const FONTS = Object.freeze({
  mono: '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
  sans: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
});

export const SHAPE = Object.freeze({
  borderRadius: 8,
  radius: Object.freeze({ sm: 8, md: 8, lg: 8, xl: 8, pill: 9999, full: 9999 }),
});

export const SWITCH_GEOMETRY = Object.freeze({
  width: 36,
  height: 20,
  thumb: 16,
  inset: 2,
  travel: 16,
});

export const BREAKPOINTS = Object.freeze({
  values: Object.freeze({ xs: 0, sm: 600, md: 768, lg: 1200, xl: 1536 }),
});
