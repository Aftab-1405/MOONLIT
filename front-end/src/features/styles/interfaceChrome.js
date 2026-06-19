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

export function getShellWorkspaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: theme.palette.background.default,
    backgroundImage: [
      isDark
        ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.018)} 0%, transparent 32%)`
        : `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.012)} 0%, transparent 34%)`,
      isDark
        ? `radial-gradient(ellipse 90% 56% at 50% 0%, ${alpha(theme.palette.common.white, 0.025)} 0%, transparent 62%)`
        : `radial-gradient(ellipse 90% 56% at 50% 0%, ${alpha(theme.palette.common.black, 0.018)} 0%, transparent 64%)`,
    ].join(', '),
  };
}

export function getSidebarChromeSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRight: getHairlineBorder(theme, isDark ? 0.09 : 0.07),
    boxShadow: isDark
      ? `inset -1px 0 0 ${alpha(theme.palette.common.white, 0.04)}`
      : `1px 0 0 ${alpha(theme.palette.common.black, 0.04)}`,
  };
}

export function getComposerSurfaceSx(theme, { isFocused = false } = {}) {
  const isDark = theme.palette.mode === 'dark';
  const ring = alpha(theme.palette.text.primary, isDark ? 0.18 : 0.14);
  const ringFocus = alpha(theme.palette.text.primary, isDark ? 0.36 : 0.28);
  const shadowBase = isDark ? 0.18 : 0.055;
  const shadowFocus = isDark ? 0.3 : 0.095;

  return {
    borderRadius: INTERFACE_RADIUS.composer,
    border: '1px solid transparent',
    backgroundColor: isDark
      ? alpha(theme.palette.background.paper, 0.94)
      : alpha(theme.palette.background.paper, 1),
    backgroundImage: isDark
      ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.035)} 0%, transparent 48%)`
      : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.88)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
    boxShadow: isFocused
      ? `0 8px 22px ${alpha(theme.palette.common.black, shadowFocus)}, 0 0 0 1px ${ringFocus}`
      : `0 4px 14px ${alpha(theme.palette.common.black, shadowBase)}, 0 0 0 1px ${ring}`,
    transition: 'box-shadow 160ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 140ms ease, transform 140ms ease',
  };
}

export function getComposerHoverShadow(theme, { isFocused = false } = {}) {
  const isDark = theme.palette.mode === 'dark';
  const ring = alpha(theme.palette.text.primary, isDark ? 0.24 : 0.2);
  const ringFocus = alpha(theme.palette.text.primary, isDark ? 0.42 : 0.32);
  const shadowBase = isDark ? 0.22 : 0.07;
  const shadowFocus = isDark ? 0.34 : 0.11;
  return isFocused
    ? `0 9px 24px ${alpha(theme.palette.common.black, shadowFocus)}, 0 0 0 1px ${ringFocus}`
    : `0 5px 16px ${alpha(theme.palette.common.black, shadowBase)}, 0 0 0 1px ${ring}`;
}

export function getArtifactPanelChromeSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderLeft: getHairlineBorder(theme, isDark ? 0.09 : 0.07),
    backgroundColor: isDark
      ? alpha(theme.palette.background.default, 0.72)
      : alpha(theme.palette.background.paper, 0.94),
    backgroundImage: isDark
      ? `linear-gradient(90deg, ${alpha(theme.palette.common.white, 0.02)} 0%, transparent 24%)`
      : `linear-gradient(90deg, ${alpha(theme.palette.common.black, 0.015)} 0%, transparent 20%)`,
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
    backgroundImage: isDark
      ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.03)} 0%, transparent 22%)`
      : `linear-gradient(180deg, ${alpha(theme.palette.common.black, 0.02)} 0%, transparent 24%)`,
    boxShadow: isDark
      ? `-12px 0 40px ${alpha('#000', 0.35)}`
      : `-8px 0 32px ${alpha('#000', 0.06)}`,
  };
}

export function getPreferenceSectionSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRadius: INTERFACE_RADIUS.panel,
    border: getHairlineBorder(theme, isDark ? 0.08 : 0.06),
    backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.4 : 0.65),
    backgroundImage: isDark
      ? `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.03)} 0%, transparent 100%)`
      : `linear-gradient(180deg, ${alpha(theme.palette.common.white, 0.55)} 0%, transparent 100%)`,
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
