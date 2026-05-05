/**
 * Theme module entry point.
 *
 * Exports:
 *   - createDarkTheme / createLightTheme — Moonlit MUI theme factories
 *   - Re-exports of shared style utilities (backward-compat with ../theme imports)
 *
 * NOTE: ThemeContext itself is NOT re-exported here to prevent a circular
 * dependency (ThemeContext imports createDarkTheme/createLightTheme via
 * `../theme`, so if theme/index.js imported ThemeContext the cycle would close).
 * Import ThemeContext directly from `../contexts/ThemeContext` when needed.
 */

// ─── Moonlit MUI themes ───────────────────────────────────────────────────────
export { createDarkTheme } from './darkTheme';
export { createLightTheme } from './lightTheme';

// ─── Style utilities (backward-compat: consumers import from '../theme') ──────
export { TRANSITIONS, getMoonlitGradient } from '../styles/themeEffects';
export { getMonacoThemeName, registerMonacoThemes } from '../styles/themeMonaco';
