// Main Interface - Logged-in application shell

import { lazy, memo, Suspense, useMemo, useRef, useState } from "react";
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  Snackbar,
  Button,
  Slide,
  Fade,
  Collapse,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import Sidebar from "@/features/sidebar-left";
import { ChatInput, MessageList, WelcomeScreen } from "@/features/chat";
import ArtifactLoader from "@/features/sidebar-right/index";
import { ConfirmDialog, ResizeHandle } from "@/components";
import {
  getInteractionColors,
  getInteractiveControlSx,
  getInteractiveIconButtonSx,
  getPopoverMenuItemSx,
  getPopoverMenuListSx,
  getPopoverPaperSx,
  getScrollbarStyles,
  UI_LAYOUT,
  UI_Z_INDEX,
} from "@/styles/shared";
import { useChatPageController } from "@/hooks/chat-page/useChatPageController";
import {
  getAppPanelSurfaceSx,
  getAppSunkenSurfaceSx,
  getShellWorkspaceSx,
} from "@/features/styles/interfaceChrome";

const DatabaseModal = lazy(
  () => import("@/features/overlays/database/DatabaseModal"),
);
const SettingsModal = lazy(
  () => import("@/features/overlays/settings/SettingsModal"),
);

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
  const isDark = theme.palette.mode === "dark";

  return (
    <Collapse in={open} timeout={250}>
      <Fade in={open} timeout={250}>
        <Box
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={{
            width: "100%",
            maxWidth: UI_LAYOUT.chatInputMaxWidth,
            mx: "auto",
            position: "relative",
            zIndex: 1,
          }}
        >
          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              mx: { xs: 1, sm: 0 },
              mb: -3.5, // Slide behind composer
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "flex-start", sm: "center" },
              justifyContent: "space-between",
              gap: { xs: 1.5, sm: 2 },
              borderTopLeftRadius: "20px",
              borderTopRightRadius: "20px",
              border: "1px solid",
              borderColor: alpha(
                theme.palette.text.primary,
                isDark ? 0.12 : 0.08,
              ),
              borderBottom: 0,
              ...getAppPanelSurfaceSx(theme),
              px: { xs: 2.25, sm: 3 },
              pb: { xs: 5.5, sm: 5 }, // padding overlap
              pt: 1.5,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  ...theme.typography.uiBodySm,
                  color: "text.primary",
                  fontWeight: 700,
                  lineHeight: 1.35,
                }}
              >
                {title || "Confirm action"}
              </Typography>
              {message && (
                <Typography
                  sx={{
                    mt: 0.25,
                    ...theme.typography.uiCaptionMd,
                    color: "text.secondary",
                    lineHeight: 1.45,
                    overflowWrap: "anywhere",
                  }}
                >
                  {message}
                </Typography>
              )}
            </Box>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexShrink: 0,
                alignSelf: { xs: "flex-end", sm: "center" },
              }}
            >
              <Button
                size="small"
                onClick={onCancel}
                sx={{
                  minHeight: 28,
                  borderRadius: "6px",
                  textTransform: "none",
                  color: "text.secondary",
                  px: 1.5,
                  ...theme.typography.uiCaptionMd,
                  fontWeight: 500,
                  "&:hover": {
                    bgcolor: alpha(theme.palette.text.primary, 0.06),
                  },
                  "&.Mui-focusVisible": {
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.text.primary, isDark ? 0.18 : 0.12)}`,
                    outline: "none",
                  },
                }}
              >
                {cancelText || "Not now"}
              </Button>
              <Button
                size="small"
                onClick={onConfirm}
                sx={{
                  minHeight: 28,
                  borderRadius: "6px",
                  textTransform: "none",
                  color: theme.palette.primary.main,
                  px: 1.5,
                  ...theme.typography.uiCaptionMd,
                  fontWeight: 700,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  "&:hover": {
                    textDecoration: "underline",
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                  "&.Mui-focusVisible": {
                    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, isDark ? 0.28 : 0.2)}`,
                    outline: "none",
                  },
                }}
              >
                {confirmText || "Confirm"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Fade>
    </Collapse>
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
          position: "absolute",
          top: "max(env(safe-area-inset-top), 12px)",
          left: 12,
          zIndex: UI_Z_INDEX.mainContentControl,
          ...getInteractiveIconButtonSx(theme, { size: 44, radius: "8px" }),
          width: 44,
          height: 44,
          ...getAppPanelSurfaceSx(theme),
          boxShadow: "none",
          opacity: 0.82,
          transition: "opacity 0.15s ease",
          "&:hover": {
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
        position: "relative",
        zIndex: UI_Z_INDEX.mainContentBase,
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        contain: "layout paint style",
      }}
    >
      <WelcomeScreen
        visible={showWelcomeState}
        user={user}
        chatInputProps={chatInputSharedProps}
      />

      <Fade in={showConversationPanel} timeout={300} unmountOnExit>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          <Box
            ref={setScrollContainerRef}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              px: { xs: 0, sm: 1 },
              pt: { xs: 2, sm: 3 },
              pb: { xs: 1, sm: 2 },
              ...getScrollbarStyles(theme),
            }}
          >
            <MessageList
              messages={messages}
              isLoadingConversation={isConversationLoading}
              loadError={conversationLoadState === "error"}
              conversationId={currentConversationId}
              onRunQuery={handleRunQuery}
              onOpenCanvasArtifact={handleOpenCanvasArtifact}
            />
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              zIndex: 2,
              px: { xs: 0, sm: 1 },
              pt: { xs: 1, sm: 1.5 },
              pb: "max(env(safe-area-inset-bottom), 8px)",
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

