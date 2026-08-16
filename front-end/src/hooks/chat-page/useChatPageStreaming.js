// useChatPageStreaming — wraps `useMessageStreaming` and owns the
// agent-interrupt / step-limit / task-mode handlers + usage-metrics state.
//
// Responsibilities:
//   - Hold the resumeAgent / continueTask / stepLimitEvent refs so the
//     interrupt handlers can defer to the streaming hook's resume API.
//   - Hold effectiveTaskMode state (badge for the composer) and reset it
//     when the conversation changes.
//   - Hold usageMetrics state and sync it from message history when not
//     streaming.
//   - Wire all of the above into `useMessageStreaming` and return the
//     streaming actions (send, stop, resume, continue) plus the dialog/refs
//     needed by the caller.
//
// This is the most tightly-coupled slice — the streaming hook + interrupt
// handlers + step-limit handlers all reference each other, so they stay
// together. The guided-confirm state is passed in via `setGuidedConfirmDialog`
// so the streaming handlers can open the banner without owning dialog state.
//
// Note on the dispatchUiAction / handleOpenSqlEditor cycle:
// The UI action dispatcher and the canvas hook both depend on each other
// transitively through this hook. To break the cycle, the controller passes
// `dispatchUiAction` and `handleOpenSqlEditor` as refs (`dispatchUiActionRef`,
// `handleOpenSqlEditorRef`) that are kept up-to-date by the controller. We
// read from these refs inside our handlers so the closures always see the
// latest values without needing to be re-created.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMessageStreaming } from '@/hooks/chat-page/useMessageStreaming';
import { isMessageActive } from '@/utils/chatMessages';

