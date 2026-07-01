import { alpha } from '@mui/material/styles';
import {
  getPreferencePanelPaperSx,
  getPreferenceSectionSurfaceSx,
  INTERFACE_RADIUS,
} from '@/features/styles/interfaceChrome';
import {
  getInteractiveControlSx,
  getScrollbarStyles,
  getSegmentedToggleGroupSx,
  UI_Z_INDEX,
} from '@/styles/shared';

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
  '& .MuiBackdrop-root': {
    pointerEvents: 'auto',
  },
  '& .MuiDialog-container': {
    pointerEvents: 'none',
    transition: 'opacity 300ms ease',
  },
  '& .MuiDialog-paper': {
    pointerEvents: 'auto',
    transition: 'opacity 300ms ease',
  },
});

export const getPreferencePaperSx = (theme, left, width) =>
  getPreferencePanelPaperSx(theme, left, width);

export { getPreferenceSectionSurfaceSx };

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
      borderRadius: INTERFACE_RADIUS.control,
      backgroundColor: fieldBg,
      boxShadow: `inset 0 1px 2px ${alpha(theme.palette.common.black, isDark ? 0.12 : 0.04)}`,
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

export const getPreferenceToggleGroupSx = (theme) =>
  getSegmentedToggleGroupSx(theme, { itemMinHeight: 32, itemRadius: INTERFACE_RADIUS.row });

export const getPreferenceButtonSx = (theme, { tone = 'neutral' } = {}) => {
  const interactionTone = tone === 'danger' ? 'error' : tone;
  const color =
    interactionTone === 'neutral'
      ? theme.palette.text.primary
      : theme.palette[interactionTone]?.main || theme.palette.text.primary;

  return {
    ...getInteractiveControlSx(theme, {
      tone: interactionTone,
      size: PREFERENCE_LAYOUT.controlHeight,
      radius: '8px',
    }),
    minHeight: PREFERENCE_LAYOUT.controlHeight,
    px: 1.5,
    textTransform: 'none',
    ...theme.typography.uiNavItem,
    fontWeight: 600,
    color: interactionTone === 'neutral' ? 'text.secondary' : color,
    boxShadow: 'none',
  };
};
