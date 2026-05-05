import { memo } from 'react';
import { Popover } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { getPopoverPaperSx } from '../styles/shared';

/**
 * AppPopover — shared styled Popover shell.
 *
 * Owns all paper styling via getPopoverPaperSx (from styles/shared).
 * Each consumer controls positioning via anchorOrigin/transformOrigin,
 * sizing via `width`, and any per-instance overrides via `paperSx`.
 *
 * For MUI Menu or Select MenuProps, import getPopoverPaperSx directly
 * from '../styles/shared' instead of using this component.
 *
 * Props:
 *   anchorEl        — anchor DOM element
 *   open            — controlled open state
 *   onClose         — close handler
 *   anchorOrigin    — MUI anchorOrigin (default: top-left)
 *   transformOrigin — MUI transformOrigin (default: bottom-left)
 *   width           — number → responsive { xs: min(Npx, calc(100vw-24px)), sm: N }
 *                     or an MUI sx width value. Omit to let content/paperSx control width.
 *   paperSx         — extra sx merged into Paper (e.g. mt, ml, minWidth, maxWidth)
 *   children        — popover content
 *   ...rest         — spread to MUI Popover (aria labels, disablePortal, etc.)
 */
const AppPopover = memo(function AppPopover({
  anchorEl,
  open,
  onClose,
  anchorOrigin = { vertical: 'top', horizontal: 'left' },
  transformOrigin = { vertical: 'bottom', horizontal: 'left' },
  width,
  paperSx,
  children,
  ...rest
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Popover
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      slotProps={{
        paper: {
          sx: {
            ...getPopoverPaperSx(theme, isDark),
            p: 0.75,
            ...(width !== undefined && {
              width:
                typeof width === 'number'
                  ? { xs: `min(${width}px, calc(100vw - 24px))`, sm: width }
                  : width,
            }),
            ...paperSx,
          },
        },
      }}
      {...rest}
    >
      {children}
    </Popover>
  );
});

export default AppPopover;
