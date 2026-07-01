import { createHighlighter } from 'shiki';

let highlighterInstance = null;
let highlighterPromise = null;

/**
 * Returns a singleton instance of the Shiki highlighter.
 * Lazily loads languages and themes on demand.
 */
export function getShikiHighlighter() {
  if (highlighterInstance) {
    return Promise.resolve(highlighterInstance);
  }
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['dracula-soft', 'github-light'],
      langs: ['sql', 'javascript', 'python', 'json', 'html', 'css', 'bash'],
    }).then((instance) => {
      highlighterInstance = instance;
      return instance;
    });
  }
  return highlighterPromise;
}
