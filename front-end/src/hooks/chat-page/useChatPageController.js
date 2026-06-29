import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTheme as useMuiTheme, alpha } from '@mui/material/styles';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import { useDatabaseConnection } from '@/contexts/DatabaseContext';
import { useAuth } from '@/contexts/AuthContext';
import useAutoScroll from '@/hooks/chat-page/useAutoScroll';
import { useConversations } from '@/hooks/chat-page/useConversations';
import { useMessageStreaming } from '@/hooks/chat-page/useMessageStreaming';
import { useQueryExecution } from '@/hooks/chat-page/useQueryExecution';
import { useWorkspaceCanvas } from '@/hooks/chat-page/useWorkspaceCanvas';
import { useResponsive } from '@/hooks/chat-page/useResponsive';
import { useChatPageLlmSelection } from '@/hooks/chat-page/useChatPageLlmSelection';
import { useChatPageSessionLifecycle } from '@/hooks/chat-page/useChatPageSessionLifecycle';
import { useUiActionDispatcher } from '@/hooks/chat-page/useUiActionDispatcher';
import { isMessageActive } from '@/utils/chatMessages';
import { UI_LAYOUT } from '@/styles/shared';
import { useLocalStorage } from '@/hooks';

const DRAWER_WIDTH = UI_LAYOUT.sidebarExpandedWidth;
const COLLAPSED_WIDTH = UI_LAYOUT.sidebarCollapsedWidth;
const SNACKBAR_MESSAGE_LIMIT = 120;

function getCompactSnackbarMessage(message, fallback = 'Guidance available') {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  if (text.length <= SNACKBAR_MESSAGE_LIMIT) return text;
  const sentenceEnd = text.search(/[.!?]\s/);
  if (sentenceEnd > 24 && sentenceEnd <= SNACKBAR_MESSAGE_LIMIT) {
    return text.slice(0, sentenceEnd + 1);
  }
  return `${text.slice(0, SNACKBAR_MESSAGE_LIMIT - 1).trim()}…`;
}