const WorkspaceOverlayLayer = memo(
  function WorkspaceOverlayLayer({
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
  const isDark = theme.palette.mode === "dark";
  const appShellSx = useMemo(
    () => ({
      display: "flex",
      flexDirection: "row",
      width: "100%",
      minWidth: 0,
      minHeight: 0,
      overflow: "hidden",
      bgcolor: "background.default",
    }),
    [],
  );
  const workspaceContainerSx = useMemo(
    () => ({
      flex: 1,
      minWidth: 0,
      minHeight: 0,
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      overflow: "hidden",
      position: "relative",
    }),
    [],
  );
  const mainContentSx = useMemo(
    () => ({
      flex: 1,
      display: "flex",
      flexDirection: "column",
      mt: 0,
      minWidth: 0,
      minHeight: 0,
      overflow: "hidden",
      position: "relative",
      zIndex: UI_Z_INDEX.mainContentBase,
      ...getShellWorkspaceSx(theme),
    }),
    [theme],
  );
  const desktopCanvasShellSx = useMemo(
    () => ({
      display: "flex",
      flexShrink: 0,
      minHeight: 0,
      alignSelf: "stretch",
      height: "100%",
    }),
    [],
  );
  const mobileCanvasShellSx = useMemo(
    () => (theme) => ({
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: UI_Z_INDEX.artifactFullscreen,
      display: "flex",
      flexDirection: "column",
      ...getAppSunkenSurfaceSx(theme),
    }),
    [],
  );
  const snackbarSx = useMemo(
    () => ({
      maxWidth: "min(420px, calc(100vw - 32px))",
      "& .MuiSnackbarContent-root": {
        width: "100%",
        borderRadius: "8px",
        boxShadow: "none",
      },
      "@media (max-width: 599.95px)": {
        "&.MuiSnackbar-anchorOriginTopCenter": {
          top: "max(8px, env(safe-area-inset-top)) !important",
        },
      },
    }),
    [],
  );
  const renameDialogPaperSx = useMemo(
    () => ({
      borderRadius: "14px",
      border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.12 : 0.08)}`,
      ...getAppPanelSurfaceSx(theme),
      boxShadow: "none",
    }),
    [isDark, theme],
  );
  const renameFieldSx = useMemo(
    () => ({
      "& .MuiOutlinedInput-root": {
        borderRadius: "8px",
        ...theme.typography.uiInput,
      },
      "& .MuiInputLabel-root": {
        ...theme.typography.uiCaptionMd,
      },
    }),
    [theme],
  );
  const renameActionsSx = useMemo(
    () => ({
      px: 3,
      pb: 2.5,
      pt: 1,
      gap: 1,
      "& .MuiButton-root": {
        minHeight: 34,
        borderRadius: "8px",
        px: 1.5,
        textTransform: "none",
        ...theme.typography.uiNavItem,
      },
    }),
    [theme],
  );
  const renameCancelButtonSx = useMemo(
    () => getInteractiveControlSx(theme, { size: 34, radius: "8px" }),
    [theme],
  );

  return (
    <Box id="app-shell" sx={appShellSx}>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: sidebarOpen ? "left" : "right",
        }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        MenuListProps={{ sx: getPopoverMenuListSx() }}
        PaperProps={{
          sx: {
            ...getPopoverPaperSx(theme, theme.palette.mode === "dark"),
            width: 240,
            p: 0,
            overflow: "hidden",
          },
        }}
      >
        {/* Email header */}
        <Box sx={{ px: 1, pt: 0.5, pb: 1 }}>
          <Typography
            sx={{
              ...theme.typography.uiCaptionXs,
              color: "text.secondary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
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
          <SettingsOutlinedIcon
            sx={{ color: "text.secondary", flexShrink: 0 }}
          />
          <Typography
            sx={{ ...theme.typography.uiNavItem, color: "text.primary" }}
          >
            Settings
          </Typography>
        </MenuItem>
        {/* Separator */}
        <Box
          sx={{
            height: "0.5px",
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
          <LogoutOutlinedIcon sx={{ color: "text.secondary", flexShrink: 0 }} />
          <Typography
            sx={{ ...theme.typography.uiNavItem, color: "text.primary" }}
          >
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
        <Box
          component="main"
          id="main-content"
          aria-label="Chat workspace"
          sx={mainContentSx}
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
            />
          </Box>
        )}
      </Box>
      {isNarrowLayout && (
        <Slide
          direction="up"
          in={workspaceCanvasOpen}
          mountOnEnter
          unmountOnExit
        >
          <Box sx={mobileCanvasShellSx}>
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
        sx={snackbarSx}
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
          component: "form",
          onSubmit: (event) => {
            event.preventDefault();
            handleRenameConversationConfirm();
          },
          sx: {
            ...renameDialogPaperSx,
          },
        }}
      >
        <DialogTitle
          sx={{
            ...theme.typography.uiCardTitle,
            fontWeight: 700,
            px: 3,
            pt: 2.5,
            pb: 1,
          }}
        >
          Rename conversation
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Conversation title"
            variant="outlined"
            value={renameConversationDialog.title}
            onChange={handleRenameConversationTitleChange}
            inputProps={{ maxLength: 80 }}
            sx={renameFieldSx}
          />
        </DialogContent>
        <DialogActions sx={renameActionsSx}>
          <Button
            onClick={handleRenameConversationDialogClose}
            color="inherit"
            sx={renameCancelButtonSx}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disableElevation
            disabled={!renameConversationDialog.title.trim()}
            sx={{
              boxShadow: "none",
              "&:hover": { boxShadow: "none" },
            }}
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
