// Main Interface - Logged-in application shell

import { useRef } from 'react';
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
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import Sidebar from './sidebar-left';
import { ChatInput, MessageList, WelcomeScreen } from './main';
import { DatabaseModal } from './main/overlays/database';
import { SettingsModal } from './main/overlays/settings';
import ArtifactLoader from './sidebar-right/index.js';
import { ConfirmDialog, ResizeHandle, StarfieldCanvas } from '../components';
import { getPopoverPaperSx } from '../styles/shared';
import { useChatPageController } from '../hooks/chat-page/useChatPageController';
import {
  getScrollbarStyles,
  UI_LAYOUT,
  UI_Z_INDEX,
} from '../styles/shared';

function GuidedConfirmationPrompt({
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
}

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
    guidedConfirmDialog,
    handleGuidedCancel,
    handleGuidedConfirm,
    dbModalInitialType,
    settingsInitialSection,
    starfieldActive,
    idleAnimationIntensity,
  } = useChatPageController();

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
        MenuListProps={{ sx: { py: 0 } }}
        PaperProps={{
          sx: {
            ...getPopoverPaperSx(theme, theme.palette.mode === 'dark'),
            width: 240,
            p: 0.75,
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
            borderRadius: '8px',
            px: 1,
            py: 0.875,
            minHeight: 32,
            gap: 1,
            '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.05) },
            '&.Mui-focusVisible': { backgroundColor: alpha(theme.palette.text.primary, 0.05) },
          }}
        >
          <SettingsOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
          <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>Settings</Typography>
        </MenuItem>
        {/* Separator */}
        <Box sx={{ height: '0.5px', backgroundColor: alpha(theme.palette.text.primary, 0.07), my: 0.75, mx: 0.5 }} />
        <MenuItem
          onClick={handleLogout}
          sx={{
            borderRadius: '8px',
            px: 1,
            py: 0.875,
            minHeight: 32,
            gap: 1,
            '&:hover': { backgroundColor: alpha(theme.palette.text.primary, 0.05) },
            '&.Mui-focusVisible': { backgroundColor: alpha(theme.palette.text.primary, 0.05) },
          }}
        >
          <LogoutOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
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
            backgroundColor: theme.palette.background.default,
            position: 'relative',
            zIndex: UI_Z_INDEX.mainContentBase,
          }}
        >
          <StarfieldCanvas active={starfieldActive} intensity={idleAnimationIntensity} />

          {isNarrowLayout && (
            <IconButton
              size="small"
              onClick={handleMobileDrawerOpen}
              aria-label="Open sidebar"
              sx={{
                position: 'absolute',
                top: 'max(env(safe-area-inset-top), 12px)',
                left: 12,
                zIndex: UI_Z_INDEX.mainContentControl,
                width: 44,
                height: 44,
                border: '1px solid',
                borderColor: alpha(theme.palette.text.primary, 0.1),
                backgroundColor: alpha(theme.palette.background.paper, 0.96),
                boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.18 : 0.08)}`,
                opacity: 0.82,
                transition: 'opacity 0.15s ease',
                '&:hover': { opacity: 1, backgroundColor: alpha(theme.palette.background.paper, 0.96) },
              }}
            >
              <MenuRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          )}

          <Box
            sx={{
              position: 'relative',
              zIndex: UI_Z_INDEX.mainContentBase,
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <WelcomeScreen
              visible={showWelcomeState}
              user={user}
              chatInputProps={chatInputSharedProps}
              starfieldFocus={showWelcomeState && starfieldActive}
            />

            <Fade in={showConversationPanel} timeout={300} unmountOnExit>
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                    showSuggestions={false}
                  />
                </Box>
              </Box>
            </Fade>
          </Box>
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
            <ResizeHandle onResize={handleCanvasResize} disabled={!workspaceCanvasOpen} />
            <ArtifactLoader
              artifact={workspaceCanvasArtifact}
              onOpenArtifact={handleOpenCanvasArtifact}
              onClose={handleCloseWorkspaceCanvas}
              isDbConnected={isDbConnected}
              currentDatabase={currentDatabase}
              isOpen={workspaceCanvasOpen}
              panelWidth={workspaceCanvasWidth}
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
      <DatabaseModal
        open={dbModalOpen}
        onClose={handleCloseDbModal}
        onConnect={handleDbConnect}
        isConnected={isDbConnected}
        currentDatabase={currentDatabase}
        initialDbType={dbModalInitialType}
        sidebarOpen={sidebarOpen}
        isNarrowLayout={isNarrowLayout}
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
      <SettingsModal
        open={settingsOpen}
        onClose={handleCloseSettings}
        initialSection={settingsInitialSection}
        sidebarOpen={sidebarOpen}
        isNarrowLayout={isNarrowLayout}
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

export default MainInterface;