export function useChatPageStreaming({
  // Conversation state
  messages,
  setMessages,
  currentConversationId,
  setCurrentConversationId,
  setConversations,
  navigate,
  fetchConversations,
  registerStreamingConversation,
  routeConversationId,
  // Settings
  settings,
  selectedProvider,
  selectedModel,
  // Refs that break the controller-internal cycle (canvas ↔ streaming ↔
  // dispatcher). The controller updates these refs on every render so the
  // closures below always read the latest values.
  dispatchUiActionRef,
  handleOpenSqlEditorRef,
  // UI coordination
  setGuidedConfirmDialog,
  showSnackbar,
  handleSidebarNewChat,
}) {
  const [usageMetrics, setUsageMetrics] = useState(null);
  const [effectiveTaskMode, setEffectiveTaskMode] = useState(null);

  const resumeAgentRef = useRef(null);
  const continueTaskRef = useRef(null);
  const stepLimitEventRef = useRef(null);
  const messagesRef = useRef(messages);

  // ── Derived: are we currently streaming? ─────────────────────────────────
  const isCurrentlyStreaming = useMemo(() => {
    if (messages.length === 0) return false;
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.role === 'assistant' && isMessageActive(lastMessage);
  }, [messages]);

  // ── Step-limit handler ───────────────────────────────────────────────────
  const handleAgentStepLimitReached = useCallback(
    (event, assistantMessageId = null) => {
      stepLimitEventRef.current = event;
      const stepsUsed = event?.steps_used ?? '?';
      const taskMode = event?.task_mode || 'normal';

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
    [selectedModel, selectedProvider, setGuidedConfirmDialog],
  );

  // ── Task-mode-resolved handler ───────────────────────────────────────────
  // Called when the backend emits a `task_mode` SSE event at the start of
  // each turn. Stores the EFFECTIVE mode (which may have been auto-elevated)
  // so the ChatInput can display a badge ("Long Task · 200 steps") while the
  // agent is running.
  const handleTaskModeResolved = useCallback((event) => {
    setEffectiveTaskMode({
      task_mode: event?.task_mode || 'normal',
      label: event?.label || event?.task_mode || 'Standard',
      recursion_limit: event?.recursion_limit ?? null,
      source: event?.source || 'user',
    });
  }, []);

  // ── Agent-interrupt handler ──────────────────────────────────────────────
  // Reads `handleOpenSqlEditor` from the ref so the closure stays stable
  // without needing `handleOpenSqlEditor` in its dependency array.
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
        handleOpenSqlEditorRef.current?.(payload.query);
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
    [handleOpenSqlEditorRef, selectedModel, selectedProvider, setGuidedConfirmDialog],
  );

  // ── Stable dispatchUiAction wrapper ──────────────────────────────────────
  // `useMessageStreaming` captures `dispatchUiAction` into its `handleSendMessage`
  // closure. If we passed the controller's `dispatchUiAction` directly, the
  // closure would be re-created on every controller render — fine in itself,
  // but it would also need to be in this hook's deps. Instead we wrap it in
  // a stable callback that reads from the ref.
  const dispatchUiActionStable = useCallback(
    (event) => {
      dispatchUiActionRef.current?.(event);
    },
    [dispatchUiActionRef],
  );

  // ── Wire streaming hook ──────────────────────────────────────────────────
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
      dispatchUiAction: dispatchUiActionStable,
      onAgentInterrupt: handleAgentInterrupt,
      onAgentStepLimitReached: handleAgentStepLimitReached,
      onTaskModeResolved: handleTaskModeResolved,
      getMessages: () => messagesRef.current,
    });

  // Keep refs in sync with the latest streaming actions so the interrupt
  // handlers (which fire later, asynchronously) always call the freshest
  // version.
  useEffect(() => {
    resumeAgentRef.current = handleResumeAgent;
    continueTaskRef.current = handleContinueTask;
  }, [handleResumeAgent, handleContinueTask]);

  // Clear the effective-mode badge when the user switches conversations so
  // a stale "Long Task" badge from the previous conversation doesn't bleed
  // into the new one. `currentConversationId` is intentionally the trigger
  // (a "reset on change" side-effect), not a value the effect derives from.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on conversation change
  useEffect(() => {
    // Intentional reset of conversation-scoped UI state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEffectiveTaskMode(null);
  }, [currentConversationId]);

  // Restore usageMetrics from message history when NOT streaming.
  //
  // FIX [CTX-SYNC]: Previously this effect ran on EVERY `messages` change
  // (every token batch during streaming) and used `setTimeout(() => ..., 0)`
  // to defer `setUsageMetrics`. Those deferred updates could fire AFTER the
  // live SSE `usage_metrics` event handler's synchronous `setUsageMetrics`,
  // clobbering the live value with `null` or stale data from a previous turn.
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
      // Restore the persisted value after conversation hydration completes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsageMetrics(nextUsage);
    } else if (!isLastUser || !messages || messages.length === 0) {
      // Clear metrics when the selected transcript contains no usage record.
      setUsageMetrics(null);
    }
  }, [messages, isCurrentlyStreaming]);

  const handleSendMessageWithModel = useCallback(
    (message) => {
      return handleSendMessage(message, {
        provider: selectedProvider || null,
        model: selectedModel || null,
      });
    },
    [handleSendMessage, selectedProvider, selectedModel],
  );

  return {
    isCurrentlyStreaming,
    handleSendMessage: handleSendMessageWithModel,
    handleStopStreaming,
    effectiveTaskMode,
    usageMetrics,
    setUsageMetrics,
    // Helper for the UI action dispatcher to fire `navigate_new_chat`.
    onNavigateNewChatGuided: useCallback(
      (payload) => {
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
      [setGuidedConfirmDialog, showSnackbar],
    ),
    // Helper for `complete_navigate_new_chat` — defers a sidebar new-chat
    // action by `delayMs` so the agent has time to settle.
    onCompleteNavigateNewChat: useCallback(
      (payload) => {
        window.setTimeout(() => {
          handleSidebarNewChat();
        }, Number(payload?.delayMs) || 900);
      },
      [handleSidebarNewChat],
    ),
    // Helper for the UI action dispatcher to receive `usage_metrics` events.
    onUsageMetricsEvent: useCallback((payload) => {
      if (payload) setUsageMetrics(payload);
    }, []),
    routeConversationId,
  };
}
