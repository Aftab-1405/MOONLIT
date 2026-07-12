// useChatPageSidebar — sidebar layout + profile menu state.
//
// Owns:
//   - sidebarOpen (desktop collapse/expand) — persisted to localStorage
//   - mobileOpen (narrow-viewport drawer)
//   - anchorEl (profile menu anchor)
//   - derived sidebar width (for canvas sizing)
//
// Handlers:
//   - handleSidebarToggle, handleMobileDrawerOpen, handleMobileDrawerClose
//   - handleMenuOpen, handleMenuClose, handleLogout, handleOpenSettings
//
// All overlay-coordination (closing modals when sidebar actions fire) is done
// via callbacks passed in from the caller — this hook does not touch overlay
// state directly.

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalStorage } from '@/hooks';
import { UI_LAYOUT } from '@/styles/shared';

const DRAWER_WIDTH = UI_LAYOUT.sidebarExpandedWidth;
const COLLAPSED_WIDTH = UI_LAYOUT.sidebarCollapsedWidth;

export function useChatPageSidebar({ isDesktop, onCloseModals } = {}) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useLocalStorage('moonlit-sidebar-open', true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const currentSidebarWidth = useMemo(
    () => (sidebarOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH),
    [sidebarOpen],
  );

  const effectiveMobileOpen = isDesktop ? false : mobileOpen;

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, [setSidebarOpen]);

  const handleMobileDrawerOpen = useCallback(() => {
    setMobileOpen(true);
  }, []);
  const handleMobileDrawerClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const handleMenuOpen = useCallback((e) => {
    setAnchorEl(e.currentTarget);
  }, []);
  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleLogout = useCallback(async () => {
    setAnchorEl(null);
    await logout();
  }, [logout]);

  const handleOpenSettings = useCallback(() => {
    handleMenuClose();
    onCloseModals?.();
    // The caller wires the actual settings-open state via onCloseModals +
    // its own settings open setter. Here we just close the menu and notify.
  }, [handleMenuClose, onCloseModals]);

  return {
    user,
    sidebarOpen,
    currentSidebarWidth,
    mobileOpen: effectiveMobileOpen,
    anchorEl,
    handleSidebarToggle,
    handleMobileDrawerOpen,
    handleMobileDrawerClose,
    handleMenuOpen,
    handleMenuClose,
    handleLogout,
    handleOpenSettings,
    setMobileOpen,
  };
}
