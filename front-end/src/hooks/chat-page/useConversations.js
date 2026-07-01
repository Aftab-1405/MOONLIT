/**
 * useConversations Hook
 *
 * Manages conversation state, CRUD operations, and URL synchronization.
 * Extracted from Chat.jsx for better separation of concerns.
 *
 * @module hooks/useConversations
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteConversation, getConversation, getConversations, renameConversation } from '@/api';
import { queryClient, queryKeys } from '@/api/queryClient';
import { normalizeConversationMessage } from '@/utils/chatMessages';
import logger from '@/utils/logger';

/**
 * Hook for managing conversations and messages
 * @returns {Object} Conversation state and handlers
 */
export function useConversations() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [isConversationLoading, setIsConversationLoading] = useState(Boolean(conversationId));
  const [routeConversationLoadState, setRouteConversationLoadState] = useState(
    conversationId ? 'loading' : 'idle',
  );
  const prevConversationIdRef = useRef(null);
  const lastLoadedConversationIdRef = useRef(null);
  const newlyCreatedConvIdRef = useRef(null);
  const conversationLoadSeqRef = useRef(0);
  const conversationsLoadSeqRef = useRef(0);
  const fetchConversations = useCallback(async (signal, options = {}) => {
    const showLoading = options.showLoading ?? true;
    if (options.force) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
    }
    const requestSeq = conversationsLoadSeqRef.current + 1;
    conversationsLoadSeqRef.current = requestSeq;
    if (showLoading) {
      setIsConversationsLoading(true);
    }
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.conversations,
        queryFn: ({ signal: querySignal }) => getConversations(signal ?? querySignal),
        staleTime: 15 * 1000,
      });
      if (data.status === 'success') {
        const nextConversations = data.conversations || [];
        setConversations((prev) => {
          if (prev.length !== nextConversations.length) return nextConversations;
          for (let i = 0; i < prev.length; i += 1) {
            if (prev[i]?.id !== nextConversations[i]?.id) return nextConversations;
            if (prev[i]?.title !== nextConversations[i]?.title) return nextConversations;
            if (prev[i]?.timestamp !== nextConversations[i]?.timestamp) return nextConversations;
            if (prev[i]?.preview !== nextConversations[i]?.preview) return nextConversations;
          }
          return prev;
        });
      }
    } catch (error) {
      if (error.name === 'AbortError') return; // Ignore abort errors
      logger.error('Failed to fetch conversations:', error);
    } finally {
      if (showLoading && conversationsLoadSeqRef.current === requestSeq) {
        setIsConversationsLoading(false);
      }
    }
  }, []);
  const registerStreamingConversation = useCallback((convId) => {
    newlyCreatedConvIdRef.current = convId;
    lastLoadedConversationIdRef.current = convId;
    prevConversationIdRef.current = convId;
    setCurrentConversationId(convId);
    setIsConversationLoading(false);
  }, []);
  const resetChatState = useCallback(() => {
    setMessages([]);
    setCurrentConversationId(null);
    setIsConversationLoading(false);
  }, []);
  const handleSelectConversation = useCallback(async (convId) => {
    const cachedConversation = queryClient.getQueryData(queryKeys.conversation(convId));
    if (cachedConversation?.messages) {
      setCurrentConversationId(convId);
      setMessages(cachedConversation.messages);
      lastLoadedConversationIdRef.current = convId;
      setIsConversationLoading(false);
      return true;
    }

    const requestSeq = ++conversationLoadSeqRef.current;
    setIsConversationLoading(true);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.conversation(convId),
        queryFn: ({ signal: querySignal }) => getConversation(convId, querySignal),
        staleTime: 5 * 60 * 1000,
      });

      // Guard: if the user switched conversations while this request was
      // in-flight, discard the stale result entirely.
      if (conversationLoadSeqRef.current !== requestSeq) {
        return false;
      }

      if (data.status === 'success' && data.conversation) {
        setCurrentConversationId(convId);
        const formattedMessages = (data.conversation.messages || []).map((msg, index) =>
          normalizeConversationMessage(msg, index),
        );
        queryClient.setQueryData(queryKeys.conversation(convId), {
          ...data,
          messages: formattedMessages,
        });
        setMessages(formattedMessages);
        lastLoadedConversationIdRef.current = convId;
        return true;
      }
      return false;
    } catch (error) {
      if (error.name === 'AbortError') return false; // Ignore abort errors
      logger.error('Failed to load conversation:', error);
      return false;
    } finally {
      // Only reset loading if this is still the active request.
      if (conversationLoadSeqRef.current === requestSeq) {
        setIsConversationLoading(false);
      }
    }
  }, []);
  const handleDeleteConversation = useCallback(
    async (convId) => {
      try {
        await deleteConversation(convId);
        queryClient.removeQueries({ queryKey: queryKeys.conversation(convId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (currentConversationId === convId) {
          navigate('/chat');
        }
      } catch (error) {
        if (error.name === 'AbortError') return; // Ignore abort errors
        logger.error('Failed to delete conversation:', error);
        throw error;
      }
    },
    [currentConversationId, navigate],
  );
  const handleRenameConversation = useCallback(async (convId, title) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    try {
      const data = await renameConversation(convId, trimmedTitle);
      const savedTitle = data.title || trimmedTitle;
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: savedTitle } : c)),
      );
    } catch (error) {
      if (error.name === 'AbortError') return;
      logger.error('Failed to rename conversation:', error);
    }
  }, []);
  useEffect(() => {
    if (!currentConversationId) return;
    queryClient.setQueryData(queryKeys.conversation(currentConversationId), (prev) => ({
      ...(prev || { status: 'success' }),
      messages,
    }));
  }, [currentConversationId, messages]);
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);
  useEffect(() => {
    let cancelled = false;

    const loadRouteConversation = () => {
      setRouteConversationLoadState('loading');
      handleSelectConversation(conversationId).then((loaded) => {
        if (cancelled) return;
        if (loaded) {
          prevConversationIdRef.current = conversationId;
          setRouteConversationLoadState('ready');
          return;
        }
        setRouteConversationLoadState('error');
      });
    };

    if (conversationId) {
      if (
        conversationId !== prevConversationIdRef.current ||
        conversationId !== lastLoadedConversationIdRef.current
      ) {
        if (conversationId === newlyCreatedConvIdRef.current) {
          newlyCreatedConvIdRef.current = null;
          lastLoadedConversationIdRef.current = conversationId;
          setRouteConversationLoadState('ready');
        } else {
          loadRouteConversation();
        }
      } else {
        setRouteConversationLoadState('ready');
      }
    } else if (prevConversationIdRef.current) {
      resetChatState();
      lastLoadedConversationIdRef.current = null;
      setRouteConversationLoadState('idle');
    } else {
      setRouteConversationLoadState('idle');
    }
    if (!conversationId || conversationId === lastLoadedConversationIdRef.current) {
      prevConversationIdRef.current = conversationId;
    }

    return () => {
      cancelled = true;
    };
  }, [conversationId, handleSelectConversation, resetChatState]);

  return {
    messages,
    setMessages,
    isConversationsLoading,
    isConversationLoading,
    conversations,
    setConversations,
    currentConversationId,
    setCurrentConversationId,
    routeConversationId: conversationId || null,
    routeConversationLoadState,
    fetchConversations,
    registerStreamingConversation,
    handleDeleteConversation,
    handleRenameConversation,
    navigate,
  };
}
