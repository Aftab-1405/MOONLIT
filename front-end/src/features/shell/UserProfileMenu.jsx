// UserProfileMenu — the user-account dropdown menu (Settings / Sign out).
//
// Shell chrome: lives at the application-shell level. Its trigger lives in the
// Sidebar footer, which calls `onMenuOpen` to set the anchor element. The
// menu itself is mounted once at the shell so it floats above all three
// columns.

import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Box, Menu, MenuItem, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { memo } from 'react';
import { getPopoverMenuItemSx, getPopoverMenuListSx, getPopoverPaperSx } from '@/styles/shared';

const UserProfileMenu = memo(function UserProfileMenu({
  anchorEl,
  open,
  onClose,
  onOpenSettings,
  onLogout,
  userEmail,
  sidebarOpen,
  theme,
}) {
  const isDark = theme.palette.mode === 'dark';

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'top',
        horizontal: sidebarOpen ? 'left' : 'right',
      }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      MenuListProps={{ sx: getPopoverMenuListSx() }}
      PaperProps={{
        sx: {
          ...getPopoverPaperSx(theme, isDark),
          width: 240,
          p: 0,
          overflow: 'hidden',
        },
      }}
    >
      {/* Email header */}
      <Box sx={{ px: 1, pt: 0.5, pb: 1 }}>
        <Typography
          sx={{
            ...theme.typography.uiCaptionXs,
            color: 'text.secondary',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {userEmail}
        </Typography>
      </Box>
      <MenuItem
        onClick={onOpenSettings}
        data-ui-target="settings_button"
        sx={{ ...getPopoverMenuItemSx(theme) }}
      >
        <SettingsOutlinedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
        <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>
          Settings
        </Typography>
      </MenuItem>
      {/* Separator */}
      <Box
        sx={{
          height: '1px',
          backgroundColor: alpha(theme.palette.text.primary, 0.07),
          my: 0.75,
          mx: 0.5,
        }}
      />
      <MenuItem onClick={onLogout} sx={{ ...getPopoverMenuItemSx(theme) }}>
        <LogoutOutlinedIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
        <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>
          Sign out
        </Typography>
      </MenuItem>
    </Menu>
  );
});

export default UserProfileMenu;
