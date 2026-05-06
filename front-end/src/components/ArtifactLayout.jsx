import { forwardRef, memo } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

export const ArtifactSurface = forwardRef(function ArtifactSurface({ children, sx = {}, component = 'section', ...props }, ref) {
  return (
    <Box
      component={component}
      ref={ref}
      sx={(theme) => ({
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid',
        borderColor: theme.palette.border.subtle,
        borderRadius: '8px',
        bgcolor: 'background.paper',
        boxSizing: 'border-box',
        ...sx,
      })}
      {...props}
    >
      {children}
    </Box>
  );
});

export const ArtifactBody = forwardRef(function ArtifactBody({ children, sx = {}, padded = false, ...props }, ref) {
  return (
    <Box
      ref={ref}
      sx={(theme) => {
        const isDark = theme.palette.mode === 'dark';
        return {
          position: 'relative',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          p: padded ? { xs: 1.25, sm: 1.5 } : 0,
          bgcolor: alpha(theme.palette.background.default, isDark ? 0.36 : 0.42),
          boxSizing: 'border-box',
          ...sx,
        };
      }}
      {...props}
    >
      {children}
    </Box>
  );
});

export function ArtifactToolbar({
  leading,
  center,
  trailing,
  sx = {},
  leadingSx = {},
  centerSx = {},
}) {
  if (!leading && !center && !trailing) return null;
  const hasLeading = Boolean(leading);
  const hasCenter = Boolean(center);
  const hasTrailing = Boolean(trailing);
  const gridTemplateColumns = hasLeading && hasCenter && hasTrailing
    ? 'minmax(0, 1fr) auto minmax(0, 1fr)'
    : hasLeading && hasCenter
      ? 'auto auto'
      : hasCenter && hasTrailing
        ? 'auto auto'
        : hasLeading && hasTrailing
          ? 'minmax(0, 1fr) auto'
          : 'minmax(0, 1fr)';

  return (
    <Box
      sx={(theme) => {
        const isDark = theme.palette.mode === 'dark';
        return {
          display: 'grid',
          gridTemplateColumns,
          alignItems: 'center',
          gap: { xs: 0.75, sm: 1 },
          minHeight: 46,
          minWidth: 0,
          px: { xs: 1, sm: 1.25 },
          py: 0.625,
          flexShrink: 0,
          overflow: 'hidden',
          borderBottom: '1px solid',
          borderColor: theme.palette.border.subtle,
          bgcolor: alpha(theme.palette.background.paper, isDark ? 0.94 : 0.98),
          boxSizing: 'border-box',
          ...sx,
        };
      }}
    >
      {leading && (
        <Box
          sx={{
            gridColumn: hasCenter && !hasTrailing ? 1 : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 0.5,
            minWidth: 0,
            overflow: 'hidden',
            ...leadingSx,
          }}
        >
          {leading}
        </Box>
      )}
      {center && (
        <Box
          sx={{
            gridColumn: hasLeading && hasCenter ? 2 : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            minWidth: 0,
            overflow: 'hidden',
            px: { xs: 0, sm: 0.75 },
            ...centerSx,
          }}
        >
          {center}
        </Box>
      )}
      {trailing && (
        <Box
          sx={{
            gridColumn: hasCenter && hasTrailing ? 3 : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 0.375,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {trailing}
        </Box>
      )}
    </Box>
  );
}

function ArtifactFooter({ children, sx = {}, justifyContent = 'flex-end' }) {
  return (
    <Box
      sx={(theme) => {
        const isDark = theme.palette.mode === 'dark';
        return {
          display: 'flex',
          alignItems: 'center',
          justifyContent,
          gap: { xs: 0.5, sm: 0.75 },
          px: { xs: 1, sm: 1.25 },
          py: 0.75,
          flexShrink: 0,
          minHeight: 48,
          minWidth: 0,
          borderTop: '1px solid',
          borderColor: theme.palette.border.subtle,
          bgcolor: alpha(theme.palette.background.paper, isDark ? 0.96 : 0.98),
          boxSizing: 'border-box',
          ...sx,
        };
      }}
    >
      {children}
    </Box>
  );
}

export function ArtifactCommandBar({
  leading,
  center,
  trailing,
  sx = {},
  centerSx = {},
}) {
  return (
    <ArtifactFooter
      justifyContent="space-between"
      sx={{
        gap: { xs: 0.75, sm: 1 },
        flexWrap: 'nowrap',
        alignItems: 'center',
        minHeight: 50,
        overflow: 'hidden',
        ...sx,
      }}
    >
      {leading && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            minWidth: 0,
            flex: '0 1 auto',
            overflow: 'hidden',
          }}
        >
          {leading}
        </Box>
      )}
      {center && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            minWidth: 0,
            flex: '1 1 auto',
            overflow: 'hidden',
            ...centerSx,
          }}
        >
          {center}
        </Box>
      )}
      {trailing && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 0.5,
            minWidth: 0,
            flex: '0 0 auto',
            overflow: 'hidden',
          }}
        >
          {trailing}
        </Box>
      )}
    </ArtifactFooter>
  );
}

export function ArtifactActions({ children, sx = {} }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.375, flexShrink: 0, ...sx }}>
      {children}
    </Box>
  );
}

export function ArtifactIconButton({
  title,
  ariaLabel,
  onClick,
  children,
  active = false,
  disabled = false,
  buttonProps = {},
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton
          size="small"
          onClick={onClick}
          disabled={disabled}
          aria-label={ariaLabel || title}
          color={active ? 'success' : 'primary'}
          {...buttonProps}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

export const ArtifactEmptyState = memo(function ArtifactEmptyState({
  icon: Icon,
  title,
  subtitle,
  hint,
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.25,
        px: { xs: 2.5, md: 4 },
        py: { xs: 2.5, md: 3.5 },
        color: 'text.secondary',
        textAlign: 'center',
        boxSizing: 'border-box',
        overflow: 'auto',
        '@media (prefers-reduced-motion: no-preference)': {
          animation: 'artifactEmptyIn 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        },
        '@keyframes artifactEmptyIn': {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {Icon && (
        <Box
          sx={(theme) => ({
            width: 44,
            height: 44,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.07 : 0.045),
            border: '1px solid',
            borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.07),
          })}
        >
          <Icon sx={{ fontSize: 22, color: 'text.secondary' }} />
        </Box>
      )}
      <Typography sx={(theme) => ({ ...theme.typography.uiBodySm, fontWeight: 650, color: 'text.primary' })}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={(theme) => ({ ...theme.typography.uiCaptionMd, color: 'text.secondary', maxWidth: 320 })}>
          {subtitle}
        </Typography>
      )}
      {hint}
    </Box>
  );
});
