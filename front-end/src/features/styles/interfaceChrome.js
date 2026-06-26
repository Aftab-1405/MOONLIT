/**
 * Premium surface tokens for the logged-in interface shell.
 * Mode-aware (light + dark) styling shared across sidebar, chat, artifacts, settings.
 * @module features/styles/interfaceChrome
 */

import { alpha } from '@mui/material/styles';

export const INTERFACE_RADIUS = Object.freeze({
  row: '10px',
  control: '8px',
  composer: '18px',
  panel: '14px',
  popover: '14px',
});

function getHairlineBorder(theme, opacity = null) {
  const isDark = theme.palette.mode === 'dark';
  const o = opacity ?? (isDark ? 0.1 : 0.08);
  return `0.5px solid ${alpha(theme.palette.text.primary, o)}`;
}

export function getAppDividerColor(theme) {
  return alpha(
    theme.palette.text.primary,
    theme.palette.mode === 'dark' ? 0.09 : 0.07,
  );
}

export function getAppPanelSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: isDark
      ? theme.palette.background.paper
      : alpha(theme.palette.background.paper, 0.98),
    backgroundImage: 'none',
  };
}

export function getAppBarSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: isDark
      ? theme.palette.background.paper
      : alpha(theme.palette.background.paper, 0.98),
    backgroundImage: 'none',
  };
}

export function getAppSunkenSurfaceSx(theme) {
  return {
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
  };
}

export function getShellWorkspaceSx(theme) {
  return {
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
  };
}

export function getSidebarChromeSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRight: getHairlineBorder(theme, isDark ? 0.09 : 0.07),
    boxShadow: 'none',
  };
}

export function getComposerSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  const ring = alpha(theme.palette.text.primary, isDark ? 0.18 : 0.14);

  return {
    borderRadius: INTERFACE_RADIUS.composer,
    border: '1px solid transparent',
    overflow: 'hidden',
    backgroundColor: isDark
      ? alpha(theme.palette.background.paper, 0.94)
      : alpha(theme.palette.background.paper, 1),
    backgroundImage: 'none',
    boxShadow: `0 0 0 1px ${ring}`,
    transition: 'box-shadow 160ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 140ms ease, transform 140ms ease',
  };
}

export function getComposerHoverShadow(theme) {
  const isDark = theme.palette.mode === 'dark';
  const ring = alpha(theme.palette.text.primary, isDark ? 0.18 : 0.14);
  return `0 0 0 1px ${ring}`;
}

export function getArtifactPanelChromeSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderLeft: getHairlineBorder(theme, isDark ? 0.09 : 0.07),
    ...getAppPanelSurfaceSx(theme),
  };
}

export function getPreferencePanelPaperSx(theme, left, width) {
  const isDark = theme.palette.mode === 'dark';
  return {
    position: 'fixed',
    inset: '0 auto auto auto',
    left,
    top: 0,
    width,
    maxWidth: width,
    height: '100vh',
    maxHeight: '100vh',
    minHeight: '100vh',
    m: 0,
    borderRadius: 0,
    borderLeft: getHairlineBorder(theme, isDark ? 0.1 : 0.08),
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    boxShadow: 'none',
  };
}

export function getPreferenceSectionSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRadius: INTERFACE_RADIUS.panel,
    border: getHairlineBorder(theme, isDark ? 0.08 : 0.06),
    backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.86),
    backgroundImage: 'none',
    overflow: 'hidden',
    boxSizing: 'border-box',
    px: { xs: 2, sm: 2.5 },
    py: { xs: 0.75, sm: 1 },
  };
}

export function getWelcomeHeroSx(theme) {
  return {
    ...theme.typography.uiHeadingHero,
    fontWeight: 560,
    letterSpacing: 0,
    color: 'text.primary',
    textWrap: 'balance',
  };
}
