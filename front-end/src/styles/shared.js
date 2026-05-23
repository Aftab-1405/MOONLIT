/**
 * Shared styling helpers built on theme tokens.
 */
import { alpha } from '@mui/material/styles';
import { HOVER_CAPABLE_QUERY, BACKDROP_FILTER_FALLBACK_QUERY } from '@/styles/mediaQueries';

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

export const UI_Z_INDEX = Object.freeze({
  mainContentBase: 1,
  mainContentControl: 3,
  artifactStickyHeader: 2,
  artifactFullscreen: 1310,
  mainContentModal: 1320,
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

export const getScrollbarStyles = (_theme, _opts = {}) => ({
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
});

export const getPaletteInteractionColors = (
  palette,
  {
    active = false,
    tone = 'neutral',
  } = {},
) => {
  const isDark = palette.mode === 'dark';
  const semanticColor = palette[tone]?.main;
  const color = tone === 'neutral'
    ? palette.text.primary
    : semanticColor || palette.text.primary;
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
      ? (isDark ? alpha(black, 0.78) : alpha(palette.text.primary, 0.08))
      : 'transparent',
    hoverBackground: isDark
      ? alpha(black, 0.58)
      : alpha(palette.text.primary, 0.045),
    activeBackground: isDark
      ? alpha(black, 0.78)
      : alpha(palette.text.primary, 0.08),
    activeHoverBackground: isDark
      ? black
      : alpha(palette.text.primary, 0.11),
    border: alpha(palette.text.primary, isDark ? 0.1 : 0.08),
    hoverBorder: alpha(palette.text.primary, isDark ? 0.16 : 0.14),
    activeBorder: alpha(palette.text.primary, isDark ? 0.2 : 0.16),
    focusRing: alpha(palette.text.primary, isDark ? 0.18 : 0.12),
  };
};

export const getInteractionColors = (theme, options = {}) => (
  getPaletteInteractionColors(theme.palette, options)
);

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
    transition: theme.transitions.create(['background-color', 'border-color', 'color', 'box-shadow'], {
      duration: theme.transitions.duration.shorter,
    }),
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        color: interaction.hoverColor,
        backgroundColor: active ? interaction.activeHoverBackground : interaction.hoverBackground,
        borderColor: showBorder
          ? (active ? interaction.activeBorder : interaction.hoverBorder)
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
  {
    itemMinHeight = 34,
    itemRadius = '8px',
    gap = 0.25,
  } = {},
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
  {
    active = false,
    tone = 'neutral',
    columns = 'auto minmax(0, 1fr)',
  } = {},
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
  {
    backgroundOpacity = 0.5,
    borderRadius = 2,
    enableHover = false,
  } = {},
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

export const getUtilityIconButtonSx = (
  theme,
  {
    padding = 0.5,
    radius = '6px',
  } = {},
) => {
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
  {
    isMobile = false,
    desktopMaxHeight = 720,
    desktopMinHeight = 400,
  } = {},
) => ({
  borderRadius: isMobile ? 0 : 3,
  backgroundImage: 'none',
  backgroundColor: theme.palette.background.paper,
  height: isMobile
    ? '100vh'
    : `calc(100vh - ${UI_LAYOUT.dialogDesktopOffset}px)`,
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
export const getPopoverPaperSx = (theme, isDark, overrides = {}) => ({
  borderRadius: '14px',
  border: `0.5px solid ${
    isDark
      ? alpha(theme.palette.text.primary, 0.12)
      : alpha(theme.palette.text.primary, 0.09)
  }`,
  backgroundColor: isDark
    ? alpha(theme.palette.background.paper, 0.96)
    : alpha(theme.palette.background.paper, 0.99),
  backgroundImage: isDark
    ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.04)} 0%, transparent 100%)`
    : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.65)} 0%, transparent 100%)`,
  backdropFilter: 'blur(24px) saturate(1.15)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.15)',
  boxShadow: isDark
    ? `0 12px 40px ${alpha('#000', 0.42)}, 0 0 0 0.5px ${alpha(theme.palette.common.white, 0.04)}`
    : `0 12px 36px ${alpha('#000', 0.1)}, 0 0 0 0.5px ${alpha(theme.palette.common.white, 0.8)}`,
  [BACKDROP_FILTER_FALLBACK_QUERY]: {
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    backgroundColor: theme.palette.background.paper,
  },
  ...overrides,
});
