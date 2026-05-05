import { alpha } from '@mui/material/styles';

export const artifactControlButtonSx = (theme, { height = 30 } = {}) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    height,
    minWidth: { xs: 84, sm: 100 },
    maxWidth: { xs: 128, sm: 156 },
    px: 1,
    borderRadius: '8px',
    border: '1px solid',
    borderColor: theme.palette.border.subtle,
    bgcolor: alpha(theme.palette.text.primary, isDark ? 0.055 : 0.035),
    color: 'text.primary',
    cursor: 'pointer',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.12s ease, background-color 0.12s ease',
    '&:hover': {
      borderColor: theme.palette.border.hover,
      bgcolor: alpha(theme.palette.text.primary, isDark ? 0.085 : 0.055),
    },
    '&:focus-visible': {
      outline: `2px solid ${alpha(theme.palette.text.secondary, 0.4)}`,
      outlineOffset: 1,
    },
  };
};
