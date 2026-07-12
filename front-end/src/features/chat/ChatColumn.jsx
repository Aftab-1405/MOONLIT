// ChatColumn — the center column of the application shell.
//
// Renders the chat workspace: welcome screen, message list, scroll container,
// composer, and the guided confirmation prompt (agent interrupts / step-limit
// banner). Receives all state as props — owns no business logic of its own.
//
// Layout note: the column's outer surface (background.default) is painted by
// AppShell. This component is transparent and inherits that surface. Only the
// guided confirmation prompt paints its own panel surface (it's an overlay,
// not part of the column body).

import { Box, Fade } from '@mui/material';
import { memo } from 'react';
import { ChatInput, MessageList, WelcomeScreen } from '@/features/chat';
import GuidedConfirmationPrompt from '@/features/chat/GuidedConfirmationPrompt';
import { getScrollbarStyles } from '@/styles/shared';

const ChatColumn = memo(function ChatColumn({
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
        zIndex: 1,
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

export default ChatColumn;
