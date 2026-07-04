// Main Interface — logged-in application shell.
//
// This is the screen users land on after authentication. It composes three
// layers:
//
//   1. Sidebar (left)          — conversation list, nav items, profile footer
//   2. Chat workspace (center) — message list + composer + welcome screen
//   3. Artifact panel (right)  — SQL editor, visualizations, diagram canvas
//
// On narrow viewports the sidebar becomes a drawer and the artifact panel
// becomes a full-screen slide-up overlay — see `useChatPageController` and
// `useResponsive` for the breakpoint logic.
//
// Overlays (DatabaseModal, SettingsModal, ConfirmDialog) are mounted at the
// end of the tree so they float above the workspace layers. Toasts use MUI's
// `Snackbar` z-index token (1400) so they sit above everything except
// tooltips.

import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Box,
  Button,
  Collapse,
  Fade,
  IconButton,
  Menu,
  MenuItem,
  Slide,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AnimatePresence } from 'framer-motion';
import { lazy, memo, Suspense, useMemo, useRef, useState } from 'react';
import { ConfirmDialog, ResizeHandle } from '@/components';
import Notification from '@/components/ui/toast';
import { ChatInput, MessageList, WelcomeScreen } from '@/features/chat';
import RenameConversationDialog from '@/features/chat/RenameConversationDialog';
import Sidebar from '@/features/sidebar-left';
import ArtifactLoader from '@/features/sidebar-right/index';
import {
  getAppPanelSurfaceSx,
  getAppSunkenSurfaceSx,
  getShellWorkspaceSx,
} from '@/features/styles/interfaceChrome';
import { useChatPageController } from '@/hooks/chat-page/useChatPageController';
import {
  getInteractionColors,
  getInteractiveIconButtonSx,
  getPopoverMenuItemSx,
  getPopoverMenuListSx,
  getPopoverPaperSx,
  getScrollbarStyles,
  UI_LAYOUT,
  UI_Z_INDEX,
} from '@/styles/shared';

const DatabaseModal = lazy(() => import('@/features/overlays/database/DatabaseModal'));
const SettingsModal = lazy(() => import('@/features/overlays/settings/SettingsModal'));

/**
 * ENH [TASK-PAUSED-BANNER]: Compact "Task Paused" strip that slides UP from
 * behind the composer, overlaying the chat instead of pushing it.
 *
 * Design goals:
 *   1. No layout shift — the banner is absolutely positioned over the chat,
 *      so chat messages don't jump when it appears.
 *   2. Compact single-line text ("⏸ Step limit reached · 5 steps used") —
 *      the buttons speak for themselves.
 *   3. Slides up from behind the composer's top edge (translateY animation).
 *   4. Composer stays fully interactive (zIndex above the banner).
 *   5. A subtle gradient fade at the banner's top edge so the chat content
 *      behind it fades out gracefully.
 *
 * Layering:
 *   - Banner zIndex: 3  (above chat messages, below composer)
 *   - Composer zIndex: 4 (always on top, always interactive)
 */
