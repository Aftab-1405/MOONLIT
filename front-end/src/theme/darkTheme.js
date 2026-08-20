import { createMoonlitTheme } from '@/theme/createMoonlitTheme';
import { DARK } from '@/theme/tokens';
import { darkSemanticTokens } from '@/theme/tokens/semantic';

let cachedTheme = null;

export const createDarkTheme = () => {
  cachedTheme ||= createMoonlitTheme(darkSemanticTokens, DARK);
  return cachedTheme;
};
