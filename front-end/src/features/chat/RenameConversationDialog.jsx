/**
 * RenameConversationDialog
 *
 * Self-contained dialog for renaming a conversation. Extracted from
 * MainInterface so the application shell does not own conversation CRUD UI.
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { memo, useMemo } from 'react';
import { getAppPanelSurfaceSx } from '@/features/styles/interfaceChrome';
import { getInteractiveControlSx } from '@/styles/shared';

function RenameConversationDialog({ open, title, onClose, onChange, onConfirm }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const paperSx = useMemo(
    () => ({
      borderRadius: '14px',
      border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.12 : 0.08)}`,
      ...getAppPanelSurfaceSx(theme),
      boxShadow: 'none',
    }),
    [isDark, theme],
  );

  const fieldSx = useMemo(
    () => ({
      '& .MuiOutlinedInput-root': {
        borderRadius: '8px',
        ...theme.typography.uiInput,
      },
      '& .MuiInputLabel-root': {
        ...theme.typography.uiCaptionMd,
      },
    }),
    [theme],
  );

  const actionsSx = useMemo(
    () => ({
      px: 3,
      pb: 2.5,
      pt: 1,
      gap: 1,
      '& .MuiButton-root': {
        minHeight: 34,
        borderRadius: '8px',
        px: 1.5,
        textTransform: 'none',
        ...theme.typography.uiNavItem,
      },
    }),
    [theme],
  );

  const cancelButtonSx = useMemo(
    () => getInteractiveControlSx(theme, { size: 34, radius: '8px' }),
    [theme],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        component: 'form',
        onSubmit: (e) => {
          e.preventDefault();
          onConfirm?.();
        },
        sx: paperSx,
      }}
    >
      <DialogTitle
        sx={{
          ...theme.typography.uiCardTitle,
          fontWeight: 700,
          px: 3,
          pt: 2.5,
          pb: 1,
        }}
      >
        Rename conversation
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 1 }}>
        <TextField
          autoFocus
          fullWidth
          label="Conversation title"
          variant="outlined"
          value={title}
          onChange={onChange}
          inputProps={{ maxLength: 80 }}
          sx={fieldSx}
        />
      </DialogContent>

      <DialogActions sx={actionsSx}>
        <Button onClick={onClose} color="inherit" sx={cancelButtonSx}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disableElevation
          disabled={!title?.trim()}
          sx={{ boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
        >
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default memo(RenameConversationDialog);
