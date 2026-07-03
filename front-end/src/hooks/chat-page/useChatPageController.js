import { useTheme as useMuiTheme } from '@mui/material/styles';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDatabaseConnection } from '@/contexts/DatabaseContext';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import { useLocalStorage } from '@/hooks';
import useAutoScroll from '@/hooks/chat-page/useAutoScroll';
import { useChatPageLlmSelection } from '@/hooks/chat-page/useChatPageLlmSelection';
import { useChatPageSessionLifecycle } from '@/hooks/chat-page/useChatPageSessionLifecycle';
import { useConversationDialogs } from '@/hooks/chat-page/useConversationDialogs';
import { useConversations } from '@/hooks/chat-page/useConversations';
import { useMessageStreaming } from '@/hooks/chat-page/useMessageStreaming';
import { useOverlayState } from '@/hooks/chat-page/useOverlayState';
import { useQueryExecution } from '@/hooks/chat-page/useQueryExecution';
import { useResponsive } from '@/hooks/chat-page/useResponsive';
import { useUiActionDispatcher } from '@/hooks/chat-page/useUiActionDispatcher';
import { useWorkspaceCanvas } from '@/hooks/chat-page/useWorkspaceCanvas';
import { UI_LAYOUT } from '@/styles/shared';
import { isMessageActive } from '@/utils/chatMessages';

const DRAWER_WIDTH = UI_LAYOUT.sidebarExpandedWidth;
const COLLAPSED_WIDTH = UI_LAYOUT.sidebarCollapsedWidth;

