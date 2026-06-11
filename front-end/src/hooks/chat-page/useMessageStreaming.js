/**
 * useMessageStreaming Hook
 *
 * Handles sending messages, resuming LangGraph interrupts, and streaming AI
 * responses via SSE events.
 *
 * @module hooks/useMessageStreaming
 */

import { useCallback, useEffect, useRef } from 'react';
import { resumeAgent, sendMessage } from '@/api';
import logger from '@/utils/logger';
import { parseSSEStream } from '@/utils/streamParser';
import {
  createAssistantMessage,
  createMessageId,
  createUserMessage,
  MESSAGE_STATUS,
} from '@/utils/chatMessages';

const STREAM_RENDER_BATCH_MS = 32;

function getErrorMessage(error) {
  if (!navigator.onLine) {
    return "You appear to be offline. Please check your internet connection and try again.";
  }
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return "Unable to connect to the server. Please check your connection and try again.";
  }
  if (error.status) {
    switch (error.status) {
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "You don't have permission to perform this action.";
      case 429:
        return "You've made too many requests. Please wait a moment and try again.";
      case 500:
      case 502:
      case 503:
        return "The server is experiencing issues. Please try again in a few moments.";
      case 504:
        return "The request timed out. Please try again with a simpler query.";
      default:
        if (error.status >= 400 && error.status < 500) {
          return error.message || "There was a problem with your request. Please try again.";
        }
        if (error.status >= 500) {
          return "Server error. Our team has been notified. Please try again later.";
        }
    }
  }
  if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
    return "The request took too long. Please try again with a simpler query.";
  }
  return "Something went wrong. Please try again.";
}

function upsertAssistantMessage(prevMessages, assistantId, messageData, status) {
  const nextAssistant = createAssistantMessage({
    id: assistantId,
    textOverride: messageData.text,
    stepsOverride: messageData.steps,
    timelineOverride: messageData.timeline,
    status,
  });
  const messageIndex = prevMessages.findIndex((message) => message.id === assistantId);

  if (messageIndex === -1) {
    return [...prevMessages, nextAssistant];
  }

  const updated = [...prevMessages];
  updated[messageIndex] = {
    ...updated[messageIndex],
    ...nextAssistant,
  };
  return updated;
}

