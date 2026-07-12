// MainInterface — logged-in application shell root.
//
// Acts as the orchestrator for the three-column chat experience. Owns no
// feature-specific business logic — that lives in `useChatPageController` and
// the feature modules. MainInterface's job is to:
//
//   1. Wire the controller.
//   2. Pass feature content into AppShell as slots.
//   3. Mount global overlays (modals, toasts, dialogs) once at the shell.
//
// Layout, theme surfaces, and column-width animations are owned by AppShell.
// Feature content (Sidebar, ChatColumn, ArtifactLoader) is rendered into the
// appropriate column slots.

import { Box } from '@mui/material';
import { lazy, memo, Suspense, useState } from 'react';
import { ResizeHandle } from '@/components';
import ChatColumn from '@/features/chat/ChatColumn';
import AppShell from '@/features/shell/AppShell';
import GlobalOverlays from '@/features/shell/GlobalOverlays';
import MobileSidebarOpenButton from '@/features/shell/MobileSidebarOpenButton';
import UserProfileMenu from '@/features/shell/UserProfileMenu';
import ArtifactLoader from '@/features/sidebar-right/index';
import { useChatPageController } from '@/hooks/chat-page/useChatPageController';

// Module-scope lazy import.
// CRITICAL: `lazy()` MUST be called at module scope, NOT inside the component
// body. Calling it inside the component body creates a NEW lazy component type
// on every render, which causes React to unmount and remount the entire
// Sidebar subtree on every parent re-render. This was the root cause of:
//   - Bug #1: Sidebar re-rendering on unrelated UI interactions
//   - Bug #3: Profile dialog appearing at top-left (anchor element was
//     detached from the DOM by the remount before MUI Menu could position)
//   - Bug #2/#4: State propagation issues during navigation
const Sidebar = lazy(() => import('@/features/sidebar-left'));

function MainInterface() {
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
    handleOpenMindmap,
    mindmapOpen,
    handleCloseMindmap,
    schemaLoading,
    schemaData,
  } = useChatPageController();

  const [isResizingCanvas, setIsResizingCanvas] = useState(false);

  // The mobile sidebar open button lives on the chat column's surface (top-left
  // corner). We render it via a slot prop instead of mounting it inside
  // ChatColumn so that the chat feature doesn't need to know about shell
  // affordances.
  const chatSlot = (
    <>
      <MobileSidebarOpenButton
        visible={isNarrowLayout}
        theme={theme}
        onOpen={handleMobileDrawerOpen}
      />
      <ChatColumn
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
    </>
  );

  // The workspace slot needs a ResizeHandle on desktop (between chat and
  // artifact panel). On narrow viewports the handle is irrelevant (the panel
  // is full-screen) — but AppShell only renders the desktop layout when
  // !isNarrowLayout, so we always include it; it just doesn't show.
  const workspaceSlot = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <ResizeHandle
        onResize={handleCanvasResize}
        onResizeStart={() => setIsResizingCanvas(true)}
        onResizeEnd={() => setIsResizingCanvas(false)}
        disabled={!workspaceCanvasOpen}
      />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <ArtifactLoader
          artifact={workspaceCanvasArtifact}
          onOpenArtifact={handleOpenCanvasArtifact}
          onClose={handleCloseWorkspaceCanvas}
          isDbConnected={isDbConnected}
          currentDatabase={currentDatabase}
          isOpen={workspaceCanvasOpen}
          panelWidth={workspaceCanvasWidth}
          isResizing={isResizingCanvas}
          onNotify={undefined}
        />
      </Box>
    </Box>
  );

  // Note: workspaceContainerRef was used by the SQL editor to position its
  // autocomplete popovers relative to the workspace container. The ref used
  // to live on a Box that wrapped both the chat column and the artifact panel.
  // With AppShell owning that container, the SQL editor should compute its
  // position relative to its own root instead. ArtifactLoader accepts the ref
  // as an optional prop; we don't pass it here. If the SQL editor breaks, we
  // can reintroduce a workspace container ref via a forwardRef on AppShell.

  return (
    <Box id="app-shell" sx={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}>
      <UserProfileMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onOpenSettings={handleOpenSettings}
        onLogout={handleLogout}
        userEmail={user?.email}
        sidebarOpen={sidebarOpen}
        theme={theme}
      />

      <AppShell
        isNarrowLayout={isNarrowLayout}
        sidebarOpen={sidebarOpen}
        canvasOpen={workspaceCanvasOpen}
        canvasWidth={workspaceCanvasWidth}
        isResizingCanvas={isResizingCanvas}
        sidebarSlot={
          <Suspense fallback={null}>
            <Sidebar
              {...commonSidebarProps}
              onNewChat={handleSidebarNewChat}
              onSelectConversation={handleSidebarSelectConversation}
              onOpenDbModal={handleSidebarOpenDbModal}
              onOpenMindmap={handleOpenMindmap}
              open={sidebarOpen}
              onToggleOpen={handleSidebarToggle}
              onMenuOpen={handleSidebarMenuOpen}
              mobileOpen={mobileOpen}
              onMobileClose={handleMobileDrawerClose}
            />
          </Suspense>
        }
        chatSlot={chatSlot}
        workspaceSlot={workspaceSlot}
      />

      <GlobalOverlays
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
        notifications={notifications}
        removeToast={removeToast}
        isNarrowLayout={isNarrowLayout}
        confirmDialog={confirmDialog}
        handleConfirmDialogClose={handleConfirmDialogClose}
        deleteConversationDialog={deleteConversationDialog}
        handleDeleteConversationDialogClose={handleDeleteConversationDialogClose}
        handleDeleteConversationConfirm={handleDeleteConversationConfirm}
        renameConversationDialog={renameConversationDialog}
        handleRenameConversationDialogClose={handleRenameConversationDialogClose}
        handleRenameConversationTitleChange={handleRenameConversationTitleChange}
        handleRenameConversationConfirm={handleRenameConversationConfirm}
        mindmapOpen={mindmapOpen}
        handleCloseMindmap={handleCloseMindmap}
        schemaLoading={schemaLoading}
        schemaData={schemaData}
        theme={theme}
      />
    </Box>
  );
}

export default memo(MainInterface);
