import { createTheme, responsiveFontSizes, alpha } from '@mui/material/styles';

// ============================================
// 1. SHARED CONFIGURATION
// ============================================

const shape = { borderRadius: 12 };

// Clean, standard breakpoints (removed redundant 'xs: 0')
const breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 900,
    lg: 1200,
    xl: 1536,
  },
};

const typography = {
  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  h1: { fontWeight: 700, fontSize: '3rem', lineHeight: 1.1, letterSpacing: '-0.025em' },
  h2: { fontWeight: 600, fontSize: '2.25rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
  h3: { fontWeight: 600, fontSize: '1.75rem', lineHeight: 1.3, letterSpacing: '-0.015em' },
  h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
  h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 },
  h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },
  subtitle1: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.5 },
  subtitle2: { fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.5 },
  body1: { fontSize: '1rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.5 },
  caption: { fontSize: '0.75rem', lineHeight: 1.4, letterSpacing: '0.02em' },
  overline: { fontSize: '0.625rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.1em', textTransform: 'uppercase' },
  button: { textTransform: 'none', fontWeight: 500, fontSize: '0.875rem' },
};

// ============================================
// 2. PALETTE DEFINITIONS
// ============================================

// MOONLIT GRADIENT - Single source of truth for the brand gradient
const getMoonlitGradient = (theme) => `linear-gradient(135deg, ${theme.palette.info.main}, ${theme.palette.primary.main})`;

// NATURAL MOONLIT EFFECT - Enhanced moonlight-inspired gradients and effects
const getNaturalMoonlitEffects = (theme) => ({
  // Primary moonlit gradient - cool blue to soft silver
  gradient: `linear-gradient(135deg, #E0E7FF, #C7D2FE, #A5B4FC, #818CF8)`,

  // Moonlit glow effect - soft ethereal glow
  glow: `radial-gradient(ellipse at center, rgba(129, 140, 248, 0.15) 0%, rgba(99, 102, 241, 0.08) 40%, transparent 70%)`,

  // Moonlight shadow effect - soft blue-tinted shadow
  shadow: '0 8px 32px rgba(129, 140, 248, 0.12), 0 4px 16px rgba(99, 102, 241, 0.08)',

  // Moonlit text gradient - more subtle and natural
  textGradient: `linear-gradient(135deg, #6366F1, #818CF8, #A5B4FC)`,

  // Moonlit ambient background - very subtle blue tint
  ambient: `radial-gradient(ellipse at top right, rgba(129, 140, 248, 0.03) 0%, transparent 50%)`,

  // Moonlit border - soft blue glow
  border: '1px solid rgba(129, 140, 248, 0.2)',

  // Moonlit hover state - gentle blue enhancement
  hover: 'rgba(129, 140, 248, 0.05)',

  // Moonlit focus state - soft blue ring
  focus: '0 0 0 3px rgba(129, 140, 248, 0.1)',
});

const darkPalette = {
  mode: 'dark',
  primary: { main: '#F1F5F9', light: '#F8FAFC', dark: '#E2E8F0', contrastText: '#0F0F11' },
  secondary: { main: '#27272A', light: '#3F3F46', dark: '#18181B', contrastText: '#F1F5F9' },
  background: { default: '#0F0F11', paper: '#18181B' },
  text: { primary: '#F1F5F9', secondary: '#A1A1AA', disabled: '#52525B' },
  divider: '#27272A',
  action: {
    active: '#F1F5F9',
    hover: 'rgba(255, 255, 255, 0.06)',
    selected: 'rgba(255, 255, 255, 0.10)',
    disabled: 'rgba(255, 255, 255, 0.3)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
  },
  // SEMANTIC COLORS: Improved UX with clear visual feedback
  success: { main: '#10B981', light: '#34D399', dark: '#059669', contrastText: '#FFFFFF' },
  error: { main: '#EF4444', light: '#F87171', dark: '#DC2626', contrastText: '#FFFFFF' },
  warning: { main: '#F59E0B', light: '#FBBF24', dark: '#D97706', contrastText: '#000000' },
  info: { main: '#3B82F6', light: '#60A5FA', dark: '#2563EB', contrastText: '#FFFFFF' },
};

