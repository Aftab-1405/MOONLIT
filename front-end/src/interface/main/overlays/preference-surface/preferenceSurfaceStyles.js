import { alpha } from '@mui/material/styles';
import { getScrollbarStyles, UI_Z_INDEX } from '../../../../styles/shared';

export const PREFERENCE_LAYOUT = Object.freeze({
  pageMaxWidth: 1380,
  contentMaxWidth: 860,
  navWidth: 204,
  headerHeight: 96,
  controlHeight: 34,
});

export const getPreferenceRootSx = () => ({
  pointerEvents: 'none',
  zIndex: UI_Z_INDEX.mainContentModal,
  '& .MuiBackdrop-root': { pointerEvents: 'auto' },
  '& .MuiDialog-container': { pointerEvents: 'none' },
  '& .MuiDialog-paper': { pointerEvents: 'auto' },
});

export const getPreferencePaperSx = (theme, left, width) => ({
  position: 'fixed',
  inset: '0 auto auto auto',
  left,
  top: 0,
  width,
  maxWidth: width,
  height: '100vh',
  maxHeight: '100vh',
  minHeight: '100vh',
  m: 0,
  borderRadius: 0,
  backgroundColor: theme.palette.background.default,
  backgroundImage: 'none',
  boxShadow: 'none',
});

export const getPreferenceBackdropSx = (left, width) => ({
  left,
  width,
  backgroundColor: 'transparent',
});

export const getPreferenceBodySx = (theme) => ({
  display: 'block',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  backgroundColor: theme.palette.background.default,
  ...getScrollbarStyles(theme),
});

export const getPreferenceControlSx = (theme, { minWidth = 132 } = {}) => {
  const isDark = theme.palette.mode === 'dark';
  const fieldBg = alpha(theme.palette.text.primary, isDark ? 0.075 : 0.045);
  const fieldHoverBg = alpha(theme.palette.text.primary, isDark ? 0.1 : 0.065);
  const borderColor = alpha(theme.palette.text.primary, isDark ? 0.12 : 0.1);
  const focusColor = theme.palette.border?.focus || theme.palette.primary.main;

  return {
    minWidth,
    '& .MuiInputBase-root': {
      minHeight: PREFERENCE_LAYOUT.controlHeight,
      borderRadius: '8px',
      backgroundColor: fieldBg,
      transition: theme.transitions.create(['background-color', 'box-shadow'], {
        duration: theme.transitions.duration.shorter,
      }),
      '&:hover': {
        backgroundColor: fieldHoverBg,
      },
      '&.Mui-focused': {
        backgroundColor: fieldHoverBg,
        boxShadow: `0 0 0 2px ${alpha(focusColor, isDark ? 0.26 : 0.18)}`,
      },
      '&.Mui-disabled': {
        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.045 : 0.03),
      },
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor,
      transition: theme.transitions.create('border-color', {
        duration: theme.transitions.duration.shorter,
      }),
    },
    '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: alpha(theme.palette.text.primary, isDark ? 0.18 : 0.15),
    },
    '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'transparent',
    },
    '& .MuiInputBase-input': {
      ...theme.typography.uiInput,
      py: 0.875,
      color: 'text.primary',
      '&::placeholder': {
        color: 'text.disabled',
        opacity: 1,
      },
    },
    '& .MuiInputLabel-root': {
      ...theme.typography.uiCaptionMd,
      color: 'text.secondary',
      '&.Mui-focused': {
        color: 'text.secondary',
      },
    },
    '& .MuiFormHelperText-root': {
      mx: 0,
      mt: 0.75,
      ...theme.typography.uiCaptionMd,
    },
    '& .MuiSelect-select': {
      py: 0,
      pr: '30px !important',
      pl: '10px',
      minHeight: PREFERENCE_LAYOUT.controlHeight,
      display: 'flex',
      alignItems: 'center',
      ...theme.typography.uiNavItem,
      fontWeight: 500,
      color: 'text.primary',
    },
    '& .MuiSelect-icon': {
      color: 'text.secondary',
      opacity: 0.72,
    },
  };
};

export const getPreferenceToggleGroupSx = (theme) => {
  const isDark = theme.palette.mode === 'dark';
  const activeBg = alpha(theme.palette.text.primary, isDark ? 0.13 : 0.08);
  const hoverBg = alpha(theme.palette.text.primary, isDark ? 0.08 : 0.05);

  return {
    p: 0.375,
    gap: 0.25,
    borderRadius: '10px',
    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.035),
    '& .MuiToggleButtonGroup-grouped': {
      minHeight: 30,
      px: 1.25,
      py: 0,
      gap: 0.75,
      border: 'none',
      borderRadius: '8px !important',
      textTransform: 'none',
      ...theme.typography.uiNavItem,
      fontWeight: 500,
      color: 'text.secondary',
      transition: theme.transitions.create(['background-color', 'color'], {
        duration: theme.transitions.duration.shorter,
      }),
      '&:hover': {
        backgroundColor: hoverBg,
        color: 'text.primary',
      },
      '&.Mui-selected': {
        backgroundColor: activeBg,
        color: 'text.primary',
        '&:hover': {
          backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.16 : 0.1),
        },
      },
      '&.Mui-disabled': {
        border: 'none',
      },
    },
  };
};

export const getPreferenceButtonSx = (theme, { tone = 'neutral' } = {}) => {
  const isDark = theme.palette.mode === 'dark';
  const color = tone === 'danger' ? theme.palette.error.main : theme.palette.text.primary;

  return {
    minHeight: PREFERENCE_LAYOUT.controlHeight,
    borderRadius: '8px',
    px: 1.5,
    textTransform: 'none',
    ...theme.typography.uiNavItem,
    fontWeight: 600,
    color: tone === 'neutral' ? 'text.secondary' : color,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    '&:hover': {
      color: tone === 'neutral' ? 'text.primary' : color,
      backgroundColor: alpha(color, tone === 'neutral' ? (isDark ? 0.08 : 0.05) : (isDark ? 0.09 : 0.055)),
      boxShadow: 'none',
    },
  };
};
