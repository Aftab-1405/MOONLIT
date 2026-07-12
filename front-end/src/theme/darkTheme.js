/**
 * MUI dark theme for Moonlit.
 *
 * Brand palette: Moonlit Volt.
 * Monochrome surfaces stay dominant; neon chartreuse marks brand intent.
 *
 * Token mapping:
 *   bg-000  → background.default   (dark base surface)
 *   bg-100  → background.paper     (slightly darker — cards, modals)
 *   bg-200  → background.sunken    (input fields, very dark inset)
 *   bg-000  → background.elevated  (popovers/tooltips float above default)
 *   text-000 → text.primary        (near white)
 *   text-200 → text.secondary      (mid gray)
 *   text-400 → text.disabled / hint
 *   brand-000 → primary.main       (neon chartreuse)
 *   accent-000 → secondary.main    (neutral support tone)
 */

import { alpha, createTheme, responsiveFontSizes } from '@mui/material/styles';
import {
  BACKDROP_FILTER_FALLBACK_QUERY,
  MOBILE_SM_QUERY,
  REDUCED_MOTION_QUERY,
} from '@/styles/mediaQueries';
import { getPaletteInteractionColors, UI_POPOVER } from '@/styles/shared';
import { TRANSITIONS } from '@/theme/themeEffects';
import { BREAKPOINTS, DARK, FONTS, SHAPE } from '@/theme/tokens';
import { createTypography } from '@/theme/typography';

const H = DARK; // alias for brevity

// ─── Palette ─────────────────────────────────────────────────────────────────

const getContainedButtonColorStyles = (main, contrastText = H.bg000) => ({
  borderColor: 'transparent',
  color: contrastText,
  backgroundColor: main,
  '&:hover': {
    borderColor: 'transparent',
    backgroundColor: alpha(main, 0.88),
    color: contrastText,
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(main, 0.2)}`,
  },
});

const getOutlinedButtonColorStyles = (main) => ({
  borderColor: alpha(main, 0.42),
  color: main,
  backgroundColor: 'transparent',
  '&:hover': {
    borderColor: main,
    backgroundColor: alpha(main, 0.1),
    color: main,
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(main, 0.2)}`,
  },
});