const GuidedConfirmationPrompt = memo(function GuidedConfirmationPrompt({
  open,
  title,
  message,
  confirmText,
  cancelText,
  onCancel,
  onConfirm,
  theme,
}) {
  const isDark = theme.palette.mode === 'dark';

  // The compact one-line message is already built by the caller
  // ("Step limit reached · 5 steps used"). We render it as a single line.
  const compactMessage = message || 'Task paused';

  return (
    <Collapse
      in={open}
      timeout={250}
      sx={{
        // Collapse wraps the banner; we position it absolutely so it
        // overlays the chat instead of pushing content. Anchored to the
        // bottom of the composer wrapper, just above the composer.
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '100%',
        zIndex: 3,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <Fade in={open} timeout={250}>
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label={title ? `${title}: ${compactMessage}` : compactMessage}
          sx={{
            width: '100%',
            maxWidth: UI_LAYOUT.chatInputMaxWidth,
            mx: 'auto',
            px: { xs: 1, sm: 0 },
            // Slide up from behind the composer: start translated down + faded,
            // end at rest. The Collapse handles the height; this transform
            // adds the "from behind" feel.
            transform: open ? 'translateY(0)' : 'translateY(8px)',
            transition: theme.transitions.create(['transform', 'opacity'], {
              duration: 250,
              easing: theme.transitions.easing.easeOut,
            }),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: { xs: 1, sm: 1.5 },
              borderTopLeftRadius: '14px',
              borderTopRightRadius: '14px',
              border: '1px solid',
              borderColor: alpha(theme.palette.warning.main, isDark ? 0.32 : 0.24),
              borderBottom: 0,
              ...getAppPanelSurfaceSx(theme),
              px: { xs: 1.75, sm: 2.25 },
              py: 1,
              // Subtle warning-tinted background so it reads as a status,
              // not a plain panel.
              bgcolor: (th) =>
                alpha(th.palette.warning.main, th.palette.mode === 'dark' ? 0.08 : 0.05),
              // Shadow upward so it lifts off the composer edge.
              boxShadow: `0 -4px 16px ${alpha(theme.palette.common.black, isDark ? 0.3 : 0.08)}`,
            }}
          >
            {/* Compact single-line message with icon */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minWidth: 0,
              }}
            >
              <Box
                aria-hidden
                component="span"
                sx={{
                  fontSize: 14,
                  lineHeight: 1,
                  flexShrink: 0,
                  color: 'warning.main',
                }}
              >
                ⏸
              </Box>
              <Typography
                sx={{
                  ...theme.typography.uiBodySm,
                  color: 'text.primary',
                  fontWeight: 600,
                  lineHeight: 1.3,
                  // Allow wrapping for longer messages (agent interrupts,
                  // navigate_new_chat) but keep it compact. The step-limit
                  // message ("Step limit reached · 5 steps used") fits on
                  // one line in most widths.
                  overflowWrap: 'anywhere',
                  maxHeight: '2.6em', // cap at ~2 lines
                  overflow: 'hidden',
                }}
              >
                {compactMessage}
              </Typography>
            </Box>

            {/* Action buttons — compact, single row */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                flexShrink: 0,
                // On mobile, buttons go to the right edge of their row.
                alignSelf: { xs: 'flex-end', sm: 'center' },
              }}
            >
              <Button
                size="small"
                onClick={onCancel}
                sx={{
                  minHeight: 28,
                  borderRadius: '6px',
                  textTransform: 'none',
                  color: 'text.secondary',
                  px: 1.25,
                  ...theme.typography.uiCaptionMd,
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                  },
                  '&.Mui-focusVisible': {
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.text.primary, isDark ? 0.18 : 0.12)}`,
                    outline: 'none',
                  },
                }}
              >
                {cancelText || 'Stop'}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={onConfirm}
                sx={{
                  minHeight: 28,
                  borderRadius: '6px',
                  textTransform: 'none',
                  px: 1.5,
                  ...theme.typography.uiCaptionMd,
                  fontWeight: 700,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                    boxShadow: 'none',
                  },
                  '&.Mui-focusVisible': {
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, isDark ? 0.28 : 0.2)}`,
                    outline: 'none',
                  },
                }}
              >
                {confirmText || 'Continue'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Fade>
    </Collapse>
  );
});

