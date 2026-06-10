import { useState, memo, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  Avatar,
  Collapse,
  Drawer,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import MindmapIcon from '@/components/icons/MindmapIcon';
import NewChatIcon from '@/components/icons/NewChatIcon';
import RecentChatIcon from '@/components/icons/RecentChatIcon';
import SearchIcon from '@/components/icons/SearchIcon';
import SidebarPanelIcon from '@/components/icons/SidebarPanelIcon';
import { getUserContext } from '@/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import { getInteractionColors, getScrollbarStyles } from '@/styles/shared';
import logger from '@/utils/logger';
import { ConversationItem, SidebarNavItem, HistoryListSkeleton } from '@/features/sidebar-left/components/SidebarPrimitives';
import SidebarOverlays from '@/features/sidebar-left/components/SidebarOverlays';
import {
  buildDesktopNavSx,
  buildMobileDrawerPaperStyles,
  buildSidebarSectionLabelSx,
  buildNavRowSx,
  ICON_COL,
  ROW_PX,
} from '@/features/sidebar-left/styles/sidebarStyles';

// ─── Main Sidebar component ───────────────────────────────────────────────────
function Sidebar({
  conversations = [],
  isConversationsLoading = false,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  isConnected,
  currentDatabase,
  availableDatabases = [],
  onOpenDbModal,
  onDatabaseSwitch,
  open = true,
  onToggleOpen,
  user = null,
  onMenuOpen,
  mobileOpen = false,
  onMobileClose,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDark = theme.palette.mode === 'dark';

  const [dbPopoverAnchor, setDbPopoverAnchor] = useState(null);
  const [historyPopoverAnchor, setHistoryPopoverAnchor] = useState(null);
  const [searchPopoverAnchor, setSearchPopoverAnchor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mindmapOpen, setMindmapOpen] = useState(false);
  const [recentsCollapsed, setRecentsCollapsed] = useState(false);
  const [schemaData, setSchemaData] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);

  const scrollbarStyles = useMemo(() => getScrollbarStyles(theme), [theme]);
  const neutralInteraction = useMemo(() => getInteractionColors(theme), [theme]);
  const mobileDrawerPaperStyles = useMemo(() => buildMobileDrawerPaperStyles(theme), [theme]);
  const desktopNavSx = useMemo(() => buildDesktopNavSx(theme, open), [theme, open]);
  const closeMindmapSurface = useCallback(() => setMindmapOpen(false), []);

  const userInitials = useMemo(() => {
    const name = user?.displayName?.trim();
    if (!name) return 'M';
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'M';
  }, [user?.displayName]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleDatabaseSelect = useCallback((dbName) => {
    setDbPopoverAnchor(null);
    closeMindmapSurface();
    if (dbName !== currentDatabase) onDatabaseSwitch?.(dbName);
  }, [closeMindmapSurface, currentDatabase, onDatabaseSwitch]);

  const handleDatabaseAction = useCallback((event) => {
    closeMindmapSurface();
    if (isConnected && availableDatabases.length > 0) {
      setDbPopoverAnchor(event.currentTarget);
    } else {
      onOpenDbModal?.();
    }
  }, [closeMindmapSurface, isConnected, availableDatabases.length, onOpenDbModal]);

  const handleHistoryClick = useCallback((event) => {
    closeMindmapSurface();
    if (conversations.length > 0) setHistoryPopoverAnchor(event.currentTarget);
  }, [closeMindmapSurface, conversations.length]);

  const handleSearchClick = useCallback((event) => {
    closeMindmapSurface();
    setSearchPopoverAnchor(event.currentTarget);
  }, [closeMindmapSurface]);

  const handleOpenMindmap = useCallback(async () => {
    if (!isConnected || !currentDatabase) return;
    setSchemaLoading(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.userContext,
        queryFn: getUserContext,
        staleTime: 60 * 1000,
      });
      if (data.status === 'success') {
        setSchemaData(data.schemas?.find((s) => s.database === currentDatabase) || null);
      }
    } catch (err) {
      logger.error('Failed to fetch schema:', err);
      setSchemaData(null);
    } finally {
      setSchemaLoading(false);
      setMindmapOpen(true);
    }
  }, [currentDatabase, isConnected]);

  const handleCloseMindmap = useCallback(() => setMindmapOpen(false), []);
  const toggleRecentsCollapsed = useCallback(() => setRecentsCollapsed((p) => !p), []);
  const handleCloseDbPopover = useCallback(() => setDbPopoverAnchor(null), []);
  const handleCloseHistoryPopover = useCallback(() => setHistoryPopoverAnchor(null), []);
  const handleCloseSearchPopover = useCallback(() => {
    setSearchPopoverAnchor(null);
    setSearchQuery('');
  }, []);
  const handleProfileClick = useCallback((e) => {
    closeMindmapSurface();
    onMenuOpen?.(e);
  }, [closeMindmapSurface, onMenuOpen]);
  const handleOpenNewConnection = useCallback(() => {
    setDbPopoverAnchor(null);
    closeMindmapSurface();
    onOpenDbModal?.();
  }, [closeMindmapSurface, onOpenDbModal]);
  const handleSelectConversation = useCallback((id) => {
    closeMindmapSurface();
    onSelectConversation?.(id);
  }, [closeMindmapSurface, onSelectConversation]);

  // Close popovers when sidebar closes
  useEffect(() => {
    if ((isMobile && !mobileOpen) || (!isMobile && !open)) {
      setDbPopoverAnchor(null);
      setHistoryPopoverAnchor(null);
      setSearchPopoverAnchor(null);
      setSearchQuery('');
    }
  }, [isMobile, mobileOpen, open]);

  // ── Nav item definitions ─────────────────────────────────────────────────────
  const topNavItems = useMemo(() => [
    {
      id: 'new-chat',
      label: 'New chat',
      tooltip: 'New chat',
      icon: <NewChatIcon sx={{ fontSize: 18 }} />,
      onClick: () => {
        closeMindmapSurface();
        onNewChat?.();
      },
      shortcut: 'Ctrl+Shift+O',
    },
    {
      id: 'search',
      label: 'Search chats',
      tooltip: 'Search chats',
      icon: <SearchIcon sx={{ fontSize: 18 }} />,
      onClick: handleSearchClick,
      shortcut: 'Ctrl+K',
    },
  ], [closeMindmapSurface, handleSearchClick, onNewChat]);

  const workspaceNavItems = useMemo(() => {
    const items = [
      {
        id: 'database',
        label: 'Database',
        tooltip: isConnected ? (currentDatabase || 'Connected') : 'Connect database',
        icon: <DatabaseIcon sx={{ fontSize: 17 }} />,
        onClick: handleDatabaseAction,
        showStatus: isConnected,
        uiTarget: 'database_button',
      },
    ];
    if (isConnected) {
      items.push({
        id: 'mindmap',
        label: 'Mindmap',
        tooltip: 'Mindmap',
        icon: <MindmapIcon sx={{ fontSize: 18 }} />,
        onClick: handleOpenMindmap,
      });
    }
    return items;
  }, [isConnected, currentDatabase, handleDatabaseAction, handleOpenMindmap]);

  // ── Shared overlay props ─────────────────────────────────────────────────────
  const overlayProps = {
    theme,
    isPopoverOpen: Boolean(dbPopoverAnchor),
    dbPopoverAnchor,
    handleCloseDbPopover,
    availableDatabases,
    currentDatabase,
    handleDatabaseSelect,
    handleOpenNewConnection,
    isSearchPopoverOpen: Boolean(searchPopoverAnchor),
    searchPopoverAnchor,
    handleCloseSearchPopover,
    searchQuery,
    setSearchQuery,
    isHistoryPopoverOpen: Boolean(historyPopoverAnchor),
    historyPopoverAnchor,
    handleCloseHistoryPopover,
    conversations,
    currentConversationId,
    onSelectConversation: handleSelectConversation,
    onDeleteConversation,
    mindmapOpen,
    handleCloseMindmap,
    schemaLoading,
    schemaData,
    sidebarOpen: open,
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  /**
   * Header row — toggle button + "Moonlit" title.
   *
   * The toggle button uses the same buildNavRowSx as all other rows.
   * The icon column is ICON_COL wide (same as SidebarNavItem) so the
   * toggle icon is always pixel-aligned with every nav icon below it.
   */
  const renderHeader = ({ collapsed = false, mobile = false } = {}) => {
    const label = mobile ? 'Close sidebar' : collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    return (
      <Box component="header" sx={{ px: ROW_PX, pt: 1, pb: 0.5 }}>
        <Tooltip title={collapsed ? label : ''} placement="right" arrow disableHoverListener={!collapsed}>
          <Box
            component="button"
            type="button"
            onClick={mobile ? onMobileClose : onToggleOpen}
            aria-label={label}
            aria-expanded={mobile ? undefined : !collapsed}
            sx={{
              ...buildNavRowSx(theme),
              px: 0,
            }}
          >
            {/* Icon column — always ICON_COL wide, icon centered */}
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                flexShrink: 0,
                width: ICON_COL,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <SidebarPanelIcon sx={{ fontSize: 18 }} />
            </Box>

            {/* Title — fades + collapses when sidebar is collapsed */}
            <Box
              sx={{
                flex: '1 1 auto',
                minWidth: 0,
                maxWidth: collapsed ? 0 : 200,
                opacity: collapsed ? 0 : 1,
                overflow: 'hidden',
                transition: theme.transitions.create(['max-width', 'opacity'], {
                  duration: theme.transitions.duration.shortest,
                }),
              }}
            >
              <Typography
                noWrap
                sx={{
                  ...theme.typography.uiBrandWordmark,
                  fontSize: '1rem',
                  color: 'text.primary',
                  whiteSpace: 'nowrap',
                }}
              >                Moonlit
              </Typography>
            </Box>
          </Box>
        </Tooltip>
      </Box>
    );
  };

  /**
   * Nav group — renders a list of SidebarNavItem rows.
   * px: ROW_PX on the container gives the hover pill a small inset from the sidebar edges.
   */
  const renderNavGroup = (items, collapsed, { pt = 1, ariaLabel = 'Navigation' } = {}) => (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{ display: 'flex', flexDirection: 'column', gap: '2px', pt, px: ROW_PX }}
    >
      {items.map((item) => (
        <SidebarNavItem
          key={item.id}
          label={item.label}
          tooltip={item.tooltip}
          icon={item.icon}
          onClick={item.onClick}
          isCollapsed={collapsed}
          showStatus={item.showStatus}
          disabled={item.disabled}
          shortcut={item.shortcut}
          uiTarget={item.uiTarget}
        />
      ))}
    </Box>
  );

  /**
   * Recents section — collapsible list of conversations.
   * Only shown in expanded state.
   */
  const renderHistorySection = () => (
    <Box sx={{ flex: recentsCollapsed ? '0 0 auto' : 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Section header / collapse toggle */}
      <Box
        component="button"
        type="button"
        aria-expanded={!recentsCollapsed}
        onClick={toggleRecentsCollapsed}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          px: 2,
          pt: 1.5,
          pb: 0.75,
          border: 'none',
          outline: 'none',
          appearance: 'none',
          cursor: 'pointer',
          backgroundColor: 'transparent',
          flexShrink: 0,
          '&:hover .toggle-hint': { opacity: 0.7 },
          '&:focus-visible': {
            outline: `2px solid ${alpha(theme.palette.text.primary, 0.3)}`,
            outlineOffset: -2,
            borderRadius: '8px',
          },
        }}
      >
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875, minWidth: 0 }}>
          <RecentChatIcon sx={{ fontSize: 18 }} />
          <Typography
            component="span"
            sx={{ ...buildSidebarSectionLabelSx(), px: 0, pt: 0, pb: 0 }}
          >
            Recents
          </Typography>
        </Box>
        <Typography
          className="toggle-hint"
          component="span"
          sx={{ ...theme.typography.uiNavShortcut, color: 'text.disabled', opacity: 0, transition: 'opacity 0.15s ease' }}
        >
          {recentsCollapsed ? 'Show' : 'Hide'}
        </Typography>
      </Box>

      {/* Conversation list */}
      <Collapse
        in={!recentsCollapsed}
        timeout="auto"
        sx={{ flex: recentsCollapsed ? 0 : 1, minHeight: 0, overflow: recentsCollapsed ? 'hidden' : 'auto' }}
      >
        <Box
          component="ul"
          role="list"
          sx={{
            listStyle: 'none',
            m: 0,
            px: 1,
            pb: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            ...scrollbarStyles,
          }}
        >
          {isConversationsLoading ? (
            <HistoryListSkeleton />
          ) : conversations.length === 0 ? (
            <Box sx={{ px: 1.5, py: 1.5, opacity: 0.55 }}>
              <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.secondary' }}>
                No conversations yet
              </Typography>
            </Box>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === currentConversationId}
                onSelect={handleSelectConversation}
                onDelete={onDeleteConversation}
                onRename={onRenameConversation}
              />
            ))
          )}
        </Box>
      </Collapse>
    </Box>
  );

  /**
   * Footer — profile avatar + name + chevron.
   * Same icon-column model as nav items.
   */
  const renderFooter = ({ collapsed = false } = {}) => (
    <Box
      component="footer"
      sx={{
        px: ROW_PX,
        py: 0.75,
        borderTop: `1px solid ${alpha(theme.palette.divider, isDark ? 0.5 : 0.65)}`,
      }}
    >
      <Tooltip
        title={collapsed ? (user?.displayName || 'Profile') : ''}
        placement="right"
        arrow
        disableHoverListener={!collapsed}
        disableFocusListener={!collapsed}
        disableTouchListener={!collapsed}
      >
        <Box
          component="button"
          type="button"
          onClick={handleProfileClick}
          aria-label={`${user?.displayName || 'Profile'}, Settings`}
          sx={{
            ...buildNavRowSx(theme),
            px: 0,
            opacity: 0.8,
            '&:hover': {
              opacity: 1,
              backgroundColor: neutralInteraction.hoverBackground,
              color: theme.palette.text.primary,
            },
          }}
        >
          {/* Avatar — in the same ICON_COL slot as all nav icons */}
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              flexShrink: 0,
              width: ICON_COL,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Avatar
              src={user?.photoURL || undefined}
              sx={{ width: 26, height: 26, fontSize: '0.7rem', fontWeight: 700 }}
            >
              {!user?.photoURL && userInitials}
            </Avatar>
          </Box>

          {/* Name — fades + collapses when collapsed */}
          <Box
            sx={{
              flex: '1 1 auto',
              minWidth: 0,
              maxWidth: collapsed ? 0 : 200,
              opacity: collapsed ? 0 : 1,
              overflow: 'hidden',
              transition: theme.transitions.create(['max-width', 'opacity'], {
                duration: theme.transitions.duration.shortest,
              }),
            }}
          >
            <Typography noWrap sx={{ ...theme.typography.uiNavItem, fontWeight: 500, color: 'text.primary', whiteSpace: 'nowrap' }}>
              {user?.displayName || 'Profile'}
            </Typography>
          </Box>

          {/* Chevron — fades out when collapsed */}
          <Box
            sx={{
              maxWidth: collapsed ? 0 : 20,
              opacity: collapsed ? 0 : 1,
              overflow: 'hidden',
              flexShrink: 0,
              transition: theme.transitions.create(['max-width', 'opacity'], {
                duration: theme.transitions.duration.shortest,
              }),
            }}
          >
            <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', display: 'block' }} />
          </Box>
        </Box>
      </Tooltip>
    </Box>
  );

  // ── Content trees ────────────────────────────────────────────────────────────

  // Mobile: always fully expanded
  const mobileContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderHeader({ mobile: true })}
      {renderNavGroup(topNavItems, false, { ariaLabel: 'Primary actions' })}
      {renderNavGroup(workspaceNavItems, false, { pt: 0.25, ariaLabel: 'Workspace actions' })}
      {renderHistorySection()}
      {renderFooter()}
    </Box>
  );

  // Desktop: collapses/expands with smooth width transition.
  // The history section and collapsed history icon are BOTH always mounted
  // and crossfade via opacity/visibility — no unmount/remount jitter.
  const desktopContent = (
    <>
      {renderHeader({ collapsed: !open })}

      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {renderNavGroup(topNavItems, !open, { ariaLabel: 'Primary actions' })}
        {renderNavGroup(workspaceNavItems, !open, { pt: 0.25, ariaLabel: 'Workspace actions' })}

        {/* Scrollable zone — history list (expanded) and history icon (collapsed) */}
        <Box sx={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>

          {/* Expanded: full history list */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              opacity: open ? 1 : 0,
              visibility: open ? 'visible' : 'hidden',
              pointerEvents: open ? 'auto' : 'none',
              transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.shortest }),
            }}
          >
            {renderHistorySection()}
          </Box>

          {/* Collapsed: single history icon row */}
          <Box
            sx={{
              px: ROW_PX,
              opacity: open ? 0 : 1,
              visibility: open ? 'hidden' : 'visible',
              pointerEvents: open ? 'none' : 'auto',
              transition: theme.transitions.create('opacity', { duration: theme.transitions.duration.shortest }),
            }}
          >
            <SidebarNavItem
              label="History"
              tooltip="Recent chats"
              icon={<RecentChatIcon sx={{ fontSize: 18 }} />}
              onClick={handleHistoryClick}
              isCollapsed
              disabled={conversations.length === 0}
            />
          </Box>
        </Box>
      </Box>

      {renderFooter({ collapsed: !open })}
    </>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
          SlideProps={{ mountOnEnter: true, unmountOnExit: true }}
          PaperProps={{ sx: mobileDrawerPaperStyles }}
        >
          {mobileContent}
        </Drawer>
        <SidebarOverlays {...overlayProps} />
      </>
    );
  }

  return (
    <>
      {/* Clip wrapper prevents content overflow during width transition */}
      <Box sx={{ flexShrink: 0, overflow: 'hidden' }}>
        <Box component="nav" aria-label="Sidebar" sx={desktopNavSx}>
          {desktopContent}
        </Box>
      </Box>
      <SidebarOverlays {...overlayProps} />
    </>
  );
}

