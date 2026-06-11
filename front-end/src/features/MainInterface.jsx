// Main Interface - Logged-in application shell

import { lazy, memo, Suspense, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  Snackbar,
  Button,
  Slide,
  Fade,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import Sidebar from '@/features/sidebar-left';
import { ChatInput, MessageList, WelcomeScreen } from '@/features/chat';
import ArtifactLoader from '@/features/sidebar-right/index';
import { ConfirmDialog, ResizeHandle } from '@/components';
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
import { useChatPageController } from '@/hooks/chat-page/useChatPageController';
import { getShellWorkspaceSx } from '@/features/styles/interfaceChrome';

const DatabaseModal = lazy(() => import('@/features/overlays/database/DatabaseModal'));
const SettingsModal = lazy(() => import('@/features/overlays/settings/SettingsModal'));

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
  return (
    <Fade in={open} timeout={180} unmountOnExit>
      <Box
        role="status"
        aria-live="polite"
        sx={{
          width: '100%',
          maxWidth: UI_LAYOUT.chatInputMaxWidth,
          mx: 'auto',
          mb: 1,
          boxSizing: 'border-box',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
            alignItems: 'center',
            gap: { xs: 1, sm: 1.5 },
            borderRadius: '10px',
            border: '1px solid',
            borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.12 : 0.1),
            bgcolor: alpha(theme.palette.background.elevated, theme.palette.mode === 'dark' ? 0.96 : 0.98),
            boxShadow: `0 10px 28px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.24 : 0.08)}`,
            px: { xs: 1.25, sm: 1.5 },
            py: { xs: 1, sm: 1.1 },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                ...theme.typography.uiBodySm,
                color: 'text.primary',
                fontWeight: 600,
                lineHeight: 1.35,
              }}
            >
              {title || 'Confirm action'}
            </Typography>
            {message ? (
              <Typography
                sx={{
                  mt: 0.25,
                  ...theme.typography.uiCaptionMd,
                  color: 'text.secondary',
                  lineHeight: 1.45,
                  overflowWrap: 'anywhere',
                }}
              >
                {message}
              </Typography>
            ) : null}
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: { xs: 'flex-end', sm: 'flex-start' },
              gap: 0.75,
              flexWrap: 'wrap',
            }}
          >
            <Button
              size="small"
              color="secondary"
              onClick={onCancel}
              sx={{ minHeight: 34, borderRadius: '8px' }}
            >
              {cancelText || 'Not now'}
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              disableElevation
              onClick={onConfirm}
              sx={{ minHeight: 34, borderRadius: '8px' }}
            >
              {confirmText || 'Confirm'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
});

const MobileSidebarOpenButton = memo(function MobileSidebarOpenButton({
  visible,
  theme,
  onOpen,
}) {
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
        backgroundColor: alpha(theme.palette.background.paper, 0.96),
        boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.18 : 0.08)}`,
        opacity: 0.82,
        transition: 'opacity 0.15s ease',
        '&:hover': {
          opacity: 1,
          backgroundColor: getInteractionColors(theme).hoverBackground,
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
  handleOpenSqlEditor,
  handleOpenCanvasArtifact,
  guidedConfirmDialog,
  handleGuidedCancel,
  handleGuidedConfirm,
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
      <WelcomeScreen
        visible={showWelcomeState}
        user={user}
        chatInputProps={chatInputSharedProps}
      />

      <Fade in={showConversationPanel} timeout={300} unmountOnExit>
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
          {messages.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                top: { xs: 8, sm: 16 },
                right: { xs: 8, sm: 24 },
                zIndex: UI_Z_INDEX.mainContentControl,
                pointerEvents: 'none',
              }}
            >
              <Chip
                label={`Turns: ${Math.floor(messages.length / 2)}`}
                size="small"
                variant="outlined"
                sx={{
                  height: 26,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: alpha(theme.palette.background.paper, 0.6),
                  backdropFilter: 'blur(8px)',
                  borderColor: alpha(theme.palette.divider, 0.4),
                  color: 'text.secondary',
                  boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.05)}`,
                }}
              />
            </Box>
          )}
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
              onRunQuery={handleRunQuery}
              onOpenSqlEditor={handleOpenSqlEditor}
              onOpenCanvasArtifact={handleOpenCanvasArtifact}
            />
          </Box>

          <Box
            sx={{
              flexShrink: 0,
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
            <ChatInput
              {...chatInputSharedProps}
              messageCount={messages.length}
            />
          </Box>
        </Box>
      </Fade>
    </Box>
  );
});

