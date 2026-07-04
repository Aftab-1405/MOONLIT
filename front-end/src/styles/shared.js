/**
 * Shared styling helpers built on theme tokens.
 *
 * This module is the single source of truth for cross-cutting styling
 * primitives (popover paper, menu items, scrollbars, focus rings, etc.).
 * Anything that needs to look the same in multiple places should live here
 * so we can evolve the visual language in one shot.
 *
 * Conventions:
 *   - Hairline borders always use `1px solid <alpha(text.primary, n)>`.
 *     We avoid `0.5px` borders — they disappear on non-retina displays and
 *     render inconsistently across browsers. Lower alpha achieves the same
 *     "soft" feel without the rendering risk.
 *   - Focus rings use `--focus-ring` token below; do not roll your own.
 *   - Scrollbars are visible-but-subtle. Hiding them entirely (the old
 *     behaviour) removed a key navigation affordance in long conversations.
 */
import { alpha } from '@mui/material/styles';
import { BACKDROP_FILTER_FALLBACK_QUERY, HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';

const DIALOG_VIEWPORT_SUPPORT_QUERY = '@supports (height: 100dvh)';

export const UI_LAYOUT = Object.freeze({
  touchTarget: 44,
  compactTouchTarget: 40,
  sidebarExpandedWidth: 260,
  sidebarCollapsedWidth: 52,
  chatInputMaxWidth: 768,
  contentMaxWidth: 800,
  dialogDesktopOffset: 64,
});

// ─── Z-index layer cake ───────────────────────────────────────────────────────
//
// Must stay in sync with MUI's built-in zIndex defaults:
//   appBar        1100
//   drawer        1200
//   modal         1300  ← ALL MUI portals: Menu, Popover, Select, Autocomplete
//   snackbar      1400
//   tooltip       1500
//
// Rule: artifactFullscreen MUST stay between drawer (1200) and modal (1300).
// If it ever exceeds 1300, MUI sidebar menus/popovers will be hidden behind
// the fullscreen panel — which is the bug this change was made to fix.
// ─────────────────────────────────────────────────────────────────────────────
export const UI_Z_INDEX = Object.freeze({
  mainContentBase: 1,
  mainContentControl: 3,
  artifactStickyHeader: 2,
  artifactFullscreen: 1250, // above drawer (1200), BELOW MUI modal (1300)
  mainContentModal: 1320, // our custom modals — above MUI modal
  confirmModal: 1400, // highest priority — confirm/destructive dialogs
});

export const UI_POPOVER = Object.freeze({
  paperPadding: 0.75,
  rowRadius: '8px',
  rowMinHeight: 34,
  rowPaddingX: 1,
  rowPaddingY: 0.75,
  rowGap: 1,
  iconSlotWidth: 24,
  iconSize: 16,
  sectionGap: 0.5,
});

/**
 * Standardised hairline border colour.
 *
 * We deliberately avoid `0.5px` borders (they vanish on non-retina screens).
 * Using `1px` with a low alpha gives a crisp-but-soft divider that renders
 * consistently across DPRs.
 *
 * @param {object} theme  MUI theme
 * @param {number} [opacity]  Override the default alpha (defaults to 0.07/0.09)
 */
export const getHairlineBorder = (theme, opacity) => {
  const isDark = theme.palette.mode === 'dark';
  const o = opacity ?? (isDark ? 0.09 : 0.07);
  return `1px solid ${alpha(theme.palette.text.primary, o)}`;
};

/**
 * Standardised focus ring for keyboard navigation.
 * Use as `&:focus-visible` outline or as a `box-shadow` for inset focus.
 *
 * @param {object} theme
 * @param {object} [opts]
 * @param {string} [opts.color]  Override colour (defaults to text.primary)
 * @param {number} [opts.width]  Ring width in px (default 2)
 * @param {number} [opts.offset] Outline offset in px (default 2)
 */
export const getFocusRing = (theme, { color, width = 2, offset = 2 } = {}) => {
  const isDark = theme.palette.mode === 'dark';
  const ringColor = color || theme.palette.text.primary;
  const alphaVal = isDark ? 0.4 : 0.32;
  return {
    outline: `${width}px solid ${alpha(ringColor, alphaVal)}`,
    outlineOffset: offset,
  };
};

/**
 * Scrollbar styling — hidden by default for a unibody look.
 *
 * The Moonlit design language intentionally hides scrollbars to reduce visual
 * clutter and keep the interface feeling "intact" (one continuous surface
 * rather than a stack of scrollable regions). Scroll still works — the
 * scrollbar affordance is just invisible.
 *
 * This is a deliberate design decision, not an oversight. If you need a
 * visible scrollbar in a specific context (e.g. a data table where scroll
 * position is critical), override locally rather than changing this default.
 *
 * Firefox: `scrollbar-width: none`
 * WebKit/Blink: `::-webkit-scrollbar { display: none }`
 */
export const getScrollbarStyles = (_theme, _opts = {}) => ({
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
});

export const getPaletteInteractionColors = (palette, { active = false, tone = 'neutral' } = {}) => {
  const isDark = palette.mode === 'dark';
  const semanticColor = palette[tone]?.main;
  const color = tone === 'neutral' ? palette.text.primary : semanticColor || palette.text.primary;
  const textColor = tone === 'neutral' ? palette.text.primary : color;
  const restingTextColor = tone === 'neutral' ? palette.text.secondary : color;

  if (tone !== 'neutral') {
    return {
      color: active ? textColor : restingTextColor,
      restingColor: restingTextColor,
      hoverColor: textColor,
      activeColor: textColor,
      background: active ? alpha(color, isDark ? 0.16 : 0.1) : 'transparent',
      hoverBackground: alpha(color, isDark ? 0.2 : 0.08),
      activeBackground: alpha(color, isDark ? 0.24 : 0.12),
      activeHoverBackground: alpha(color, isDark ? 0.28 : 0.16),
      border: alpha(color, isDark ? 0.18 : 0.14),
      hoverBorder: alpha(color, isDark ? 0.28 : 0.22),
      activeBorder: alpha(color, isDark ? 0.34 : 0.28),
      focusRing: alpha(color, isDark ? 0.22 : 0.16),
    };
  }

  const black = palette.common?.black || '#000000';

  return {
    color: active ? palette.text.primary : palette.text.secondary,
    restingColor: palette.text.secondary,
    hoverColor: palette.text.primary,
    activeColor: palette.text.primary,
    background: active
      ? isDark
        ? alpha(black, 0.78)
        : alpha(palette.text.primary, 0.08)
      : 'transparent',
    hoverBackground: isDark ? alpha(black, 0.58) : alpha(palette.text.primary, 0.045),
    activeBackground: isDark ? alpha(black, 0.78) : alpha(palette.text.primary, 0.08),
    activeHoverBackground: isDark ? black : alpha(palette.text.primary, 0.11),
    border: alpha(palette.text.primary, isDark ? 0.1 : 0.08),
    hoverBorder: alpha(palette.text.primary, isDark ? 0.16 : 0.14),
    activeBorder: alpha(palette.text.primary, isDark ? 0.2 : 0.16),
    focusRing: alpha(palette.text.primary, isDark ? 0.18 : 0.12),
  };
};

export const getInteractionColors = (theme, options = {}) =>
  getPaletteInteractionColors(theme.palette, options);

export const getInteractiveControlSx = (
  theme,
  {
    active = false,
    tone = 'neutral',
    size = 36,
    radius = '8px',
    showBorder = tone !== 'neutral',
  } = {},
) => {
  const interaction = getInteractionColors(theme, { active, tone });
  return {
    minHeight: size,
    borderRadius: radius,
    color: interaction.color,
    backgroundColor: interaction.background,
    borderColor: showBorder && active ? interaction.activeBorder : 'transparent',
    transition: theme.transitions.create(
      ['background-color', 'border-color', 'color', 'box-shadow'],
      {
        duration: theme.transitions.duration.shorter,
      },
    ),
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        color: interaction.hoverColor,
        backgroundColor: active ? interaction.activeHoverBackground : interaction.hoverBackground,
        borderColor: showBorder
          ? active
            ? interaction.activeBorder
            : interaction.hoverBorder
          : 'transparent',
      },
    },
    '&:focus-visible': {
      outline: `2px solid ${interaction.focusRing}`,
      outlineOffset: 2,
    },
  };
};

