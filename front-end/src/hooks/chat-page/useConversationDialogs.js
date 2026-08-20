/**
 * useConversationDialogs
 *
 * Manages the delete-conversation dialog flow. Renaming is edited directly in
 * the conversation row and therefore does not need global overlay state.
 *
 * Extracted from useChatPageController to give each dialog its own
 * clear responsibility boundary.
 */

import { useCallback, useState } from 'react';

/**
 * @param {Object} params
 * @param {Function} params.handleDeleteConversation - async fn(conversationId)
 * @param {Function} params.showSnackbar             - fn(message, severity)
 */
export function useConversationDialogs({ handleDeleteConversation, showSnackbar }) {
  // ── Delete dialog ────────────────────────────────────────────────────────────

  const [deleteConversationDialog, setDeleteConversationDialog] = useState({
    open: false,
    conversationId: null,
  });

  const handleDeleteConversationRequest = useCallback((conversationId) => {
    setDeleteConversationDialog({ open: true, conversationId });
  }, []);

  const handleDeleteConversationDialogClose = useCallback(() => {
    setDeleteConversationDialog({ open: false, conversationId: null });
  }, []);

  const handleDeleteConversationConfirm = useCallback(async () => {
    if (!deleteConversationDialog.conversationId) return;
    try {
      await handleDeleteConversation(deleteConversationDialog.conversationId);
    } catch (error) {
      showSnackbar(error?.message || 'Failed to delete conversation', 'error');
      throw error;
    }
  }, [deleteConversationDialog.conversationId, handleDeleteConversation, showSnackbar]);

  return {
    deleteConversationDialog,
    handleDeleteConversationRequest,
    handleDeleteConversationDialogClose,
    handleDeleteConversationConfirm,
  };
}