const WorkspaceOverlayLayer = memo(function WorkspaceOverlayLayer({
  dbModalOpen,
  handleCloseDbModal,
  handleDbConnect,
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
}, (prev, next) => (
  prev.dbModalOpen === next.dbModalOpen &&
  prev.settingsOpen === next.settingsOpen &&
  prev.isDbConnected === next.isDbConnected &&
  prev.currentDatabase === next.currentDatabase &&
  prev.availableDatabases === next.availableDatabases
));

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
    handleRunQuery,
    handleOpenSqlEditor,
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
    snackbar,
    handleCloseSnackbar,
    snackbarAnchorOrigin,
    snackbarContentProps,
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

  return (
    <Box
      id="app-shell"
      sx={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'top', horizontal: sidebarOpen ? 'left' : 'right' }}
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
          <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>Settings</Typography>
        </MenuItem>
        {/* Separator */}
        <Box sx={{ height: '0.5px', backgroundColor: alpha(theme.palette.text.primary, 0.07), my: 0.75, mx: 0.5 }} />
        <MenuItem
          onClick={handleLogout}
          sx={{
            ...getPopoverMenuItemSx(theme),
          }}
        >
          <LogoutOutlinedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
          <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>Sign out</Typography>
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
      <Box
        ref={workspaceContainerRef}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          component="main"
          id="main-content"
          aria-label="Chat workspace"
          sx={{
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
          }}
        >
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
            handleOpenSqlEditor={handleOpenSqlEditor}
            handleOpenCanvasArtifact={handleOpenCanvasArtifact}
            guidedConfirmDialog={guidedConfirmDialog}
            handleGuidedCancel={handleGuidedCancel}
            handleGuidedConfirm={handleGuidedConfirm}
            theme={theme}
          />
        </Box>
        {!isNarrowLayout && (
          <Box
            component="section"
            data-ui-target="workspace_canvas"
            sx={{
              display: 'flex',
              flexShrink: 0,
              minHeight: 0,
              alignSelf: 'stretch',
              height: '100%',
            }}
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
            />
          </Box>
        )}
      </Box>
      {isNarrowLayout && (
        <Slide direction="up" in={workspaceCanvasOpen} mountOnEnter unmountOnExit>
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: UI_Z_INDEX.artifactFullscreen,
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.default',
            }}
          >
            <ArtifactLoader
              artifact={workspaceCanvasArtifact}
              onOpenArtifact={handleOpenCanvasArtifact}
              onClose={handleCloseWorkspaceCanvas}
              isDbConnected={isDbConnected}
              currentDatabase={currentDatabase}
              fullscreen
              workspaceContainerRef={workspaceContainerRef}
            />
          </Box>
        </Slide>
      )}
      <WorkspaceOverlayLayer
        dbModalOpen={dbModalOpen}
        handleCloseDbModal={handleCloseDbModal}
        handleDbConnect={handleDbConnect}
        isDbConnected={isDbConnected}
        currentDatabase={currentDatabase}
        availableDatabases={commonSidebarProps.availableDatabases}
        dbModalInitialType={dbModalInitialType}
        settingsOpen={settingsOpen}
        handleCloseSettings={handleCloseSettings}
        settingsInitialSection={settingsInitialSection}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={snackbarAnchorOrigin}
        message={snackbar.message}
        ContentProps={snackbarContentProps}
        sx={{
          maxWidth: 'min(420px, calc(100vw - 32px))',
          '& .MuiSnackbarContent-root': {
            width: '100%',
          },
        }}
      />
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
      <Dialog
        open={renameConversationDialog.open}
        onClose={handleRenameConversationDialogClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          component: 'form',
          onSubmit: (event) => {
            event.preventDefault();
            handleRenameConversationConfirm();
          },
          sx: {
            borderRadius: '12px',
          },
        }}
      >
        <DialogTitle sx={{ ...theme.typography.uiCardTitle, fontWeight: 700, pb: 1 }}>
          Rename conversation
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Conversation title"
            variant="outlined"
            value={renameConversationDialog.title}
            onChange={handleRenameConversationTitleChange}
            inputProps={{ maxLength: 80 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleRenameConversationDialogClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disableElevation
            disabled={!renameConversationDialog.title.trim()}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>
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
