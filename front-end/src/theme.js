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
// TYPOGRAPHY - Premium, refined type scale
// ============================================
const typography = {
  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  
  // Hero/Display headings
  h1: { 
    fontWeight: 700, 
    fontSize: '3rem',
    lineHeight: 1.1,
    letterSpacing: '-0.025em' 
  },
  h2: { 
    fontWeight: 600, 
    fontSize: '2.25rem',
    lineHeight: 1.2,
    letterSpacing: '-0.02em' 
  },
  h3: { 
    fontWeight: 600, 
    fontSize: '1.75rem',
    lineHeight: 1.3,
    letterSpacing: '-0.015em' 
  },
  
  // Section headings
  h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
  h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 },
  h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },
  
  // Subtitles
  subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5 },
  
  // Body
  body1: { fontSize: '1rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.5 },
  
  // Meta text
  caption: { fontSize: '0.75rem', lineHeight: 1.4, letterSpacing: '0.02em' },
  overline: { 
    fontSize: '0.625rem',
    fontWeight: 600, 
    lineHeight: 1.5, 
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  },
  
  // Buttons
  button: { textTransform: 'none', fontWeight: 500, fontSize: '0.875rem' },
};

// ============================================
// PREMIUM COLOR PALETTES
// ============================================

// Primary - Refined Teal (Premium, Sophisticated)
const primaryColorsDark = {
  main: '#14b8a6',      // Teal 500 - Rich, premium teal
  light: '#2dd4bf',     // Teal 400
  dark: '#0d9488',      // Teal 600
  contrastText: '#ffffff',
};

const primaryColorsLight = {
  main: '#0d9488',      // Teal 600 - Deeper for light mode
  light: '#14b8a6',     // Teal 500
  dark: '#0f766e',      // Teal 700
  contrastText: '#ffffff',
};

// Secondary - Indigo (Elegant accent)
const secondaryColorsDark = {
  main: '#818cf8',      // Indigo 400 - Soft, elegant
  light: '#a5b4fc',     // Indigo 300
  dark: '#6366f1',      // Indigo 500
  contrastText: '#0f0f14',
};

const secondaryColorsLight = {
  main: '#6366f1',      // Indigo 500
  light: '#818cf8',     // Indigo 400
  dark: '#4f46e5',      // Indigo 600
  contrastText: '#ffffff',
};

// Status colors - Refined, muted tones
const statusColorsDark = {
  success: { main: '#22c55e', light: '#4ade80', dark: '#16a34a' },
  error: { main: '#f87171', light: '#fca5a5', dark: '#ef4444' },
  warning: { main: '#fbbf24', light: '#fde047', dark: '#f59e0b' },
  info: { main: '#38bdf8', light: '#7dd3fc', dark: '#0ea5e9' },
};

const statusColorsLight = {
  success: { main: '#16a34a', light: '#22c55e', dark: '#15803d' },
  error: { main: '#dc2626', light: '#ef4444', dark: '#b91c1c' },
  warning: { main: '#d97706', light: '#f59e0b', dark: '#b45309' },
  info: { main: '#0284c7', light: '#0ea5e9', dark: '#0369a1' },
};