const getTextButtonColorStyles = (main) => ({
  borderColor: 'transparent',
  color: main,
  backgroundColor: 'transparent',
  '&:hover': {
    borderColor: 'transparent',
    backgroundColor: alpha(main, 0.1),
    color: main,
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(main, 0.2)}`,
  },
});

const getNeutralOutlinedButtonStyles = (paletteForMode) => {
  const interaction = getPaletteInteractionColors(paletteForMode);
  return {
    borderColor: interaction.border,
    color: interaction.restingColor,
    backgroundColor: 'transparent',
    '&:hover': {
      borderColor: interaction.hoverBorder,
      backgroundColor: interaction.hoverBackground,
      color: interaction.hoverColor,
    },
    '&.Mui-focusVisible': {
      boxShadow: `0 0 0 4px ${interaction.focusRing}`,
    },
  };
};

const getNeutralTextButtonStyles = (paletteForMode) => {
  const interaction = getPaletteInteractionColors(paletteForMode);
  return {
    borderColor: 'transparent',
    color: interaction.restingColor,
    backgroundColor: 'transparent',
    '&:hover': {
      borderColor: 'transparent',
      backgroundColor: interaction.hoverBackground,
      color: interaction.hoverColor,
    },
    '&.Mui-focusVisible': {
      boxShadow: `0 0 0 4px ${interaction.focusRing}`,
    },
  };
};

const palette = {
  mode: 'dark',

  background: {
    default: H.bg000,
    paper: H.bg100,
    elevated: H.bg100,
    sunken: H.bg200,
  },

  text: {
    primary: H.text000, // near white
    secondary: H.text200, // mid gray
    disabled: H.text400, // muted
    hint: H.text400, // alias
  },

  primary: {
    main: H.brand000,
    light: H.brand200,
    dark: H.brandDark,
    glow: H.brandGlow,
    contrastText: H.bg000,
  },

  secondary: {
    main: H.accent000,
    light: H.accentLight,
    dark: H.accentDark,
    contrastText: H.bg000,
  },

  error: {
    main: H.danger000, // bright red for visibility on dark
    light: H.dangerLight,
    dark: H.dangerDark,
    contrastText: H.bg000,
  },

  success: {
    main: H.success000,
    light: H.successLight,
    dark: H.successDark,
    contrastText: H.bg000,
  },

  warning: {
    main: H.warning000,
    light: H.warningLight,
    dark: H.warningDark,
    contrastText: H.bg000,
  },

  info: {
    main: H.info000,
    light: H.infoLight,
    dark: H.infoDark,
    contrastText: H.bg000,
  },

  // divider must be a pure hex (not rgba) so alpha() in cross-cutting consumers
  // like the Chat.jsx grid overlay works correctly. Using bg-200 (#1f1e1c) gives
  // a subtle dark-on-dark line at whatever opacity the consumer requests.
  divider: H.bg400,

  // Custom: border tokens
  border: {
    default: alpha(H.border200, 0.13),
    subtle: alpha(H.border200, 0.075),
    hover: alpha(H.border200, 0.18),
    focus: alpha(H.brand000, 0.52),
  },

  action: {
    hover: alpha(H.text000, 0.055),
    selected: alpha(H.text000, 0.085),
    disabled: alpha(H.text000, 0.38),
    disabledBackground: alpha(H.text000, 0.08),
    focus: alpha(H.text000, 0.1),
    active: alpha(H.text000, 0.72),
  },

  // Custom: scrollbar tokens
  scrollbar: {
    track: 'transparent',
    thumb: alpha(H.border200, 0.14),
    thumbHover: alpha(H.border200, 0.24),
  },

  // Custom: code block styling
  code: {
    background: H.bg200,
    text: H.brand200,
    border: alpha(H.brand000, 0.12),
  },

  // Custom: Monaco editor colors
  monaco: {
    background: H.bg200,
    gutter: H.bg200,
    highlight: H.bg400,
    lineHighlight: H.bg300,
  },

  // Custom: chart color series
  chart: [
    H.brand000,
    H.info000,
    H.warning000,
    H.infoDark,
    H.brandDark,
    H.infoLight,
    H.accent000,
    H.danger000,
  ],
};

// ─── Typography ───────────────────────────────────────────────────────────────

const typography = createTypography(H);

// ─── Component overrides ──────────────────────────────────────────────────────

const focusRing = `0 0 0 3px ${alpha(H.brand000, 0.18)}`;
const neutralInteraction = getPaletteInteractionColors(palette);
const neutralOutlinedButtonStyles = getNeutralOutlinedButtonStyles(palette);
const neutralTextButtonStyles = getNeutralTextButtonStyles(palette);
const groupedButtonBorder = neutralInteraction.border;
const groupedButtonBg = alpha(H.bg100, 0.9);
const groupedButtonHoverBg = neutralInteraction.hoverBackground;
const groupedButtonSelectedBg = neutralInteraction.activeBackground;
const groupedButtonFocusRing = `0 0 0 3px ${neutralInteraction.focusRing}`;
const iconButtonFocusRing = `0 0 0 4px ${alpha(H.brand000, 0.2)}`;
const getIconButtonColorStyles = (main) => ({
  color: main,
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  boxShadow: 'none',
  '&:hover': {
    color: main,
    backgroundColor: alpha(main, 0.08),
    borderColor: 'transparent',
  },
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 4px ${alpha(main, 0.2)}`,
  },
});

