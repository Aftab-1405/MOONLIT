import { createTheme, responsiveFontSizes } from '@mui/material/styles';

// ============================================
// SHARED SETTINGS (applies to both themes)
// ============================================

// Mobile-first breakpoints
const breakpoints = {
  values: {
    xs: 0,      // Mobile
    sm: 600,    // Tablet
    md: 900,    // Small laptop
    lg: 1200,   // Desktop
    xl: 1536,   // Large screens
  },
};

// Border radius
const shape = { borderRadius: 12 };

// ============================================
// TYPOGRAPHY - Centralized, semantic variants
// ============================================
const typography = {
  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  
  // Hero/Display headings (Landing Page)
  h1: { 
    fontWeight: 700, 
    fontSize: '3rem',        // 48px - Will be responsive via responsiveFontSizes
    lineHeight: 1.1,
    letterSpacing: '-0.02em' 
  },
  h2: { 
    fontWeight: 600, 
    fontSize: '2.25rem',     // 36px
    lineHeight: 1.2,
    letterSpacing: '-0.01em' 
  },
  h3: { 
    fontWeight: 600, 
    fontSize: '1.75rem',     // 28px
    lineHeight: 1.3,
    letterSpacing: '-0.01em' 
  },
  
  // Section headings
  h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },  // 20px
  h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 }, // 18px
  h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },     // 16px
  
  // Subtitles - Component headers, form labels  
  subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },     // 16px medium
  subtitle2: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5 }, // 14px medium
  
  // Body - Primary content (Chat AI/User messages)
  body1: { fontSize: '1rem', lineHeight: 1.6 },      // 16px - optimal for reading
  body2: { fontSize: '0.875rem', lineHeight: 1.5 }, // 14px - secondary content, sidebar
  
  // Meta text
  caption: { fontSize: '0.75rem', lineHeight: 1.4, letterSpacing: '0.02em' }, // 12px - timestamps
  overline: { 
    fontSize: '0.625rem',    // 10px - section labels
    fontWeight: 600, 
    lineHeight: 1.5, 
    letterSpacing: '0.08em',
    textTransform: 'uppercase'
  },
  
  // Buttons - No uppercase
  button: { textTransform: 'none', fontWeight: 500, fontSize: '0.875rem' },
};

// ============================================
// COLOR PALETTES
// ============================================

// Primary - Emerald Green (CTAs, Success, Main Actions)
const primaryColors = {
  main: '#10b981',      // Emerald 500
  light: '#34d399',     // Emerald 400
  dark: '#059669',      // Emerald 600
  contrastText: '#ffffff',
};

// Secondary - Cyan (AI Elements, Highlights, Accents)
const secondaryColors = {
  main: '#06b6d4',      // Cyan 500
  light: '#22d3ee',     // Cyan 400
  dark: '#0891b2',      // Cyan 600
  contrastText: '#ffffff',
};

// Status colors (shared between themes)
const statusColors = {
  success: { main: '#22c55e', light: '#4ade80', dark: '#16a34a' },
  error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
  warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
  info: { main: '#06b6d4', light: '#22d3ee', dark: '#0891b2' },
};

