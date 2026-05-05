/**
 * Shared styling helpers built on theme tokens.
 */
import { alpha } from '@mui/material/styles';
import { HOVER_CAPABLE_QUERY, BACKDROP_FILTER_FALLBACK_QUERY } from './mediaQueries';
import { getMoonlitBrandGradients } from './themeEffects';

export const DIALOG_VIEWPORT_SUPPORT_QUERY = '@supports (height: 100dvh)';

export const UI_LAYOUT = Object.freeze({
  touchTarget: 44,
  compactTouchTarget: 40,
  sidebarExpandedWidth: 260,
  sidebarCollapsedWidth: 52,
  chatInputMaxWidth: 768,
  contentMaxWidth: 800,
  dialogDesktopOffset: 64,
});

export const getGlassmorphismStyles = (theme) => ({
  background: theme.palette.glassmorphism.background,
  backdropFilter: theme.palette.glassmorphism.backdropFilter,
  WebkitBackdropFilter: theme.palette.glassmorphism.backdropFilter,
  borderColor: theme.palette.glassmorphism.borderColor,
});

export const getScrollbarStyles = (_theme, _opts = {}) => ({
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
});

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

export const getCompactActionSx = (
  theme,
  {
    size = UI_LAYOUT.touchTarget,
    color = 'text.secondary',
  } = {},
) => ({
  width: size,
  height: size,
  minWidth: size,
  minHeight: size,
  flexShrink: 0,
  color,
  opacity: 0.65,
  transition: 'opacity 0.15s ease',
  '&:hover': { opacity: 1, backgroundColor: 'transparent' },
});

export const getToolbarChipSx = (
  theme,
  {
    interactive = true,
  } = {},
) => ({
  height: 32,
  borderRadius: '6px',
  border: 'none',
  backgroundColor: 'transparent',
  color: 'text.secondary',
  transition: 'background-color 150ms ease, color 150ms ease',
  '& .MuiChip-label': {
    px: 1.25,
    ...theme.typography.uiCaptionSm,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
  },
  '& .MuiChip-icon': {
    fontSize: 16,
    ml: 0.875,
    mr: -0.25,
    color: alpha(theme.palette.text.primary, 0.45),
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  '&:active': { transform: 'scale(0.995)' },
  ...(interactive
    ? {
        [HOVER_CAPABLE_QUERY]: {
          '&:hover': {
            backgroundColor: alpha(theme.palette.text.primary, 0.06),
            color: 'text.primary',
            '& .MuiChip-icon': {
              color: alpha(theme.palette.text.primary, 0.65),
            },
          },
        },
      }
    : {}),
});

export const getPrimaryActionButtonSx = (theme, {
  minHeight,
  borderRadius = 1.5,
} = {}) => {
  const isDark = theme.palette.mode === 'dark';
  const brandGradients = getMoonlitBrandGradients(theme);
  const shadowColor = theme.palette.common.black;

  return {
    py: { xs: 1, sm: 1.125 },
    minHeight,
    borderRadius,
    fontWeight: 600,
    backgroundImage: brandGradients.static,
    backgroundColor: 'transparent',
    color: theme.palette.primary.contrastText,
    border: 'none',
    boxShadow: `0 10px 26px ${alpha(shadowColor, isDark ? 0.32 : 0.12)}`,
    transition: theme.transitions.create(
      ['filter', 'transform', 'box-shadow'],
      { duration: 200 },
    ),
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        filter: 'brightness(1.12)',
        transform: 'translateY(-1px)',
        boxShadow: `0 14px 32px ${alpha(shadowColor, isDark ? 0.38 : 0.16)}`,
      },
    },
    '&:active': { transform: 'scale(0.98)', boxShadow: 'none' },
    '&.Mui-disabled': {
      backgroundImage: 'none',
      backgroundColor: alpha(theme.palette.text.primary, 0.3),
      color: alpha('#fff', 0.6),
      boxShadow: 'none',
    },
  };
};

export const getGhostIconButtonSx = (
  theme,
  {
    size = 32,
    radius = 1.5,
    color = 'text.secondary',
    active = false,
    activeColor = 'text.primary',
    disabledColor = 'text.disabled',
  } = {},
) => ({
  width: size,
  height: size,
  minWidth: size,
  minHeight: size,
  flexShrink: 0,
  borderRadius: radius,
  color: active ? activeColor : color,
  backgroundColor: 'transparent',
  opacity: active ? 1 : 0.65,
  transition: 'opacity 0.15s ease, background-color 0.15s ease, color 0.15s ease',
  [HOVER_CAPABLE_QUERY]: {
    '&:hover': {
      opacity: 1,
      backgroundColor: 'transparent',
    },
  },
  '&.Mui-disabled': {
    color: disabledColor,
    backgroundColor: 'transparent',
    opacity: 0.38,
  },
});

export const getPopoverSectionLabelSx = (theme, { pt = 0.5 } = {}) => ({
  px: 1,
  pt,
  pb: 0.25,
  ...theme.typography.uiMonoLabel,
  color: 'text.disabled',
  display: 'block',
  lineHeight: 1,
});

export const getSelectableMenuItemSx = (
  theme,
  {
    isActive = false,
    minHeight = 32,
    columns = 'minmax(0, 1fr) auto',
    gap = 1,
  } = {},
) => {
  const isDark = theme.palette.mode === 'dark';
  const activeBg = alpha(theme.palette.text.primary, isDark ? 0.1 : 0.07);
  const hoverBg = alpha(theme.palette.text.primary, isDark ? 0.07 : 0.05);
  const activeHoverBg = alpha(theme.palette.text.primary, isDark ? 0.13 : 0.09);

  return {
    borderRadius: '8px',
    px: 1,
    py: 0.875,
    minHeight,
    cursor: 'pointer',
    display: 'grid',
    gridTemplateColumns: columns,
    gap,
    alignItems: 'center',
    userSelect: 'none',
    transition: 'background-color 120ms',
    backgroundColor: isActive ? activeBg : 'transparent',
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        backgroundColor: isActive ? activeHoverBg : hoverBg,
      },
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

export const getDialogNavPaneSx = (theme, width) => ({
  width,
  flexShrink: 0,
  borderRight: 1,
  borderColor: 'divider',
  backgroundColor: alpha(theme.palette.background.default, 0.5),
  overflowY: 'auto',
});

export const getDialogScrollablePaneSx = ({ padding = { xs: 2, sm: 3 } } = {}) => ({
  flex: 1,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  p: padding,
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
      ? alpha(theme.palette.text.primary, 0.1)
      : alpha(theme.palette.text.primary, 0.08)
  }`,
  backgroundColor: isDark
    ? alpha(theme.palette.background.paper, 0.97)
    : alpha(theme.palette.background.paper, 0.99),
  backgroundImage: 'none',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: isDark
    ? `0 2px 8px ${alpha('#000', 0.32)}`
    : `0 2px 8px ${alpha('#000', 0.08)}`,
  [BACKDROP_FILTER_FALLBACK_QUERY]: {
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    backgroundColor: theme.palette.background.paper,
  },
  ...overrides,
});
