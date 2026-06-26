import { alpha } from '@mui/material/styles';
import { getAppPanelSurfaceSx, getSidebarChromeSx } from '@/features/styles/interfaceChrome';
import { getInteractionColors, UI_LAYOUT } from '@/styles/shared';

const EXPANDED_WIDTH = UI_LAYOUT.sidebarExpandedWidth;   // 260
const COLLAPSED_WIDTH = UI_LAYOUT.sidebarCollapsedWidth; // 52
const SIDEBAR_RADIUS = '10px';

// ─── Shared token ────────────────────────────────────────────────────────────
// Every clickable row uses the same horizontal inset (px: ROW_PX = 8px each side).
// The icon column is ICON_COL wide — a fixed-width slot that centers the icon.
// Height is controlled by the row's minHeight, not the icon slot.
export const ROW_PX = 1;        // MUI spacing → 8px each side
export const ICON_COL = 36;     // px — fixed icon column width only (not height)
const ROW_HEIGHT = 36;   // px — single consistent row height for all items
const focusRing = (theme) => `0 0 0 3px ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.16 : 0.1)}`;

export function getSidebarRailTooltipSlotProps(theme) {
  return {
    popper: {
      modifiers: [
        {
          name: 'offset',
          options: { offset: [0, 8] },
        },
      ],
    },
    tooltip: {
      sx: {
        ...theme.typography.uiCaptionMd,
        borderRadius: '6px',
        px: 1,
        py: 0.5,
        color: theme.palette.background.paper,
        bgcolor: theme.palette.text.primary,
      },
    },
    arrow: {
      sx: {
        color: theme.palette.text.primary,
      },
    },
  };
}

export function getCollapsingLabelSx(theme, collapsed, maxWidth = 200) {
  return {
    flex: '1 1 auto',
    minWidth: 0,
    maxWidth: collapsed ? 0 : maxWidth,
    opacity: collapsed ? 0 : 1,
    overflow: 'hidden',
    transition: theme.transitions.create(['max-width', 'opacity'], {
      duration: 180,
      easing: theme.transitions.easing.easeInOut,
    }),
  };
}

// ─── Nav row (toggle, nav items, footer) ─────────────────────────────────────
export function buildNavRowSx(theme, { isActive = false, disabled = false } = {}) {
  const interaction = getInteractionColors(theme, { active: isActive });
  return {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: ROW_HEIGHT,
    minHeight: ROW_HEIGHT,
    px: ROW_PX,
    py: 0,
    gap: 0,
    border: '0.5px solid',
    borderColor: isActive ? interaction.activeBorder : 'transparent',
    outline: 'none',
    appearance: 'none',
    textAlign: 'left',
    cursor: disabled ? 'default' : 'pointer',
    borderRadius: SIDEBAR_RADIUS,
    boxSizing: 'border-box',
    backgroundColor: isActive ? interaction.activeBackground : 'transparent',
    boxShadow: 'none',
    color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
    opacity: disabled ? 0.4 : 1,
    transition: theme.transitions.create(['background-color', 'border-color', 'color', 'opacity'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover:not(:disabled)': {
      backgroundColor: isActive ? interaction.activeHoverBackground : interaction.hoverBackground,
      color: theme.palette.text.primary,
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: focusRing(theme),
    },
  };
}

// ─── Conversation row ─────────────────────────────────────────────────────────
export function buildConversationRowSx(theme, { isActive = false, menuOpen = false } = {}) {
  const interaction = getInteractionColors(theme, { active: isActive });
  return {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
    height: ROW_HEIGHT,
    minHeight: ROW_HEIGHT,
    pl: 0,
    pr: 3.5,
    py: 0,
    mb: 0.125,
    border: 'none',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    borderRadius: SIDEBAR_RADIUS,
    boxSizing: 'border-box',
    backgroundColor: isActive ? interaction.activeBackground : 'transparent',
    color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
    boxShadow: 'none',
    transition: theme.transitions.create(['background-color', 'color', 'box-shadow'], {
      duration: theme.transitions.duration.shorter,
    }),
    '& .options-btn': { opacity: menuOpen ? 1 : 0 },
    '&:hover .options-btn, &:focus-within .options-btn': { opacity: 1 },
    '&:hover .conv-title, &:focus-within .conv-title': {
      maskImage: 'linear-gradient(to right, black 78%, transparent 98%)',
      WebkitMaskImage: 'linear-gradient(to right, black 78%, transparent 98%)',
    },
    ...(menuOpen && {
      '& .conv-title': {
        maskImage: 'linear-gradient(to right, black 78%, transparent 98%)',
        WebkitMaskImage: 'linear-gradient(to right, black 78%, transparent 98%)',
      },
    }),
    '&:hover': {
      backgroundColor: isActive ? interaction.activeHoverBackground : interaction.hoverBackground,
      color: theme.palette.text.primary,
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: focusRing(theme),
    },
  };
}

// ─── Desktop nav element ──────────────────────────────────────────────────────
export function buildDesktopNavSx(theme, open) {
  return {
    width: open ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
    flexShrink: 0,
    height: '100vh',
    position: 'sticky',
    top: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxSizing: 'border-box',
    zIndex: 2,
    willChange: 'width',
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.easeInOut,
      duration: 240,
    }),
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
    ...getAppPanelSurfaceSx(theme),
    ...getSidebarChromeSx(theme),
  };
}

// ─── Mobile drawer paper ──────────────────────────────────────────────────────
export function buildMobileDrawerPaperStyles(theme) {
  return {
    height: '100dvh',
    '@supports not (height: 100dvh)': { height: '100vh' },
    display: 'flex',
    flexDirection: 'column',
    width: { xs: '88vw', sm: 320 },
    maxWidth: 320,
    paddingBottom: 'env(safe-area-inset-bottom)',
    borderRadius: 0,
    boxSizing: 'border-box',
    ...getAppPanelSurfaceSx(theme),
    borderRight: 'none',
  };
}

// ─── Section label ────────────────────────────────────────────────────────────
// Returns sx that matches theme.typography.uiSectionLabel.
// Used as a spread: sx={{ ...buildSidebarSectionLabelSx(), px: 0, pt: 0, pb: 0 }}
export function buildSidebarSectionLabelSx() {
  return {
    px: 2,
    pt: 2,
    pb: 0.75,
    fontSize: '0.8125rem',
    fontWeight: 650,
    lineHeight: 1.3,
    color: 'text.secondary',
    letterSpacing: 0,
    textTransform: 'none',
    opacity: 0.88,
  };
}
