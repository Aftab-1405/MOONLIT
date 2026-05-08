/**
 * MUI light theme for Moonlit.
 *
 * Brand palette: strict CRED-inspired monochrome.
 * Primary token uses Cod Gray on an Alabaster canvas; secondary is neutral support.
 *
 * Token mapping:
 *   bg-000  → background.default   (pure white canvas)
 *   bg-100  → background.paper     (barely-warm white — cards, sidebar)
 *   bg-200  → background.sunken    (input fields, inset surfaces)
 *   bg-000  → background.elevated  (popovers float above default)
 *   text-000 → text.primary
 *   text-200 → text.secondary
 *   text-400 → text.disabled / text.hint
 *   brand-000 → primary.main       (Cod Gray)
 *   accent-000 → secondary.main    (neutral support tone)
 */

import { createTheme, alpha, responsiveFontSizes } from '@mui/material/styles';
import { LIGHT, FONTS, SHAPE, BREAKPOINTS } from './tokens';
import { KEYFRAMES, TRANSITIONS } from '../styles/themeEffects';
import { MOBILE_SM_QUERY, REDUCED_MOTION_QUERY, BACKDROP_FILTER_FALLBACK_QUERY } from '../styles/mediaQueries';

const H = LIGHT; // alias for brevity

// ─── Palette ─────────────────────────────────────────────────────────────────

const getContainedButtonColorStyles = (main, contrastText = '#ffffff') => ({
  borderColor: 'transparent',
  color: contrastText,
  backgroundColor: main,
  '&:hover': {
    borderColor: 'transparent',
    backgroundColor: alpha(main, 0.88),
    color: contrastText,
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(main, 0.16)}`,
  },
});

const getOutlinedButtonColorStyles = (main) => ({
  borderColor: alpha(main, 0.42),
  color: main,
  backgroundColor: 'transparent',
  '&:hover': {
    borderColor: main,
    backgroundColor: alpha(main, 0.07),
    color: main,
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(main, 0.16)}`,
  },
});

const getTextButtonColorStyles = (main) => ({
  borderColor: 'transparent',
  color: main,
  backgroundColor: 'transparent',
  '&:hover': {
    borderColor: 'transparent',
    backgroundColor: alpha(main, 0.07),
    color: main,
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(main, 0.16)}`,
  },
});

const neutralOutlinedButtonStyles = {
  borderColor: alpha(H.border200, 0.18),
  color: H.text200,
  backgroundColor: 'transparent',
  '&:hover': {
    borderColor: alpha(H.border200, 0.3),
    backgroundColor: alpha(H.text000, 0.05),
    color: H.text000,
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(H.border200, 0.12)}`,
  },
};

