/**
 * Theme context for the canonical Moonlit dark theme.
 * @module ThemeContext
 */

import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { createDarkTheme } from '@/theme/index';
import { CANONICAL_THEME_MODE, INPUT_MODALITY_ATTRIBUTE, THEME_ATTRIBUTE } from '@/theme/mode';

const ThemeContext = createContext(null);
const EFFECTIVE_THEME = CANONICAL_THEME_MODE;
const IS_DARK_MODE = true;

/** Returns theme-related settings and actions. */
// eslint-disable-next-line react-refresh/only-export-components -- Hook export alongside Provider is valid React pattern
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
function ThemeProviderInner({ children }) {
  const { settings, updateSetting, updateSettings, resetSettings } = useSettings();
  const theme = useMemo(() => createDarkTheme(), []);
  const value = useMemo(
    () => ({
      settings,
      updateSetting,
      updateSettings,
      resetSettings,
      isDarkMode: IS_DARK_MODE,
      effectiveTheme: EFFECTIVE_THEME,
    }),
    [settings, updateSetting, updateSettings, resetSettings],
  );

  useLayoutEffect(() => {
    document.documentElement.style.colorScheme = CANONICAL_THEME_MODE;
    document.documentElement.setAttribute(THEME_ATTRIBUTE, CANONICAL_THEME_MODE);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const markKeyboardInput = () => root.setAttribute(INPUT_MODALITY_ATTRIBUTE, 'keyboard');
    const markPointerInput = () => root.setAttribute(INPUT_MODALITY_ATTRIBUTE, 'pointer');

    document.addEventListener('keydown', markKeyboardInput, true);
    document.addEventListener('pointerdown', markPointerInput, true);
    return () => {
      document.removeEventListener('keydown', markKeyboardInput, true);
      document.removeEventListener('pointerdown', markPointerInput, true);
    };
  }, []);

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

/** App provider that composes SettingsProvider and MUI ThemeProvider. */
export function ThemeProvider({ children }) {
  return (
    <SettingsProvider>
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </SettingsProvider>
  );
}