const lightPalette = {
  mode: 'light',
  // Warm, deep brown for primary text - easier on eyes than pure black
  primary: { main: '#2D2A26', light: '#4A453F', dark: '#1A1815', contrastText: '#FFFFFF' },
  // Warm taupe for secondary elements
  secondary: { main: '#8B7969', light: '#A69585', dark: '#6F5F52', contrastText: '#FFFFFF' },
  // Warm cream backgrounds to reduce blue light and eye strain
  background: { 
    default: '#FFF8F3', // Warm cream base
    paper: '#FFFEFA'     // Slightly warmer white
  },
  // Warm, soft text colors for comfortable reading
  text: { 
    primary: '#2D2A26',   // Warm dark brown instead of harsh black
    secondary: '#6B5D54', // Muted warm brown
    disabled: '#A69585'   // Consistent with secondary palette
  },
  // Soft, warm dividers that blend naturally
  divider: '#E8DFD3',
  action: {
    active: '#1A1815',
    hover: 'rgba(45, 42, 38, 0.04)',     // Warm hover state
    selected: 'rgba(45, 42, 38, 0.08)',   // Warm selection
    disabled: 'rgba(45, 42, 38, 0.26)',
    disabledBackground: 'rgba(45, 42, 38, 0.06)', // Warm disabled background
  },
  // SEMANTIC COLORS: Warmer, more soothing variants
  success: { main: '#2E7D32', light: '#4CAF50', dark: '#1B5E20', contrastText: '#FFFFFF' },  // Forest green
  error: { main: '#C62828', light: '#EF5350', dark: '#B71C1C', contrastText: '#FFFFFF' },     // Warm red
  warning: { main: '#F57C00', light: '#FF9800', dark: '#E65100', contrastText: '#000000' },   // Warm orange
  info: { main: '#1565C0', light: '#2196F3', dark: '#0D47A1', contrastText: '#FFFFFF' },      // Warm blue
};

// ============================================
// 3. COMPONENT OVERRIDES
// ============================================

