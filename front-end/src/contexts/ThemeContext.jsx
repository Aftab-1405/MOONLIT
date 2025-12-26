/**
 * ThemeContext - MUI Theme Provider with Settings Integration
 * 
 * SEPARATION OF CONCERNS:
 * - SettingsContext: Manages all user preferences (persistence, updates)
 * - ThemeContext: Consumes theme setting to create MUI theme object
 * 
 * This context provides:
 * 1. MUI ThemeProvider with dark/light theme based on settings
 * 2. Backwards-compatible access to settings via useTheme hook
 * 
 * For new code, prefer using useSettings() directly from SettingsContext.
 * The useTheme() hook is maintained for backwards compatibility.
 * 
 * @module ThemeContext
 */

import { createContext, useContext, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { createDarkTheme, createLightTheme } from '../theme';
import { useSettings, SettingsProvider } from './SettingsContext';

// =============================================================================
// CONTEXT CREATION
// =============================================================================

const ThemeContext = createContext(null);

// =============================================================================
// CUSTOM HOOK
// =============================================================================

/**
 * Hook to access theme and settings.
 * 
 * For new code, consider using useSettings() directly for settings access:
 * - useSettings() - For reading/writing user preferences
 * - useTheme() - For theme + legacy settings access (backwards compatible)
 * 
 * @returns {Object} Theme state including settings, updateSetting, etc.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// =============================================================================
// INNER THEME PROVIDER
// =============================================================================
// This component consumes SettingsContext and provides the MUI theme

function ThemeProviderInner({ children }) {
  const settingsContext = useSettings();
  const { settings, isDarkMode, updateSetting, resetSettings } = settingsContext;
  
  // Create MUI theme based on the theme setting
  // Memoized to prevent unnecessary recalculations
  const theme = useMemo(() => {
    return settings.theme === 'light' ? createLightTheme() : createDarkTheme();
  }, [settings.theme]);
  
  // Backwards-compatible value for useTheme consumers
  const value = {
    settings,
    updateSetting,
    resetSettings,
    isDarkMode,
    toggleTheme: () => updateSetting('theme', settings.theme === 'dark' ? 'light' : 'dark'),
  };
  
  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

// =============================================================================
// PROVIDER COMPONENT
// =============================================================================

/**
 * Combined Settings + Theme provider.
 * Wrap your app with this to enable both useSettings() and useTheme() hooks.
 */
export function ThemeProvider({ children }) {
  return (
    <SettingsProvider>
      <ThemeProviderInner>{children}</ThemeProviderInner>
    </SettingsProvider>
  );
}

export default ThemeContext;
