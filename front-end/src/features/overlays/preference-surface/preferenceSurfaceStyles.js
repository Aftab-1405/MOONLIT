import {
  getPreferencePanelPaperSx,
  getPreferenceSectionSurfaceSx,
  INTERFACE_RADIUS,
} from '@/features/styles/interfaceChrome';
import {
  getInteractiveControlSx,
  getOutlinedFieldStateSx,
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
  responsiveControlHeight: { xs: 44, md: 34 },
  responsiveToggleHeight: { xs: 44, md: 32 },
  navHeight: { xs: 44, md: 36 },
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
  const rootSelector = '& .MuiInputBase-root';
  const fieldState = getOutlinedFieldStateSx(theme, {
    rootSelector,
    radius: INTERFACE_RADIUS.control,
  });

  return {
    minWidth,
    [rootSelector]: {
      ...fieldState[rootSelector],
      minHeight: PREFERENCE_LAYOUT.responsiveControlHeight,
      boxShadow: 'none',
      '&.Mui-focused': {
        backgroundColor: theme.palette.background.input,
        outline: 'none',
        boxShadow: 'none',
      },
      '&.Mui-focused:hover': {
        backgroundColor: theme.palette.background.input,
      },
      '&.Mui-disabled': {
        backgroundColor: theme.palette.layer.faint,
      },
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
      minHeight: PREFERENCE_LAYOUT.responsiveControlHeight,
      display: 'flex',
      alignItems: 'center',
      ...theme.typography.uiNavItem,
      fontWeight: 400,
      color: 'text.primary',
    },
    '& .MuiSelect-icon': {
      color: 'text.secondary',
      opacity: 0.72,
    },
  };
};

export const getPreferenceToggleGroupSx = (theme) =>
  getSegmentedToggleGroupSx(theme, {
    itemMinHeight: PREFERENCE_LAYOUT.responsiveToggleHeight,
    itemRadius: `${theme.shape.radius.pill}px`,
  });

export const getPreferenceButtonSx = (theme, { tone = 'neutral' } = {}) => {
  const interactionTone = tone === 'danger' ? 'error' : tone;
  const color =
    interactionTone === 'neutral'
      ? theme.palette.text.primary
      : theme.palette[interactionTone]?.main || theme.palette.text.primary;

  return {
    ...getInteractiveControlSx(theme, {
      tone: interactionTone,
      size: PREFERENCE_LAYOUT.responsiveControlHeight,
      radius: theme.shape.radius.pill,
    }),
    minHeight: PREFERENCE_LAYOUT.responsiveControlHeight,
    px: 1.5,
    textTransform: 'none',
    ...theme.typography.uiNavItem,
    fontWeight: 400,
    color: interactionTone === 'neutral' ? 'text.secondary' : color,
    boxShadow: 'none',
  };
};