const MobileSidebarOpenButton = memo(function MobileSidebarOpenButton({ visible, theme, onOpen }) {
  if (!visible) return null;

  return (
    <Tooltip title="Open sidebar">
      <IconButton
        size="small"
        onClick={onOpen}
        aria-label="Open sidebar"
        sx={{
          position: 'absolute',
          top: 'max(env(safe-area-inset-top), 12px)',
          left: 12,
          zIndex: UI_Z_INDEX.mainContentControl,
          ...getInteractiveIconButtonSx(theme, { size: 44, radius: '8px' }),
          width: 44,
          height: 44,
          ...getAppPanelSurfaceSx(theme),
          // Subtle resting shadow so the button reads as "floating" above the chat surface.
          // Previous version used `opacity: 0.82` which reduced visible contrast and hurt
          // a11y — we now keep the button at full opacity and rely on shadow + position
          // to communicate its overlay role.
          boxShadow: (th) =>
            th.palette.mode === 'dark'
              ? `0 4px 14px ${alpha('#000', 0.42)}, 0 0 0 1px ${alpha(th.palette.text.primary, 0.12)}`
              : `0 4px 14px ${alpha('#000', 0.08)}, 0 0 0 1px ${alpha(th.palette.text.primary, 0.08)}`,
          transition: 'box-shadow 160ms ease, background-color 160ms ease',
          '&:hover': {
            backgroundColor: getInteractionColors(theme).hoverBackground,
            boxShadow: (th) =>
              th.palette.mode === 'dark'
                ? `0 6px 18px ${alpha('#000', 0.5)}, 0 0 0 1px ${alpha(th.palette.text.primary, 0.18)}`
                : `0 6px 18px ${alpha('#000', 0.1)}, 0 0 0 1px ${alpha(th.palette.text.primary, 0.12)}`,
          },
        }}
      >
        <MenuRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
});

const ChatWorkspaceLayer = memo(function ChatWorkspaceLayer({
  showWelcomeState,
  user,
  chatInputSharedProps,
  showConversationPanel,
  setScrollContainerRef,
  messages,
  isConversationLoading,
  conversationLoadState,
  handleRunQuery,
  handleOpenCanvasArtifact,
  guidedConfirmDialog,
  handleGuidedCancel,
  handleGuidedConfirm,
  currentConversationId,
  theme,
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        zIndex: UI_Z_INDEX.mainContentBase,
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        contain: 'layout paint style',
      }}
    >
      <WelcomeScreen visible={showWelcomeState} user={user} chatInputProps={chatInputSharedProps} />

      <Fade in={showConversationPanel} timeout={300} unmountOnExit>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            position: 'relative',
          }}
        >
          <Box
            ref={setScrollContainerRef}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              px: { xs: 0, sm: 1 },
              pt: { xs: 2, sm: 3 },
              pb: { xs: 1, sm: 2 },
              ...getScrollbarStyles(theme),
            }}
          >
            <MessageList
              messages={messages}
              isLoadingConversation={isConversationLoading}
              loadError={conversationLoadState === 'error'}
              conversationId={currentConversationId}
              onRunQuery={handleRunQuery}
              onOpenCanvasArtifact={handleOpenCanvasArtifact}
            />
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              position: 'relative', // Anchor for the absolutely-positioned banner
              zIndex: 2,
              px: { xs: 0, sm: 1 },
              pt: { xs: 1, sm: 1.5 },
              pb: 'max(env(safe-area-inset-bottom), 8px)',
            }}
          >
            <GuidedConfirmationPrompt
              open={guidedConfirmDialog.open}
              title={guidedConfirmDialog.title}
              message={guidedConfirmDialog.message}
              confirmText={guidedConfirmDialog.confirmText}
              cancelText={guidedConfirmDialog.cancelText}
              onCancel={handleGuidedCancel}
              onConfirm={handleGuidedConfirm}
              theme={theme}
            />
            <Box sx={{ position: 'relative', zIndex: 4 }}>
              <ChatInput {...chatInputSharedProps} messageCount={messages.length} />
            </Box>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
});

const WorkspaceOverlayLayer = memo(
  function WorkspaceOverlayLayer({
    dbModalOpen,
    handleCloseDbModal,
    handleDbConnect,
    handleDbModalSelectDatabase,
    isDbConnected,
    currentDatabase,
    availableDatabases,
    dbModalInitialType,
    settingsOpen,
    handleCloseSettings,
    settingsInitialSection,
  }) {
    return (
      <>
        <Suspense fallback={null}>
          <DatabaseModal
            open={dbModalOpen}
            onClose={handleCloseDbModal}
            onConnect={handleDbConnect}
            onSelectDatabase={handleDbModalSelectDatabase}
            isConnected={isDbConnected}
            currentDatabase={currentDatabase}
            availableDatabases={availableDatabases}
            initialDbType={dbModalInitialType}
          />
        </Suspense>
        <Suspense fallback={null}>
          <SettingsModal
            open={settingsOpen}
            onClose={handleCloseSettings}
            initialSection={settingsInitialSection}
          />
        </Suspense>
      </>
    );
  },
  (prev, next) =>
    prev.dbModalOpen === next.dbModalOpen &&
    prev.settingsOpen === next.settingsOpen &&
    prev.isDbConnected === next.isDbConnected &&
    prev.currentDatabase === next.currentDatabase &&
    prev.availableDatabases === next.availableDatabases &&
    prev.dbModalInitialType === next.dbModalInitialType &&
    prev.settingsInitialSection === next.settingsInitialSection,
);

