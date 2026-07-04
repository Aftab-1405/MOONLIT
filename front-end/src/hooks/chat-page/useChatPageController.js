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
    workspaceCanvasArtifact: rawWorkspaceCanvasArtifact,
    workspaceCanvasWidth,
    handleOpenCanvasArtifact,
    handleOpenSqlEditor: openSqlEditorCanvas,
    handleCloseWorkspaceCanvas,
    handleCanvasResize,
  } = useWorkspaceCanvas({ sidebarWidth: currentSidebarWidth });

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [usageMetrics, setUsageMetrics] = useState(null);
  // ENH [AUTO-TASK-MODE]: The effective task mode reported by the backend
  // for the current/last turn. Reset to null when the conversation changes
  // or streaming stops so the badge doesn't persist across turns.
  const [effectiveTaskMode, setEffectiveTaskMode] = useState(null);

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

  // ── Detect agent streaming into the SQL editor ───────────────────────────
  // When the agent calls `write_sql_editor_query`, the tool step is in
  // `running` state. We detect this and inject `isStreaming: true` into the
  // artifact props so SqlEditorSurface switches to streaming mode.
  const isSqlEditorStreaming = useMemo(() => {
    if (!isCurrentlyStreaming) return false;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.steps) return false;
    return lastMessage.steps.some(
      (step) =>
        step.type === 'tool' &&
        step.name === 'write_sql_editor_query' &&
        step.status === 'running',
    );
  }, [isCurrentlyStreaming, messages]);

  // Inject isStreaming into the artifact props when the SQL editor is open
  // and the agent is actively writing a query.
  const workspaceCanvasArtifact = useMemo(() => {
    if (!rawWorkspaceCanvasArtifact) return null;
    if (rawWorkspaceCanvasArtifact.type !== 'sql-editor') return rawWorkspaceCanvasArtifact;
    return {
      ...rawWorkspaceCanvasArtifact,
      props: {
        ...rawWorkspaceCanvasArtifact.props,
        isStreaming: isSqlEditorStreaming,
      },
    };
  }, [rawWorkspaceCanvasArtifact, isSqlEditorStreaming]);

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

  // ── Open SQL editor early when agent starts writing a query ──────────────
  // When `write_sql_editor_query` enters `running` state, open the editor
  // immediately (with empty query) so the user sees the "Agent is writing…"
  // indicator while the agent composes the query. The actual query arrives
  // when the `ui_action` event fires (via the handler below).
  useEffect(() => {
    if (!isSqlEditorStreaming) return;
    // Only open if the SQL editor isn't already open
    if (rawWorkspaceCanvasArtifact?.type === 'sql-editor') return;
    if (!isDbConnected) return;
    openSqlEditorCanvas('', null);
  }, [isSqlEditorStreaming, rawWorkspaceCanvasArtifact, isDbConnected, openSqlEditorCanvas]);

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

  // Restore usageMetrics from message history when NOT streaming.
  //
  // FIX [CTX-SYNC]: Previously this effect ran on EVERY `messages` change
  // (every token batch during streaming) and used `setTimeout(() => ..., 0)`
  // to defer `setUsageMetrics`. Those deferred updates could fire AFTER the
  // live SSE `usage_metrics` event handler's synchronous `setUsageMetrics`,
  // clobbering the live value with `null` or stale data from a previous turn.
  // This caused the context-window indicator to flicker and fall out of sync.
  //
  // Fix: (1) Skip entirely while streaming — the live SSE path is the sole
  // source of truth during active streaming. (2) Remove the `setTimeout`
  // wrappers — React batches synchronous state updates, so the deferral
  // was unnecessary AND was the root cause of the clobbering race.
  // (3) Add `isCurrentlyStreaming` to the dependency array.
  useEffect(() => {
    messagesRef.current = messages;

    if (isCurrentlyStreaming) return;

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
      setUsageMetrics(nextUsage);
    } else if (!isLastUser || !messages || messages.length === 0) {
      setUsageMetrics(null);
    }
  }, [messages, isCurrentlyStreaming]);

  const handleAgentStepLimitReached = useCallback(
    (event, assistantMessageId = null) => {
      stepLimitEventRef.current = event;
      const stepsUsed = event?.steps_used ?? '?';
      const taskMode = event?.task_mode || 'normal';

      // ENH [TASK-PAUSED-BANNER]: The compact banner shows a one-line summary
      // ("Step limit reached · 5 steps used") instead of the old full
      // sentence. The stepsUsed count is passed through so the banner can
      // display it. We keep the full message in the state for accessibility
      // (screen readers) but the visual banner uses the compact form.
      setGuidedConfirmDialog({
        open: true,
        title: '⏸ Task Paused',
        message: `Step limit reached · ${stepsUsed} steps used`,
        stepsUsed,
        confirmText: 'Continue Task',
        cancelText: 'Stop',
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

  /**
   * ENH [AUTO-TASK-MODE]: Called when the backend emits a `task_mode` SSE
   * event at the start of each turn. The event reports the EFFECTIVE mode
   * (which may have been auto-elevated from normal → tool_task / long_task
   * based on the prompt). We store it so the ChatInput can display a badge
   * ("Long Task · 200 steps") while the agent is running.
   */
  const handleTaskModeResolved = useCallback((event) => {
    setEffectiveTaskMode({
      task_mode: event?.task_mode || 'normal',
      label: event?.label || event?.task_mode || 'Standard',
      recursion_limit: event?.recursion_limit ?? null,
      source: event?.source || 'user',
    });
  }, []);

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
      onTaskModeResolved: handleTaskModeResolved,
      getMessages: () => messagesRef.current,
    });

  // ENH [AUTO-TASK-MODE]: Clear the effective-mode badge when the user
  // switches conversations so a stale "Long Task" badge from the previous
  // conversation doesn't bleed into the new one.
  useEffect(() => {
    setEffectiveTaskMode(null);
  }, [currentConversationId]);

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
      // ENH [AUTO-TASK-MODE]: User's chosen task mode (from settings) and
      // the backend-reported effective mode for the current turn.
      taskMode: settings.taskMode ?? 'auto',
      onTaskModeChange: (value) => updateSetting('taskMode', value),
      effectiveTaskMode,
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
      settings.taskMode,
      updateSetting,
      effectiveTaskMode,
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
