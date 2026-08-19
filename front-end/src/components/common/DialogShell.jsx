import { Box, Dialog, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CloseIcon } from '@/components/icons';
import { getDialogCloseButtonSx } from '@/components/common/dialogActionStyles';
import {
  getDialogFooterSx,
  getDialogHeaderSx,
  getDialogPaperSx,
} from '@/styles/shared';

function DialogShell({
  open,
  onClose,
  isMobile = false,
  maxWidth = 'md',
  fullWidth = true,
  TransitionComponent,
  transitionProps = {},
  desktopMaxHeight = 720,
  desktopMinHeight = 400,
  headerLeading,
  headerIcon,
  headerTitle,
  headerTitleId,
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
        transition: transitionProps,
        backdrop: {
          sx: {
            backgroundColor: theme.palette.overlay.modal,
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
        <Box sx={{ ...getDialogHeaderSx(theme), minHeight: { xs: 60, sm: 64 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
            {headerLeading}
            {headerIcon}
            {headerTitle ? (
              <Typography
                id={headerTitleId}
                variant={titleVariant}
                sx={{ minWidth: 0, fontWeight: 400, letterSpacing: '-0.015em' }}
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
              sx={getDialogCloseButtonSx(theme)}
            >
              <CloseIcon sx={{ fontSize: 19 }} />
            </IconButton>
          ) : null}
        </Box>
      )}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', ...bodySx }}>{children}</Box>
      {footer ? <Box sx={{ ...getDialogFooterSx(theme), ...footerSx }}>{footer}</Box> : null}
    </Dialog>
  );
}

export default DialogShell;
