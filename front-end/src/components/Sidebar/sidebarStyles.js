import { alpha } from '@mui/material/styles';
import { UI_LAYOUT } from '../../styles/shared';

export const EXPANDED_WIDTH = UI_LAYOUT.sidebarExpandedWidth;
export const COLLAPSED_WIDTH = UI_LAYOUT.sidebarCollapsedWidth;
export const SIDEBAR_ROW_RADIUS = '10px';

export function buildSidebarNavRowSx(theme, {
  isActive = false,
  disabled = false,
} = {}) {
  const isDark = theme.palette.mode === 'dark';
  const activeBg = alpha(theme.palette.text.primary, isDark ? 0.105 : 0.065);
  const hoverBg = alpha(theme.palette.text.primary, isDark ? 0.065 : 0.045);

  return {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minHeight: 38,
    // Fixed padding — icon stays left-aligned at all times.
    // The label fades/shrinks via maxWidth+opacity, so the icon never needs to re-center.
    px: 1.5,
    py: 0.65,
    justifyContent: 'flex-start',
    border: 'none',
    outline: 'none',
    appearance: 'none',
    cursor: disabled ? 'default' : 'pointer',
    textAlign: 'left',
    borderRadius: SIDEBAR_ROW_RADIUS,
    gap: 1.25,
    overflow: 'hidden',
    color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
    backgroundColor: isActive ? activeBg : 'transparent',
    opacity: disabled ? 0.45 : 1,
    transition: theme.transitions.create(['background-color', 'color', 'opacity'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover:not(:disabled)': {
      backgroundColor: isActive ? activeBg : hoverBg,
      color: theme.palette.text.primary,
    },
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${alpha(theme.palette.text.primary, isDark ? 0.22 : 0.18)}`,
    },
  };
}

export function buildConversationRowSx(theme, { isActive = false, menuOpen = false } = {}) {
  const isDark = theme.palette.mode === 'dark';
  const activeBg = alpha(theme.palette.text.primary, isDark ? 0.11 : 0.07);
  const hoverBg = alpha(theme.palette.text.primary, isDark ? 0.065 : 0.045);

  return {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
    mb: 0.125,
    pl: 1.5,
    pr: 3.5,
    py: 0.65,
    minHeight: 36,
    borderRadius: SIDEBAR_ROW_RADIUS,
    border: 'none',
    outline: 'none',
    appearance: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: isActive ? theme.palette.text.primary : theme.palette.text.secondary,
    backgroundColor: isActive ? activeBg : 'transparent',
    transition: theme.transitions.create(['background-color', 'color'], {
      duration: theme.transitions.duration.shorter,
    }),
    '& .options-btn': { opacity: menuOpen ? 1 : 0 },
    '&:hover .options-btn, &:focus-within .options-btn': { opacity: 1 },
    '&:hover .conv-title, &:focus-within .conv-title': {
      maskImage: 'linear-gradient(to right, black 78%, transparent 95%)',
      WebkitMaskImage: 'linear-gradient(to right, black 78%, transparent 95%)',
    },
    ...(menuOpen && {
      '& .conv-title': {
        maskImage: 'linear-gradient(to right, black 78%, transparent 95%)',
        WebkitMaskImage: 'linear-gradient(to right, black 78%, transparent 95%)',
      },
    }),
    '&:hover': {
      backgroundColor: isActive ? activeBg : hoverBg,
      color: theme.palette.text.primary,
    },
    '&:focus-visible': {
      boxShadow: `0 0 0 2px ${alpha(theme.palette.text.primary, isDark ? 0.22 : 0.18)}`,
    },
  };
}

export function buildSidebarSectionLabelSx() {
  return {
    px: 2,
    pt: 2.25,
    pb: 0.75,
    fontSize: '0.8rem',
    fontWeight: 700,
    lineHeight: 1.25,
    color: 'text.primary',
    letterSpacing: 0,
  };
}

/**
 * Builds sx for the desktop sidebar <nav> element.
 * Replaces the old StyledDesktopSidebarPanel (styled MuiDrawer).
 * Result: 1 <nav> element instead of MuiDrawer > MuiPaper > MuiDrawer-paper (3+ wrappers).
 */
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
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    zIndex: 2,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: open
        ? theme.transitions.duration.enteringScreen
        : theme.transitions.duration.leavingScreen,
    }),
    backgroundColor: alpha(
      theme.palette.background.paper,
      isDark ? 0.9 : 0.98,
    ),
    backgroundImage: isDark
      ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.03)} 0%, transparent 18%)`
      : `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.02)} 0%, transparent 18%)`,
    borderRight: 'none',
    boxShadow: 'none',
  };
}

export function buildMobileDrawerPaperStyles(theme) {
  return {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    '@supports not (height: 100dvh)': {
      height: '100vh',
    },
    width: { xs: '88vw', sm: 320 },
    maxWidth: 320,
    paddingBottom: 'env(safe-area-inset-bottom)',
    borderRadius: 0,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    backgroundImage: theme.palette.mode === 'dark'
      ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.03)} 0%, transparent 18%)`
      : `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.02)} 0%, transparent 18%)`,
    borderRight: 'none',
  };
}
