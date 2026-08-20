import assert from 'node:assert/strict';
import test from 'node:test';

const chatHeaderModel = await import('./chatHeaderModel.js').catch(() => ({}));

test('active conversation title follows the selected conversation', () => {
  assert.equal(typeof chatHeaderModel.getActiveConversationTitle, 'function');

  const conversations = [
    { id: 'conversation-1', title: 'First conversation' },
    { id: 'conversation-2', title: 'Selected conversation' },
  ];

  assert.equal(
    chatHeaderModel.getActiveConversationTitle(conversations, 'conversation-2'),
    'Selected conversation',
  );
});

test('active conversation title is absent on the new-chat route', () => {
  assert.equal(typeof chatHeaderModel.getActiveConversationTitle, 'function');
  assert.equal(chatHeaderModel.getActiveConversationTitle([], null), null);
});

test('route conversation identity wins while a newly selected chat is loading', () => {
  assert.equal(typeof chatHeaderModel.getActiveConversationId, 'function');
  assert.equal(
    chatHeaderModel.getActiveConversationId('route-conversation', 'previous-conversation'),
    'route-conversation',
  );
  assert.equal(
    chatHeaderModel.getActiveConversationId(null, 'streaming-conversation'),
    'streaming-conversation',
  );
});

test('conversation rename rejects blank input and normalizes valid titles', () => {
  assert.equal(typeof chatHeaderModel.prepareConversationRename, 'function');
  assert.equal(chatHeaderModel.prepareConversationRename('   '), null);
  assert.equal(
    chatHeaderModel.prepareConversationRename('  Updated conversation title  '),
    'Updated conversation title',
  );
});
