import {
  buildConversationTitle,
  getConversationDisplayTitle,
} from '../../utils/conversationTitles.js';

export function getActiveConversationId(routeConversationId, currentConversationId) {
  return routeConversationId || currentConversationId || null;
}

export function getActiveConversationTitle(conversations, currentConversationId) {
  if (!currentConversationId) return null;
  const activeConversation = conversations.find(
    (conversation) => conversation.id === currentConversationId,
  );
  return getConversationDisplayTitle(activeConversation?.title);
}

export function prepareConversationRename(value) {
  return buildConversationTitle(value) || null;
}
