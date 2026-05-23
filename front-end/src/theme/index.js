/**
 * Theme module entry point.
 *
 * Exports:
 *   - createDarkTheme / createLightTheme — Moonlit MUI theme factories
 *   - Re-exports of shared style utilities (themeEffects, themeMonaco)
 *
 * NOTE: ThemeContext itself is NOT re-exported here to prevent a circular
 * dependency (ThemeContext imports createDarkTheme/createLightTheme via
 * `../theme`, so if theme/index.js imported ThemeContext the cycle would close).
 * Import ThemeContext directly from `../contexts/ThemeContext` when needed.
 */

// ─── Moonlit MUI themes ───────────────────────────────────────────────────────
export { createDarkTheme } from '@/theme/darkTheme';
export { createLightTheme } from '@/theme/lightTheme';

// ─── Style utilities ──────────────────────────────────────────────────────────
export { TRANSITIONS, getMoonlitGradient } from '@/theme/themeEffects';
export { getMonacoThemeName, registerMonacoThemes } from '@/theme/themeMonaco';
