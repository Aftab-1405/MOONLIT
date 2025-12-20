import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { createDarkTheme, createLightTheme } from '../theme';  // Import from theme.js

// Create context
const ThemeContext = createContext();

// Hook to use theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Settings storage key
const SETTINGS_KEY = 'db-genie-settings';

// Default settings - meaningful for a database query tool
const defaultSettings = {
  // Appearance
  theme: 'dark',
  // Query Execution
  confirmBeforeRun: false,
  queryTimeout: 30,
  // Results Display
  maxRows: 1000,
  nullDisplay: 'NULL',
  // Connection
  rememberConnection: false,
  defaultDbType: 'postgresql',
};

// Theme Provider Component (LOGIC ONLY - no theme definitions)
export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Create theme based on settings - imports from theme.js (Separation of Concerns)
  const theme = useMemo(() => {
    return settings.theme === 'light' ? createLightTheme() : createDarkTheme();
  }, [settings.theme]);

  // Update a single setting
  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Reset to defaults
  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  const value = {
    settings,
    updateSetting,
    resetSettings,
    isDarkMode: settings.theme === 'dark',
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

export default ThemeContext;
