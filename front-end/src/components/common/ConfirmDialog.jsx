import { useState, useCallback, memo, useId } from 'react';
import {
  Button,
  Typography,
  Box,
  Zoom,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import DialogShell from '@/components/common/DialogShell';
import ButtonLoadingSpinner from '@/components/common/ButtonLoadingSpinner';
import {
  getInteractiveControlSx,
  getInsetPanelSx,
  getScrollbarStyles,
  UI_Z_INDEX,
} from '@/styles/shared';

const INTENT_CONFIG = {
  default: {
    color: 'primary',
    icon: HelpOutlineRoundedIcon,
  },
  info: {
    color: 'primary',
    icon: InfoOutlinedIcon,
  },
  warning: {
    color: 'warning',
    icon: WarningAmberRoundedIcon,
  },
  danger: {
    color: 'error',
    icon: ErrorOutlineRoundedIcon,
  },
  success: {
    color: 'success',
    icon: CheckCircleOutlineRoundedIcon,
  },
};

const ACTION_BUTTON_HEIGHT = 34;

function getIntentConfig(intent) {
  return INTENT_CONFIG[intent] || INTENT_CONFIG.default;
}

function getPaperMaxWidth(maxWidth) {
  if (maxWidth === 'xs') return 400;
  if (maxWidth === 'sm') return 560;
  if (maxWidth === 'md') return 720;
  return undefined;
}

function getDetailsSx(theme, variant, isDarkMode) {
  const intentColor = variant === 'danger' ? theme.palette.error.main : theme.palette.text.primary;

  return {
    ...getInsetPanelSx(theme, {
      backgroundOpacity: isDarkMode ? 0.12 : 0.04,
      borderRadius: '10px',
    }),
    borderColor: variant === 'danger'
      ? alpha(theme.palette.error.main, isDarkMode ? 0.36 : 0.24)
      : alpha(theme.palette.text.primary, isDarkMode ? 0.12 : 0.1),
    maxHeight: variant === 'code' ? 220 : 180,
    overflow: 'auto',
    color: intentColor,
    p: variant === 'plain' ? 1.5 : 1.5,
    ...getScrollbarStyles(theme),
    ...(variant === 'code'
      ? {
          fontFamily: theme.typography.fontFamilyMono,
          fontSize: theme.typography.uiCodeBlock.fontSize,
          lineHeight: theme.typography.uiCodeBlock.lineHeight,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }
      : {
          ...theme.typography.uiBodySm,
          lineHeight: 1.55,
          overflowWrap: 'anywhere',
        }),
  };
}

/**
 * Generic confirmation dialog for reusable app actions.
 */
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm action',
  description = 'Are you sure you want to proceed?',
  children = null,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  intent = 'default',
  confirmColor,
  icon = null,
  showIcon = false,
  loading,
  loadingText = 'Working...',
  disabled = false,
  maxWidth = 'xs',
  closeOnConfirm = false,
  preventCloseWhileLoading = true,
  details = null,
  detailsLabel,
  detailsVariant = 'plain',
  primaryActionProps = {},
  secondaryActionProps = {},
  contentSx = {},
  footerSx = {},
  paperSx = {},
  rootSx = {},
}) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = useId();
  const descriptionId = useId();
  const [internalLoading, setInternalLoading] = useState(false);

  const intentConfig = getIntentConfig(intent);
  const accentColor = theme.palette[intentConfig.color]?.main || theme.palette.primary.main;
  const resolvedConfirmColor = confirmColor || (intent === 'danger' ? 'error' : intentConfig.color);
  const IconComponent = intentConfig.icon;
  const isControlledLoading = loading !== undefined;
  const isLoading = isControlledLoading ? loading : internalLoading;
  const isActionDisabled = disabled || isLoading;
  const isCloseDisabled = preventCloseWhileLoading && isLoading;
  const { sx: primaryActionSx, ...restPrimaryActionProps } = primaryActionProps;
  const { sx: secondaryActionSx, ...restSecondaryActionProps } = secondaryActionProps;

  const handleConfirm = useCallback(async () => {
    if (isActionDisabled) return;

    if (!isControlledLoading) {
      setInternalLoading(true);
    }

    try {
      await onConfirm?.();
      if (closeOnConfirm) {
        onClose?.();
      }
    } finally {
      if (!isControlledLoading) {
        setInternalLoading(false);
      }
    }
  }, [closeOnConfirm, isActionDisabled, isControlledLoading, onClose, onConfirm]);

  const handleClose = useCallback((event, reason) => {
    if (isCloseDisabled) return;
    onClose?.(event, reason);
  }, [isCloseDisabled, onClose]);

  return (
    <DialogShell
      open={open}
      onClose={handleClose}
      isMobile={false}
      maxWidth={maxWidth}
      desktopMaxHeight="calc(100vh - 32px)"
      desktopMinHeight={0}
      showCloseButton={false}
      TransitionComponent={Zoom}
      transitionDuration={{ enter: 200, exit: 140 }}
      ariaLabelledBy={title ? titleId : undefined}
      ariaDescribedBy={description ? descriptionId : undefined}
      rootSx={{ zIndex: UI_Z_INDEX.confirmModal, ...rootSx }}
      paperSx={{
        width: 'calc(100% - 32px)',
        maxWidth: getPaperMaxWidth(maxWidth),
        height: 'auto',
        minHeight: 0,
        maxHeight: 'calc(100vh - 32px)',
        borderRadius: '16px',
        border: `1px solid ${alpha(theme.palette.text.primary, isDarkMode ? 0.12 : 0.08)}`,
        boxShadow: isDarkMode
          ? `0 18px 48px ${alpha(theme.palette.common.black, 0.42)}`
          : `0 18px 48px ${alpha(theme.palette.common.black, 0.14)}`,
        m: 2,
        ...paperSx,
      }}
      bodySx={{ flexDirection: 'column', minHeight: 0 }}
      footer={(
        <>
          <Button
            {...restSecondaryActionProps}
            size="small"
            variant="text"
            onClick={handleClose}
            color="inherit"
            disabled={isCloseDisabled}
            fullWidth={isCompactMobile}
            sx={{
              minWidth: { xs: '100%', sm: 72 },
              minHeight: ACTION_BUTTON_HEIGHT,
              height: ACTION_BUTTON_HEIGHT,
              borderRadius: '8px',
              px: 1.25,
              py: 0,
              ...theme.typography.uiNavItem,
              fontWeight: 500,
              ...getInteractiveControlSx(theme, { size: ACTION_BUTTON_HEIGHT, radius: '8px' }),
              ...secondaryActionSx,
            }}
          >
            {cancelText}
          </Button>
          <Button
            {...restPrimaryActionProps}
            size="small"
            variant="contained"
            onClick={handleConfirm}
            disabled={isActionDisabled}
            color={resolvedConfirmColor}
            fullWidth={isCompactMobile}
            startIcon={isLoading ? <ButtonLoadingSpinner /> : null}
            sx={{
              minWidth: { xs: '100%', sm: 78 },
              minHeight: ACTION_BUTTON_HEIGHT,
              height: ACTION_BUTTON_HEIGHT,
              borderRadius: '8px',
              px: 1.25,
              py: 0,
              ...theme.typography.uiNavItem,
              fontWeight: 500,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
              '& .MuiButton-startIcon': {
                ml: 0,
                mr: 0.75,
              },
              ...primaryActionSx,
            }}
          >
            {isLoading ? loadingText : confirmText}
          </Button>
        </>
      )}
      footerSx={{
        px: { xs: 2, sm: 3 },
        pt: 0,
        pb: { xs: 2, sm: 3 },
        borderTop: 0,
        justifyContent: 'flex-end',
        gap: 1,
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        flexWrap: 'nowrap',
        bgcolor: 'transparent',
        ...footerSx,
      }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          pt: { xs: 2, sm: 3 },
          pb: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.75,
          minHeight: 0,
          overflow: 'auto',
          ...getScrollbarStyles(theme),
          ...contentSx,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, minWidth: 0 }}>
          {showIcon ? (
            <Box
              aria-hidden="true"
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                color: accentColor,
                backgroundColor: alpha(accentColor, isDarkMode ? 0.16 : 0.1),
                border: `1px solid ${alpha(accentColor, isDarkMode ? 0.28 : 0.18)}`,
              }}
            >
              {icon || <IconComponent sx={{ fontSize: 21 }} />}
            </Box>
          ) : null}
          <Box sx={{ minWidth: 0, pt: showIcon ? 0.15 : 0 }}>
            {title ? (
              <Typography
                id={titleId}
                variant="h6"
                sx={{
                  color: 'text.primary',
                  fontWeight: 650,
                  fontSize: '1.05rem',
                  lineHeight: 1.25,
                  overflowWrap: 'anywhere',
                }}
              >
                {title}
              </Typography>
            ) : null}
            {description ? (
              <Typography
                id={descriptionId}
                sx={{
                  mt: 0.75,
                  ...theme.typography.uiBodySm,
                  color: 'text.secondary',
                  lineHeight: 1.5,
                  overflowWrap: 'anywhere',
                }}
              >
                {description}
              </Typography>
            ) : null}
          </Box>
        </Box>

        {children}

        {details !== null && details !== undefined ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {detailsLabel ? (
              <Typography sx={{ ...theme.typography.uiMonoLabel, color: 'text.disabled' }}>
                {detailsLabel}
              </Typography>
            ) : null}
            <Box sx={getDetailsSx(theme, detailsVariant, isDarkMode)}>
              {details}
            </Box>
          </Box>
        ) : null}
      </Box>
    </DialogShell>
  );
}

export default memo(ConfirmDialog);