const neutralTextButtonStyles = {
  borderColor: 'transparent',
  color: H.text200,
  backgroundColor: 'transparent',
  '&:hover': {
    borderColor: 'transparent',
    backgroundColor: alpha(H.text000, 0.05),
    color: H.text000,
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(H.border200, 0.12)}`,
  },
};

const palette = {
  mode: 'light',

  background: {
    default:  H.bg000,   // Alabaster
    paper:    H.bg100,   // barely-warm white
    elevated: H.bg000,   // popovers sit at the same white level
    sunken:   H.bg200,   // soft neutral inset / input bg
  },

  text: {
    primary:   H.text000,  // near black
    secondary: H.text200,  // dark gray
    disabled:  H.text400,  // muted
    hint:      H.text400,  // alias (used by components)
  },

  primary: {
    main:         H.brand000,
    light:        H.brand200,
    dark:         H.brandDark,
    contrastText: '#ffffff',
  },

  secondary: {
    main:         H.accent000,
    light:        H.accentLight,
    dark:         H.accentDark,
    contrastText: '#ffffff',
  },

  error: {
    main:         H.danger000,
    light:        '#ef4444',
    dark:         '#991b1b',
    contrastText: '#ffffff',
  },

  success: {
    main:         H.success000,
    light:        '#22c55e',
    dark:         '#166534',
    contrastText: '#ffffff',
  },

  warning: {
    main:         H.warning000,
    light:        '#f59e0b',
    dark:         '#92400e',
    contrastText: '#ffffff',
  },

  info: {
    main:         H.info000,
    light:        H.infoLight,
    dark:         H.infoDark,
    contrastText: '#ffffff',
  },

  // divider must be a pure hex so alpha() in cross-cutting consumers works correctly.
  // bg-400 (#e5e2d7) is the deepest cream shade — gives a warm, barely-visible
  // grid line on white when used with alpha(divider, 0.45) at the overlay's 0.35 opacity.
  divider: H.bg400,  // #e5e2d7 — pure light hex, never pre-alpha-wrapped

  // Custom: border tokens (used by components via theme.palette.border.*)
  border: {
    default: alpha(H.border200, 0.18),
    subtle:  alpha(H.border200, 0.11),
    hover:   alpha(H.border200, 0.3),
    focus:   alpha(H.text000, 0.45),
  },

  action: {
    hover:              alpha(H.text000, 0.04),
    selected:           alpha(H.text000, 0.07),
    disabled:           alpha(H.text000, 0.24),
    disabledBackground: alpha(H.text000, 0.08),
    focus:              alpha(H.text000, 0.09),
    active:             alpha(H.text000, 0.62),
  },

  // Custom: scrollbar tokens (read as CSS variables in CssBaseline)
  scrollbar: {
    track:     'transparent',
    thumb:     alpha(H.border200, 0.22),
    thumbHover:alpha(H.border200, 0.38),
  },

  // Custom: code block styling
  code: {
    background: alpha(H.brand000, 0.05),
    text:       H.brandDark,
    border:     alpha(H.brand000, 0.14),
  },

  // Custom: Monaco editor colors
  monaco: {
    background:    H.bg200,
    gutter:        H.bg200,
    highlight:     H.bg300,
    lineHighlight: H.bg300,
  },

  // Custom: chart color series
  chart: [
    H.text000, H.text200, H.accentDark, H.accent000,
    H.accentLight, H.text400, H.bg400, H.border200,
  ],

  // Custom: glassmorphism surface (used by getGlassmorphismStyles in shared.js)
  glassmorphism: {
    background:     alpha(H.bg000, 0.92),
    backdropFilter: 'blur(16px)',
    borderColor:    alpha(H.text000, 0.08),
  },
};

// ─── Typography ───────────────────────────────────────────────────────────────

const typography = {
  fontFamily: FONTS.sans,
  fontFamilyMono: FONTS.mono,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,

  h1: { fontSize: '2.5rem',  fontWeight: 700, lineHeight: 1.2,  letterSpacing: '-0.015em', color: H.text000, fontFamily: FONTS.serif },
  h2: { fontSize: '2rem',    fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em',  color: H.text000, fontFamily: FONTS.serif },
  h3: { fontSize: '1.5rem',  fontWeight: 600, lineHeight: 1.35, letterSpacing: '-0.005em', fontFamily: FONTS.serif },
  h4: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
  h5: { fontSize: '1.125rem',fontWeight: 600, lineHeight: 1.5 },
  h6: { fontSize: '1rem',    fontWeight: 600, lineHeight: 1.5 },

  subtitle1: { fontSize: '1rem',     fontWeight: 500, lineHeight: 1.6,  color: H.text000 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5,  color: H.text200 },
  body1:     { fontSize: '1rem',     lineHeight: 1.75, letterSpacing: '0.008em', color: H.text000 },
  body2:     { fontSize: '0.875rem', lineHeight: 1.7,  letterSpacing: '0.008em', color: H.text000 },
  caption:   { fontSize: '0.75rem',  lineHeight: 1.5,  letterSpacing: '0.02em',  color: H.text200 },
  overline:  { fontSize: '0.625rem', fontWeight: 600,  letterSpacing: '0.1em',   lineHeight: 1.5, textTransform: 'uppercase', color: H.text200 },
  button:    { fontFamily: FONTS.sans, textTransform: 'none', fontWeight: 500, fontSize: '0.875rem', letterSpacing: '0.01em' },

  // Custom semantic variants (accessed as Typography variant="uiBodyMd" etc.)
  mono:           { fontFamily: FONTS.mono, fontSize: '0.875rem', lineHeight: 1.6 },
  label:          { fontFamily: FONTS.mono, fontSize: '0.6875rem', fontWeight: 500, lineHeight: 1.1, letterSpacing: '0.05em', textTransform: 'uppercase', color: H.text400 },
  uiBodyMd:       { fontSize: { xs: '0.82rem', sm: '0.9rem' },   lineHeight: 1.65, letterSpacing: '0.008em' },
  uiBodySm:       { fontSize: { xs: '0.8rem',  sm: '0.875rem' }, lineHeight: 1.55, letterSpacing: '0.008em' },
  uiCaptionSm:    { fontSize: { xs: '0.72rem', sm: '0.8rem' },   lineHeight: 1.45, letterSpacing: '0.01em' },
  uiCaptionXs:    { fontSize: { xs: '0.68rem', sm: '0.75rem' },  lineHeight: 1.4,  letterSpacing: '0.01em' },
  uiMonoLabel:    { fontFamily: FONTS.mono, fontSize: { xs: '0.62rem', sm: '0.6875rem' }, fontWeight: 500, lineHeight: 1.1, letterSpacing: '0.05em', textTransform: 'uppercase' },
  uiInput:        { fontSize: { xs: '1rem', sm: '0.95rem' } },
  uiCaption2xs:   { fontSize: { xs: '0.65rem', sm: '0.7rem' },   lineHeight: 1.4,  letterSpacing: '0.01em' },
  uiCaptionMd:    { fontSize: { xs: '0.75rem', sm: '0.8125rem' },lineHeight: 1.45, letterSpacing: '0.01em' },
  uiBodyTable:    { fontSize: { xs: '0.78rem', sm: '0.875rem' }, lineHeight: 1.55, letterSpacing: '0.008em' },
  uiCodeBlock:    { fontSize: '0.85rem', lineHeight: 1.5 },
  uiBrandWordmark:{ fontFamily: FONTS.serif, fontSize: { xs: '2rem', sm: '2.5rem' }, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.01em' },
  uiLoaderWordmark:{ fontFamily: FONTS.serif, fontSize: { xs: '2.5rem', md: '3.5rem' }, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.015em' },
  uiHeadingHero:  { fontFamily: FONTS.serif, fontSize: { xs: '2rem', sm: '2.5rem', md: '3.25rem' }, lineHeight: 1.15, letterSpacing: '-0.02em' },
  uiHeadingLandingLg: { fontFamily: FONTS.serif, fontSize: { xs: '1.75rem', md: '2.25rem' }, lineHeight: 1.2 },
  uiHeadingLandingMd: { fontFamily: FONTS.serif, fontSize: { xs: '1.5rem',  md: '2rem' },    lineHeight: 1.2 },
  uiBodyLg:       { fontSize: { xs: '1rem', md: '1.125rem' }, lineHeight: 1.7 },
  uiCardTitle:    { fontSize: '1.1rem',  lineHeight: 1.35 },
  uiCardBody:     { fontSize: '0.9rem',  lineHeight: 1.7 },
  uiStepNumber:   { fontSize: '0.85rem', lineHeight: 1.1, letterSpacing: '0.02em' },
  uiSchemaDbLabel:    { fontSize: { xs: '0.9rem', sm: '0.8rem' },  lineHeight: 1.3 },
  uiSchemaTableLabel: { fontSize: { xs: '0.85rem', sm: '0.75rem' },lineHeight: 1.3 },
  uiSchemaColumnLabel:{ fontSize: { xs: '0.75rem', sm: '0.7rem' }, lineHeight: 1.3 },
  uiSchemaColumnType: { fontSize: { xs: '0.65rem', sm: '0.6rem' }, lineHeight: 1.2 },
  uiCode:         { fontSizePx: 13 },
  uiCodeCompact:  { fontSizePx: 12 },
  // Sidebar-specific variants
  uiNavItem:      { fontSize: '0.875rem', lineHeight: 1.3, letterSpacing: '0.008em' },
  uiNavShortcut:  { fontSize: '0.72rem',  lineHeight: 1.4, letterSpacing: '0.01em' },
  uiSectionLabel: { fontSize: '0.75rem',  fontWeight: 700, lineHeight: 1.25, letterSpacing: '0.04em', textTransform: 'uppercase' },
  // SQL editor button/menu text
  uiButtonSm:     { fontSize: '0.75rem',  fontWeight: 600, letterSpacing: '0.01em' },
  uiMenuItemSm:   { fontSize: '0.8125rem', lineHeight: 1.5 },
};

// ─── Component overrides ──────────────────────────────────────────────────────

const focusRing = `0 0 0 3px ${alpha(H.text000, 0.08)}`;
const surfaceGradient = `linear-gradient(180deg, ${alpha('#000000', 0.012)}, transparent)`;
const groupedButtonBorder = alpha(H.border200, 0.12);
const groupedButtonBg = H.bg100;
const groupedButtonHoverBg = alpha(H.text000, 0.05);
const groupedButtonSelectedBg = alpha(H.text000, 0.07);
const groupedButtonFocusRing = `0 0 0 3px ${alpha(H.text000, 0.1)}`;
const iconButtonFocusRing = `0 0 0 4px ${alpha(H.brand000, 0.18)}`;
const getIconButtonColorStyles = (main) => ({
  color: main,
  backgroundColor: H.bg100,
  borderColor: alpha(main, 0.14),
  boxShadow: 'none',
  '&:hover': {
    color: main,
    backgroundColor: alpha(main, 0.05),
    borderColor: alpha(main, 0.2),
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(main, 0.18)}`,
  },
});