// ============================================
// COMPONENT OVERRIDES - Shared between themes
// ============================================
const getComponentOverrides = (mode) => ({
  // Disable default ripple effect globally, add subtle click transform
  MuiButtonBase: {
    defaultProps: {
      disableRipple: true, // Disable ripple effect globally
    },
    styleOverrides: {
      root: {
        // Subtle click effect using transform
        transition: 'transform 0.1s ease-in-out, opacity 0.1s ease-in-out',
        '&:active': {
          transform: 'scale(0.97)',
          opacity: 0.9,
        },
      },
    },
  },
  
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        scrollbarWidth: 'thin',
        scrollbarColor: mode === 'dark' ? '#475569 transparent' : '#cbd5e1 transparent',
        '&::-webkit-scrollbar': { width: 8 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { 
          backgroundColor: mode === 'dark' ? '#475569' : '#cbd5e1', 
          borderRadius: 4 
        },
      },
    },
  },
  
  MuiButton: {
    defaultProps: {
      disableRipple: true,
    },
    styleOverrides: {
      root: { 
        borderRadius: 10, 
        padding: '10px 20px', 
        fontWeight: 500,
        transition: 'all 0.15s ease-in-out',
        '&:active': {
          transform: 'scale(0.98)',
        },
      },
      contained: { 
        boxShadow: mode === 'dark' ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.12)',
        '&:hover': { 
          boxShadow: mode === 'dark' 
            ? '0 4px 12px rgba(16, 185, 129, 0.3)' 
            : '0 4px 12px rgba(5, 150, 105, 0.25)' 
        },
        '&:active': {
          transform: 'scale(0.98)',
          boxShadow: 'none',
        },
      },
      outlined: { 
        borderWidth: 1.5, 
        '&:hover': { 
          borderWidth: 1.5,
          backgroundColor: mode === 'light' ? 'rgba(5, 150, 105, 0.04)' : undefined,
        } 
      },
    },
  },
  
  MuiPaper: {
    styleOverrides: {
      root: { 
        backgroundImage: 'none', 
        borderRadius: 16, 
        backdropFilter: mode === 'dark' ? 'blur(20px)' : undefined,
        boxShadow: mode === 'light' ? '0 1px 3px rgba(0,0,0,0.08)' : undefined,
        border: mode === 'light' ? '1px solid rgba(100, 116, 139, 0.08)' : undefined,
      },
    },
  },
  
  MuiDialog: {
    styleOverrides: {
      paper: { 
        backdropFilter: mode === 'dark' ? 'blur(20px)' : undefined, 
        background: mode === 'dark' ? 'rgba(17, 17, 24, 0.95)' : '#ffffff', 
        border: mode === 'dark' 
          ? '1px solid rgba(148, 163, 184, 0.1)' 
          : '1px solid rgba(100, 116, 139, 0.12)',
        boxShadow: mode === 'light' ? '0 25px 50px -12px rgba(0, 0, 0, 0.2)' : undefined,
      },
    },
  },
  
  MuiDrawer: {
    styleOverrides: {
      paper: { 
        borderRight: mode === 'dark' 
          ? '1px solid rgba(148, 163, 184, 0.08)' 
          : '1px solid rgba(100, 116, 139, 0.1)', 
        backgroundImage: 'none',
        backgroundColor: mode === 'light' ? '#f1f5f9' : undefined, // Slate 100 for light
      },
    },
  },
  
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        backgroundColor: mode === 'light' ? 'rgba(255, 255, 255, 0.9)' : undefined,
        backdropFilter: mode === 'light' ? 'blur(10px)' : undefined,
        borderBottom: mode === 'light' ? '1px solid rgba(100, 116, 139, 0.1)' : undefined,
      },
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 12,
          backgroundColor: mode === 'light' ? '#ffffff' : undefined,
          '& fieldset': { 
            borderColor: mode === 'dark' 
              ? 'rgba(148, 163, 184, 0.2)' 
              : 'rgba(100, 116, 139, 0.2)' 
          },
          '&:hover fieldset': { 
            borderColor: mode === 'dark' 
              ? 'rgba(6, 182, 212, 0.5)' 
              : 'rgba(5, 150, 105, 0.4)' 
          },
          '&.Mui-focused fieldset': { 
            borderColor: mode === 'dark' ? '#10b981' : '#059669', 
            borderWidth: 2 
          },
        },
      },
    },
  },
  
  MuiIconButton: {
    defaultProps: {
      disableRipple: true,
    },
    styleOverrides: {
      root: { 
        borderRadius: 10, 
        transition: 'all 0.15s ease-in-out', 
        '&:hover': { 
          backgroundColor: mode === 'dark' 
            ? 'rgba(148, 163, 184, 0.12)' 
            : 'rgba(100, 116, 139, 0.08)' 
        },
        '&:active': {
          transform: 'scale(0.92)',
          opacity: 0.85,
        },
      },
    },
  },
  
  MuiAvatar: {
    styleOverrides: {
      root: {
        border: '2px solid rgba(6, 182, 212, 0.3)',
      },
    },
  },
  
  MuiChip: {
    defaultProps: {
      clickable: false, // If clickable, add these styles
    },
    styleOverrides: {
      root: { 
        borderRadius: 8, 
        fontWeight: 500,
        transition: 'all 0.1s ease-in-out',
        '&:active': {
          transform: 'scale(0.95)',
        },
      },
      filled: mode === 'light' ? {
        backgroundColor: 'rgba(5, 150, 105, 0.1)',
        color: '#059669',
      } : undefined,
    },
  },
  
  MuiTooltip: {
    styleOverrides: {
      tooltip: { 
        backgroundColor: mode === 'dark' ? '#1e293b' : '#334155', 
        borderRadius: 8, 
        fontSize: '0.75rem' 
      },
    },
  },
  
  MuiMenu: {
    styleOverrides: {
      paper: { 
        borderRadius: 12, 
        border: mode === 'dark' 
          ? '1px solid rgba(148, 163, 184, 0.1)' 
          : '1px solid rgba(100, 116, 139, 0.1)', 
        boxShadow: mode === 'dark' 
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.5)' 
          : '0 10px 25px -5px rgba(0, 0, 0, 0.12)' 
      },
    },
  },
  
  MuiMenuItem: {
    defaultProps: {
      disableRipple: true,
    },
    styleOverrides: {
      root: { 
        borderRadius: 8, 
        margin: '2px 8px', 
        padding: '8px 12px',
        transition: 'all 0.1s ease-in-out',
        '&:hover': { 
          backgroundColor: mode === 'dark' 
            ? 'rgba(148, 163, 184, 0.12)' 
            : 'rgba(5, 150, 105, 0.08)' 
        },
        '&:active': {
          transform: 'scale(0.98)',
          opacity: 0.9,
        },
        '&.Mui-selected': mode === 'light' ? { 
          backgroundColor: 'rgba(5, 150, 105, 0.12)' 
        } : undefined,
      },
    },
  },
  
  MuiListItemButton: {
    defaultProps: {
      disableRipple: true,
    },
    styleOverrides: {
      root: {
        borderRadius: 8,
        transition: 'all 0.1s ease-in-out',
        '&:hover': { 
          backgroundColor: mode === 'dark' 
            ? 'rgba(148, 163, 184, 0.08)' 
            : 'rgba(5, 150, 105, 0.06)' 
        },
        '&:active': {
          transform: 'scale(0.98)',
          opacity: 0.9,
        },
        '&.Mui-selected': { 
          backgroundColor: mode === 'dark' 
            ? 'rgba(6, 182, 212, 0.1)' 
            : 'rgba(5, 150, 105, 0.1)',
          '&:hover': { 
            backgroundColor: mode === 'dark' 
              ? 'rgba(6, 182, 212, 0.15)' 
              : 'rgba(5, 150, 105, 0.15)' 
          },
        },
      },
    },
  },
  
  MuiTabs: {
    styleOverrides: {
      indicator: { backgroundColor: mode === 'dark' ? '#10b981' : '#059669' },
    },
  },
  
  MuiTab: {
    defaultProps: {
      disableRipple: true,
    },
    styleOverrides: {
      root: {
        transition: 'all 0.1s ease-in-out',
        '&:active': {
          transform: 'scale(0.97)',
        },
        '&.Mui-selected': { color: mode === 'dark' ? '#10b981' : '#059669' },
      },
    },
  },
});

