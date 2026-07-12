// MobileSidebarOpenButton — floating button shown on narrow viewports to open
// the sidebar drawer.
//
// Shell chrome: lives at the application-shell level because it is a floating
// overlay control that opens a drawer — not sidebar feature content. The
// sidebar feature owns the drawer; this button just triggers it.

import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { memo } from 'react';
import { getAppPanelSurfaceSx } from '@/features/styles/interfaceChrome';
import { getInteractionColors, getInteractiveIconButtonSx, UI_Z_INDEX } from '@/styles/shared';

const MobileSidebarOpenButton = memo(function MobileSidebarOpenButton({ visible, theme, onOpen }) {
  if (!visible) return null;

  return (
    <Tooltip title="Open sidebar">
      <IconButton
        size="small"
        onClick={onOpen}
        aria-label="Open sidebar"
        sx={{
          position: 'absolute',
          top: 'max(env(safe-area-inset-top), 12px)',
          left: 12,
          zIndex: UI_Z_INDEX.mainContentControl,
          ...getInteractiveIconButtonSx(theme, { size: 44, radius: '8px' }),
          width: 44,
          height: 44,
          ...getAppPanelSurfaceSx(theme),
          boxShadow: (th) =>
            th.palette.mode === 'dark'
              ? `0 4px 14px ${alpha('#000', 0.42)}, 0 0 0 1px ${alpha(th.palette.text.primary, 0.12)}`
              : `0 4px 14px ${alpha('#000', 0.08)}, 0 0 0 1px ${alpha(th.palette.text.primary, 0.08)}`,
          transition: 'box-shadow 160ms ease, background-color 160ms ease',
          '&:hover': {
            backgroundColor: getInteractionColors(theme).hoverBackground,
            boxShadow: (th) =>
              th.palette.mode === 'dark'
                ? `0 6px 18px ${alpha('#000', 0.5)}, 0 0 0 1px ${alpha(th.palette.text.primary, 0.18)}`
                : `0 6px 18px ${alpha('#000', 0.1)}, 0 0 0 1px ${alpha(th.palette.text.primary, 0.12)}`,
          },
        }}
      >
        <MenuRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
});

export default MobileSidebarOpenButton;