const getComponentOverrides = (mode) => {
  const isDark = mode === 'dark';
  const borderColor = isDark ? '#1F1F1F' : '#E8DFD3';
  const paperBg = isDark ? '#0A0A0A' : '#FFFEFA';

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          // Enhanced scrollbar styling for better UX
          scrollbarWidth: 'thin',
          scrollbarColor: isDark ? '#333 transparent' : '#E8DFD3 transparent',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? '#333' : '#E8DFD3',
            borderRadius: 4,
            '&:hover': { backgroundColor: isDark ? '#555' : '#A69585' },
          },
          // Improved text rendering for light theme
          ...(mode === 'light' && {
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          }),
        },
      },
    },
    MuiButtonBase: { defaultProps: { disableRipple: true } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontWeight: 600,
          textTransform: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          // Better letter spacing for readability
          letterSpacing: '0.01em',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: isDark ? '0 0 0 1px #333' : '0 2px 4px 0 rgba(0,0,0,0.08)',
            transform: 'translateY(-1px)',
          },
          // Subtle background variation for light theme
          ...(mode === 'light' && {
            background: 'linear-gradient(135deg, #FFFEFA 0%, #FFF8F3 100%)',
          }),
        },
        outlined: {
          borderColor: borderColor,
          borderWidth: '1.5px', // Slightly thicker for better visibility
          '&:hover': {
            backgroundColor: isDark ? alpha('#FFFFFF', 0.05) : alpha('#2D2A26', 0.03),
            borderColor: isDark ? '#FFFFFF' : '#2D2A26',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: isDark ? alpha('#FFFFFF', 0.05) : alpha('#2D2A26', 0.04),
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { 
          backgroundImage: 'none', 
          borderRadius: 16,
          // Subtle gradient for light theme papers
          ...(mode === 'light' && {
            background: 'linear-gradient(145deg, #FFFEFA 0%, #FFF8F3 100%)',
          }),
        },
        elevation1: {
          boxShadow: isDark 
            ? 'none' 
            : '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px 0 rgba(0, 0, 0, 0.04)', // Softer shadows
          border: `1px solid ${borderColor}`,
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
            border: `1px solid ${borderColor}`,
            boxShadow: 'none',
        }
      }
    },
    // FORM ELEMENTS - Enhanced for light theme comfort
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: isDark ? '#0A0A0A' : '#FFFEFA',
            // Subtle inner shadow for depth in light theme
            ...(mode === 'light' && {
              boxShadow: 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.04)',
            }),
            '& fieldset': { 
              borderColor: borderColor,
              borderWidth: '1.5px',
            },
            '&:hover fieldset': { 
              borderColor: isDark ? '#52525B' : '#A69585',
            },
            '&.Mui-focused fieldset': { 
              borderColor: isDark ? '#FFFFFF' : '#2D2A26', 
              borderWidth: 2,
              // Subtle glow on focus for light theme
              ...(mode === 'light' && {
                boxShadow: '0 0 0 3px rgba(45, 42, 38, 0.1)',
              }),
            },
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: isDark ? '#52525B' : '#A69585',
          '&.Mui-checked': { color: isDark ? '#FFFFFF' : '#2D2A26' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          letterSpacing: '0.01em',
        },
        filled: {
          backgroundColor: isDark ? '#27272A' : '#FFF8F3',
          color: isDark ? '#EDEDED' : '#2D2A26',
          // Subtle border for better definition in light theme
          ...(mode === 'light' && {
            border: '1px solid #E8DFD3',
          }),
        },
        outlined: {
          borderColor: isDark ? '#52525B' : '#E8DFD3',
          color: isDark ? '#EDEDED' : '#6B5D54',
          '&:hover': {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(45, 42, 38, 0.04)',
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: isDark ? '#111111' : '#2D2A26',
          borderRadius: 8,
          border: `1px solid ${borderColor}`,
          fontSize: '0.875rem',
          fontWeight: 500,
          // Better padding for readability
          padding: '8px 12px',
          // Subtle shadow for light theme
          ...(mode === 'light' && {
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }),
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          border: `1px solid ${borderColor}`,
          boxShadow: isDark ? '0 20px 25px -5px rgba(0, 0, 0, 0.4)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '2px 6px',
          fontSize: '0.875rem',
          minHeight: '40px', // Better touch targets
          '&:hover': {
            backgroundColor: isDark ? '#27272A' : '#FFF8F3',
          },
          '&.Mui-selected': {
            backgroundColor: isDark ? '#27272A' : '#FFF8F3',
            color: isDark ? '#FFFFFF' : '#2D2A26',
            fontWeight: 500,
            '&:hover': { 
              backgroundColor: isDark ? '#3F3F46' : '#E8DFD3',
            },
          },
        },
      },
    },
  };
};

    // ============================================
    // 4. THEME FACTORIES
    // ============================================

    export const createDarkTheme = () => {
      const theme = createTheme({
        breakpoints,
        shape,
        typography,
        palette: darkPalette,
        components: getComponentOverrides('dark'),
      });
      // Add moonlit gradient and natural effects to theme for easy access
      theme.custom = { 
        getMoonlitGradient: () => getMoonlitGradient(theme),
        getNaturalMoonlitEffects: () => getNaturalMoonlitEffects(theme),
      };
      return responsiveFontSizes(theme);
    };

    export const createLightTheme = () => {
      const theme = createTheme({
        breakpoints,
        shape,
        typography,
        palette: lightPalette,
        components: getComponentOverrides('light'),
      });
      // Add moonlit gradient and natural effects to theme for easy access
      theme.custom = { 
        getMoonlitGradient: () => getMoonlitGradient(theme),
        getNaturalMoonlitEffects: () => getNaturalMoonlitEffects(theme),
      };
      return responsiveFontSizes(theme);
    };

    export default createDarkTheme();