// ============================================
// COMPONENT OVERRIDES
// ============================================
const getComponentOverrides = (mode) => ({
  MuiButtonBase: {
    defaultProps: {
      disableRipple: true,
    },
    styleOverrides: {
      root: {
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
        scrollbarColor: mode === 'dark' ? '#3f3f46 transparent' : '#d4d4d8 transparent',
        '&::-webkit-scrollbar': { width: 8 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { 
          backgroundColor: mode === 'dark' ? '#3f3f46' : '#d4d4d8', 
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
        boxShadow: 'none',
        '&:hover': { 
          boxShadow: mode === 'dark' 
            ? '0 4px 12px rgba(20, 184, 166, 0.25)' 
            : '0 4px 12px rgba(13, 148, 136, 0.2)' 
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
          backgroundColor: mode === 'dark' 
            ? 'rgba(20, 184, 166, 0.08)' 
            : 'rgba(13, 148, 136, 0.06)',
        } 
      },
    },
  },
  
  MuiPaper: {
    styleOverrides: {
      root: { 
        backgroundImage: 'none', 
        borderRadius: 16,
        boxShadow: mode === 'dark' 
          ? 'none' 
          : '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
        border: mode === 'dark' 
          ? '1px solid rgba(63, 63, 70, 0.5)' 
          : '1px solid rgba(228, 228, 231, 0.8)',
      },
    },
  },
  
  MuiDialog: {
    styleOverrides: {
      paper: { 
        background: mode === 'dark' ? '#18181b' : '#ffffff',
        border: mode === 'dark' 
          ? '1px solid rgba(63, 63, 70, 0.6)' 
          : '1px solid rgba(228, 228, 231, 0.8)',
        boxShadow: mode === 'dark'
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
      },
    },
  },
  
  MuiDrawer: {
    styleOverrides: {
      paper: { 
        borderRight: mode === 'dark' 
          ? '1px solid rgba(63, 63, 70, 0.5)' 
          : '1px solid rgba(228, 228, 231, 0.8)', 
        backgroundImage: 'none',
        backgroundColor: mode === 'dark' ? '#09090b' : '#fafafa',
      },
    },
  },
  
  MuiAppBar: {
    styleOverrides: {
      root: {
        backgroundImage: 'none',
        backgroundColor: mode === 'dark' ? '#09090b' : 'rgba(250, 250, 250, 0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: mode === 'dark' 
          ? '1px solid rgba(63, 63, 70, 0.5)' 
          : '1px solid rgba(228, 228, 231, 0.8)',
      },
    },
  },
  
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiOutlinedInput-root': {
          borderRadius: 10,
          backgroundColor: mode === 'dark' ? 'rgba(24, 24, 27, 0.5)' : '#ffffff',
          '& fieldset': { 
            borderColor: mode === 'dark' 
              ? 'rgba(63, 63, 70, 0.6)' 
              : 'rgba(228, 228, 231, 1)' 
          },
          '&:hover fieldset': { 
            borderColor: mode === 'dark' 
              ? 'rgba(20, 184, 166, 0.5)' 
              : 'rgba(13, 148, 136, 0.4)' 
          },
          '&.Mui-focused fieldset': { 
            borderColor: mode === 'dark' ? '#14b8a6' : '#0d9488', 
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
            ? 'rgba(63, 63, 70, 0.5)' 
            : 'rgba(228, 228, 231, 0.8)' 
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
        border: mode === 'dark' 
          ? '2px solid rgba(20, 184, 166, 0.3)' 
          : '2px solid rgba(13, 148, 136, 0.25)',
      },
    },
  },
  
  MuiChip: {
    defaultProps: {
      clickable: false,
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
      filled: mode === 'dark' ? {
        backgroundColor: 'rgba(20, 184, 166, 0.15)',
        color: '#2dd4bf',
      } : {
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        color: '#0d9488',
      },
    },
  },
  
  MuiTooltip: {
    styleOverrides: {
      tooltip: { 
        backgroundColor: mode === 'dark' ? '#27272a' : '#3f3f46', 
        borderRadius: 8, 
        fontSize: '0.75rem',
        border: mode === 'dark' ? '1px solid rgba(63, 63, 70, 0.6)' : 'none',
      },
    },
  },
  
  MuiMenu: {
    styleOverrides: {
      paper: { 
        borderRadius: 12, 
        border: mode === 'dark' 
          ? '1px solid rgba(63, 63, 70, 0.6)' 
          : '1px solid rgba(228, 228, 231, 0.8)', 
        boxShadow: mode === 'dark' 
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.4)' 
          : '0 10px 25px -5px rgba(0, 0, 0, 0.08)' 
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
            ? 'rgba(63, 63, 70, 0.5)' 
            : 'rgba(228, 228, 231, 0.8)' 
        },
        '&:active': {
          transform: 'scale(0.98)',
          opacity: 0.9,
        },
        '&.Mui-selected': { 
          backgroundColor: mode === 'dark' 
            ? 'rgba(20, 184, 166, 0.12)' 
            : 'rgba(13, 148, 136, 0.1)' 
        },
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
            ? 'rgba(63, 63, 70, 0.4)' 
            : 'rgba(228, 228, 231, 0.7)' 
        },
        '&:active': {
          transform: 'scale(0.98)',
          opacity: 0.9,
        },
        '&.Mui-selected': { 
          backgroundColor: mode === 'dark' 
            ? 'rgba(20, 184, 166, 0.12)' 
            : 'rgba(13, 148, 136, 0.1)',
          '&:hover': { 
            backgroundColor: mode === 'dark' 
              ? 'rgba(20, 184, 166, 0.18)' 
              : 'rgba(13, 148, 136, 0.15)' 
          },
        },
      },
    },
  },
  
  MuiTabs: {
    styleOverrides: {
      indicator: { backgroundColor: mode === 'dark' ? '#14b8a6' : '#0d9488' },
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
        '&.Mui-selected': { color: mode === 'dark' ? '#14b8a6' : '#0d9488' },
      },
    },
  },

  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 10,
      },
      standardSuccess: {
        backgroundColor: mode === 'dark' 
          ? 'rgba(34, 197, 94, 0.12)' 
          : 'rgba(22, 163, 74, 0.1)',
        color: mode === 'dark' ? '#4ade80' : '#16a34a',
      },
      standardError: {
        backgroundColor: mode === 'dark' 
          ? 'rgba(248, 113, 113, 0.12)' 
          : 'rgba(220, 38, 38, 0.1)',
        color: mode === 'dark' ? '#fca5a5' : '#dc2626',
      },
    },
  },

  MuiSnackbar: {
    styleOverrides: {
      root: {
        '& .MuiAlert-root': {
          boxShadow: mode === 'dark' 
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.4)' 
            : '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

// ============================================
// DARK THEME - Premium Dark
// ============================================
export const createDarkTheme = () => {
  let theme = createTheme({
    breakpoints,
    shape,
    typography,
    palette: {
      mode: 'dark',
      primary: primaryColorsDark,
      secondary: secondaryColorsDark,
      ...statusColorsDark,
      background: {
        default: '#09090b',   // Zinc 950 - True dark
        paper: '#18181b',     // Zinc 900 - Cards, elevated surfaces
      },
      text: {
        primary: '#fafafa',   // Zinc 50 - Crisp white
        secondary: '#a1a1aa', // Zinc 400 - Muted
        disabled: '#52525b',  // Zinc 600
      },
      divider: 'rgba(63, 63, 70, 0.5)', // Zinc 700 with transparency
      action: {
        active: '#fafafa',
        hover: 'rgba(63, 63, 70, 0.4)',
        selected: 'rgba(63, 63, 70, 0.6)',
        disabled: 'rgba(250, 250, 250, 0.3)',
        disabledBackground: 'rgba(250, 250, 250, 0.12)',
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
// LIGHT THEME - Premium Light
// ============================================
export const createLightTheme = () => {
  let theme = createTheme({
    breakpoints,
    shape,
    typography,
    palette: {
      mode: 'light',
      primary: primaryColorsLight,
      secondary: secondaryColorsLight,
      ...statusColorsLight,
      background: {
        default: '#fafafa',   // Zinc 50 - Soft white
        paper: '#ffffff',     // Pure white
      },
      text: {
        primary: '#18181b',   // Zinc 900 - Deep black
        secondary: '#71717a', // Zinc 500 - Muted
        disabled: '#a1a1aa',  // Zinc 400
      },
      divider: 'rgba(228, 228, 231, 0.8)', // Zinc 200
      action: {
        active: '#18181b',
        hover: 'rgba(228, 228, 231, 0.6)',
        selected: 'rgba(13, 148, 136, 0.12)',
        disabled: 'rgba(0, 0, 0, 0.26)',
        disabledBackground: 'rgba(0, 0, 0, 0.12)',
      },
    },
    shadows: [
      'none',
      '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
      '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
      '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
      '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
      '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
      ...Array(19).fill('0 25px 50px -12px rgba(0, 0, 0, 0.1)'),
    ],
    components: getComponentOverrides('light'),
  });
  
  return responsiveFontSizes(theme);
};

// Default export
export default createDarkTheme();
