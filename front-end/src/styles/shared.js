/**
 * Shared styling helpers built on theme tokens.
 */
import { alpha } from '@mui/material/styles';
import { HOVER_CAPABLE_QUERY } from './mediaQueries';

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

export const getScrollbarStyles = (theme, { size = 8 } = {}) => ({
  scrollbarWidth: 'thin',
  scrollbarColor: `${theme.palette.scrollbar.thumb} ${theme.palette.scrollbar.track}`,
  '&::-webkit-scrollbar': { width: size, height: size },
  '&::-webkit-scrollbar-track': { background: theme.palette.scrollbar.track },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.palette.scrollbar.thumb,
    borderRadius: 999,
    border: '2px solid transparent',
    backgroundClip: 'content-box',
    minHeight: 24,
    minWidth: 24,
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: theme.palette.scrollbar.thumbHover,
  },
  '&::-webkit-scrollbar-corner': {
    backgroundColor: 'transparent',
  },
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
  height: 26,
  borderRadius: '8px',
  border: '1px solid',
  borderColor: alpha(theme.palette.text.primary, 0.14),
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  '& .MuiChip-label': {
    px: 0.875,
    ...theme.typography.uiCaptionSm,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiChip-icon': {
    fontSize: 14,
    ml: 0.625,
    mr: -0.125,
    display: 'flex',
    alignItems: 'center',
  },
  ...(interactive
    ? {
        [HOVER_CAPABLE_QUERY]: {
          '&:hover': {
            borderColor: alpha(theme.palette.text.primary, 0.28),
            backgroundColor: alpha(theme.palette.text.primary, 0.07),
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
  const brand = theme.palette.primary.main;
  const brandLight = theme.palette.primary.light;
  const accent = theme.palette.secondary.main;

  return {
    py: { xs: 1, sm: 1.125 },
    minHeight,
    borderRadius,
    fontWeight: 600,
    backgroundImage: `linear-gradient(135deg, ${accent}, ${brandLight}, ${brand})`,
    backgroundColor: 'transparent',
    color: '#fff',
    border: 'none',
    boxShadow: `0 4px 20px ${alpha(brand, isDark ? 0.45 : 0.35)}`,
    transition: theme.transitions.create(
      ['filter', 'transform', 'box-shadow'],
      { duration: 200 },
    ),
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        filter: 'brightness(1.12)',
        transform: 'translateY(-1px)',
        boxShadow: `0 6px 24px ${alpha(brand, isDark ? 0.55 : 0.45)}`,
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