export const getInteractiveIconButtonSx = (
  theme,
  {
    active = false,
    tone = 'neutral',
    size = 36,
    radius = '8px',
    showBorder = tone !== 'neutral',
  } = {},
) => ({
  ...getInteractiveControlSx(theme, { active, tone, size, radius, showBorder }),
  width: size,
  height: size,
  minWidth: size,
  minHeight: size,
  p: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid transparent',
  boxShadow: 'none',
});

export const getSegmentedToggleGroupSx = (
  theme,
  { itemMinHeight = 34, itemRadius = '8px', gap = 0.25 } = {},
) => {
  const interaction = getInteractionColors(theme);

  return {
    p: 0,
    gap,
    borderRadius: itemRadius,
    border: 'none',
    backgroundColor: 'transparent',
    boxShadow: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    '& .MuiToggleButtonGroup-grouped': {
      minHeight: itemMinHeight,
      px: 1.25,
      py: 0,
      gap: 0.75,
      border: '1px solid transparent',
      borderColor: 'transparent',
      borderRadius: `${itemRadius} !important`,
      ml: '0 !important',
      textTransform: 'none',
      ...theme.typography.uiNavItem,
      fontWeight: 500,
      color: 'text.secondary',
      backgroundColor: 'transparent',
      transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
        duration: theme.transitions.duration.shorter,
      }),
      [HOVER_CAPABLE_QUERY]: {
        '&:hover': {
          color: 'text.primary',
          backgroundColor: interaction.hoverBackground,
          borderColor: 'transparent',
        },
      },
      '&.Mui-selected': {
        color: 'text.primary',
        backgroundColor: interaction.activeBackground,
        borderColor: 'transparent',
        fontWeight: 600,
        [HOVER_CAPABLE_QUERY]: {
          '&:hover': {
            backgroundColor: interaction.activeHoverBackground,
            borderColor: 'transparent',
          },
        },
      },
      '&.Mui-disabled': {
        borderColor: 'transparent',
      },
    },
  };
};

