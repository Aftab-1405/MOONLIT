const SUPPORTED_OVERLAYS = new Set(['database', 'settings']);

export function planOverlayLaunch({ drawerOpen, overlay }) {
  if (!SUPPORTED_OVERLAYS.has(overlay)) {
    throw new TypeError(`Unsupported preference overlay: ${String(overlay)}`);
  }

  return drawerOpen
    ? { closeDrawer: true, openOverlay: null, pendingOverlay: overlay }
    : { closeDrawer: false, openOverlay: overlay, pendingOverlay: null };
}

export function resolveOverlayFocusTarget(originalTrigger, fallbackTrigger) {
  if (originalTrigger?.isConnected) return originalTrigger;
  if (fallbackTrigger?.isConnected) return fallbackTrigger;
  return null;
}
