/**
 * Premium surface tokens for the logged-in interface shell.
 *
 * Mode-aware (light + dark) styling shared across sidebar, chat, artifacts,
 * settings. Anything that needs to look like "the app chrome" should source
 * its visual language from this module so the whole shell stays cohesive.
 *
 * Conventions:
 *   - All hairline borders go through `getHairlineBorder` so they stay 1px
 *     and never disappear on non-retina displays.
 *   - Composer (chat input) has a clearly differentiated resting vs hover
 *     vs focus state — the previous version had identical resting/hover
 *     shadows which made hover feel dead.
 *   - Elevation tokens (`ELEVATION.*`) are the only sanctioned shadow values
 *     for app chrome. Don't hand-roll box-shadows elsewhere.
 *
 * @module features/styles/interfaceChrome
 */

import { alpha } from '@mui/material/styles';

/** Radius scale used by interface chrome. */
export const INTERFACE_RADIUS = Object.freeze({
  row: '10px',
  control: '8px',
  composer: '18px',
  panel: '14px',
  popover: '14px',
});

/**
 * Elevation tokens — the sanctioned shadow values for app chrome.
 *
 * Each token has a `light` and `dark` variant because dark-mode shadows
 * need stronger alpha to read against dark surfaces.
 *
 * Usage:
 *   boxShadow: ELEVATION.resting[isDark ? 'dark' : 'light']
 */
export const ELEVATION = Object.freeze({
  // Flat surface with a hairline ring (sidebar, panel)
  resting: {
    light: 'none',
    dark: 'none',
  },
  // Slightly raised surface (composer resting, cards)
  subtle: {
    light: `0 1px 2px ${alpha('#000', 0.04)}, 0 1px 1px ${alpha('#000', 0.03)}`,
    dark: `0 1px 2px ${alpha('#000', 0.28)}, 0 1px 1px ${alpha('#000', 0.22)}`,
  },
  // Hovering surface (composer hover, popover)
  raised: {
    light: `0 4px 14px ${alpha('#000', 0.06)}, 0 1px 3px ${alpha('#000', 0.04)}`,
    dark: `0 4px 14px ${alpha('#000', 0.42)}, 0 1px 3px ${alpha('#000', 0.28)}`,
  },
  // Floating surface (modal, fullscreen artifact)
  floating: {
    light: `0 18px 48px ${alpha('#000', 0.12)}, 0 4px 12px ${alpha('#000', 0.05)}`,
    dark: `0 18px 48px ${alpha('#000', 0.6)}, 0 4px 12px ${alpha('#000', 0.36)}`,
  },
});

/**
 * Hairline border — 1px solid with low-alpha foreground.
 * We never use `0.5px` borders because they vanish on non-retina displays.
 */
function getHairlineBorder(theme, opacity = null) {
  const isDark = theme.palette.mode === 'dark';
  const o = opacity ?? (isDark ? 0.1 : 0.08);
  return `1px solid ${alpha(theme.palette.text.primary, o)}`;
}

/** Standardised divider colour used between major interface sections. */
export function getAppDividerColor(theme) {
  return alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.09 : 0.07);
}

/** Panel surface — sidebar, artifact panel, settings sections. */
export function getAppPanelSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: isDark
      ? theme.palette.background.paper
      : alpha(theme.palette.background.paper, 0.98),
    backgroundImage: 'none',
  };
}

/** Bar surface — toolbar / header strips inside panels. */
export function getAppBarSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    backgroundColor: isDark
      ? theme.palette.background.paper
      : alpha(theme.palette.background.paper, 0.98),
    backgroundImage: 'none',
  };
}

/** Sunken surface — workspace canvas background. Sits one step below panels. */
export function getAppSunkenSurfaceSx(theme) {
  return {
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
  };
}

/** Shell workspace surface — main chat column background. */
export function getShellWorkspaceSx(theme) {
  return {
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
  };
}

/** Sidebar chrome — applies the right-side border that separates it from the workspace. */
export function getSidebarChromeSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRight: getHairlineBorder(theme, isDark ? 0.09 : 0.07),
    boxShadow: 'none',
  };
}

/**
 * Composer (chat input) surface.
 *
 * Resting state: subtle hairline ring + barely-visible shadow.
 * This used to share the same ring colour for both resting AND hover which
 * made hover feel dead — now `getComposerHoverShadow` returns a stronger
 * ring + actual elevation so the composer visibly lifts on hover.
 */
export function getComposerSurfaceSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  const restingRing = alpha(theme.palette.text.primary, isDark ? 0.14 : 0.1);

  return {
    borderRadius: INTERFACE_RADIUS.composer,
    border: '1px solid transparent',
    overflow: 'hidden',
    backgroundColor: isDark
      ? alpha(theme.palette.background.paper, 0.94)
      : alpha(theme.palette.background.paper, 1),
    backgroundImage: 'none',
    boxShadow: `${ELEVATION.subtle[isDark ? 'dark' : 'light']}, 0 0 0 1px ${restingRing}`,
    transition:
      'box-shadow 200ms cubic-bezier(0.2, 0.8, 0.2, 1), background-color 160ms ease, transform 160ms ease',
  };
}

/**
 * Composer hover/focus shadow — visibly stronger than resting.
 * Pairs with `getComposerSurfaceSx` to give the input a clear "lift" on
 * interaction. The ring alpha and elevation both step up.
 */
export function getComposerHoverShadow(theme) {
  const isDark = theme.palette.mode === 'dark';
  const hoverRing = alpha(theme.palette.text.primary, isDark ? 0.28 : 0.22);
  return `${ELEVATION.raised[isDark ? 'dark' : 'light']}, 0 0 0 1px ${hoverRing}`;
}

/** Artifact panel chrome — left border separating it from the workspace. */
export function getArtifactPanelChromeSx(theme) {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderLeft: getHairlineBorder(theme, isDark ? 0.09 : 0.07),
    ...getAppPanelSurfaceSx(theme),
  };
}

/**
 * Preference surface paper — full-height right-side panel used by the
 * settings overlay. Stretches to viewport height, full-width column.
 */
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

/** Preference section surface — individual cards inside the settings panel. */
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

/** Welcome hero typography — the large headline on the empty chat state. */
export function getWelcomeHeroSx(theme) {
  return {
    ...theme.typography.uiHeadingHero,
    fontWeight: 560,
    letterSpacing: 0,
    color: 'text.primary',
    textWrap: 'balance',
  };
}
