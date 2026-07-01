import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Box, Dialog, IconButton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  getDialogFooterSx,
  getDialogHeaderSx,
  getDialogPaperSx,
  getInteractiveIconButtonSx,
} from '@/styles/shared';

function DialogShell({
  open,
  onClose,
  isMobile = false,
  maxWidth = 'md',
  fullWidth = true,
  TransitionComponent,
  desktopMaxHeight = 720,
  desktopMinHeight = 400,
  headerLeading,
  headerIcon,
  headerTitle,
  titleVariant = 'h6',
  showCloseButton = true,
  closeAriaLabel = 'Close dialog',
  ariaLabelledBy,
  ariaDescribedBy,
  container,
  disableAutoFocus = false,
  disableEnforceFocus = false,
  disableRestoreFocus = false,
  keepMounted = false,
  transitionDuration,
  rootSx = {},
  paperSx = {},
  backdropSx = {},
  bodySx = {},
  footer = null,
  footerSx = {},
  children,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      fullScreen={isMobile}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      TransitionComponent={TransitionComponent}
      container={container}
      disableAutoFocus={disableAutoFocus}
      disableEnforceFocus={disableEnforceFocus}
      disableRestoreFocus={disableRestoreFocus}
      keepMounted={keepMounted}
      transitionDuration={transitionDuration}
      sx={rootSx}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: alpha(theme.palette.common.black, isDark ? 0.62 : 0.34),
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            ...backdropSx,
          },
          transitionDuration,
        },
        paper: {
          elevation: 0,
          sx: {
            ...getDialogPaperSx(theme, { isMobile, desktopMaxHeight, desktopMinHeight }),
            isolation: 'isolate',
            ...paperSx,
          },
        },
      }}
    >
      {(headerLeading || headerIcon || headerTitle || showCloseButton) && (
        <Box sx={{ ...getDialogHeaderSx(), minHeight: { xs: 60, sm: 64 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
            {headerLeading}
            {headerIcon}
            {headerTitle ? (
              <Typography
                variant={titleVariant}
                sx={{ minWidth: 0, fontWeight: 650, letterSpacing: '-0.015em' }}
              >
                {headerTitle}
              </Typography>
            ) : null}
          </Box>
          {showCloseButton ? (
            <IconButton
              onClick={onClose}
              size="small"
              aria-label={closeAriaLabel}
              sx={getInteractiveIconButtonSx(theme, { size: 34, radius: '10px' })}
            >
              <CloseRoundedIcon sx={{ fontSize: 19 }} />
            </IconButton>
          ) : null}
        </Box>
      )}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', ...bodySx }}>{children}</Box>
      {footer ? <Box sx={{ ...getDialogFooterSx(), ...footerSx }}>{footer}</Box> : null}
    </Dialog>
  );
}

export default DialogShell;
