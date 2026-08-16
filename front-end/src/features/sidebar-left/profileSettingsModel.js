export function getProfileSettingsMode(sidebarExpanded) {
  return {
    showDirectSettings: Boolean(sidebarExpanded),
    showPopoverSettings: !sidebarExpanded,
  };
}

export function getProfileControlGeometry({ iconOnly = false } = {}) {
  const size = { xs: 44, md: 36 };
  return {
    ...(iconOnly ? { width: size, minWidth: size } : {}),
    height: size,
    minHeight: size,
  };
}