export const getPopoverMenuListSx = () => ({
  py: UI_POPOVER.paperPadding,
  px: UI_POPOVER.paperPadding,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.25,
});

export const getPopoverMenuItemSx = (
  theme,
  { active = false, tone = 'neutral', columns = 'auto minmax(0, 1fr)' } = {},
) => {
  const interaction = getInteractionColors(theme, { active, tone });

  return {
    ...theme.typography.uiMenuItemSm,
    minHeight: UI_POPOVER.rowMinHeight,
    borderRadius: UI_POPOVER.rowRadius,
    px: UI_POPOVER.rowPaddingX,
    py: UI_POPOVER.rowPaddingY,
    my: 0,
    mx: 0,
    gap: UI_POPOVER.rowGap,
    display: 'grid',
    gridTemplateColumns: columns,
    alignItems: 'center',
    color: interaction.color,
    backgroundColor: interaction.background,
    transition: theme.transitions.create(['background-color', 'color'], {
      duration: theme.transitions.duration.shorter,
    }),
    '& .MuiListItemIcon-root': {
      minWidth: UI_POPOVER.iconSlotWidth,
      width: UI_POPOVER.iconSlotWidth,
      color: 'inherit',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '& .MuiSvgIcon-root': {
      fontSize: UI_POPOVER.iconSize,
    },
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        color: interaction.hoverColor,
        backgroundColor: active ? interaction.activeHoverBackground : interaction.hoverBackground,
      },
    },
    '&.Mui-selected': {
      color: interaction.activeColor,
      backgroundColor: interaction.activeBackground,
      fontWeight: 600,
      [HOVER_CAPABLE_QUERY]: {
        '&:hover': {
          backgroundColor: interaction.activeHoverBackground,
        },
      },
    },
  };
};

export const getInsetPanelSx = (
  theme,
  { backgroundOpacity = 0.5, borderRadius = 2, enableHover = false } = {},
) => ({
  borderRadius,
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: alpha(theme.palette.background.paper, backgroundOpacity),
  ...(enableHover
    ? {
        transition: 'border-color 0.15s ease',
        [HOVER_CAPABLE_QUERY]: {
          '&:hover': {
            borderColor: alpha(theme.palette.text.primary, 0.15),
          },
        },
      }
    : {}),
});

export const getUtilityIconButtonSx = (theme, { padding = 0.5, radius = '6px' } = {}) => {
  const baseSx = getInteractiveControlSx(theme, { radius });
  return {
    ...baseSx,
    p: padding,
    minHeight: 'auto',
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    boxShadow: 'none',
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        ...baseSx[HOVER_CAPABLE_QUERY]?.['&:hover'],
        borderColor: 'transparent',
      },
    },
  };
};

