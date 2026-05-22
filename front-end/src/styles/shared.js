/**
 * Shared styling helpers built on theme tokens.
 */
import { alpha } from '@mui/material/styles';
import { HOVER_CAPABLE_QUERY, BACKDROP_FILTER_FALLBACK_QUERY } from './mediaQueries';

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

export const getToolbarChipSx = (
  theme,
  {
    interactive = true,
  } = {},
) => {
  const isDark = theme.palette.mode === 'dark';
  return {
  height: 32,
  borderRadius: '8px',
  border: `0.5px solid ${alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06)}`,
  backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.04 : 0.025),
  color: 'text.secondary',
  transition: 'background-color 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
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
            backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.09 : 0.06),
            borderColor: alpha(theme.palette.text.primary, isDark ? 0.14 : 0.1),
            color: 'text.primary',
            boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, isDark ? 0.12 : 0.04)}`,
            '& .MuiChip-icon': {
              color: alpha(theme.palette.text.primary, 0.65),
            },
          },
        },
      }
    : {}),
};
};

export const getUtilityIconButtonSx = (
  theme,
  {
    padding = 0.5,
    radius = '6px',
    hoverOpacity = theme.palette.mode === 'dark' ? 0.1 : 0.06,
  } = {},
) => ({
  p: padding,
  borderRadius: radius,
  borderColor: 'transparent',
  backgroundColor: 'transparent',
  boxShadow: 'none',
  color: theme.palette.text.secondary,
  transition: theme.transitions.create(['opacity', 'background-color', 'color'], {
    duration: theme.transitions.duration.shorter,
  }),
  '&:hover': {
    color: theme.palette.text.primary,
    borderColor: 'transparent',
    backgroundColor: alpha(theme.palette.text.primary, hoverOpacity),
  },
});

export const getPopoverSectionLabelSx = (theme, { pt = 0.5 } = {}) => ({
  px: 1,
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
    minHeight = 32,
    columns = 'minmax(0, 1fr) auto',
    gap = 1,
  } = {},
) => {
  const isDark = theme.palette.mode === 'dark';
  const activeBg = alpha(theme.palette.text.primary, isDark ? 0.105 : 0.07);
  const hoverBg = alpha(theme.palette.text.primary, isDark ? 0.055 : 0.04);
  const activeHoverBg = alpha(theme.palette.text.primary, isDark ? 0.13 : 0.09);

  return {
    borderRadius: '8px',
    my: 0.125,
    px: 1,
    py: 0.875,
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
    backgroundColor: isActive ? activeBg : 'transparent',
    boxShadow: isActive
      ? `inset 0 0 0 1px ${alpha(theme.palette.text.primary, isDark ? 0.025 : 0.035)}`
      : 'inset 0 0 0 1px transparent',
    [HOVER_CAPABLE_QUERY]: {
      '&:hover': {
        backgroundColor: isActive ? activeHoverBg : hoverBg,
        boxShadow: isActive
          ? `inset 0 0 0 1px ${alpha(theme.palette.text.primary, isDark ? 0.04 : 0.05)}`
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