export function useChatPageController() {
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
    connect: connectDb,
    resetConnectionState,
    switchDatabase,
  } = useDatabaseConnection();
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
  const [sidebarOpen, setSidebarOpen] = useLocalStorage('moonlit-sidebar-open', true);
  const currentSidebarWidth = useMemo(() =>
    sidebarOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH,
  [sidebarOpen]);
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
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dbModalInitialType, setDbModalInitialType] = useState(null);
  const [settingsInitialSection, setSettingsInitialSection] = useState(null);
  const [usageMetrics, setUsageMetrics] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [guidedConfirmDialog, setGuidedConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Not now',
    onCancel: null,
    onConfirm: null,
  });
  const [deleteConversationDialog, setDeleteConversationDialog] = useState({
    open: false,
    conversationId: null,
  });
  const [renameConversationDialog, setRenameConversationDialog] = useState({
    open: false,
    conversationId: null,
    title: '',
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

  const showSnackbar = useCallback((message, severity = 'info') => {
    setSnackbar({
      open: true,
      message: getCompactSnackbarMessage(message),
      severity,
    });
  }, []);
  const handleOpenSqlEditor = useCallback((query = '', results = null) => {
    if (!isDbConnected) {
      setSettingsOpen(false);
      setDbModalOpen(true);
      showSnackbar('Connect a database to use the SQL editor.', 'info');
      return;
    }
    openSqlEditorCanvas(query, results);
  }, [isDbConnected, openSqlEditorCanvas, showSnackbar]);
  const handleQueryResults = useCallback((data, sourceQuery) => {
    handleOpenCanvasArtifact({
      type: 'visualization',
      title: 'Query results',
      props: { data, sourceQuery, sourceType: 'sql-editor' },
    });
  }, [handleOpenCanvasArtifact]);
  const {
    confirmDialog,
    handleRunQuery,
    handleConfirmDialogClose,
  } = useQueryExecution({
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
  }, [navigate]);

  const isCurrentlyStreaming = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.role === 'assistant' && isMessageActive(lastMessage);
  }, [messages]);

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

  const handleDeleteConversationRequest = useCallback((conversationId) => {
    setDeleteConversationDialog({
      open: true,
      conversationId,
    });
  }, []);

  const handleDeleteConversationDialogClose = useCallback(() => {
    setDeleteConversationDialog({
      open: false,
      conversationId: null,
    });
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

  const handleRenameConversationRequest = useCallback((conversationId, title) => {
    setRenameConversationDialog({
      open: true,
      conversationId,
      title: title || '',
    });
  }, []);

  const handleRenameConversationDialogClose = useCallback(() => {
    setRenameConversationDialog({
      open: false,
      conversationId: null,
      title: '',
    });
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
    
    // Extract usage metrics from the loaded conversation history
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

    const isLastUser = messages && messages.length === 1 && (messages[0].role === 'user' || messages[0].sender === 'user');
    
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

  const handleAgentStepLimitReached = useCallback((event, assistantMessageId = null) => {
    stepLimitEventRef.current = event;
    const stepsUsed = event?.steps_used ?? '?';
    const taskMode = event?.task_mode || 'normal';
    const message = event?.message
      || `The agent paused after ${stepsUsed} steps to avoid runaway execution. The task context has been saved.`;

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
  }, [selectedModel, selectedProvider]);

  const handleAgentInterrupt = useCallback((event, assistantMessageId = null) => {
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
  }, [handleOpenSqlEditor, selectedModel, selectedProvider]);

  const {
    handleSendMessage,
    handleResumeAgent,
    handleStopStreaming,
    handleContinueTask,
  } = useMessageStreaming({
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

  const isRouteConversationHydrating = routeConversationLoadState === 'loading';
  const isConversationViewLoading = isConversationLoading || isRouteConversationHydrating;
  const showWelcomeState = !routeConversationId && messages.length === 0 && !isConversationViewLoading;
  const showConversationPanel = Boolean(routeConversationId) || messages.length > 0 || isConversationViewLoading;

  const streamActivityKey = useMemo(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return 'empty';
    const textLen = (lastMessage.text || '').length;
    const stepsLen = (lastMessage.steps || []).length;
    return `${lastMessage.id}|${lastMessage.status}|${textLen}|${stepsLen}|${messages.length}`;
  }, [messages]);
  const snackbarContentProps = useMemo(() => {
    const severityColor = snackbar.severity === 'success' ? theme.palette.success.main :
      snackbar.severity === 'error' ? theme.palette.error.main :
        snackbar.severity === 'warning' ? theme.palette.warning.main :
          theme.palette.info.main;
    const surfaceColor = alpha(theme.palette.background.elevated, isDarkMode ? 0.96 : 0.98);
    const borderBase = alpha(theme.palette.text.primary, isDarkMode ? 0.12 : 0.1);

    return {
      sx: {
        width: '100%',
        maxWidth: 'min(420px, calc(100vw - 32px))',
        alignItems: 'flex-start',
        backgroundColor: surfaceColor,
        color: theme.palette.text.primary,
        fontWeight: 500,
        borderRadius: '8px',
        border: `1px solid ${borderBase}`,
        borderLeft: `3px solid ${severityColor}`,
        boxShadow: isDarkMode
          ? `0 12px 30px ${alpha(theme.palette.common.black, 0.28)}`
          : `0 4px 12px ${alpha(severityColor, 0.15)}`,
        padding: theme.spacing(1.1, 1.5),
        minWidth: 'auto !important',
        '& .MuiSnackbarContent-message': {
          padding: 0,
          minWidth: 0,
          ...theme.typography.uiBodySm,
          lineHeight: 1.45,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        },
      },
    };
  }, [isDarkMode, theme, snackbar.severity]);
  const snackbarAnchorOrigin = useMemo(() => ({
    vertical: 'top',
    horizontal: isNarrowLayout ? 'center' : 'right',
  }), [isNarrowLayout]);

  const handleSendMessageWithModel = useCallback((message) => {
    return handleSendMessage(message, {
      provider: selectedProvider || null,
      model: selectedModel || null,
    });
  }, [handleSendMessage, selectedProvider, selectedModel]);

  const handleCloseDbModal = useCallback(() => setDbModalOpen(false), []);
  const handleCloseSettings = useCallback(() => setSettingsOpen(false), []);
  const handleCloseSnackbar = useCallback(() => setSnackbar((s) => ({ ...s, open: false })), []);
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
  }, [handleMenuClose]);
  const handleDbConnect = useCallback((data) => {
    if (data) {
      connectDb(data);
      showSnackbar('Connected to database!', 'success');
    } else {
      resetConnectionState();
      showSnackbar('Disconnected from database', 'info');
    }
  }, [connectDb, resetConnectionState, showSnackbar]);
  const handleDatabaseSwitch = useCallback(async (dbName) => {
    const result = await switchDatabase(dbName);
    if (result.success) {
      showSnackbar(`Switched to ${dbName}`, 'success');
    } else {
      showSnackbar(result.error || 'Failed to switch', 'error');
    }
  }, [switchDatabase, showSnackbar]);
  const chatInputSharedProps = useMemo(() => ({
    onSend: handleSendMessageWithModel,
    onStop: handleStopStreaming,
    isStreaming: isCurrentlyStreaming,
    isConnected: isDbConnected,
    dbType,
    currentDatabase,
    availableDatabases,
    onDatabaseSwitch: handleDatabaseSwitch,
    onOpenSqlEditor: handleOpenSqlEditor,
    selectedProvider,
    selectedModel,
    providerOptions,
    llmOptionsLoading,
    onSelectLlm: handleLlmSelection,
    usageMetrics,
  }), [
    handleSendMessageWithModel,
    handleStopStreaming,
    isCurrentlyStreaming,
    isDbConnected,
    dbType,
    currentDatabase,
    availableDatabases,
    handleDatabaseSwitch,
    handleOpenSqlEditor,
    selectedProvider,
    selectedModel,
    providerOptions,
    llmOptionsLoading,
    handleLlmSelection,
    usageMetrics,
  ]);
  const commonSidebarProps = useMemo(() => ({
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
  }), [
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
  ]);
  const handleSidebarSelectConversation = useCallback((id) => {
    setMobileOpen(false);
    setSettingsOpen(false);
    setDbModalOpen(false);
    navigate(`/chat/${id}`);
  }, [navigate]);
  const handleSidebarOpenDbModal = useCallback(() => {
    setMobileOpen(false);
    setSettingsOpen(false);
    setDbModalOpen(true);
  }, []);
  const handleSidebarMenuOpen = useCallback((e) => {
    setMobileOpen(false);
    handleMenuOpen(e);
  }, [handleMenuOpen]);

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
    closeGuidedConfirmDialog,
    handleGuidedCancel,
    handleGuidedConfirm,
    dbModalInitialType,
    settingsInitialSection,
  };
}
