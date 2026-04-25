export function normalizeCitationMarkdown(content = '') {
  return String(content)
    .replace(/\r\n/g, '\n')
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, '$1')
    .replace(/\s+#{1,6}\s+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

