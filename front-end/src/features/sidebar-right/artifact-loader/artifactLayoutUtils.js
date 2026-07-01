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
  return {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: '8px',
    border: '0.5px solid transparent',
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
      boxShadow: `0 0 0 3px ${interaction.focusRing}`,
    },
    '&.Mui-disabled': {
      opacity: 0.68,
      color: theme.palette.text.secondary,
      borderColor: 'transparent',
    },
  };
};