const components = {
  MuiCssBaseline: {
    styleOverrides: {
      // Inject animation keyframes globally
      ...KEYFRAMES,

      '*, *::before, *::after': { boxSizing: 'border-box' },

      '*': {
        scrollbarWidth: 'none',
      },
      '*::-webkit-scrollbar': { display: 'none' },
      '*::-webkit-scrollbar-corner':      { backgroundColor: 'transparent' },

      html: {
        colorScheme: 'light',
        scrollBehavior: 'smooth',
        WebkitTextSizeAdjust: '100%',
        textSizeAdjust: '100%',
        minHeight: '100%',
        height: '100%',
      },

      body: {
        margin: 0,
        overflowX: 'hidden',
        minHeight: '100dvh',
        '@supports not (min-height: 100dvh)': { minHeight: '100vh' },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '1rem',
        fontFamily: FONTS.sans,
        color: H.text000,
        fontFeatureSettings: '"liga" 1, "calt" 1',
        textRendering: 'optimizeLegibility',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        backgroundColor: H.bg000,

        // Scrollbar CSS vars
        '--app-scrollbar-size':    '8px',
        '--scrollbar-track':       'transparent',
        '--scrollbar-thumb':       alpha(H.border200, 0.22),
        '--scrollbar-thumb-hover': alpha(H.border200, 0.38),

        // Color CSS vars (used throughout components as var(--color-*))
        '--dark-mode':             '0',
        '--color-bg-default':      H.bg000,
        '--color-bg-paper':        H.bg100,
        '--color-bg-elevated':     H.bg000,
        '--color-bg-sunken':       H.bg200,

        '--color-text-primary':    H.text000,
        '--color-text-secondary':  H.text200,
        '--color-text-disabled':   H.text400,
        '--color-text-hint':       H.text400,

        '--color-border-default':  alpha(H.border200, 0.18),
        '--color-border-subtle':   alpha(H.border200, 0.11),
        '--color-border-hover':    alpha(H.border200, 0.3),
        '--color-border-focus':    H.brand000,

        '--color-primary':         H.brand000,
        '--color-primary-light':   H.brand200,
        '--color-primary-dark':    H.brandDark,
        '--color-error':           H.danger000,
        '--color-warning':         H.warning000,
        '--color-success':         H.success000,
        '--color-info':            H.info000,

        '--radius-sm':   `${SHAPE.radius.sm}px`,
        '--radius-md':   `${SHAPE.radius.md}px`,
        '--radius-lg':   `${SHAPE.radius.lg}px`,
        '--radius-full': `${SHAPE.radius.full}px`,

        '--color-code-bg':     alpha(H.brand000, 0.05),
        '--color-code-text':   H.brandDark,
        '--color-code-border': alpha(H.brand000, 0.14),

        '&::selection': {
          backgroundColor: alpha(H.brand000, 0.18),
          color: H.brandDark,
        },

        [MOBILE_SM_QUERY]: {
          '& input, & select, & textarea': { fontSize: '16px' },
        },
      },

      '#root': {
        flex: '1 1 auto',
        minWidth: 0,
        width: '100%',
        minHeight: '100dvh',
        '@supports not (min-height: 100dvh)': { minHeight: '100vh' },
        display: 'flex',
        flexDirection: 'column',
      },

      [REDUCED_MOTION_QUERY]: {
        '*': {
          animationDuration: '0.01ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.01ms !important',
          scrollBehavior: 'auto !important',
        },
      },
    },
  },

  MuiButtonBase: { defaultProps: { disableRipple: true } },

  // ── Button ─────────────────────────────────────────────────────────────────
  MuiButton: {
    defaultProps: { disableElevation: true },
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.md,
        fontFamily: FONTS.sans,
        padding: '10px 22px',
        fontWeight: 500,
        // Per requirements: no uppercase transform
        textTransform: 'none',
        letterSpacing: 0,
        transition: TRANSITIONS.default,
        borderWidth: 1,
        borderStyle: 'solid',
        [MOBILE_SM_QUERY]: { minHeight: 44, padding: '10px 18px' },
        '&:active': { transform: 'scale(0.98)' },
        '&.Mui-disabled': {
          borderColor: alpha(H.border200, 0.12),
          color: H.text400,
          backgroundColor: alpha(H.bg200, 0.65),
          boxShadow: 'none',
        },
      },
      contained: getContainedButtonColorStyles(H.brand000, '#ffffff'),
      containedPrimary: getContainedButtonColorStyles(H.brand000, '#ffffff'),
      containedSecondary: getContainedButtonColorStyles(H.accent000, '#ffffff'),
      containedSuccess: getContainedButtonColorStyles(H.success000, '#ffffff'),
      containedWarning: getContainedButtonColorStyles(H.warning000, '#ffffff'),
      containedError: getContainedButtonColorStyles(H.danger000, '#ffffff'),
      containedInfo: getContainedButtonColorStyles(H.info000, '#ffffff'),
      outlined: neutralOutlinedButtonStyles,
      outlinedInherit: neutralOutlinedButtonStyles,
      outlinedPrimary: getOutlinedButtonColorStyles(H.brand000),
      outlinedSecondary: getOutlinedButtonColorStyles(H.accent000),
      outlinedSuccess: getOutlinedButtonColorStyles(H.success000),
      outlinedWarning: getOutlinedButtonColorStyles(H.warning000),
      outlinedError: getOutlinedButtonColorStyles(H.danger000),
      outlinedInfo: getOutlinedButtonColorStyles(H.info000),
      text: neutralTextButtonStyles,
      textInherit: neutralTextButtonStyles,
      textPrimary: getTextButtonColorStyles(H.brand000),
      textSecondary: getTextButtonColorStyles(H.accent000),
      textSuccess: getTextButtonColorStyles(H.success000),
      textWarning: getTextButtonColorStyles(H.warning000),
      textError: getTextButtonColorStyles(H.danger000),
      textInfo: getTextButtonColorStyles(H.info000),
      sizeSmall: { padding: '6px 16px', fontSize: '0.8125rem' },
      sizeLarge: { padding: '14px 28px', fontSize: '0.9375rem' },
    },
  },

  MuiIconButton: {
    styleOverrides: {
      root: {
        width: 36,
        height: 36,
        minWidth: 36,
        minHeight: 36,
        padding: 0,
        border: '1px solid',
        borderRadius: SHAPE.borderRadius,
        boxShadow: 'none',
        color: H.text200,
        backgroundColor: H.bg100,
        borderColor: alpha(H.border200, 0.12),
        transition: TRANSITIONS.default,
        '& .MuiSvgIcon-root': { fontSize: 20 },
        '&:hover': {
          color: H.text000,
          backgroundColor: alpha(H.text000, 0.05),
          borderColor: alpha(H.border200, 0.18),
        },
        '&.Mui-focusVisible': {
          outline: 'none',
          boxShadow: iconButtonFocusRing,
        },
        '&:active': { transform: 'scale(0.98)' },
        '&.Mui-disabled': {
          color: H.text400,
          backgroundColor: alpha(H.bg200, 0.72),
          borderColor: alpha(H.border200, 0.12),
          boxShadow: 'none',
        },
      },
      colorPrimary: getIconButtonColorStyles(H.brand000),
      colorSecondary: getIconButtonColorStyles(H.accent000),
      colorSuccess: getIconButtonColorStyles(H.success000),
      colorWarning: getIconButtonColorStyles(H.warning000),
      colorError: getIconButtonColorStyles(H.danger000),
      colorInfo: getIconButtonColorStyles(H.info000),
      sizeSmall: {
        width: 32,
        height: 32,
        minWidth: 32,
        minHeight: 32,
      },
      sizeMedium: {
        width: 36,
        height: 36,
        minWidth: 36,
        minHeight: 36,
      },
      sizeLarge: {
        width: 40,
        height: 40,
        minWidth: 40,
        minHeight: 40,
      },
    },
    variants: [
      {
        props: { variant: 'outlined' },
        style: {
          color: H.text200,
          backgroundColor: H.bg100,
          borderColor: alpha(H.border200, 0.12),
          boxShadow: 'none',
          '&:hover': {
            color: H.text000,
            backgroundColor: alpha(H.text000, 0.05),
            borderColor: alpha(H.border200, 0.18),
          },
          '&.Mui-focusVisible': {
            boxShadow: `0 0 0 4px ${alpha(H.brand000, 0.14)}`,
          },
        },
      },
    ],
  },

  // ── Paper ──────────────────────────────────────────────────────────────────
  // Per requirements: bg-100 background, subtle border-200 border
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.borderRadius,
        // bg-100 as background
        backgroundColor: H.bg100,
        backgroundImage: surfaceGradient,
      },
      elevation1: {
        boxShadow: `0 1px 3px 0 ${alpha('#000000', 0.06)}`,
        // Subtle border using border-200
        border: `1px solid ${alpha(H.border200, 0.11)}`,
      },
      elevation2: {
        boxShadow: `0 4px 6px -1px ${alpha('#000000', 0.07)}`,
      },
    },
  },

  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: H.bg100,
        border: `1px solid ${alpha(H.border200, 0.11)}`,
        boxShadow: 'none',
        backgroundImage: surfaceGradient,
        transition: TRANSITIONS.smooth,
        '&:hover': {
          borderColor: alpha(H.border200, 0.22),
          boxShadow: `0 8px 20px -12px ${alpha('#000000', 0.1)}`,
        },
      },
    },
  },

  // ── TextField / Input ──────────────────────────────────────────────────────
  // Per requirements: bg-200 background, text-000 color
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: SHAPE.radius.md,
          // bg-200 as input background
          backgroundColor: H.bg200,
          transition: TRANSITIONS.default,
          '& fieldset': {
            borderColor: alpha(H.border200, 0.2),
            borderWidth: 1,
            transition: TRANSITIONS.default,
          },
          '&:hover fieldset': { borderColor: alpha(H.border200, 0.35) },
          '&.Mui-focused': { boxShadow: focusRing },
          '&.Mui-focused fieldset': {
            borderColor: alpha(H.border200, 0.45),
            borderWidth: 1.5,
          },
        },
        '& .MuiInputBase-input': {
          // text-000 as text color
          color: H.text000,
          '&::placeholder': { color: H.text400, opacity: 0.9 },
        },
      },
    },
  },

  // Per requirements: bg-200 background, text-000 text color
  // Scoped to outlined variant only — standard/filled variants (e.g. ChatInput)
  // manage their own background through the parent shell.
  MuiInputBase: {
    styleOverrides: {
      root: {
        color: H.text000,
        fontFamily: FONTS.sans,
        '&.MuiOutlinedInput-root': {
          backgroundColor: H.bg200,
        },
      },
      input: {
        // Browsers don't inherit fontFamily on <input> from the body by default.
        // Explicitly set it here so all text fields match the rest of the UI.
        fontFamily: 'inherit',
      },
    },
  },

  // ── Divider ────────────────────────────────────────────────────────────────
  // Per requirements: border-200 color
  MuiDivider: {
    styleOverrides: {
      root: { borderColor: alpha(H.border200, 0.14) },
    },
  },

  // ── Tooltip ────────────────────────────────────────────────────────────────
  // Per requirements: bg-300 background
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: H.bg300,
        color: H.text000,
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '6px 12px',
        borderRadius: SHAPE.radius.sm,
        border: `1px solid ${alpha(H.border200, 0.12)}`,
        boxShadow: `0 4px 6px -2px ${alpha('#000000', 0.08)}`,
      },
      arrow: { color: H.bg300 },
    },
  },

  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.sm,
        fontWeight: 500,
        transition: TRANSITIONS.default,
      },
      filled: {
        backgroundColor: alpha(H.text000, 0.06),
        color: H.text000,
        '&:hover': { backgroundColor: alpha(H.text000, 0.09) },
      },
      outlined: {
        borderColor: alpha(H.border200, 0.2),
        '&:hover': { backgroundColor: alpha(H.text000, 0.04) },
      },
    },
  },

  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundColor: alpha(H.bg000, 0.92),
        backgroundImage: surfaceGradient,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${alpha(H.border200, 0.1)}`,
        boxShadow: 'none',
        [BACKDROP_FILTER_FALLBACK_QUERY]: {
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
        [MOBILE_SM_QUERY]: {
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      },
    },
  },

  MuiDialog: {
    styleOverrides: {
      paper: {
        backgroundColor: H.bg100,
        border: `1px solid ${alpha(H.border200, 0.11)}`,
        backgroundImage: surfaceGradient,
      },
    },
  },

  MuiMenu: {
    styleOverrides: {
      paper: {
        backgroundColor: alpha(H.bg000, 0.97),
        backgroundImage: surfaceGradient,
        border: `1px solid ${alpha(H.border200, 0.12)}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: `0 8px 24px -8px ${alpha('#000000', 0.12)}`,
        borderRadius: SHAPE.radius.md,
        [BACKDROP_FILTER_FALLBACK_QUERY]: {
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      },
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.sm,
        margin: '2px 8px',
        padding: '10px 16px',
        transition: TRANSITIONS.default,
        [MOBILE_SM_QUERY]: { minHeight: 44 },
        '&:hover': { backgroundColor: alpha(H.text000, 0.04) },
        '&.Mui-selected': {
          backgroundColor: alpha(H.text000, 0.07),
          fontWeight: 600,
          '&:hover': { backgroundColor: alpha(H.text000, 0.1) },
        },
      },
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: { borderBottom: `1px solid ${alpha(H.border200, 0.11)}` },
      head: {
        color: H.text200,
        fontWeight: 600,
        backgroundColor: alpha(H.border200, 0.04),
      },
    },
  },

  MuiTablePagination: {
    styleOverrides: {
      root: {
        backgroundColor: H.bg000,
        borderTop: `1px solid ${alpha(H.border200, 0.11)}`,
      },
      selectLabel: { color: H.text200 },
      displayedRows: { color: H.text200 },
      select: { color: H.text000 },
      actions: { color: H.text000 },
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.md,
        border: `1px solid ${alpha(H.border200, 0.11)}`,
      },
      standardSuccess: {
        backgroundColor: alpha(H.success000, 0.08),
        '& .MuiAlert-icon': { color: H.success000 },
      },
      standardInfo: {
        backgroundColor: alpha(H.info000, 0.07),
        '& .MuiAlert-icon': { color: H.info000 },
      },
      standardWarning: {
        backgroundColor: alpha(H.warning000, 0.08),
        '& .MuiAlert-icon': { color: H.warning000 },
      },
      standardError: {
        backgroundColor: alpha(H.danger000, 0.07),
        '& .MuiAlert-icon': { color: H.danger000 },
      },
    },
  },

  MuiSnackbarContent: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.md,
        border: `1px solid ${alpha(H.border200, 0.11)}`,
        backgroundColor: H.bg100,
      },
    },
  },

  MuiSkeleton: {
    styleOverrides: {
      root: {
        backgroundColor: alpha(H.text200, 0.08),
        borderRadius: SHAPE.radius.sm,
      },
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.full,
        backgroundColor: alpha(H.text000, 0.07),
        height: 4,
      },
      bar: { borderRadius: SHAPE.radius.full },
    },
  },

  MuiTabs: {
    styleOverrides: {
      root: { minHeight: 40 },
      indicator: { height: 2, borderRadius: 2, backgroundColor: H.brand000 },
    },
  },

  MuiTab: {
    styleOverrides: {
      root: {
        minHeight: 40,
        textTransform: 'none',
        fontWeight: 500,
        fontSize: '0.875rem',
        letterSpacing: '0.01em',
        color: H.text200,
        padding: '8px 16px',
        transition: TRANSITIONS.default,
        '&.Mui-selected': { color: H.text000, fontWeight: 600 },
        '&:hover': { color: H.text000, backgroundColor: alpha(H.text000, 0.04) },
        [MOBILE_SM_QUERY]: { minHeight: 44, padding: '10px 12px' },
      },
    },
  },

  MuiSwitch: {
    styleOverrides: {
      root: {
        width: 36,
        height: 20,
        padding: 0,
        display: 'flex',
        flexShrink: 0,
        overflow: 'visible',
        '& .MuiSwitch-switchBase': {
          top: 0,
          left: 0,
          margin: 0,
          padding: 2,
          transform: 'translateX(0)',
        },
        '& .MuiSwitch-switchBase.Mui-checked': {
          transform: 'translateX(16px)',
        },
        '& .MuiSwitch-thumb': {
          display: 'block',
        },
      },
      switchBase: {
        padding: 2,
        '&.Mui-checked': {
          transform: 'translateX(16px)',
          color: '#ffffff',
          '& + .MuiSwitch-track': {
            opacity: 1,
            backgroundColor: H.success000,
          },
        },
        '&.Mui-focusVisible + .MuiSwitch-track': {
          boxShadow: `0 0 0 4px ${alpha(H.success000, 0.16)}`,
        },
      },
      thumb: { boxShadow: 'none', width: 16, height: 16 },
      track: {
        opacity: 1,
        borderRadius: 10,
        backgroundColor: alpha(H.text000, 0.16),
        border: 'none',
      },
    },
  },

  MuiSelect: {
    styleOverrides: {
      root: { borderRadius: SHAPE.radius.md },
      select: { color: H.text000 },
      icon: { color: H.text200, transition: TRANSITIONS.fast },
    },
  },

  MuiLink: {
    styleOverrides: {
      root: {
        color: H.brand000,
        textDecorationColor: alpha(H.brand000, 0.35),
        textUnderlineOffset: '2px',
        transition: TRANSITIONS.default,
        '&:hover': { color: H.brandDark },
      },
    },
  },

  MuiAccordion: {
    styleOverrides: {
      root: {
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        boxShadow: 'none',
        border: `1px solid ${alpha(H.border200, 0.11)}`,
        borderRadius: `${SHAPE.radius.lg}px !important`,
        marginBottom: 8,
        '&::before': { display: 'none' },
        '&.Mui-expanded': { marginTop: 0, marginBottom: 8 },
      },
    },
  },

  MuiAccordionSummary: {
    styleOverrides: {
      root: {
        minHeight: 48,
        padding: '0 16px',
        transition: TRANSITIONS.default,
        '&:hover': { backgroundColor: alpha(H.text000, 0.03) },
        '&.Mui-expanded': {
          minHeight: 48,
          borderBottom: `1px solid ${alpha(H.border200, 0.11)}`,
        },
      },
      content: {
        margin: '12px 0',
        '&.Mui-expanded': { margin: '12px 0' },
      },
      expandIconWrapper: {
        color: H.text200,
        transition: TRANSITIONS.default,
      },
    },
  },

  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.sm,
        transition: TRANSITIONS.default,
        '&:hover': { backgroundColor: alpha(H.text000, 0.04) },
        '&.Mui-selected': {
          backgroundColor: alpha(H.text000, 0.07),
          '&:hover': { backgroundColor: alpha(H.text000, 0.1) },
        },
      },
    },
  },

  MuiToggleButton: {
    styleOverrides: {
      root: {
        minWidth: 44,
        height: 32,
        padding: '0 12px',
        gap: 6,
        border: `1px solid ${groupedButtonBorder}`,
        borderColor: groupedButtonBorder,
        borderRadius: '0 !important',
        color: H.text200,
        backgroundColor: groupedButtonBg,
        ...typography.uiNavItem,
        fontWeight: 500,
        textTransform: 'none',
        transition: TRANSITIONS.default,
        '&:hover': {
          color: H.text000,
          backgroundColor: groupedButtonHoverBg,
        },
        '&.Mui-selected': {
          color: H.text000,
          fontWeight: 600,
          backgroundColor: groupedButtonSelectedBg,
          borderColor: groupedButtonBorder,
          '&:hover': { backgroundColor: alpha(H.text000, 0.09) },
        },
        '&.Mui-focusVisible': {
          position: 'relative',
          zIndex: 1,
          boxShadow: groupedButtonFocusRing,
        },
        '&.Mui-disabled': {
          color: H.text400,
          backgroundColor: alpha(H.bg200, 0.72),
        },
      },
      sizeSmall: {
        height: 32,
        padding: '0 12px',
      },
    },
  },

  MuiToggleButtonGroup: {
    styleOverrides: {
      root: {
        display: 'inline-flex',
        borderRadius: SHAPE.borderRadius,
        boxShadow: `0 1px 2px ${alpha('#000000', 0.06)}`,
      },
      grouped: {
        marginLeft: '-1px',
        '&:first-of-type': {
          marginLeft: 0,
          borderTopLeftRadius: `${SHAPE.borderRadius}px !important`,
          borderBottomLeftRadius: `${SHAPE.borderRadius}px !important`,
        },
        '&:last-of-type': {
          borderTopRightRadius: `${SHAPE.borderRadius}px !important`,
          borderBottomRightRadius: `${SHAPE.borderRadius}px !important`,
        },
        '&:not(:first-of-type)': {
          borderLeftColor: `${groupedButtonBorder} !important`,
        },
      },
    },
  },

  MuiInputLabel: {
    styleOverrides: {
      root: {
        color: H.text200,
        fontSize: '0.875rem',
        '&.Mui-focused': { color: H.text000 },
        '&.Mui-error': { color: H.danger000 },
      },
      shrink: { fontSize: '0.75rem', letterSpacing: '0.02em' },
    },
  },

  MuiFormHelperText: {
    styleOverrides: {
      root: {
        fontSize: '0.75rem',
        color: H.text200,
        marginTop: 4,
        '&.Mui-error': { color: H.danger000 },
      },
    },
  },

  MuiCheckbox: {
    styleOverrides: {
      root: {
        color: H.text200,
        '&.Mui-checked': { color: H.success000 },
        '&.MuiCheckbox-indeterminate': { color: H.success000 },
      },
    },
  },

  MuiRadio: {
    styleOverrides: {
      root: {
        color: H.text200,
        '&.Mui-checked': { color: H.success000 },
      },
    },
  },

  MuiBadge: {
    styleOverrides: {
      badge: {
        fontWeight: 600,
        border: `1px solid ${alpha(H.bg000, 0.4)}`,
      },
    },
  },

  MuiPopover: {
    styleOverrides: {
      paper: {
        backgroundColor: alpha(H.bg000, 0.97),
        backgroundImage: surfaceGradient,
        border: `1px solid ${alpha(H.border200, 0.12)}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: `0 8px 24px -8px ${alpha('#000000', 0.12)}`,
        [BACKDROP_FILTER_FALLBACK_QUERY]: {
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
      },
    },
  },
};

// ─── Theme factory ────────────────────────────────────────────────────────────

let _cached = null;

export const createLightTheme = () => {
  if (_cached) return _cached;
  const base = createTheme({
    breakpoints: BREAKPOINTS,
    spacing: 8,
    shape: SHAPE,
    palette,
    typography,
    components,
  });
  _cached = responsiveFontSizes(base);
  return _cached;
};
