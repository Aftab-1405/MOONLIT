const CONVERSATION_TITLE_MAX_LENGTH = 80;

const LEGACY_GENERATED_TITLE_LENGTHS = [40, 50];

export function buildConversationTitle(content) {
  return String(content || '')
    .trim()
    .slice(0, CONVERSATION_TITLE_MAX_LENGTH);
}

export function getConversationDisplayTitle(title) {
  const normalizedTitle = String(title || '').trim() || 'New Conversation';
  const isLegacyGeneratedTitle = LEGACY_GENERATED_TITLE_LENGTHS.some(
    (length) => normalizedTitle.length === length + 3 && normalizedTitle.endsWith('...'),
  );
  return isLegacyGeneratedTitle ? normalizedTitle.slice(0, -3) : normalizedTitle;
}

export function recoverLegacyConversationTitle(title, firstUserMessage) {
  const normalizedTitle = String(title || '').trim();
  const normalizedMessage = String(firstUserMessage || '').trim();
  if (!normalizedMessage) return normalizedTitle;

  const matchesLegacyGeneratedTitle = LEGACY_GENERATED_TITLE_LENGTHS.some(
    (length) =>
      normalizedMessage.length > length &&
      normalizedTitle === `${normalizedMessage.slice(0, length)}...`,
  );

  return matchesLegacyGeneratedTitle ? buildConversationTitle(normalizedMessage) : normalizedTitle;
}