// ============================================
// DARK THEME
// ============================================
export const createDarkTheme = () => {
  let theme = createTheme({
    breakpoints,
    shape,
    typography,
    palette: {
      mode: 'dark',
      primary: primaryColors,
      secondary: secondaryColors,
      ...statusColors,
      background: {
        default: '#0a0a0f',   // Near black, neutral
        paper: '#111118',     // Slightly lighter
      },
      text: {
        primary: '#f8fafc',   // Slate 50
        secondary: '#94a3b8', // Slate 400
        disabled: '#475569',  // Slate 600
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
    components: getComponentOverrides('dark'),
  });
  
  return responsiveFontSizes(theme);
};

// ============================================
// LIGHT THEME
// ============================================
export const createLightTheme = () => {
  let theme = createTheme({
    breakpoints,
    shape,
    typography,
    palette: {
      mode: 'light',
      primary: {
        main: '#059669',      // Emerald 600 (darker for better contrast)
        light: '#10b981',     // Emerald 500
        dark: '#047857',      // Emerald 700
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#0891b2',      // Cyan 600
        light: '#06b6d4',     // Cyan 500
        dark: '#0e7490',      // Cyan 700
        contrastText: '#ffffff',
      },
      success: { main: '#16a34a', light: '#22c55e', dark: '#15803d' },
      error: { main: '#dc2626', light: '#ef4444', dark: '#b91c1c' },
      warning: { main: '#d97706', light: '#f59e0b', dark: '#b45309' },
      info: { main: '#0284c7', light: '#0ea5e9', dark: '#0369a1' },
      background: {
        default: '#f8fafc',   // Slate 50
        paper: '#ffffff',
      },
      text: {
        primary: '#1e293b',   // Slate 800
        secondary: '#64748b', // Slate 500
        disabled: '#94a3b8',  // Slate 400
      },
      divider: 'rgba(100, 116, 139, 0.12)',
      action: {
        active: '#1e293b',
        hover: 'rgba(100, 116, 139, 0.08)',
        selected: 'rgba(5, 150, 105, 0.12)',
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
    components: getComponentOverrides('light'),
  });
  
  return responsiveFontSizes(theme);
};

// Default export for backward compatibility
export default createDarkTheme();
