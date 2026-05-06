import { alpha } from '@mui/material/styles';
import { UI_LAYOUT } from '../../styles/shared';

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

// ─── Nav row (toggle, nav items, footer) ─────────────────────────────────────
export function buildNavRowSx(theme, { isActive = false, disabled = false } = {}) {
  const isDark = theme.palette.mode === 'dark';
  return {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: ROW_HEIGHT,
    minHeight: ROW_HEIGHT,
    px: ROW_PX,
    py: 0,
    gap: 0,
    border: 'none',
    outline: 'none',
    appearance: 'none',
    textAlign: 'left',
    cursor: disabled ? 'default' : 'pointer',
    borderRadius: SIDEBAR_RADIUS,
    boxSizing: 'border-box',
    backgroundColor: isActive
      ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.065)
      : 'transparent',
    color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
    opacity: disabled ? 0.4 : 1,
    transition: theme.transitions.create(['background-color', 'color', 'opacity'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover:not(:disabled)': {
      backgroundColor: isActive
        ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.065)
        : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.045),
      color: theme.palette.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${alpha(theme.palette.text.primary, 0.4)}`,
      outlineOffset: -2,
    },
  };
}

// ─── Conversation row ─────────────────────────────────────────────────────────
export function buildConversationRowSx(theme, { isActive = false, menuOpen = false } = {}) {
  const isDark = theme.palette.mode === 'dark';
  return {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
    height: ROW_HEIGHT,
    minHeight: ROW_HEIGHT,
    pl: 1.5,
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
    backgroundColor: isActive
      ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.07)
      : 'transparent',
    color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
    transition: theme.transitions.create(['background-color', 'color'], {
      duration: theme.transitions.duration.shorter,
    }),
    '& .options-btn': { opacity: menuOpen ? 1 : 0 },
    '&:hover .options-btn, &:focus-within .options-btn': { opacity: 1 },
    '&:hover .conv-title, &:focus-within .conv-title': {
      maskImage: 'linear-gradient(to right, black 75%, transparent 95%)',
      WebkitMaskImage: 'linear-gradient(to right, black 75%, transparent 95%)',
    },
    ...(menuOpen && {
      '& .conv-title': {
        maskImage: 'linear-gradient(to right, black 75%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to right, black 75%, transparent 95%)',
      },
    }),
    '&:hover': {
      backgroundColor: isActive
        ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.07)
        : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.045),
      color: theme.palette.text.primary,
    },
    '&:focus-visible': {
      outline: `2px solid ${alpha(theme.palette.text.primary, 0.4)}`,
      outlineOffset: -2,
    },
  };
}

// ─── Desktop nav element ──────────────────────────────────────────────────────
export function buildDesktopNavSx(theme, open) {
  const isDark = theme.palette.mode === 'dark';
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
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: open
        ? theme.transitions.duration.enteringScreen
        : theme.transitions.duration.leavingScreen,
    }),
    backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.9 : 0.98),
    backgroundImage: isDark
      ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.03)} 0%, transparent 18%)`
      : `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.02)} 0%, transparent 18%)`,
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
    backgroundColor: theme.palette.background.paper,
    backgroundImage: theme.palette.mode === 'dark'
      ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.03)} 0%, transparent 18%)`
      : `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.02)} 0%, transparent 18%)`,
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
    fontSize: '0.75rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: 'text.secondary',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  };
}
