import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';

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

// DB-Genie color palette
const palette = {
  primary: {
    main: '#10b981',      // Emerald 500
    light: '#34d399',     // Emerald 400
    dark: '#059669',      // Emerald 600
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#06b6d4',      // Cyan 500
    light: '#22d3ee',     // Cyan 400
    dark: '#0891b2',      // Cyan 600
    contrastText: '#ffffff',
  },
  success: {
    main: '#22c55e',
    light: '#4ade80',
    dark: '#16a34a',
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
  },
  info: {
    main: '#06b6d4',
    light: '#22d3ee',
    dark: '#0891b2',
  },
};

// Common theme settings
const commonSettings = {
  breakpoints: {
    values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
  },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
  },
  shape: { borderRadius: 12 },
};

// Dark theme
const createDarkTheme = () => createTheme({
  ...commonSettings,
  palette: {
    mode: 'dark',
    ...palette,
    background: {
      default: '#0a0a0f',
      paper: '#111118',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#94a3b8',
      disabled: '#475569',
    },
    divider: 'rgba(148, 163, 184, 0.08)',
    action: {
      active: '#f8fafc',
      hover: 'rgba(148, 163, 184, 0.08)',
      selected: 'rgba(148, 163, 184, 0.12)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
    ...Array(19).fill('0 25px 50px -12px rgba(0, 0, 0, 0.6)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#475569 transparent',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#475569', borderRadius: 4 },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, padding: '10px 20px', fontWeight: 500 },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' } },
        outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', borderRadius: 16, backdropFilter: 'blur(20px)' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backdropFilter: 'blur(20px)', background: 'rgba(17, 17, 24, 0.95)', border: '1px solid rgba(148, 163, 184, 0.1)' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRight: '1px solid rgba(148, 163, 184, 0.08)', backgroundImage: 'none' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': { borderColor: 'rgba(148, 163, 184, 0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(6, 182, 212, 0.5)' },
            '&.Mui-focused fieldset': { borderColor: '#10b981', borderWidth: 2 },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 10, transition: 'all 0.2s ease-in-out', '&:hover': { backgroundColor: 'rgba(148, 163, 184, 0.12)' } },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: '#1e293b', borderRadius: 8, fontSize: '0.75rem' },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 12, border: '1px solid rgba(148, 163, 184, 0.1)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { borderRadius: 8, margin: '2px 8px', padding: '8px 12px', '&:hover': { backgroundColor: 'rgba(148, 163, 184, 0.12)' } },
      },
    },
  },
});

// Light theme - Professional and Clean
const createLightTheme = () => createTheme({
  ...commonSettings,
  palette: {
    mode: 'light',
    // Use lighter, softer versions of primary colors for light mode
    primary: {
      main: '#059669',      // Emerald 600 (darker for better contrast)
      light: '#10b981',     // Emerald 500
      dark: '#047857',      // Emerald 700
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0891b2',      // Cyan 600 (darker for better contrast)
      light: '#06b6d4',     // Cyan 500
      dark: '#0e7490',      // Cyan 700
      contrastText: '#ffffff',
    },
    success: {
      main: '#16a34a',      // Green 600
      light: '#22c55e',
      dark: '#15803d',
    },
    error: {
      main: '#dc2626',      // Red 600
      light: '#ef4444',
      dark: '#b91c1c',
    },
    warning: {
      main: '#d97706',      // Amber 600
      light: '#f59e0b',
      dark: '#b45309',
    },
    info: {
      main: '#0284c7',      // Sky 600
      light: '#0ea5e9',
      dark: '#0369a1',
    },
    background: {
      default: '#f8fafc',   // Slate 50 - soft white
      paper: '#ffffff',     // Pure white
    },
    text: {
      primary: '#1e293b',   // Slate 800 - readable dark
      secondary: '#64748b', // Slate 500 - muted
      disabled: '#94a3b8',  // Slate 400
    },
    divider: 'rgba(100, 116, 139, 0.12)', // Slate 500 with transparency
    action: {
      active: '#1e293b',
      hover: 'rgba(100, 116, 139, 0.08)',
      selected: 'rgba(5, 150, 105, 0.12)', // Primary with transparency
      disabled: 'rgba(0, 0, 0, 0.26)',
      disabledBackground: 'rgba(0, 0, 0, 0.12)',
    },
  },
  shadows: [
    'none',
    '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    ...Array(19).fill('0 25px 50px -12px rgba(0, 0, 0, 0.15)'),
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: 4 },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, padding: '10px 20px', fontWeight: 500 },
        contained: { 
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)', 
          '&:hover': { boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)' } 
        },
        outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5, backgroundColor: 'rgba(5, 150, 105, 0.04)' } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { 
          backgroundImage: 'none', 
          borderRadius: 16, 
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid rgba(100, 116, 139, 0.08)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { 
          background: '#ffffff', 
          border: '1px solid rgba(100, 116, 139, 0.12)', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.2)' 
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { 
          borderRight: '1px solid rgba(100, 116, 139, 0.1)', 
          backgroundImage: 'none', 
          backgroundColor: '#f1f5f9', // Slate 100
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(100, 116, 139, 0.1)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#ffffff',
            '& fieldset': { borderColor: 'rgba(100, 116, 139, 0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(5, 150, 105, 0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#059669', borderWidth: 2 },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { 
          borderRadius: 10, 
          transition: 'all 0.2s ease-in-out', 
          '&:hover': { backgroundColor: 'rgba(100, 116, 139, 0.08)' } 
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: '#334155', borderRadius: 8, fontSize: '0.75rem' }, // Slate 700
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { 
          borderRadius: 12, 
          border: '1px solid rgba(100, 116, 139, 0.1)', 
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12)' 
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: { 
          borderRadius: 8, 
          margin: '2px 8px', 
          padding: '8px 12px', 
          '&:hover': { backgroundColor: 'rgba(5, 150, 105, 0.08)' },
          '&.Mui-selected': { backgroundColor: 'rgba(5, 150, 105, 0.12)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        filled: {
          backgroundColor: 'rgba(5, 150, 105, 0.1)',
          color: '#059669',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '&:hover': { backgroundColor: 'rgba(5, 150, 105, 0.06)' },
          '&.Mui-selected': { 
            backgroundColor: 'rgba(5, 150, 105, 0.1)',
            '&:hover': { backgroundColor: 'rgba(5, 150, 105, 0.15)' },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          '&.Mui-selected': { color: '#059669' },
        },
      },
    },
  },
});

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

// Theme Provider Component
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

  // Create theme based on settings
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
