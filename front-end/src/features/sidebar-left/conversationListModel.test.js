import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conversationListLoadReducer,
  getConversationListView,
  initialConversationListLoadState,
} from './conversationListModel.js';

test('visible retry clears an error and success leaves the list ready', () => {
  const failed = conversationListLoadReducer(initialConversationListLoadState, {
    type: 'failed',
  });
  assert.deepEqual(failed, {
    error: 'Couldn’t load conversations',
    failureRevision: 1,
  });

  const retrying = conversationListLoadReducer(failed, {
    type: 'started',
    visible: true,
  });
  assert.equal(retrying.error, null);
  assert.equal(retrying.failureRevision, 1);

  assert.deepEqual(conversationListLoadReducer(retrying, { type: 'succeeded' }), {
    error: null,
    failureRevision: 1,
  });
});

test('background start preserves the last error until the request settles', () => {
  const failed = conversationListLoadReducer(initialConversationListLoadState, {
    type: 'failed',
  });
  assert.equal(
    conversationListLoadReducer(failed, { type: 'started', visible: false }).error,
    'Couldn’t load conversations',
  );
});

test('conversation rows take precedence over a background refresh error', () => {
  assert.equal(
    getConversationListView({
      isLoading: false,
      error: 'Couldn’t load conversations',
      conversationCount: 1,
    }),
    'list',
  );
  assert.equal(
    getConversationListView({ isLoading: true, error: null, conversationCount: 0 }),
    'loading',
  );
  assert.equal(
    getConversationListView({
      isLoading: false,
      error: 'Couldn’t load conversations',
      conversationCount: 0,
    }),
    'error',
  );
  assert.equal(
    getConversationListView({ isLoading: false, error: null, conversationCount: 0 }),
    'empty',
  );
});