export const getPopoverSectionLabelSx = (theme, { pt = 0.5 } = {}) => ({
  px: UI_POPOVER.rowPaddingX,
  pt,
  pb: 0.25,
  ...theme.typography.uiMenuItemSm,
  fontWeight: 650,
  letterSpacing: 0,
  textTransform: 'none',
  color: 'text.secondary',
  display: 'block',
  lineHeight: 1.35,
});

export const getSelectableMenuItemSx = (
  theme,
  {
    isActive = false,
    minHeight = UI_POPOVER.rowMinHeight,
    columns = 'minmax(0, 1fr) auto',
    gap = UI_POPOVER.rowGap,
  } = {},
) => {
  const interaction = getInteractionColors(theme, { active: isActive });

  return {
    borderRadius: UI_POPOVER.rowRadius,
    my: 0.125,
    px: UI_POPOVER.rowPaddingX,
    py: UI_POPOVER.rowPaddingY,
    minHeight,
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: columns,
    gap,
    alignItems: 'center',
    userSelect: 'none',
    backgroundClip: 'padding-box',
    transition: theme.transitions.create(['background-color', 'box-shadow'], {
      duration: theme.transitions.duration.shorter,
    }),
    backgroundColor: isActive ? interaction.activeBackground : 'transparent',
    boxShadow: isActive
      ? `inset 0 0 0 1px ${interaction.activeBorder}`
      : 'inset 0 0 0 1px transparent',
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        backgroundColor: isActive ? interaction.activeHoverBackground : interaction.hoverBackground,
        boxShadow: isActive
          ? `inset 0 0 0 1px ${interaction.activeBorder}`
          : 'inset 0 0 0 1px transparent',
      },
    },
    '&:first-of-type': {
      mt: 0,
    },
    '&:last-of-type': {
      mb: 0,
    },
  };
};

export const getDialogPaperSx = (
  theme,
  { isMobile = false, desktopMaxHeight = 720, desktopMinHeight = 400 } = {},
) => ({
  ...getPopoverPaperSx(theme, theme.palette.mode === 'dark', {
    borderRadius: isMobile ? 0 : '16px',
    height: isMobile ? '100vh' : `calc(100vh - ${UI_LAYOUT.dialogDesktopOffset}px)`,
    maxHeight: isMobile ? '100vh' : desktopMaxHeight,
    minHeight: isMobile ? '100vh' : desktopMinHeight,
    [DIALOG_VIEWPORT_SUPPORT_QUERY]: isMobile
      ? {
          height: '100dvh',
          maxHeight: '100dvh',
          minHeight: '100dvh',
        }
      : {},
    overflow: 'hidden',
  }),
});

export const getDialogHeaderSx = () => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  px: { xs: 2, sm: 3 },
  py: 2,
  borderBottom: 1,
  borderColor: 'divider',
});

export const getDialogFooterSx = () => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  px: { xs: 2, sm: 3 },
  py: 2,
  paddingBottom: { xs: 'max(env(safe-area-inset-bottom), 12px)', sm: 2 },
  borderTop: 1,
  borderColor: 'divider',
});

/**
 * Shared popover/menu paper styles.
 * Use this for any MUI Popover, Menu, or Select MenuProps so all
 * floating surfaces look identical regardless of which primitive is used.
 *
 * @example — MUI Menu
 *   PaperProps={{ sx: getPopoverPaperSx(theme, isDark) }}
 *
 * @example — MUI Select
 *   MenuProps={{ PaperProps: { sx: getPopoverPaperSx(theme, isDark) } }}
 *
 * @example — AppPopover (handled internally, no need to call directly)
 *
 * @param {object} theme     — MUI theme
 * @param {boolean} isDark   — whether dark mode is active
 * @param {object} overrides — extra sx merged last (e.g. width, mt, p overrides)
 */
/**
 * Shared secondary action button sx.
 *
 * Used for small action buttons that appear inside content areas —
 * "View diagram", "Filter to selection", "Copy row", "Load older messages",
 * etc. Keeps every small action button in the app visually identical:
 *   - borderRadius: 8px
 *   - typography: uiBodySm
 *   - color: text.secondary → text.primary on hover
 *   - border: hairline at low alpha
 *   - padding: px 1.75, py 0.625
 *
 * Usage:
 *   <Button size="small" variant="outlined" sx={getSecondaryActionButtonSx(theme)}>...</Button>
 */
