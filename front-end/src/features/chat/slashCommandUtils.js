/** Return the first slash-command token, without the slash, or null. */
export function extractSlashQuery(message) {
  if (!message?.startsWith('/')) return null;
  const firstToken = message.split(/\s/, 1)[0];
  if (!firstToken) return null;
  return firstToken.slice(1).toLowerCase();
}
