import { createTheme, alpha } from '@mui/material/styles';

// DB-Genie Premium Dark Theme with Advanced Color Palette
const theme = createTheme({
  // Mobile-first breakpoints
  breakpoints: {
    values: {
      xs: 0,      // Mobile
      sm: 600,    // Tablet
      md: 900,    // Small laptop
      lg: 1200,   // Desktop
      xl: 1536,   // Large screens
    },
  },
  
  palette: {
    mode: 'dark',
    
    // Primary - Vibrant Violet/Indigo
    primary: {
      main: '#8b5cf6',      // Violet 500
      light: '#a78bfa',     // Violet 400
      dark: '#7c3aed',      // Violet 600
      contrastText: '#ffffff',
    },
    
    // Secondary - Electric Cyan
    secondary: {
      main: '#06b6d4',      // Cyan 500
      light: '#22d3ee',     // Cyan 400
      dark: '#0891b2',      // Cyan 600
      contrastText: '#ffffff',
    },
    
    // Background - Deep Space
    background: {
      default: '#0a0a0f',   // Near black with blue tint
      paper: '#12121a',     // Slightly lighter
    },
    
    // Text
    text: {
      primary: '#f8fafc',   // Slate 50
      secondary: '#94a3b8', // Slate 400
      disabled: '#475569',  // Slate 600
    },
    
    // Status colors
    success: {
      main: '#10b981',      // Emerald 500
      light: '#34d399',
      dark: '#059669',
    },
    error: {
      main: '#f43f5e',      // Rose 500
      light: '#fb7185',
      dark: '#e11d48',
    },
    warning: {
      main: '#f59e0b',      // Amber 500
      light: '#fbbf24',
      dark: '#d97706',
    },
    info: {
      main: '#3b82f6',      // Blue 500
      light: '#60a5fa',
      dark: '#2563eb',
    },
    
    // Divider
    divider: 'rgba(148, 163, 184, 0.08)',
    
    // Action states
    action: {
      active: '#f8fafc',
      hover: 'rgba(139, 92, 246, 0.08)',
      selected: 'rgba(139, 92, 246, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
  },

  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
    body1: {
      lineHeight: 1.6,
    },
    body2: {
      lineHeight: 1.5,
    },
  },

  shape: {
    borderRadius: 12,
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
          '&::-webkit-scrollbar': {
            width: 8,
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#475569',
            borderRadius: 4,
          },
        },
      },
    },
    
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 20px',
          fontWeight: 500,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': {
            borderWidth: 1.5,
          },
        },
      },
    },
    
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        },
      },
    },
    
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        },
      },
    },
    
    MuiDialog: {
      styleOverrides: {
        paper: {
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'rgba(18, 18, 26, 0.95)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
        },
      },
    },
    
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(148, 163, 184, 0.08)',
          backgroundImage: 'none',
        },
      },
    },
    
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            '& fieldset': {
              borderColor: 'rgba(148, 163, 184, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(139, 92, 246, 0.5)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#8b5cf6',
              borderWidth: 2,
            },
          },
        },
      },
    },
    
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(139, 92, 246, 0.12)',
          },
        },
      },
    },
    
    MuiAvatar: {
      styleOverrides: {
        root: {
          border: '2px solid rgba(139, 92, 246, 0.3)',
        },
      },
    },
    
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
        },
      },
    },
    
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#1e293b',
          borderRadius: 8,
          fontSize: '0.75rem',
        },
      },
    },
    
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          border: '1px solid rgba(148, 163, 184, 0.1)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        },
      },
    },
    
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          padding: '8px 12px',
          '&:hover': {
            backgroundColor: 'rgba(139, 92, 246, 0.12)',
          },
        },
      },
    },
  },
});

export default theme;