export function useChatPageController() {
  // ── Infrastructure ─────────────────────────────────────────────────────────
  const theme = useMuiTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const { isDesktop } = useResponsive();
  const isNarrowLayout = !isDesktop;
  const { settings, updateSetting, updateSettings } = useAppTheme();
  const { user, logout } = useAuth();
  const {
    isConnected: isDbConnected,
    currentDatabase,
    dbType,
    availableDatabases,
    availableSchemas,
    currentSchema,
    connect: connectDb,
    resetConnectionState,
    switchDatabase,
    selectSchema,
  } = useDatabaseConnection();

  // ── Conversations ──────────────────────────────────────────────────────────
  const {
    messages,
    setMessages,
    isConversationsLoading,
    isConversationLoading,
    conversations,
    setConversations,
    currentConversationId,
    setCurrentConversationId,
    routeConversationId,
    routeConversationLoadState,
    fetchConversations,
    registerStreamingConversation,
    handleDeleteConversation,
    handleRenameConversation,
    navigate,
  } = useConversations();

  // ── Overlay state (modals + snackbar) ─────────────────────────────────────
  const {
    dbModalOpen,
    setDbModalOpen,
    dbModalInitialType,
    setDbModalInitialType,
    settingsOpen,
    setSettingsOpen,
    settingsInitialSection,
    setSettingsInitialSection,
    notifications,
    showSnackbar,
    handleCloseDbModal,
    handleCloseSettings,
    handleCloseSnackbar,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    loading,
    setNotifications,
  } = useOverlayState();

  // ── Conversation dialogs (delete / rename) ─────────────────────────────────
  const {
    deleteConversationDialog,
    handleDeleteConversationRequest,
    handleDeleteConversationDialogClose,
    handleDeleteConversationConfirm,
    renameConversationDialog,
    handleRenameConversationRequest,
    handleRenameConversationDialogClose,
    handleRenameConversationTitleChange,
    handleRenameConversationConfirm,
  } = useConversationDialogs({
    handleDeleteConversation,
    handleRenameConversation,
    showSnackbar,
  });

  // ── Sidebar / canvas / LLM ─────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useLocalStorage('moonlit-sidebar-open', true);
  const currentSidebarWidth = useMemo(
    () => (sidebarOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH),
    [sidebarOpen],
  );
  const {
    workspaceCanvasOpen,
    workspaceCanvasArtifact,
    workspaceCanvasWidth,
    handleOpenCanvasArtifact,
    handleOpenSqlEditor: openSqlEditorCanvas,
    handleCloseWorkspaceCanvas,
    handleCanvasResize,
  } = useWorkspaceCanvas({ sidebarWidth: currentSidebarWidth });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [usageMetrics, setUsageMetrics] = useState(null);

  // ── Guided confirm dialog (agent interrupts / step limits) ─────────────────
  const [guidedConfirmDialog, setGuidedConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Not now',
    onCancel: null,
    onConfirm: null,
  });

  const resumeAgentRef = useRef(null);
  const continueTaskRef = useRef(null);
  const stepLimitEventRef = useRef(null);
  const messagesRef = useRef(messages);

  const llmSelection = useChatPageLlmSelection({ settings, updateSetting, updateSettings });
  const {
    providerOptions,
    selectedProvider,
    selectedModel,
    llmOptionsLoading,
    handleLlmSelection,
  } = llmSelection;

  // ── Derived / computed ─────────────────────────────────────────────────────
  const isCurrentlyStreaming = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.role === 'assistant' && isMessageActive(lastMessage);
  }, [messages]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOpenSqlEditor = useCallback(
    (query = '', results = null) => {
      if (!isDbConnected) {
        setSettingsOpen(false);
        setDbModalOpen(true);
        showSnackbar('Connect a database to use the SQL editor.', 'info');
        return;
      }
      openSqlEditorCanvas(query, results);
    },
    [isDbConnected, openSqlEditorCanvas, setDbModalOpen, setSettingsOpen, showSnackbar],
  );

  const handleQueryResults = useCallback(
    (data, sourceQuery) => {
      handleOpenCanvasArtifact({
        type: 'visualization',
        title: 'Query results',
        props: { data, sourceQuery, sourceType: 'chat-code-block' },
      });
    },
    [handleOpenCanvasArtifact],
  );

  const { confirmDialog, handleRunQuery, handleConfirmDialogClose } = useQueryExecution({
    isDbConnected,
    settings,
    setDbModalOpen,
    showSnackbar,
    onQueryResults: handleQueryResults,
  });

  const handleSidebarNewChat = useCallback(() => {
    setMobileOpen(false);
    setSettingsOpen(false);
    setDbModalOpen(false);
    navigate('/chat');
  }, [navigate, setDbModalOpen, setSettingsOpen]);

  const closeGuidedConfirmDialog = useCallback(() => {
    setGuidedConfirmDialog({
      open: false,
      title: '',
      message: '',
      confirmText: 'Confirm',
      cancelText: 'Not now',
      onCancel: null,
      onConfirm: null,
    });
  }, []);

  const handleGuidedCancel = useCallback(async () => {
    const action = guidedConfirmDialog.onCancel;
    closeGuidedConfirmDialog();
    await action?.();
  }, [closeGuidedConfirmDialog, guidedConfirmDialog.onCancel]);

  const handleGuidedConfirm = useCallback(async () => {
    const action = guidedConfirmDialog.onConfirm;
    closeGuidedConfirmDialog();
    await action?.();
  }, [closeGuidedConfirmDialog, guidedConfirmDialog.onConfirm]);

  const dispatchUiAction = useUiActionDispatcher({
    open_sql_editor: (payload) => handleOpenSqlEditor(payload?.query || ''),
    write_sql_editor_query: (payload) => {
      if (!payload?.query) return;
      handleOpenSqlEditor(payload.query);
    },
    open_database_modal: (payload) => {
      setSettingsOpen(false);
      setDbModalOpen(true);
      if (payload?.db_type) setDbModalInitialType(payload.db_type);
    },
    open_settings_modal: (payload) => {
      setDbModalOpen(false);
      setSettingsOpen(true);
      if (payload?.section) setSettingsInitialSection(payload.section);
    },
    navigate_new_chat: (payload) => {
      setGuidedConfirmDialog({
        open: true,
        title: payload?.title || 'Start a new chat?',
        message: payload?.message || 'This will leave the current conversation.',
        confirmText: payload?.confirmText || 'New Chat',
        cancelText: payload?.cancelText || 'Not now',
        onCancel: () => showSnackbar('Action cancelled.', 'info'),
        onConfirm: () => showSnackbar('Please wait for the agent to resume.', 'info'),
      });
    },
    complete_navigate_new_chat: (payload) => {
      window.setTimeout(() => {
        handleSidebarNewChat();
      }, Number(payload?.delayMs) || 900);
    },
    usage_metrics: (payload) => {
      if (payload) setUsageMetrics(payload);
    },
    onInvalidAction: ({ reason }) => {
      if (reason) showSnackbar(reason, 'warning');
    },
  });

  useEffect(() => {
    messagesRef.current = messages;

    let nextUsage = null;
    let foundUsage = false;

    if (messages && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const isAssistant = messages[i].role === 'assistant' || messages[i].sender === 'ai';
        if (isAssistant && messages[i].usage) {
          nextUsage = messages[i].usage;
          foundUsage = true;
          break;
        }
      }
    }

    const isLastUser =
      messages &&
      messages.length === 1 &&
      (messages[0].role === 'user' || messages[0].sender === 'user');

    if (foundUsage) {
      setTimeout(() => {
        setUsageMetrics(nextUsage);
      }, 0);
    } else if (!isLastUser || !messages || messages.length === 0) {
      setTimeout(() => {
        setUsageMetrics(null);
      }, 0);
    }
  }, [messages]);

  const handleAgentStepLimitReached = useCallback(
    (event, assistantMessageId = null) => {
      stepLimitEventRef.current = event;
      const stepsUsed = event?.steps_used ?? '?';
      const taskMode = event?.task_mode || 'normal';
      const message =
        event?.message ||
        `The agent paused after ${stepsUsed} steps to avoid runaway execution. The task context has been saved.`;

      setGuidedConfirmDialog({
        open: true,
        title: '⏸ Task Paused',
        message,
        confirmText: 'Continue Task',
        cancelText: 'Stop Here',
        onCancel: () => {
          stepLimitEventRef.current = null;
        },
        onConfirm: () => {
          const storedEvent = stepLimitEventRef.current;
          stepLimitEventRef.current = null;
          continueTaskRef.current?.(storedEvent, assistantMessageId, {
            provider: selectedProvider || null,
            model: selectedModel || null,
            taskMode,
          });
        },
      });
    },
    [selectedModel, selectedProvider],
  );

  const handleAgentInterrupt = useCallback(
    (event, assistantMessageId = null) => {
      const payload = event?.payload || {};
      const action = payload.action || payload.sourceTool;
      const resumeWith = (approved) => {
        const resumePayload = {
          approved,
          action,
          interrupt_id: event?.id || null,
        };
        resumeAgentRef.current?.(resumePayload, {
          provider: selectedProvider || null,
          model: selectedModel || null,
          assistantMessageId,
        });
      };

      if (action === 'execute_query' && payload.query) {
        handleOpenSqlEditor(payload.query);
      }

      setGuidedConfirmDialog({
        open: true,
        title: payload.title || 'Confirm action',
        message: payload.message || 'Please confirm before I continue.',
        confirmText: payload.confirmText || 'Confirm',
        cancelText: payload.cancelText || 'Not now',
        onCancel: () => resumeWith(false),
        onConfirm: () => resumeWith(true),
      });
    },
    [handleOpenSqlEditor, selectedModel, selectedProvider],
  );

  const { handleSendMessage, handleResumeAgent, handleStopStreaming, handleContinueTask } =
    useMessageStreaming({
      currentConversationId,
      setCurrentConversationId,
      setMessages,
      setConversations,
      navigate,
      fetchConversations,
      registerStreamingConversation,
      settings,
      dispatchUiAction,
      onAgentInterrupt: handleAgentInterrupt,
      onAgentStepLimitReached: handleAgentStepLimitReached,
      getMessages: () => messagesRef.current,
    });

  useEffect(() => {
    resumeAgentRef.current = handleResumeAgent;
    continueTaskRef.current = handleContinueTask;
  }, [handleResumeAgent, handleContinueTask]);

  useChatPageSessionLifecycle({
    isDbConnected,
    connectionPersistenceMinutes: settings.connectionPersistence ?? 0,
  });

  // ── Derived view state ─────────────────────────────────────────────────────
  const isRouteConversationHydrating = routeConversationLoadState === 'loading';
  const isConversationViewLoading = isConversationLoading || isRouteConversationHydrating;
  const showWelcomeState =
    !routeConversationId && messages.length === 0 && !isConversationViewLoading;
  const showConversationPanel =
    Boolean(routeConversationId) || messages.length > 0 || isConversationViewLoading;

  const streamActivityKey = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return 'empty';
    const textLen = (lastMessage.text || '').length;
    const stepsLen = (lastMessage.steps || []).length;
    return `${lastMessage.id}|${lastMessage.status}|${textLen}|${stepsLen}|${messages.length}`;
  }, [messages]);

  const handleSendMessageWithModel = useCallback(
    (message) => {
      return handleSendMessage(message, {
        provider: selectedProvider || null,
        model: selectedModel || null,
      });
    },
    [handleSendMessage, selectedProvider, selectedModel],
  );

  const { setScrollContainerRef } = useAutoScroll({
    messageCount: messages.length,
    isStreaming: isCurrentlyStreaming,
    isConversationLoading,
    activityKey: streamActivityKey,
  });

  const handleMobileDrawerOpen = useCallback(() => {
    setMobileOpen(true);
  }, []);
  const handleMobileDrawerClose = useCallback(() => {
    setMobileOpen(false);
  }, []);
  const effectiveMobileOpen = isDesktop ? false : mobileOpen;

  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, [setSidebarOpen]);

  const handleMenuOpen = useCallback((e) => {
    setAnchorEl(e.currentTarget);
  }, []);
  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleLogout = useCallback(async () => {
    setAnchorEl(null);
    await logout();
  }, [logout]);

  const handleOpenSettings = useCallback(() => {
    handleMenuClose();
    setDbModalOpen(false);
    setSettingsOpen(true);
  }, [handleMenuClose, setDbModalOpen, setSettingsOpen]);

  const handleDbConnect = useCallback(
    (data) => {
      if (data) {
        connectDb(data);
        showSnackbar('Connected to database!', 'success');
      } else {
        resetConnectionState();
        showSnackbar('Disconnected from database', 'info');
      }
    },
    [connectDb, resetConnectionState, showSnackbar],
  );

  const handleDatabaseSwitch = useCallback(
    async (dbName) => {
      const result = await switchDatabase(dbName);
      if (result.success) {
        showSnackbar(`Switched to ${dbName}`, 'success');
      } else {
        showSnackbar(result.error || 'Failed to switch', 'error');
      }
    },
    [switchDatabase, showSnackbar],
  );

  const handleDbModalSelectDatabase = useCallback(
    async (dbName) => {
      const result = await switchDatabase(dbName);
      if (result.success) {
        showSnackbar(`Switched to ${dbName}`, 'success');
        return { success: true };
      } else {
        const errorMsg = result.error || 'Failed to switch database';
        showSnackbar(errorMsg, 'error');
        return { success: false, error: errorMsg };
      }
    },
    [switchDatabase, showSnackbar],
  );

  const chatInputSharedProps = useMemo(
    () => ({
      onSend: handleSendMessageWithModel,
      onStop: handleStopStreaming,
      isStreaming: isCurrentlyStreaming,
      isConnected: isDbConnected,
      dbType,
      currentDatabase,
      availableDatabases,
      availableSchemas,
      currentSchema,
      onSchemaChange: selectSchema,
      onDatabaseSwitch: handleDatabaseSwitch,
      onOpenSqlEditor: handleOpenSqlEditor,
      selectedProvider,
      selectedModel,
      providerOptions,
      llmOptionsLoading,
      onSelectLlm: handleLlmSelection,
      usageMetrics,
    }),
    [
      handleSendMessageWithModel,
      handleStopStreaming,
      isCurrentlyStreaming,
      isDbConnected,
      dbType,
      currentDatabase,
      availableDatabases,
      availableSchemas,
      currentSchema,
      selectSchema,
      handleDatabaseSwitch,
      handleOpenSqlEditor,
      selectedProvider,
      selectedModel,
      providerOptions,
      llmOptionsLoading,
      handleLlmSelection,
      usageMetrics,
    ],
  );

  const commonSidebarProps = useMemo(
    () => ({
      conversations,
      isConversationsLoading,
      currentConversationId,
      onDeleteConversation: handleDeleteConversationRequest,
      onRenameConversation: handleRenameConversationRequest,
      isConnected: isDbConnected,
      currentDatabase,
      dbType,
      availableDatabases,
      onDatabaseSwitch: handleDatabaseSwitch,
      user,
    }),
    [
      conversations,
      isConversationsLoading,
      currentConversationId,
      handleDeleteConversationRequest,
      handleRenameConversationRequest,
      isDbConnected,
      currentDatabase,
      dbType,
      availableDatabases,
      handleDatabaseSwitch,
      user,
    ],
  );

  const handleSidebarSelectConversation = useCallback(
    (id) => {
      setMobileOpen(false);
      setSettingsOpen(false);
      setDbModalOpen(false);
      navigate(`/chat/${id}`);
    },
    [navigate, setDbModalOpen, setSettingsOpen],
  );

  const handleSidebarOpenDbModal = useCallback(() => {
    setMobileOpen(false);
    setSettingsOpen(false);
    setDbModalOpen(true);
  }, [setDbModalOpen, setSettingsOpen]);

  const handleSidebarMenuOpen = useCallback(
    (e) => {
      setMobileOpen(false);
      handleMenuOpen(e);
    },
    [handleMenuOpen],
  );

  // ── Return ─────────────────────────────────────────────────────────────────
  return {
    theme,
    isDarkMode,
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
    mobileOpen: effectiveMobileOpen,
    handleMobileDrawerOpen,
    handleMobileDrawerClose,
    showWelcomeState,
    setScrollContainerRef,
    showConversationPanel,
    messages,
    isConversationLoading: isConversationViewLoading,
    conversationLoadState: routeConversationLoadState,
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
    handleDbModalSelectDatabase,
    notifications,
    showSnackbar,
    handleCloseSnackbar,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
    loading,
    setNotifications,
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
    closeGuidedConfirmDialog,
    handleGuidedCancel,
    handleGuidedConfirm,
    dbModalInitialType,
    settingsInitialSection,
  };
}