function MainInterface() {
  const workspaceContainerRef = useRef(null);
  const {
    theme,
    isNarrowLayout,
    anchorEl,
    user,
    handleMenuClose,
    handleOpenSettings,
    handleLogout,
    commonSidebarProps,
    handleSidebarNewChat,
    handleSidebarSelectConversation,
    handleSidebarOpenDbModal,
    sidebarOpen,
    handleSidebarToggle,
    handleSidebarMenuOpen,
    mobileOpen,
    handleMobileDrawerOpen,
    handleMobileDrawerClose,
    showWelcomeState,
    setScrollContainerRef,
    showConversationPanel,
    messages,
    isConversationLoading,
    conversationLoadState,
    currentConversationId,
    handleRunQuery,
    handleOpenCanvasArtifact,
    chatInputSharedProps,
    workspaceCanvasOpen,
    workspaceCanvasArtifact,
    workspaceCanvasWidth,
    handleCanvasResize,
    handleCloseWorkspaceCanvas,
    isDbConnected,
    currentDatabase,
    dbModalOpen,
    handleCloseDbModal,
    handleDbConnect,
    handleDbModalSelectDatabase,
    notifications,
    showSnackbar,
    removeToast,
    settingsOpen,
    handleCloseSettings,
    confirmDialog,
    handleConfirmDialogClose,
    deleteConversationDialog,
    handleDeleteConversationDialogClose,
    handleDeleteConversationConfirm,
    renameConversationDialog,
    handleRenameConversationDialogClose,
    handleRenameConversationTitleChange,
    handleRenameConversationConfirm,
    guidedConfirmDialog,
    handleGuidedCancel,
    handleGuidedConfirm,
    dbModalInitialType,
    settingsInitialSection,
  } = useChatPageController();

  const [isResizingCanvas, setIsResizingCanvas] = useState(false);
  const _isDark = theme.palette.mode === 'dark';
  const appShellSx = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      bgcolor: 'background.default',
    }),
    [],
  );
  const workspaceContainerSx = useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'stretch',
      overflow: 'hidden',
      position: 'relative',
    }),
    [],
  );
  const mainContentSx = useMemo(
    () => ({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      mt: 0,
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      position: 'relative',
      zIndex: UI_Z_INDEX.mainContentBase,
      ...getShellWorkspaceSx(theme),
    }),
    [theme],
  );
  const desktopCanvasShellSx = useMemo(
    () => ({
      display: 'flex',
      flexShrink: 0,
      minHeight: 0,
      alignSelf: 'stretch',
      height: '100%',
    }),
    [],
  );
  const mobileCanvasShellSx = useMemo(
    () => (theme) => ({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: UI_Z_INDEX.artifactFullscreen,
      display: 'flex',
      flexDirection: 'column',
      ...getAppSunkenSurfaceSx(theme),
    }),
    [],
  );

  return (
    <Box id="app-shell" sx={appShellSx}>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: sidebarOpen ? 'left' : 'right',
        }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        MenuListProps={{ sx: getPopoverMenuListSx() }}
        PaperProps={{
          sx: {
            ...getPopoverPaperSx(theme, theme.palette.mode === 'dark'),
            width: 240,
            p: 0,
            overflow: 'hidden',
          },
        }}
      >
        {/* Email header */}
        <Box sx={{ px: 1, pt: 0.5, pb: 1 }}>
          <Typography
            sx={{
              ...theme.typography.uiCaptionXs,
              color: 'text.secondary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user?.email}
          </Typography>
        </Box>
        <MenuItem
          onClick={handleOpenSettings}
          data-ui-target="settings_button"
          sx={{
            ...getPopoverMenuItemSx(theme),
          }}
        >
          <SettingsOutlinedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
          <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>
            Settings
          </Typography>
        </MenuItem>
        {/* Separator */}
        <Box
          sx={{
            height: '1px',
            backgroundColor: alpha(theme.palette.text.primary, 0.07),
            my: 0.75,
            mx: 0.5,
          }}
        />
        <MenuItem
          onClick={handleLogout}
          sx={{
            ...getPopoverMenuItemSx(theme),
          }}
        >
          <LogoutOutlinedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
          <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>
            Sign out
          </Typography>
        </MenuItem>
      </Menu>
      <Sidebar
        {...commonSidebarProps}
        onNewChat={handleSidebarNewChat}
        onSelectConversation={handleSidebarSelectConversation}
        onOpenDbModal={handleSidebarOpenDbModal}
        open={sidebarOpen}
        onToggleOpen={handleSidebarToggle}
        onMenuOpen={handleSidebarMenuOpen}
        mobileOpen={mobileOpen}
        onMobileClose={handleMobileDrawerClose}
      />
      <Box ref={workspaceContainerRef} sx={workspaceContainerSx}>
        <Box component="main" id="main-content" aria-label="Chat workspace" sx={mainContentSx}>
          <MobileSidebarOpenButton
            visible={isNarrowLayout}
            theme={theme}
            onOpen={handleMobileDrawerOpen}
          />

          <ChatWorkspaceLayer
            showWelcomeState={showWelcomeState}
            user={user}
            chatInputSharedProps={chatInputSharedProps}
            showConversationPanel={showConversationPanel}
            setScrollContainerRef={setScrollContainerRef}
            messages={messages}
            isConversationLoading={isConversationLoading}
            conversationLoadState={conversationLoadState}
            handleRunQuery={handleRunQuery}
            handleOpenCanvasArtifact={handleOpenCanvasArtifact}
            guidedConfirmDialog={guidedConfirmDialog}
            handleGuidedCancel={handleGuidedCancel}
            handleGuidedConfirm={handleGuidedConfirm}
            currentConversationId={currentConversationId}
            theme={theme}
          />
        </Box>
        {!isNarrowLayout && (
          <Box
            component="section"
            data-ui-target="workspace_canvas"
            sx={desktopCanvasShellSx}
            aria-label="Workspace canvas"
          >
            <ResizeHandle
              onResize={handleCanvasResize}
              onResizeStart={() => setIsResizingCanvas(true)}
              onResizeEnd={() => setIsResizingCanvas(false)}
              disabled={!workspaceCanvasOpen}
            />
            <ArtifactLoader
              artifact={workspaceCanvasArtifact}
              onOpenArtifact={handleOpenCanvasArtifact}
              onClose={handleCloseWorkspaceCanvas}
              isDbConnected={isDbConnected}
              currentDatabase={currentDatabase}
              isOpen={workspaceCanvasOpen}
              panelWidth={workspaceCanvasWidth}
              isResizing={isResizingCanvas}
              workspaceContainerRef={workspaceContainerRef}
              onNotify={showSnackbar}
            />
          </Box>
        )}
      </Box>
      {isNarrowLayout && (
        <Slide direction="up" in={workspaceCanvasOpen} mountOnEnter unmountOnExit>
          <Box sx={mobileCanvasShellSx}>
            <ArtifactLoader
              artifact={workspaceCanvasArtifact}
              onOpenArtifact={handleOpenCanvasArtifact}
              onClose={handleCloseWorkspaceCanvas}
              isDbConnected={isDbConnected}
              currentDatabase={currentDatabase}
              fullscreen
              workspaceContainerRef={workspaceContainerRef}
              onNotify={showSnackbar}
            />
          </Box>
        </Slide>
      )}
      <WorkspaceOverlayLayer
        dbModalOpen={dbModalOpen}
        handleCloseDbModal={handleCloseDbModal}
        handleDbConnect={handleDbConnect}
        handleDbModalSelectDatabase={handleDbModalSelectDatabase}
        isDbConnected={isDbConnected}
        currentDatabase={currentDatabase}
        availableDatabases={commonSidebarProps.availableDatabases}
        dbModalInitialType={dbModalInitialType}
        settingsOpen={settingsOpen}
        handleCloseSettings={handleCloseSettings}
        settingsInitialSection={settingsInitialSection}
      />

      {/* ── Toast stack ───────────────────────────────────────────────────────
          Notification toasts stacked in the bottom-right on desktop, centered
          on narrow viewports. We render into a `pointerEvents: none` container
          so the underlying UI remains interactive; each toast re-enables its
          own pointer events.

          We use MUI's `Snackbar` z-index token rather than the previous magic
          `9999` so the stack stays in sync with MUI's layer cake.
      */}
      <Box
        sx={{
          position: 'fixed',
          bottom: { xs: 16, sm: 24 },
          right: isNarrowLayout ? 'auto' : 24,
          left: isNarrowLayout ? '50%' : 'auto',
          transform: isNarrowLayout ? 'translateX(-50%)' : 'none',
          zIndex: (th) => th.zIndex.snackbar,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          pointerEvents: 'none',
          width: { xs: 'calc(100% - 32px)', sm: 'auto' },
          maxWidth: 380,
        }}
      >
        <AnimatePresence>
          {notifications.map((notification) => (
            <Notification
              key={notification.id}
              type={notification.type}
              title={notification.title}
              message={notification.message}
              showIcon={notification.showIcon}
              duration={notification.duration}
              onClose={() => removeToast(notification.id)}
            />
          ))}
        </AnimatePresence>
      </Box>
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={handleConfirmDialogClose}
        onConfirm={confirmDialog.onConfirm}
        title="Run query?"
        description="This query will be executed against the connected database."
        intent="warning"
        confirmText="Run query"
        cancelText="Cancel"
        maxWidth="xs"
        loadingText="Running..."
      />
      <RenameConversationDialog
        open={renameConversationDialog.open}
        title={renameConversationDialog.title}
        onClose={handleRenameConversationDialogClose}
        onChange={handleRenameConversationTitleChange}
        onConfirm={handleRenameConversationConfirm}
      />
      <ConfirmDialog
        open={deleteConversationDialog.open}
        onClose={handleDeleteConversationDialogClose}
        onConfirm={handleDeleteConversationConfirm}
        title="Delete conversation?"
        description="Are you sure you want to delete this conversation? This action cannot be undone."
        intent="danger"
        confirmText="Delete"
        cancelText="Cancel"
        loadingText="Deleting..."
        maxWidth="xs"
        closeOnConfirm
      />
    </Box>
  );
}

export default memo(MainInterface);