// ─── Memoization ─────────────────────────────────────────────────────────────
function areConversationMetaEqual(prev = [], next = []) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i]?.id !== next[i]?.id || prev[i]?.title !== next[i]?.title) return false;
  }
  return true;
}

function areStringArraysEqual(prev = [], next = []) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

function arePropsEqual(p, n) {
  return (
    p.currentConversationId === n.currentConversationId &&
    p.isConnected === n.isConnected &&
    p.isConversationsLoading === n.isConversationsLoading &&
    p.currentDatabase === n.currentDatabase &&
    p.open === n.open &&
    p.mobileOpen === n.mobileOpen &&
    p.onNewChat === n.onNewChat &&
    p.onSelectConversation === n.onSelectConversation &&
    p.onDeleteConversation === n.onDeleteConversation &&
    p.onRenameConversation === n.onRenameConversation &&
    p.onOpenDbModal === n.onOpenDbModal &&
    p.onDatabaseSwitch === n.onDatabaseSwitch &&
    p.onToggleOpen === n.onToggleOpen &&
    p.onMenuOpen === n.onMenuOpen &&
    p.onMobileClose === n.onMobileClose &&
    p.user?.photoURL === n.user?.photoURL &&
    p.user?.displayName === n.user?.displayName &&
    areConversationMetaEqual(p.conversations, n.conversations) &&
    areStringArraysEqual(p.availableDatabases, n.availableDatabases)
  );
}

export default memo(Sidebar, arePropsEqual);
