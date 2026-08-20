const CONVERSATION_LIST_ERROR = 'Couldn’t load conversations';

export const initialConversationListLoadState = Object.freeze({
  error: null,
  failureRevision: 0,
});

export function conversationListLoadReducer(state, event) {
  switch (event.type) {
    case 'started':
      return event.visible ? { ...state, error: null } : state;
    case 'succeeded':
      return state.error === null ? state : { ...state, error: null };
    case 'failed':
      return {
        error: CONVERSATION_LIST_ERROR,
        failureRevision: state.failureRevision + 1,
      };
    default:
      return state;
  }
}

export function getConversationListView({ isLoading, error, conversationCount }) {
  if (conversationCount > 0) return 'list';
  if (isLoading) return 'loading';
  if (error) return 'error';
  return 'empty';
}