const components = {
  MuiCssBaseline: {
    styleOverrides: {
      '*, *::before, *::after': { boxSizing: 'border-box' },

      '*': {
        scrollbarWidth: 'none',
      },
      '*::-webkit-scrollbar': { display: 'none' },
      '*::-webkit-scrollbar-corner': { backgroundColor: 'transparent' },

      html: {
        colorScheme: 'dark',
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

        '--app-scrollbar-size': '8px',
        '--scrollbar-track': 'transparent',
        '--scrollbar-thumb': alpha(H.border200, 0.14),
        '--scrollbar-thumb-hover': alpha(H.border200, 0.24),

        '--dark-mode': '1',
        '--color-bg-default': H.bg000,
        '--color-bg-paper': H.bg100,
        '--color-bg-elevated': H.bg000,
        '--color-bg-sunken': H.bg200,

        '--color-text-primary': H.text000,
        '--color-text-secondary': H.text200,
        '--color-text-disabled': H.text400,
        '--color-text-hint': H.text400,

        '--color-border-default': alpha(H.border200, 0.14),
        '--color-border-subtle': alpha(H.border200, 0.08),
        '--color-border-hover': alpha(H.border200, 0.22),
        '--color-border-focus': H.brand000,

        '--color-primary': H.brand000,
        '--color-primary-light': H.brand200,
        '--color-primary-dark': H.brandDark,
        '--color-primary-glow': H.brandGlow,
        '--color-error': H.danger000,
        '--color-warning': H.warning000,
        '--color-success': H.success000,
        '--color-info': H.info000,

        '--radius-sm': `${SHAPE.radius.sm}px`,
        '--radius-md': `${SHAPE.radius.md}px`,
        '--radius-lg': `${SHAPE.radius.lg}px`,
        '--radius-full': `${SHAPE.radius.full}px`,

        '--color-code-bg': alpha(H.brand000, 0.08),
        '--color-code-text': H.brand200,
        '--color-code-border': alpha(H.brand000, 0.16),

        '&::selection': {
          backgroundColor: alpha(H.brand000, 0.3),
          color: H.text000,
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
        textTransform: 'none',
        letterSpacing: 0,
        transition: TRANSITIONS.default,
        borderWidth: 1,
        borderStyle: 'solid',
        [MOBILE_SM_QUERY]: { minHeight: 44, padding: '10px 18px' },
        '&:active': { transform: 'scale(0.98)' },
        '&.Mui-disabled': {
          borderColor: alpha(H.border200, 0.1),
          color: H.text400,
          backgroundColor: alpha(H.bg200, 0.7),
          boxShadow: 'none',
        },
      },
      contained: getContainedButtonColorStyles(H.brand000),
      containedPrimary: getContainedButtonColorStyles(H.brand000),
      containedSecondary: getContainedButtonColorStyles(H.accent000),
      containedSuccess: getContainedButtonColorStyles(H.success000),
      containedWarning: getContainedButtonColorStyles(H.warning000),
      containedError: getContainedButtonColorStyles(H.danger000),
      containedInfo: getContainedButtonColorStyles(H.info000),
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
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        transition: TRANSITIONS.default,
        '& .MuiSvgIcon-root': { fontSize: 20 },
        '&:hover': {
          color: H.text000,
          backgroundColor: neutralInteraction.hoverBackground,
          borderColor: 'transparent',
        },
        '&.Mui-focusVisible': {
          outline: 'none',
          boxShadow: iconButtonFocusRing,
        },
        '&:active': { transform: 'scale(0.98)' },
        '&.Mui-disabled': {
          color: H.text400,
          backgroundColor: 'transparent',
          borderColor: 'transparent',
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
          backgroundColor: 'transparent',
          borderColor: neutralInteraction.border,
          boxShadow: 'none',
          '&:hover': {
            color: H.text000,
            backgroundColor: neutralInteraction.hoverBackground,
            borderColor: neutralInteraction.hoverBorder,
          },
          '&.Mui-focusVisible': {
            boxShadow: `0 0 0 4px ${alpha(H.brand000, 0.18)}`,
          },
        },
      },
    ],
  },

  // ── Paper ──────────────────────────────────────────────────────────────────
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.borderRadius,
        backgroundColor: H.bg100,
        backgroundImage: 'none',
      },
      elevation1: {
        boxShadow: 'none',
        border: `1px solid ${alpha(H.border200, 0.08)}`,
      },
      elevation2: {
        boxShadow: 'none',
      },
    },
  },

  MuiCard: {
    styleOverrides: {
      root: {
        backgroundColor: H.bg100,
        border: `1px solid ${alpha(H.border200, 0.08)}`,
        boxShadow: 'none',
        backgroundImage: 'none',
        transition: TRANSITIONS.default,
        '&:hover': {
          borderColor: alpha(H.border200, 0.18),
          boxShadow: 'none',
        },
      },
    },
  },

  // ── TextField / Input ──────────────────────────────────────────────────────
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: SHAPE.radius.md,
          backgroundColor: H.bg200,
          transition: TRANSITIONS.default,
          '& fieldset': {
            borderColor: alpha(H.border200, 0.12),
            borderWidth: 1,
            transition: TRANSITIONS.default,
          },
          '&:hover fieldset': { borderColor: alpha(H.border200, 0.2) },
          '&.Mui-focused': { boxShadow: focusRing },
          '&.Mui-focused fieldset': {
            borderColor: alpha(H.border200, 0.35),
            borderWidth: 1.5,
          },
        },
        '& .MuiInputBase-input': {
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
  MuiDivider: {
    styleOverrides: {
      root: { borderColor: alpha(H.border200, 0.1) },
    },
  },

  // ── Tooltip ────────────────────────────────────────────────────────────────
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: H.bg300,
        color: H.text000,
        fontSize: '0.75rem',
        fontWeight: 500,
        padding: '6px 12px',
        borderRadius: SHAPE.radius.sm,
        border: `1px solid ${alpha(H.border200, 0.1)}`,
        boxShadow: 'none',
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
        backgroundColor: neutralInteraction.activeBackground,
        color: H.text000,
        '&:hover': { backgroundColor: neutralInteraction.activeHoverBackground },
      },
      outlined: {
        borderColor: neutralInteraction.border,
        '&:hover': { backgroundColor: neutralInteraction.hoverBackground },
      },
    },
  },

  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundColor: H.bg100,
        backgroundImage: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        borderBottom: `1px solid ${alpha(H.border200, 0.08)}`,
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
        // Handled by getDialogPaperSx / DialogShell
      },
    },
  },

  MuiMenu: {
    styleOverrides: {
      paper: {
        borderRadius: '14px',
        border: `0.5px solid ${alpha(H.text000, 0.12)}`,
        backgroundColor: H.bg100,
        backgroundImage: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        boxShadow: 'none',
        [BACKDROP_FILTER_FALLBACK_QUERY]: {
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          backgroundColor: H.bg100,
        },
      },
      list: {
        py: UI_POPOVER.paperPadding,
        px: UI_POPOVER.paperPadding,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      },
    },
  },

  MuiMenuItem: {
    styleOverrides: {
      root: {
        ...typography.uiMenuItemSm,
        minHeight: UI_POPOVER.rowMinHeight,
        borderRadius: UI_POPOVER.rowRadius,
        margin: 0,
        padding: '6px 8px',
        gap: 8,
        transition: TRANSITIONS.default,
        [MOBILE_SM_QUERY]: { minHeight: 44 },
        '& .MuiListItemIcon-root': {
          minWidth: UI_POPOVER.iconSlotWidth,
          width: UI_POPOVER.iconSlotWidth,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'inherit',
        },
        '& .MuiSvgIcon-root': {
          fontSize: UI_POPOVER.iconSize,
        },
        '&:hover': { backgroundColor: neutralInteraction.hoverBackground },
        '&.Mui-selected': {
          backgroundColor: neutralInteraction.activeBackground,
          fontWeight: 600,
          '&:hover': { backgroundColor: neutralInteraction.activeHoverBackground },
        },
      },
    },
  },

  MuiTableCell: {
    styleOverrides: {
      root: { borderBottom: `1px solid ${alpha(H.border200, 0.08)}` },
      head: {
        color: H.text200,
        fontWeight: 600,
        backgroundColor: alpha(H.text000, 0.05),
      },
    },
  },

  MuiTablePagination: {
    styleOverrides: {
      root: {
        backgroundColor: H.bg000,
        borderTop: `1px solid ${alpha(H.border200, 0.08)}`,
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
        border: `1px solid ${alpha(H.border200, 0.08)}`,
      },
      standardSuccess: {
        backgroundColor: alpha(H.success000, 0.1),
        '& .MuiAlert-icon': { color: H.success000 },
      },
      standardInfo: {
        backgroundColor: alpha(H.info000, 0.1),
        '& .MuiAlert-icon': { color: H.info000 },
      },
      standardWarning: {
        backgroundColor: alpha(H.warning000, 0.1),
        '& .MuiAlert-icon': { color: H.warning000 },
      },
      standardError: {
        backgroundColor: alpha(H.danger000, 0.1),
        '& .MuiAlert-icon': { color: H.danger000 },
      },
    },
  },

  MuiSnackbarContent: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.md,
        border: `1px solid ${alpha(H.border200, 0.08)}`,
        backgroundColor: H.bg100,
        color: H.text000,
      },
    },
  },

  MuiSkeleton: {
    defaultProps: {
      animation: 'wave',
    },
    styleOverrides: {
      root: {
        // Layered skeleton treatment: a base fill + a subtle top-edge highlight
        // so the skeleton reads as a "sunken surface" rather than a flat block.
        // This matches the rest of the dark theme's "elevated panel" language.
        backgroundColor: alpha(H.text200, 0.06),
        backgroundImage: `linear-gradient(
          180deg,
          ${alpha(H.text000, 0.04)} 0%,
          ${alpha(H.text000, 0.02)} 40%,
          transparent 100%
        )`,
        borderRadius: SHAPE.radius.sm,
        // Wave animation overlay is drawn by MUI on top of backgroundColor.
        // We tune the wave keyframe via CSS variable to make it subtle.
        '&::after': {
          background: `linear-gradient(
            90deg,
            transparent 0%,
            ${alpha(H.text000, 0.08)} 50%,
            transparent 100%
          )`,
        },
      },
    },
  },

  MuiLinearProgress: {
    styleOverrides: {
      root: {
        borderRadius: SHAPE.radius.full,
        backgroundColor: alpha(H.text000, 0.08),
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
        letterSpacing: 0,
        color: H.text200,
        padding: '8px 16px',
        transition: TRANSITIONS.default,
        '&.Mui-selected': { color: H.text000, fontWeight: 600 },
        '&:hover': { color: H.text000, backgroundColor: neutralInteraction.hoverBackground },
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
          color: H.bg000,
          '& + .MuiSwitch-track': {
            opacity: 1,
            // Green = "on / enabled / active". This is a deliberate semantic
            // color choice — switches are the one control where green is the
            // universal "this is turned on" signal. Matches the light theme.
            backgroundColor: H.success000,
          },
        },
        '&.Mui-focusVisible + .MuiSwitch-track': {
          // Focus ring uses the same green so keyboard users see the
          // connection between the focus state and the on state.
          boxShadow: `0 0 0 4px ${alpha(H.success000, 0.24)}`,
        },
        '&.Mui-disabled + .MuiSwitch-track': { opacity: 0.5 },
      },
      thumb: { boxShadow: 'none', width: 16, height: 16 },
      track: {
        opacity: 1,
        borderRadius: 10,
        backgroundColor: alpha(H.text000, 0.2),
        border: 'none',
      },
    },
  },

  MuiSelect: {
    styleOverrides: {
      root: { borderRadius: SHAPE.radius.md },
      select: { color: H.text000 },
      icon: { color: H.text200, transition: TRANSITIONS.default },
    },
  },

  MuiLink: {
    styleOverrides: {
      root: {
        color: H.brand200,
        textDecorationColor: alpha(H.brand200, 0.35),
        textUnderlineOffset: '2px',
        transition: TRANSITIONS.default,
        '&:hover': { color: H.brand000 },
      },
    },
  },

  MuiAccordion: {
    styleOverrides: {
      root: {
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        boxShadow: 'none',
        border: `1px solid ${alpha(H.border200, 0.08)}`,
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
        '&:hover': { backgroundColor: alpha(H.text000, 0.04) },
        '&.Mui-expanded': {
          minHeight: 48,
          borderBottom: `1px solid ${alpha(H.border200, 0.08)}`,
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
        '&:hover': { backgroundColor: neutralInteraction.hoverBackground },
        '&.Mui-selected': {
          backgroundColor: neutralInteraction.activeBackground,
          '&:hover': { backgroundColor: neutralInteraction.activeHoverBackground },
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
          '&:hover': { backgroundColor: neutralInteraction.activeHoverBackground },
        },
        '&.Mui-focusVisible': {
          position: 'relative',
          zIndex: 1,
          boxShadow: groupedButtonFocusRing,
        },
        '&.Mui-disabled': {
          color: H.text400,
          backgroundColor: alpha(H.bg200, 0.8),
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
        boxShadow: 'none',
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
      shrink: { fontSize: '0.75rem', letterSpacing: 0 },
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
        '&.Mui-checked': { color: H.brand000 },
        '&.MuiCheckbox-indeterminate': { color: H.brand000 },
      },
    },
  },

  MuiRadio: {
    styleOverrides: {
      root: {
        color: H.text200,
        '&.Mui-checked': { color: H.brand000 },
      },
    },
  },

  MuiBadge: {
    styleOverrides: {
      badge: {
        fontWeight: 600,
        border: `1px solid ${alpha(H.bg100, 0.2)}`,
      },
    },
  },

  MuiPopover: {
    styleOverrides: {
      paper: {
        backgroundColor: H.bg100,
        backgroundImage: 'none',
        border: `1px solid ${alpha(H.border200, 0.1)}`,
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        boxShadow: 'none',
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

export const createDarkTheme = () => {
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
