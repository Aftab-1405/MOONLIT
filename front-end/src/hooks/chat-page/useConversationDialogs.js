/**
 * useConversationDialogs
 *
 * Manages the delete-conversation and rename-conversation dialog flows.
 * Receives the underlying data operations (handleDeleteConversation,
 * handleRenameConversation) and a notification helper (showSnackbar) as
 * parameters so it stays decoupled from any specific context.
 *
 * Extracted from useChatPageController to give each dialog its own
 * clear responsibility boundary.
 */

import { useCallback, useState } from 'react';

/**
 * @param {Object} params
 * @param {Function} params.handleDeleteConversation - async fn(conversationId)
 * @param {Function} params.handleRenameConversation - async fn(conversationId, title)
 * @param {Function} params.showSnackbar             - fn(message, severity)
 */
export function useConversationDialogs({
  handleDeleteConversation,
  handleRenameConversation,
  showSnackbar,
}) {
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

  // ── Rename dialog ────────────────────────────────────────────────────────────

  const [renameConversationDialog, setRenameConversationDialog] = useState({
    open: false,
    conversationId: null,
    title: '',
  });

  const handleRenameConversationRequest = useCallback((conversationId, title) => {
    setRenameConversationDialog({
      open: true,
      conversationId,
      title: title || '',
    });
  }, []);

  const handleRenameConversationDialogClose = useCallback(() => {
    setRenameConversationDialog({ open: false, conversationId: null, title: '' });
  }, []);

  const handleRenameConversationTitleChange = useCallback((event) => {
    setRenameConversationDialog((prev) => ({
      ...prev,
      title: event.target.value,
    }));
  }, []);

  const handleRenameConversationConfirm = useCallback(async () => {
    const title = renameConversationDialog.title.trim();
    if (!renameConversationDialog.conversationId || !title) return;
    await handleRenameConversation(renameConversationDialog.conversationId, title);
    handleRenameConversationDialogClose();
  }, [
    handleRenameConversation,
    handleRenameConversationDialogClose,
    renameConversationDialog.conversationId,
    renameConversationDialog.title,
  ]);

  return {
    // Delete
    deleteConversationDialog,
    handleDeleteConversationRequest,
    handleDeleteConversationDialogClose,
    handleDeleteConversationConfirm,
    // Rename
    renameConversationDialog,
    handleRenameConversationRequest,
    handleRenameConversationDialogClose,
    handleRenameConversationTitleChange,
    handleRenameConversationConfirm,
  };
}
