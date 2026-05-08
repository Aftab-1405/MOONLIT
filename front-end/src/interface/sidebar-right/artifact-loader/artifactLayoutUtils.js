import { useMemo } from 'react';
import { alpha } from '@mui/material/styles';

export const ARTIFACT_ROOT_SX = {
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

export const ARTIFACT_STANDALONE_INSET = { xs: 1, sm: 2 };

export function useArtifactActions(actions = []) {
  return useMemo(
    () => actions.filter((action) => action && !action.hidden),
    [actions],
  );
}

export const getArtifactActionButtonSx = (theme, { active = false, size = 36 } = {}) => ({
  width: size,
  height: size,
  flexShrink: 0,
  borderRadius: '8px',
  border: 'none',
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  bgcolor: active ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.1) : 'transparent',
  transition: theme.transitions.create(['background-color', 'color', 'opacity'], {
    duration: theme.transitions.duration.shorter,
  }),
  '&:hover': {
    color: active ? theme.palette.primary.main : theme.palette.text.primary,
    bgcolor: active
      ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.14)
      : alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.05),
  },
  '&.Mui-disabled': {
    opacity: 0.38,
    color: theme.palette.text.disabled,
  },
});
