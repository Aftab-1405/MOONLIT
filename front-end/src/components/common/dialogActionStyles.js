import { getInteractiveIconButtonSx } from '@/styles/shared';

const CONFIRM_ACTION_HEIGHT = { xs: 44, md: 38 };

export function getDialogCloseButtonSx(theme) {
  return getInteractiveIconButtonSx(theme, {
    size: { xs: 44, md: 34 },
    radius: theme.shape.radius.pill,
  });
}

export function getConfirmActionGeometrySx(theme) {
  return {
    minHeight: CONFIRM_ACTION_HEIGHT,
    height: CONFIRM_ACTION_HEIGHT,
    borderRadius: theme.shape.radius.pill,
  };
}

export { CONFIRM_ACTION_HEIGHT };
