import { useMemo } from 'react';
import { getInteractionColors } from '@/styles/shared';

export const ARTIFACT_ROOT_SX = {
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

export function useArtifactActions(actions = []) {
  return useMemo(() => actions.filter((action) => action && !action.hidden), [actions]);
}

export const getArtifactActionButtonSx = (theme, { active = false, size = 36 } = {}) => {
  const interaction = getInteractionColors(theme, { active });
  const responsiveSize = { xs: 44, md: size };
  return {
    width: responsiveSize,
    height: responsiveSize,
    minWidth: responsiveSize,
    minHeight: responsiveSize,
    flexShrink: 0,
    borderRadius: theme.shape.radius.pill,
    border: '1px solid transparent',
    color: interaction.color,
    bgcolor: active ? interaction.activeBackground : 'transparent',
    transition: theme.transitions.create(['background-color', 'border-color', 'color', 'opacity'], {
      duration: theme.transitions.duration.shorter,
    }),
    '&:hover': {
      color: interaction.hoverColor,
      bgcolor: active ? interaction.activeHoverBackground : interaction.hoverBackground,
      borderColor: 'transparent',
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${interaction.focusRing}`,
      outlineOffset: 2,
    },
    '&.Mui-disabled': {
      opacity: 0.68,
      color: theme.palette.text.secondary,
      borderColor: 'transparent',
    },
  };
};
