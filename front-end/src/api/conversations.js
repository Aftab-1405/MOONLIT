/**
 * Conversations API Module
 * 
 * Handles conversation-related API calls:
 * - List conversations
 * - Get single conversation
 * - Rename conversation
 * - Delete conversation
 * - Send message to LLM (streaming)
 * 
 * @module api/conversations
 */

import { get, del, patch, postRaw } from '@/api/client';
import { CONVERSATIONS } from '@/api/endpoints';

/**
 * Get all conversations for current user.
 * 
 * @param {AbortSignal} [signal] - Optional abort signal for cancellation
 * @returns {Promise<{status: string, conversations: Array}>}
 */
export async function getConversations(signal) {
  return get(CONVERSATIONS.LIST, { signal });
}

/**
 * Get a single conversation by ID.
 * 
 * @param {string} id - Conversation ID
 * @param {AbortSignal} [signal] - Optional abort signal for cancellation
 * @returns {Promise<{status: string, conversation: Object}>}
 */
export async function getConversation(id, signal) {
  return get(CONVERSATIONS.GET(id), { signal });
}

/**
 * Delete a conversation by ID.
 * 
 * @param {string} id - Conversation ID
 * @returns {Promise<{status: string}>}
 */
export async function deleteConversation(id) {
  return del(CONVERSATIONS.DELETE(id));
}

/**
 * Rename a conversation by ID.
 *
 * @param {string} id - Conversation ID
 * @param {string} title - New conversation title
 * @returns {Promise<{status: string, title: string}>}
 */
export async function renameConversation(id, title) {
  return patch(CONVERSATIONS.RENAME(id), { title });
}

/**
 * Send a message to the LLM and receive streaming response.
 * 
 * @param {Object} params - Message parameters
 * @param {string} params.prompt - User message
 * @param {string|null} params.conversationId - Current conversation ID
 * @param {boolean} params.enableReasoning - Enable AI reasoning
 * @param {string} params.reasoningEffort - Reasoning effort level
 * @param {string} params.responseStyle - Response style preference
 * @param {number|null} params.maxRows - Max rows for query results
 * @param {string|null} params.provider - LLM provider override
 * @param {string|null} params.model - LLM model override
 * @param {AbortSignal} [signal] - Optional abort signal for cancellation
 * @returns {Promise<Response>} Raw response for streaming
 */
export async function sendMessage({
  prompt,
  conversationId = null,
  enableReasoning = true,
  reasoningEffort = 'medium',
  responseStyle = 'balanced',
  maxRows = 1000,
  provider = null,
  model = null,
  taskMode = 'normal',
}, signal) {
  return postRaw(
    CONVERSATIONS.SEND_MESSAGE,
    {
      prompt,
      conversation_id: conversationId,
      enable_reasoning: enableReasoning,
      reasoning_effort: reasoningEffort,
      response_style: responseStyle,
      max_rows: maxRows === 0 ? null : maxRows,
      provider,
      model,
      task_mode: taskMode,
    },
    { signal }
  );
}

/**
 * Resume a LangGraph conversation that paused for human input.
 *
 * @param {Object} params - Resume parameters
 * @param {string} params.conversationId - Conversation ID/thread ID to resume
 * @param {Object} params.resume - JSON-serializable resume payload
 * @param {AbortSignal} [signal] - Optional abort signal for cancellation
 * @returns {Promise<Response>} Raw response for streaming
 */
export async function resumeAgent({
  conversationId,
  resume,
  enableReasoning = true,
  reasoningEffort = 'medium',
  responseStyle = 'balanced',
  maxRows = 1000,
  provider = null,
  model = null,
  taskMode = 'normal',
}, signal) {
  return postRaw(
    CONVERSATIONS.RESUME_AGENT,
    {
      conversation_id: conversationId,
      resume,
      enable_reasoning: enableReasoning,
      reasoning_effort: reasoningEffort,
      response_style: responseStyle,
      max_rows: maxRows === 0 ? null : maxRows,
      provider,
      model,
      task_mode: taskMode,
    },
    { signal }
  );
}