export function useMessageStreaming({
  currentConversationId,
  setCurrentConversationId,
  setMessages,
  setConversations,
  navigate,
  fetchConversations,
  registerStreamingConversation,
  settings,
  dispatchUiAction = () => {},
  onAgentInterrupt = () => {},
  getMessages = () => [],
}) {
  const abortControllerRef = useRef(null);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
  }, []);

  const streamAssistantResponse = useCallback(async ({
    response,
    assistantMessageId,
    promptForNewConversation,
    baseMessageData = null,
  }) => {
    const newConversationId = response.headers.get('X-Conversation-Id');
    if (newConversationId && !currentConversationId) {
      registerStreamingConversation?.(newConversationId);
      setCurrentConversationId(newConversationId);
      navigate(`/chat/${newConversationId}`, { replace: true });

      const tempTitle = promptForNewConversation.substring(0, 50)
        + (promptForNewConversation.length > 50 ? '...' : '');
      setConversations((prev) => [
        { id: newConversationId, title: tempTitle, created_at: new Date().toISOString() },
        ...prev,
      ]);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const contentParts = [];
    const eventTimeline = [];
    let lastUpdateTime = 0;
    let pendingStatus = null;
    let streamFlushRafId = 0;
    let interruptedWithoutAssistantContent = false;

    const buildMessageData = (isDone = false) => {
      let streamedText = contentParts.join('');

      const baseText = baseMessageData?.text || '';
      const baseSteps = Array.isArray(baseMessageData?.steps) ? baseMessageData.steps : [];
      const baseTimeline = Array.isArray(baseMessageData?.timeline) ? baseMessageData.timeline : [];
      const normalizedTimeline = eventTimeline.map((item) => (
        item.type === 'thinking'
          ? { ...item, isComplete: isDone || item.isComplete }
          : item
      ));
      return {
        text: `${baseText}${streamedText}`,
        steps: [
          ...baseSteps,
          ...normalizedTimeline.filter((item) => item.type !== 'text'),
        ],
        timeline: [...baseTimeline, ...normalizedTimeline],
      };
    };

    const flushStreamUpdate = () => {
      streamFlushRafId = 0;
      if (pendingStatus === null) return;

      const status = pendingStatus;
      pendingStatus = null;
      setMessages((prev) =>
        upsertAssistantMessage(prev, assistantMessageId, buildMessageData(), status)
      );
      lastUpdateTime = performance.now();
    };

    const scheduleStreamUpdate = (status) => {
      pendingStatus = status;
      const now = performance.now();
      if (now - lastUpdateTime >= STREAM_RENDER_BATCH_MS) {
        flushStreamUpdate();
        return;
      }
      if (!streamFlushRafId) {
        streamFlushRafId = requestAnimationFrame(flushStreamUpdate);
      }
    };

    await parseSSEStream(reader, decoder, (event) => {
      switch (event.type) {
        case 'token': {
          contentParts.push(event.content);
          const lastItem = eventTimeline[eventTimeline.length - 1];
          if (lastItem?.type === 'text') {
            lastItem.content += event.content;
          } else {
            eventTimeline.push({
              type: 'text',
              id: `text-${eventTimeline.length}`,
              content: event.content,
            });
          }
          scheduleStreamUpdate(MESSAGE_STATUS.STREAMING);
          break;
        }

        case 'tool_start':
          eventTimeline.forEach((step) => {
            if (step.type === 'thinking') step.isComplete = true;
          });
          eventTimeline.push({
            type: 'tool',
            id: `tool-${event.name}-${eventTimeline.length}`,
            name: event.name,
            status: 'running',
            args: event.args,
            result: null,
          });
          scheduleStreamUpdate(MESSAGE_STATUS.STREAMING);
          break;

        case 'tool_end': {
          for (let i = eventTimeline.length - 1; i >= 0; i -= 1) {
            const step = eventTimeline[i];
            if (step.name === event.name && step.status === 'running') {
              step.status = 'done';
              step.args = event.args;
              step.result = event.result;
              break;
            }
          }
          scheduleStreamUpdate(MESSAGE_STATUS.STREAMING);
          break;
        }

        case 'thinking_token':
          if (eventTimeline[eventTimeline.length - 1]?.type === 'thinking') {
            eventTimeline[eventTimeline.length - 1].content += event.content;
            eventTimeline[eventTimeline.length - 1].isComplete = false;
          } else {
            eventTimeline.push({
              type: 'thinking',
              id: `thinking-${eventTimeline.length}`,
              content: event.content,
              isComplete: false,
            });
          }
          scheduleStreamUpdate(MESSAGE_STATUS.STREAMING);
          break;

        case 'agent_interrupt':
          interruptedWithoutAssistantContent = true;
          onAgentInterrupt(event, assistantMessageId);
          scheduleStreamUpdate(MESSAGE_STATUS.WAITING);
          break;

        case 'error':
          contentParts.push(`\n\n**Error**: ${event.message}`);
          scheduleStreamUpdate(MESSAGE_STATUS.ERROR);
          break;

        case 'ui_action':
          dispatchUiAction(event);
          break;

        default:
          break;
      }
    });

    if (streamFlushRafId) {
      cancelAnimationFrame(streamFlushRafId);
      streamFlushRafId = 0;
    }
    if (pendingStatus !== null) {
      flushStreamUpdate();
    }

    if (
      interruptedWithoutAssistantContent
      && contentParts.length === 0
      && eventTimeline.length === 0
    ) {
      setMessages((prev) => prev.filter((message) => message.id !== assistantMessageId));
    } else {
      setMessages((prev) =>
        upsertAssistantMessage(prev, assistantMessageId, buildMessageData(true), MESSAGE_STATUS.DONE)
      );
    }
    fetchConversations(undefined, { showLoading: false, force: true });
  }, [
    currentConversationId,
    dispatchUiAction,
    fetchConversations,
    navigate,
    onAgentInterrupt,
    registerStreamingConversation,
    setConversations,
    setCurrentConversationId,
    setMessages,
  ]);

  const handleSendMessage = useCallback(async (message, overrides = null) => {
    const prompt = message.trim();
    if (!prompt) return;

    const assistantMessageId = createMessageId('assistant');
    setMessages((prev) => [
      ...prev,
      createUserMessage(prompt),
      createAssistantMessage({
        id: assistantMessageId,
        textOverride: '',
        stepsOverride: [],
        status: MESSAGE_STATUS.WAITING,
      }),
    ]);

    const enableReasoning = settings.enableReasoning ?? true;
    const reasoningEffort = settings.reasoningEffort ?? 'medium';
    const responseStyle = settings.responseStyle ?? 'balanced';
    const maxRows = settings.maxRows ?? 1000;
    const provider = overrides?.provider ?? settings.llmProvider ?? null;
    const model = overrides?.model ?? settings.llmModel ?? null;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await sendMessage({
        prompt,
        conversationId: currentConversationId,
        enableReasoning,
        reasoningEffort,
        responseStyle,
        maxRows,
        provider,
        model,
      }, abortControllerRef.current.signal);

      await streamAssistantResponse({
        response,
        assistantMessageId,
        promptForNewConversation: prompt,
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessages((prev) => {
          const existingAssistant = prev.find((msg) => msg.id === assistantMessageId);
          return upsertAssistantMessage(
            prev,
            assistantMessageId,
            {
              text: existingAssistant?.text || '',
              steps: existingAssistant?.steps || [],
              timeline: existingAssistant?.timeline || [],
            },
            MESSAGE_STATUS.STOPPED,
          );
        });
        return;
      }
      logger.error('Message streaming error:', error);
      const errorMessage = getErrorMessage(error);
      setMessages((prev) => {
        const existingAssistant = prev.find((msg) => msg.id === assistantMessageId);
        const currentText = existingAssistant?.text
          ? `${existingAssistant.text}\n\n${errorMessage}`
          : errorMessage;
        return upsertAssistantMessage(
          prev,
          assistantMessageId,
          {
            text: currentText,
            steps: existingAssistant?.steps || [],
            timeline: existingAssistant?.timeline || [],
          },
          MESSAGE_STATUS.ERROR,
        );
      });
    } finally {
      abortControllerRef.current = null;
    }
  }, [currentConversationId, settings, setMessages, streamAssistantResponse]);

  const handleResumeAgent = useCallback(async (resumePayload, overrides = null) => {
    if (!currentConversationId || !resumePayload) return;

    const assistantMessageId = overrides?.assistantMessageId || createMessageId('assistant');
    const existingMessage = overrides?.assistantMessageId
      ? getMessages().find((message) => message.id === overrides.assistantMessageId)
      : null;
    const baseMessageData = existingMessage
      ? {
        text: existingMessage.text || '',
        steps: existingMessage.steps || [],
        timeline: existingMessage.timeline || [],
      }
      : null;

    setMessages((prev) => {
      if (existingMessage) {
        return prev.map((message) => (
          message.id === assistantMessageId
            ? { ...message, status: MESSAGE_STATUS.WAITING }
            : message
        ));
      }
      return [
        ...prev,
        createAssistantMessage({
          id: assistantMessageId,
          textOverride: '',
          stepsOverride: [],
          status: MESSAGE_STATUS.WAITING,
        }),
      ];
    });

    const enableReasoning = settings.enableReasoning ?? true;
    const reasoningEffort = settings.reasoningEffort ?? 'medium';
    const responseStyle = settings.responseStyle ?? 'balanced';
    const maxRows = settings.maxRows ?? 1000;
    const provider = overrides?.provider ?? settings.llmProvider ?? null;
    const model = overrides?.model ?? settings.llmModel ?? null;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const response = await resumeAgent({
        conversationId: currentConversationId,
        resume: resumePayload,
        enableReasoning,
        reasoningEffort,
        responseStyle,
        maxRows,
        provider,
        model,
      }, abortControllerRef.current.signal);

      await streamAssistantResponse({
        response,
        assistantMessageId,
        promptForNewConversation: '',
        baseMessageData,
      });
    } catch (error) {
      if (error.name === 'AbortError') return;
      logger.error('Agent resume streaming error:', error);
      const errorMessage = getErrorMessage(error);
      setMessages((prev) =>
        upsertAssistantMessage(
          prev,
          assistantMessageId,
          {
            text: errorMessage,
            steps: [],
            timeline: [{ type: 'text', id: 'resume-error', content: errorMessage }],
          },
          MESSAGE_STATUS.ERROR,
        )
      );
    } finally {
      abortControllerRef.current = null;
    }
  }, [currentConversationId, getMessages, settings, setMessages, streamAssistantResponse]);

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    handleSendMessage,
    handleResumeAgent,
    handleStopStreaming,
  };
}
