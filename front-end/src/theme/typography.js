/**
 * Moonlit typography factory.
 *
 * Returns the MUI `typography` config object for a given set of color tokens.
 * Called once per theme (dark / light) with the matching token palette so that
 * color-bearing variants (h1, subtitle1, label, etc.) resolve correctly.
 *
 * Usage:
 *   import { createTypography } from '@/theme/typography';
 *   const typography = createTypography(DARK);  // or LIGHT
 */

import { FONTS } from '@/theme/tokens';

/**
 * @param {object} H - Color token object (DARK or LIGHT from tokens.js)
 * @returns {object} MUI-compatible typography config
 */
export const createTypography = (H) => ({
  fontFamily: FONTS.sans,
  fontFamilyMono: FONTS.mono,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,

  // ── Standard MUI variants ──────────────────────────────────────────────────
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.03em',
    color: H.text000,
    fontFamily: FONTS.serif,
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: '-0.025em',
    color: H.text000,
    fontFamily: FONTS.serif,
  },
  h3: {
    fontSize: '1.5rem',
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: '-0.015em',
    fontFamily: FONTS.serif,
  },
  h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
  h5: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.5 },
  h6: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },

  subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.6, color: H.text000 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5, color: H.text200 },
  body1: { fontSize: '1rem', lineHeight: 1.75, letterSpacing: 0, color: H.text000 },
  body2: { fontSize: '0.875rem', lineHeight: 1.7, letterSpacing: 0, color: H.text000 },
  caption: { fontSize: '0.75rem', lineHeight: 1.5, letterSpacing: 0, color: H.text200 },
  overline: {
    fontSize: '0.625rem',
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: 1.5,
    textTransform: 'none',
    color: H.text200,
  },
  button: {
    fontFamily: FONTS.sans,
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.875rem',
    letterSpacing: 0,
  },

  // ── Custom Moonlit variants ────────────────────────────────────────────────
  mono: { fontFamily: FONTS.mono, fontSize: '0.875rem', lineHeight: 1.6 },
  label: {
    fontFamily: FONTS.mono,
    fontSize: '0.6875rem',
    fontWeight: 500,
    lineHeight: 1.1,
    letterSpacing: 0,
    textTransform: 'none',
    color: H.text400,
  },

  // Body scale
  uiBodyLg:    { fontSize: { xs: '1rem', md: '1.125rem' }, lineHeight: 1.7 },
  uiBodyMd:    { fontSize: { xs: '0.82rem', sm: '0.9rem' }, lineHeight: 1.65, letterSpacing: 0 },
  uiBodySm:    { fontSize: { xs: '0.8rem', sm: '0.875rem' }, lineHeight: 1.55, letterSpacing: 0 },
  uiBodyTable: { fontSize: { xs: '0.78rem', sm: '0.875rem' }, lineHeight: 1.55, letterSpacing: 0 },

  // Caption scale
  uiCaptionMd:  { fontSize: { xs: '0.75rem', sm: '0.8125rem' }, lineHeight: 1.45, letterSpacing: 0 },
  uiCaptionSm:  { fontSize: { xs: '0.72rem', sm: '0.8rem' }, lineHeight: 1.45, letterSpacing: 0 },
  uiCaptionXs:  { fontSize: { xs: '0.68rem', sm: '0.75rem' }, lineHeight: 1.4, letterSpacing: 0 },
  uiCaption2xs: { fontSize: { xs: '0.65rem', sm: '0.7rem' }, lineHeight: 1.4, letterSpacing: 0 },

  // Mono / code
  uiMonoLabel: {
    fontFamily: FONTS.mono,
    fontSize: { xs: '0.62rem', sm: '0.6875rem' },
    fontWeight: 500,
    lineHeight: 1.1,
    letterSpacing: 0,
    textTransform: 'none',
  },
  uiCodeBlock:   { fontSize: '0.85rem', lineHeight: 1.5 },
  uiCode:        { fontSizePx: 13 },
  uiCodeCompact: { fontSizePx: 12 },

  // Heading / display
  uiBrandWordmark: {
    fontFamily: FONTS.serif,
    fontSize: { xs: '2rem', sm: '2.5rem' },
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: 0,
  },
  uiLoaderWordmark: {
    fontFamily: FONTS.serif,
    fontSize: { xs: '2.5rem', md: '3.5rem' },
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: 0,
  },
  uiHeadingHero: {
    fontFamily: FONTS.serif,
    fontSize: { xs: '2rem', sm: '2.5rem', md: '3.25rem' },
    lineHeight: 1.15,
    letterSpacing: '-0.03em',
  },
  uiHeadingLandingLg: {
    fontFamily: FONTS.serif,
    fontSize: { xs: '1.75rem', md: '2.25rem' },
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
  },
  uiHeadingLandingMd: {
    fontFamily: FONTS.serif,
    fontSize: { xs: '1.5rem', md: '2rem' },
    lineHeight: 1.2,
    letterSpacing: '-0.015em',
  },

  // Card
  uiCardTitle: { fontSize: '1.1rem', lineHeight: 1.35 },
  uiCardBody:  { fontSize: '0.9rem', lineHeight: 1.7 },

  // UI controls
  uiInput:     { fontSize: { xs: '1rem', sm: '0.95rem' } },
  uiButtonSm:  { fontSize: '0.75rem', fontWeight: 600, letterSpacing: 0 },
  uiMenuItemSm:{ fontSize: '0.8125rem', lineHeight: 1.5 },
  uiStepNumber:{ fontSize: '0.85rem', lineHeight: 1.1, letterSpacing: 0 },

  // Sidebar
  uiNavItem: { fontSize: '0.875rem', lineHeight: 1.3, letterSpacing: 0 },
  uiNavShortcut: { fontSize: '0.72rem', lineHeight: 1.4, letterSpacing: 0 },
  uiSectionLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: 0,
    textTransform: 'none',
  },

  // Schema viewer
  uiSchemaDbLabel:     { fontSize: { xs: '0.9rem', sm: '0.8rem' }, lineHeight: 1.3 },
  uiSchemaTableLabel:  { fontSize: { xs: '0.85rem', sm: '0.75rem' }, lineHeight: 1.3 },
  uiSchemaColumnLabel: { fontSize: { xs: '0.75rem', sm: '0.7rem' }, lineHeight: 1.3 },
  uiSchemaColumnType:  { fontSize: { xs: '0.65rem', sm: '0.6rem' }, lineHeight: 1.2 },
});