export const getSecondaryActionButtonSx = (theme) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRadius: '8px',
    textTransform: 'none',
    ...theme.typography.uiBodySm,
    fontWeight: 600,
    px: 1.75,
    py: 0.5,
    minHeight: 30,
    color: 'text.secondary',
    borderColor: alpha(theme.palette.text.primary, isDark ? 0.16 : 0.12),
    backgroundColor: 'transparent',
    transition: theme.transitions.create(
      ['background-color', 'border-color', 'color'],
      { duration: theme.transitions.duration.shorter },
    ),
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        color: 'text.primary',
        borderColor: alpha(theme.palette.text.primary, isDark ? 0.24 : 0.18),
        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
      },
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${alpha(theme.palette.text.primary, isDark ? 0.32 : 0.22)}`,
      outlineOffset: 2,
    },
  };
};

/**
 * Shared pill/chip sx for suggestion chips and similar inline action pills.
 *
 * Used by:
 *   - WelcomeScreen suggestion chips
 *
 * Pills are bordered, transparent by default, lift slightly on hover.
 * Keep this as the single source of truth for pill geometry so every
 * pill in the app looks identical.
 */
export const getPillSx = (theme, interaction) => ({
  height: 30,
  borderRadius: '8px',
  border: '1px solid',
  borderColor: interaction.border,
  color: 'text.secondary',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  transition: theme.transitions.create(['background-color', 'color', 'transform', 'box-shadow'], {
    duration: theme.transitions.duration.shorter,
  }),
  '&:active': {
    backgroundColor: interaction.activeBackground,
    transform: 'translateY(0.5px)',
  },
  '& .MuiChip-label': {
    px: 1.2,
    ...theme.typography.uiCaptionSm,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  '& .MuiChip-icon': {
    color: alpha(theme.palette.text.primary, 0.45),
    ml: 1,
    mr: -0.25,
    fontSize: 16,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    transition: theme.transitions.create('color', {
      duration: theme.transitions.duration.shorter,
    }),
  },
  [HOVER_CAPABLE_QUERY]: {
    '&:hover': {
      borderColor: interaction.hoverBorder,
      backgroundColor: interaction.hoverBackground,
      color: 'text.primary',
      transform: 'translateY(-1.5px)',
      boxShadow: `0 3px 10px ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.03)}`,
      '& .MuiChip-icon': {
        color: alpha(theme.palette.text.primary, 0.65),
      },
    },
  },
  '&.Mui-focusVisible': {
    borderColor: interaction.hoverBorder,
    boxShadow: `0 0 0 3px ${interaction.focusRing}`,
  },
});

export const getPopoverPaperSx = (theme, isDark, overrides = {}) => ({
  borderRadius: '14px',
  // 1px (not 0.5px) so the border survives on non-retina displays.
  border: `1px solid ${
    isDark ? alpha(theme.palette.text.primary, 0.12) : alpha(theme.palette.text.primary, 0.09)
  }`,
  backgroundColor: isDark
    ? alpha(theme.palette.background.paper, 0.96)
    : alpha(theme.palette.background.paper, 0.99),
  backgroundImage: isDark
    ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.04)} 0%, transparent 100%)`
    : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.65)} 0%, transparent 100%)`,
  backdropFilter: 'blur(24px) saturate(1.15)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.15)',
  // Layered shadow = premium feel. Two-stop shadow (close + ambient)
  // reads as "elevated but not floating" rather than a hard drop shadow.
  boxShadow: isDark
    ? `0 12px 40px ${alpha('#000', 0.42)}, 0 2px 8px ${alpha('#000', 0.28)}, 0 0 0 0.5px ${alpha(theme.palette.common.white, 0.04)}`
    : `0 12px 36px ${alpha('#000', 0.1)}, 0 2px 8px ${alpha('#000', 0.06)}, 0 0 0 0.5px ${alpha(theme.palette.common.white, 0.8)}`,
  [BACKDROP_FILTER_FALLBACK_QUERY]: {
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    backgroundColor: theme.palette.background.paper,
  },
  ...overrides,
});
