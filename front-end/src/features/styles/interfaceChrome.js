/**
 * Premium surface tokens for the logged-in interface shell.
 *
 * Dark interface styling shared across sidebar, chat, artifacts, and settings.
 * Anything that needs to look like "the app chrome" should source
 * its visual language from this module so the whole shell stays cohesive.
 *
 * Conventions:
 *   - All hairline borders go through `getHairlineBorder` so they stay 1px
 *     and never disappear on non-retina displays.
 *   - Composer state changes use borders rather than elevation.
 *
 * @module features/styles/interfaceChrome
 */

/** Radius scale used by interface chrome. */
export const INTERFACE_RADIUS = Object.freeze({
  row: '8px',
  control: '8px',
  composer: '8px',
  panel: '8px',
  popover: '8px',
});

/** Responsive pill geometry for labeled chat controls. */
export function getResponsivePillControlSx(
  theme,
  { desktopHeight, mobileHeight = 44 } = {},
) {
  return {
    height: { xs: mobileHeight, md: desktopHeight },
    minHeight: { xs: mobileHeight, md: desktopHeight },
    borderRadius: theme.shape.radius.pill,
  };
}

/** Responsive pill geometry for square chat icon buttons. */
export function getResponsivePillIconButtonSx(
  theme,
  { desktopSize, mobileSize = 44 } = {},
) {
  return {
    width: { xs: mobileSize, md: desktopSize },
    height: { xs: mobileSize, md: desktopSize },
    minWidth: { xs: mobileSize, md: desktopSize },
    minHeight: { xs: mobileSize, md: desktopSize },
    borderRadius: theme.shape.radius.pill,
  };
}

/** Spacing and minimum-height contract for the chat composer. */
export function getComposerLayoutSx(theme) {
  return {
    form: {
      px: { xs: 0.5, md: 1 },
      pb: { xs: `max(${theme.spacing(1)}, env(safe-area-inset-bottom))`, md: 1 },
    },
    surface: { minHeight: { xs: 132, md: 124 } },
    content: { px: { xs: 1.5, md: 2 }, py: 1.5, gap: 1.5 },
    toolbar: { gap: 1 },
  };
}

/** Responsive spacing contract for the empty chat state. */
export function getWelcomeLayoutSx() {
  return {
    outer: { px: { xs: 1, md: 3 }, py: { xs: 2.5, md: 4 } },
    content: { gap: { xs: 2, md: 3 } },
    suggestions: { gap: 1 },
  };
}

/**
 * Hairline border — 1px solid with low-alpha foreground.
 * We never use `0.5px` borders because they vanish on non-retina displays.
 */
function getHairlineBorder(theme) {
  return `1px solid ${theme.palette.border.separator}`;
}

/** Standardised divider colour used between major interface sections. */
export function getAppDividerColor(theme) {
  return theme.palette.border.separator;
}

/** Panel surface — sidebar, artifact panel, settings sections. */
export function getAppPanelSurfaceSx(theme) {
  return {
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
  };
}

/** Bar surface — toolbar / header strips inside panels. */
export function getAppBarSurfaceSx(theme) {
  return {
    backgroundColor: theme.palette.background.paper,
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

/** Sidebar chrome — a quiet tonal shift, without a dividing rule. */
export function getSidebarChromeSx(theme) {
  return {
    borderRight: '1px solid',
    borderColor: theme.palette.border.separator,
    boxShadow: 'none',
  };
}

/**
 * Composer (chat input) surface.
 *
 * The composer uses a solid tone one step lighter than the surrounding canvas.
 */
export function getComposerSurfaceSx(theme) {
  return {
    borderRadius: INTERFACE_RADIUS.composer,
    border: `1px solid ${theme.palette.border.idle}`,
    overflow: 'hidden',
    backgroundColor: theme.palette.background.input,
    backgroundImage: 'none',
    boxShadow: 'none',
    transition: 'border-color 140ms ease, background-color 140ms ease',
  };
}

/** Composer hover intentionally adds no surface or boundary effect. */
export function getComposerHoverShadow(_theme) {
  return 'none';
}

/** Artifact panel chrome — a sibling surface without a permanent seam. */
export function getArtifactPanelChromeSx(theme) {
  return {
    borderLeft: getHairlineBorder(theme),
    ...getAppPanelSurfaceSx(theme),
  };
}

/**
 * Preference surface paper — full-height right-side panel used by the
 * settings overlay. Stretches to viewport height, full-width column.
 */
export function getPreferencePanelPaperSx(theme, left, width) {
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
    borderLeft: getHairlineBorder(theme),
    backgroundColor: theme.palette.background.default,
    backgroundImage: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    boxShadow: 'none',
  };
}

/** Preference section surface — individual cards inside the settings panel. */
export function getPreferenceSectionSurfaceSx(theme) {
  return {
    borderRadius: INTERFACE_RADIUS.panel,
    border: getHairlineBorder(theme),
    backgroundColor: theme.palette.layer.surfaceMuted,
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
    ...theme.typography.uiDisplaySm,
    color: 'text.primary',
    textWrap: 'balance',
  };
}
