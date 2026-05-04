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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import StreamOutlinedIcon from '@mui/icons-material/StreamOutlined';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { getUserContext } from '../../api';
import { getScrollbarStyles } from '../../styles/shared';
import logger from '../../utils/logger';
import {
  ConversationItem,
  SidebarNavItem,
  HistoryListSkeleton,
} from './SidebarPrimitives';
import SidebarOverlays from './SidebarOverlays';
import {
  buildDesktopNavSx,
  buildMobileDrawerPaperStyles,
  buildSidebarSectionLabelSx,
} from './sidebarStyles';

const MOBILE_DRAWER_SLIDE_PROPS = {
  mountOnEnter: true,
  unmountOnExit: true,
};

function Sidebar({
  conversations = [],
  isConversationsLoading = false,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
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

  const [dbPopoverAnchor, setDbPopoverAnchor] = useState(null);
  const [historyPopoverAnchor, setHistoryPopoverAnchor] = useState(null);
  const [searchPopoverAnchor, setSearchPopoverAnchor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mindmapOpen, setMindmapOpen] = useState(false);
  const [recentsCollapsed, setRecentsCollapsed] = useState(false);
  const [schemaData, setSchemaData] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const isPopoverOpen = Boolean(dbPopoverAnchor);
  const isHistoryPopoverOpen = Boolean(historyPopoverAnchor);
  const isSearchPopoverOpen = Boolean(searchPopoverAnchor);
  const scrollbarStyles = useMemo(() => getScrollbarStyles(theme), [theme]);
  const mobileDrawerPaperStyles = useMemo(
    () => buildMobileDrawerPaperStyles(theme),
    [theme],
  );
  const desktopNavSx = useMemo(() => buildDesktopNavSx(theme, open), [theme, open]);
  const userInitials = useMemo(() => {
    const name = user?.displayName?.trim();
    if (!name) return 'M';
    const parts = name.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M';
  }, [user?.displayName]);

  const handleDatabaseSelect = useCallback((dbName) => {
    setDbPopoverAnchor(null);
    if (dbName !== currentDatabase) {
      onDatabaseSwitch?.(dbName);
    }
  }, [currentDatabase, onDatabaseSwitch]);

  const handleDatabaseAction = useCallback((event) => {
    if (isConnected && availableDatabases.length > 0) {
      setDbPopoverAnchor(event.currentTarget);
      return;
    }
    onOpenDbModal?.();
  }, [isConnected, availableDatabases.length, onOpenDbModal]);

  const handleHistoryClick = useCallback((event) => {
    if (conversations.length === 0) return;
    setHistoryPopoverAnchor(event.currentTarget);
  }, [conversations.length]);

  const handleSearchClick = useCallback((event) => {
    setSearchPopoverAnchor(event.currentTarget);
  }, []);

  const handleOpenMindmap = useCallback(async () => {
    if (!isConnected || !currentDatabase) return;
    setMindmapOpen(true);
    setSchemaLoading(true);
    try {
      const data = await getUserContext();
      if (data.status === 'success') {
        const currentSchema = data.schemas?.find((schema) => schema.database === currentDatabase);
        setSchemaData(currentSchema || null);
      }
    } catch (err) {
      logger.error('Failed to fetch schema:', err);
    } finally {
      setSchemaLoading(false);
    }
  }, [isConnected, currentDatabase]);

  const handleCloseMindmap = useCallback(() => setMindmapOpen(false), []);
  const toggleRecentsCollapsed = useCallback(() => setRecentsCollapsed((prev) => !prev), []);
  const handleCloseDbPopover = useCallback(() => setDbPopoverAnchor(null), []);
  const handleCloseHistoryPopover = useCallback(() => setHistoryPopoverAnchor(null), []);
  const handleCloseSearchPopover = useCallback(() => {
    setSearchPopoverAnchor(null);
    setSearchQuery('');
  }, []);
  const handleProfileClick = useCallback((event) => onMenuOpen?.(event), [onMenuOpen]);
  const handleOpenNewConnection = useCallback(() => {
    setDbPopoverAnchor(null);
    onOpenDbModal?.();
  }, [onOpenDbModal]);

  useEffect(() => {
    if ((isMobile && !mobileOpen) || (!isMobile && !open)) {
      setDbPopoverAnchor(null);
      setHistoryPopoverAnchor(null);
      setSearchPopoverAnchor(null);
      setSearchQuery('');
    }
  }, [isMobile, mobileOpen, open]);

  const topNavItems = useMemo(() => [
    {
      id: 'new-chat',
      label: 'New chat',
      tooltip: 'New chat',
      icon: <AddRoundedIcon sx={{ fontSize: 16 }} />,
      onClick: () => onNewChat?.(),
      shortcut: 'Ctrl+Shift+O',
      circularIconBg: true,
    },
    {
      id: 'search',
      label: 'Search chats',
      tooltip: 'Search chats',
      icon: <SearchRoundedIcon sx={{ fontSize: 18 }} />,
      onClick: handleSearchClick,
      shortcut: 'Ctrl+K',
    },
  ], [handleSearchClick, onNewChat]);

  const workspaceNavItems = useMemo(() => {
    const items = [
      {
        id: 'database',
        label: 'Database',
        tooltip: isConnected ? (currentDatabase || 'Connected database') : 'Connect database',
        icon: <CloudUploadOutlinedIcon sx={{ fontSize: 18 }} />,
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
        icon: <StreamOutlinedIcon sx={{ fontSize: 18 }} />,
        onClick: () => handleOpenMindmap(),
      });
    }

    return items;
  }, [isConnected, currentDatabase, handleDatabaseAction, handleOpenMindmap]);

  // FIX 1: renderHeader — always 'row', never flips flexDirection.
  // Title uses opacity + maxWidth transition instead of conditional mount/unmount.
  // Stable minHeight prevents height jitter during transition.
  const renderHeader = ({ collapsed = false, mobile = false } = {}) => {
    const toggleLabel = mobile
      ? 'Close sidebar'
      : collapsed
        ? 'Expand sidebar'
        : 'Collapse sidebar';

    return (
      <Box
        component="header"
        sx={{
          // px: 1 matches the nav group container padding so the toggle icon
          // lands at the exact same horizontal position as all nav icons below it.
          px: 1,
          pt: 1,
          pb: 1,
          minHeight: 48,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 0,
        }}
      >
        {/* Toggle button — mirrors nav row structure: px:1.5 + icon, never moves */}
        <Tooltip title={toggleLabel} placement="right" arrow>
          <Box
            component="button"
            type="button"
            onClick={mobile ? onMobileClose : onToggleOpen}
            aria-label={toggleLabel}
            aria-expanded={mobile ? undefined : !collapsed}
            aria-pressed={mobile ? undefined : !collapsed}
            sx={{
              // Same px as nav rows so the icon center aligns perfectly.
              px: 1.5,
              py: 0,
              height: 32,
              flexShrink: 0,
              border: 'none',
              outline: 'none',
              appearance: 'none',
              borderRadius: '10px',
              backgroundColor: 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              cursor: 'pointer',
              color: 'text.secondary',
              WebkitTapHighlightColor: 'transparent',
              transition: theme.transitions.create('color', {
                duration: theme.transitions.duration.shorter,
              }),
              '&:hover': { color: 'text.primary' },
              '&:focus-visible': {
                boxShadow: `0 0 0 2px ${alpha(theme.palette.text.secondary, 0.3)}`,
              },
            }}
          >
            <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0, width: 16, justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M16.5 4A1.5 1.5 0 0 1 18 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5v-9A1.5 1.5 0 0 1 3.5 4zM7 15h9.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5H7zM3.5 5a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H6V5z" />
              </svg>
            </Box>
          </Box>
        </Tooltip>

        {/* Moonlit title — always mounted, fades + shrinks when collapsed */}
        <Box
          sx={{
            flex: '1 1 auto',
            minWidth: 0,
            maxWidth: collapsed ? 0 : 200,
            opacity: collapsed ? 0 : 1,
            overflow: 'hidden',
            height: 32,
            display: 'flex',
            alignItems: 'center',
            pl: 1,
            transition: theme.transitions.create(['opacity', 'max-width'], {
              duration: theme.transitions.duration.shortest,
            }),
          }}
        >
          <Typography
            noWrap
            sx={{
              fontFamily: '"Georgia", "Times New Roman", serif',
              fontSize: '1rem',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: 0,
              color: 'text.primary',
              whiteSpace: 'nowrap',
            }}
          >
            Moonlit
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderNavigation = (items, collapsed, { pt = 1, ariaLabel = 'Navigation' } = {}) => (
    <Box role="group" aria-label={ariaLabel} sx={{ display: 'flex', flexDirection: 'column', gap: '1px', pt, px: 1 }}>
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
          circularIconBg={item.circularIconBg}
          shortcut={item.shortcut}
          uiTarget={item.uiTarget}
        />
      ))}
    </Box>
  );

  const renderHistorySection = () => (
    <Box sx={{ flex: recentsCollapsed ? '0 0 auto' : 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Box
        component="button"
        type="button"
        role="button"
        aria-expanded={!recentsCollapsed}
        onClick={toggleRecentsCollapsed}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          px: 2,
          pt: 1.5,
          pb: 1,
          border: 'none',
          outline: 'none',
          appearance: 'none',
          cursor: 'pointer',
          backgroundColor: 'transparent',
          flexShrink: 0,
          '&:hover .toggle-label': { opacity: 0.75 },
          '&:focus-visible': {
            boxShadow: `0 0 0 2px ${alpha(theme.palette.text.secondary, 0.3)}`,
            borderRadius: '8px',
          },
        }}
      >
        <Typography
          component="span"
          variant="caption"
          color="text.secondary"
          sx={{
            ...buildSidebarSectionLabelSx(),
            px: 0,
            pt: 0,
            pb: 0,
          }}
        >
          Recents
        </Typography>
        <Typography
          className="toggle-label"
          component="span"
          sx={{
            fontSize: '0.75rem',
            fontWeight: 400,
            color: 'text.disabled',
            opacity: 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          {recentsCollapsed ? 'Show' : 'Hide'}
        </Typography>
      </Box>
      <Collapse in={!recentsCollapsed} timeout="auto" sx={{ flex: recentsCollapsed ? 0 : 1, minHeight: 0, overflow: recentsCollapsed ? 'hidden' : 'auto' }}>
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
            <Box sx={{ px: 1.5, py: 1.5, opacity: 0.6 }}>
              <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.4 }}>
                No conversations yet
              </Typography>
            </Box>
          ) : (
            conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === currentConversationId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
              />
            ))
          )}
        </Box>
      </Collapse>
    </Box>
  );

  const renderFooter = ({ collapsed = false } = {}) => {
    const profileTooltipTitle = collapsed ? (user?.displayName || 'Profile') : '';
    const profileAriaLabel = `${user?.displayName || 'Profile'}, Settings`;

    return (
      <Box
        component="footer"
        sx={{
          // Fixed padding matching nav items — no layout shift during transition.
          px: 1,
          py: 0.75,
          borderTop: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.5 : 0.65)}`,
        }}
      >
        <Tooltip
          title={profileTooltipTitle}
          placement="right"
          arrow
          disableHoverListener={!profileTooltipTitle}
          disableFocusListener={!profileTooltipTitle}
          disableTouchListener={!profileTooltipTitle}
        >
          <Box
            component="button"
            type="button"
            onClick={handleProfileClick}
            aria-label={profileAriaLabel}
            sx={{
              display: 'flex',
              alignItems: 'center',
              // px: 1.5 matches nav rows exactly — avatar left edge aligns with nav icons.
              justifyContent: 'flex-start',
              gap: 1.25,
              width: '100%',
              minHeight: 38,
              px: 1.5,
              py: 0.5,
              border: 'none',
              outline: 'none',
              appearance: 'none',
              cursor: 'pointer',
              borderRadius: '10px',
              backgroundColor: 'transparent',
              color: 'inherit',
              opacity: 0.78,
              transition: theme.transitions.create(['opacity', 'background-color'], {
                duration: theme.transitions.duration.shorter,
              }),
              '&:hover': {
                opacity: 1,
                backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.055),
              },
              '&:focus-visible': {
                boxShadow: `0 0 0 2px ${alpha(theme.palette.text.secondary, 0.3)}`,
              },
            }}
          >
            {/* Avatar — fixed size, never moves */}
            {user?.photoURL ? (
              <Avatar
                src={user.photoURL}
                sx={{ width: 28, height: 28, flexShrink: 0 }}
              />
            ) : (
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  flexShrink: 0,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {userInitials}
              </Avatar>
            )}

            {/* Label — always mounted, fades + shrinks */}
            <Box
              sx={{
                flex: '1 1 auto',
                minWidth: 0,
                maxWidth: collapsed ? 0 : 218,
                opacity: collapsed ? 0 : 1,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                transition: theme.transitions.create(['opacity', 'max-width'], {
                  duration: theme.transitions.duration.shortest,
                }),
              }}
            >
              <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.2, color: 'text.primary', whiteSpace: 'nowrap' }}>
                {user?.displayName || 'Profile'}
              </Typography>
            </Box>

            {/* Chevron — always mounted, fades out */}
            <Box
              sx={{
                maxWidth: collapsed ? 0 : 24,
                opacity: collapsed ? 0 : 1,
                overflow: 'hidden',
                flexShrink: 0,
                transition: theme.transitions.create(['opacity', 'max-width'], {
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
  };

  const expandedSidebarContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderHeader({ mobile: isMobile })}
      {renderNavigation(topNavItems, false, { ariaLabel: 'Primary actions' })}
      {renderNavigation(workspaceNavItems, false, { pt: 0.125, ariaLabel: 'Workspace actions' })}
      {renderHistorySection()}
      {renderFooter()}
    </Box>
  );

  // FIX 3: desktopSidebarContent — history section and collapsed history icon are BOTH
  // always mounted inside a stable flex:1 container. They crossfade via opacity + visibility
  // instead of unmounting and remounting, which was the primary cause of layout jitter.
  const desktopSidebarContent = (
    <>
      {renderHeader({ collapsed: !open })}
      {/* Content zone — matches Claude's flex-grow overflow-hidden min-h-0 wrapper */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {renderNavigation(topNavItems, !open, { ariaLabel: 'Primary actions' })}
        {renderNavigation(workspaceNavItems, !open, { pt: 0.125, ariaLabel: 'Workspace actions' })}

        {/* Scrollable zone */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
        {/* Expanded: full history list — always mounted, hidden when collapsed */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            opacity: open ? 1 : 0,
            visibility: open ? 'visible' : 'hidden',
            pointerEvents: open ? 'auto' : 'none',
            transition: theme.transitions.create('opacity', {
              duration: theme.transitions.duration.shortest,
            }),
          }}
        >
          {renderHistorySection()}
        </Box>

        {/* Collapsed: history icon — always mounted, hidden when expanded */}
        <Box
          sx={{
            px: 1,
            py: 0.25,
            opacity: open ? 0 : 1,
            visibility: open ? 'hidden' : 'visible',
            pointerEvents: open ? 'none' : 'auto',
            transition: theme.transitions.create('opacity', {
              duration: theme.transitions.duration.shortest,
            }),
          }}
        >
          <Box>
            <SidebarNavItem
              label="History"
              tooltip="Recent chats"
              icon={<HistoryOutlinedIcon sx={{ fontSize: 18 }} />}
              onClick={handleHistoryClick}
              isCollapsed
              disabled={conversations.length === 0}
            />
          </Box>
        </Box>
        </Box>
      </Box>

      {renderFooter({ collapsed: !open })}
    </>
  );

  if (isMobile) {
    return (
      <>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
          SlideProps={MOBILE_DRAWER_SLIDE_PROPS}
          PaperProps={{ sx: mobileDrawerPaperStyles }}
        >
          {expandedSidebarContent}
        </Drawer>
        <SidebarOverlays
          theme={theme}
          isPopoverOpen={isPopoverOpen}
          dbPopoverAnchor={dbPopoverAnchor}
          handleCloseDbPopover={handleCloseDbPopover}
          availableDatabases={availableDatabases}
          currentDatabase={currentDatabase}
          handleDatabaseSelect={handleDatabaseSelect}
          handleOpenNewConnection={handleOpenNewConnection}
          isSearchPopoverOpen={isSearchPopoverOpen}
          searchPopoverAnchor={searchPopoverAnchor}
          handleCloseSearchPopover={handleCloseSearchPopover}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isHistoryPopoverOpen={isHistoryPopoverOpen}
          historyPopoverAnchor={historyPopoverAnchor}
          handleCloseHistoryPopover={handleCloseHistoryPopover}
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={onSelectConversation}
          onDeleteConversation={onDeleteConversation}
          mindmapOpen={mindmapOpen}
          handleCloseMindmap={handleCloseMindmap}
          schemaLoading={schemaLoading}
          schemaData={schemaData}
        />
      </>
    );
  }

  return (
    <>
      {/* Outer clip wrapper — prevents content overflow during width transition.
          Mirrors Claude's div.shrink-0(overflow:hidden) > div.sticky > nav pattern. */}
      <Box
        sx={{
          flexShrink: 0,
          overflow: 'hidden',
          width: 'auto',
          opacity: 1,
        }}
      >
        <Box component="nav" aria-label="Sidebar" sx={desktopNavSx}>
          {desktopSidebarContent}
        </Box>
      </Box>
      <SidebarOverlays
        theme={theme}
        isPopoverOpen={isPopoverOpen}
        dbPopoverAnchor={dbPopoverAnchor}
        handleCloseDbPopover={handleCloseDbPopover}
        availableDatabases={availableDatabases}
        currentDatabase={currentDatabase}
        handleDatabaseSelect={handleDatabaseSelect}
        handleOpenNewConnection={handleOpenNewConnection}
        isSearchPopoverOpen={isSearchPopoverOpen}
        searchPopoverAnchor={searchPopoverAnchor}
        handleCloseSearchPopover={handleCloseSearchPopover}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isHistoryPopoverOpen={isHistoryPopoverOpen}
        historyPopoverAnchor={historyPopoverAnchor}
        handleCloseHistoryPopover={handleCloseHistoryPopover}
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={onSelectConversation}
        onDeleteConversation={onDeleteConversation}
        mindmapOpen={mindmapOpen}
        handleCloseMindmap={handleCloseMindmap}
        schemaLoading={schemaLoading}
        schemaData={schemaData}
      />
    </>
  );
}

function areStringArraysEqual(prev = [], next = []) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

function areConversationMetaEqual(prev = [], next = []) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i]?.id !== next[i]?.id) return false;
    if (prev[i]?.title !== next[i]?.title) return false;
  }
  return true;
}

function arePropsEqual(prevProps, nextProps) {
  if (prevProps.currentConversationId !== nextProps.currentConversationId) return false;
  if (prevProps.isConnected !== nextProps.isConnected) return false;
  if (prevProps.isConversationsLoading !== nextProps.isConversationsLoading) return false;
  if (prevProps.currentDatabase !== nextProps.currentDatabase) return false;
  if (prevProps.open !== nextProps.open) return false;
  if (prevProps.mobileOpen !== nextProps.mobileOpen) return false;
  if (prevProps.onNewChat !== nextProps.onNewChat) return false;
  if (prevProps.onSelectConversation !== nextProps.onSelectConversation) return false;
  if (prevProps.onDeleteConversation !== nextProps.onDeleteConversation) return false;
  if (prevProps.onOpenDbModal !== nextProps.onOpenDbModal) return false;
  if (prevProps.onDatabaseSwitch !== nextProps.onDatabaseSwitch) return false;
  if (prevProps.onToggleOpen !== nextProps.onToggleOpen) return false;
  if (prevProps.onMenuOpen !== nextProps.onMenuOpen) return false;
  if (prevProps.onMobileClose !== nextProps.onMobileClose) return false;
  if (prevProps.user?.photoURL !== nextProps.user?.photoURL) return false;
  if (prevProps.user?.displayName !== nextProps.user?.displayName) return false;
  if (!areConversationMetaEqual(prevProps.conversations, nextProps.conversations)) return false;
  if (!areStringArraysEqual(prevProps.availableDatabases, nextProps.availableDatabases)) return false;
  return true;
}

export default memo(Sidebar, arePropsEqual);
