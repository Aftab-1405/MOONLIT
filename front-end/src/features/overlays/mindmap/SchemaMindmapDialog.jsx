// SchemaMindmapDialog — full-screen overlay that renders the database schema
// as an interactive React Flow diagram.
//
// Lifted out of the Sidebar feature into the shell's global-overlay layer so
// that:
//   - It is mounted once at the application shell, not inside a feature.
//   - Its state survives sidebar unmount/remount (e.g. narrow ↔ desktop).
//   - The Sidebar feature stays focused on navigation/list interactions.
//
// The dialog itself is unchanged visually — only its mount point moved.

import { Box, Button, CircularProgress, Dialog, DialogContent, Typography } from '@mui/material';
import { lazy, memo, Suspense } from 'react';
import {
  getDialogHeaderSx,
  getDialogPaperSx,
  getInteractiveControlSx,
  getScrollbarStyles,
} from '@/styles/shared';

const SchemaFlowDiagram = lazy(() => import('@/features/overlays/database/SchemaFlowDiagram'));

const schemaDialogRootSx = {
  pointerEvents: 'none',
  '& .MuiBackdrop-root': {
    pointerEvents: 'auto',
  },
  '& .MuiDialog-container': {
    pointerEvents: 'none',
    transition: 'opacity 300ms ease',
  },
  '& .MuiDialog-paper': {
    pointerEvents: 'auto',
    transition: 'opacity 300ms ease',
  },
  '&.MuiModal-hidden .react-flow': {
    display: 'none',
  },
};

const SchemaMindmapDialog = memo(
  function SchemaMindmapDialog({
    open,
    onClose,
    theme,
    currentDatabase,
    schemaLoading,
    schemaData,
  }) {
    const schemaSurfaceLeft = '0px';
    const schemaSurfaceWidth = '100vw';

    return (
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={false}
        maxWidth={false}
        fullWidth={false}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        keepMounted
        transitionDuration={300}
        sx={schemaDialogRootSx}
        slotProps={{
          backdrop: {
            transitionDuration: 300,
            sx: {
              left: schemaSurfaceLeft,
              width: schemaSurfaceWidth,
              backgroundColor: 'transparent',
            },
          },
        }}
        PaperProps={{
          sx: {
            ...getDialogPaperSx(theme, { isMobile: true }),
            position: 'fixed',
            inset: '0 auto auto auto',
            left: schemaSurfaceLeft,
            top: 0,
            width: schemaSurfaceWidth,
            maxWidth: schemaSurfaceWidth,
            height: '100vh',
            maxHeight: '100vh',
            minHeight: '100vh',
            m: 0,
            borderRadius: 0,
            backgroundColor: theme.palette.background.default,
            boxShadow: 'none',
            opacity: open ? 1 : 0,
            transition: 'opacity 300ms ease',
          },
        }}
      >
        <Box
          sx={{
            ...getDialogHeaderSx(),
            px: { xs: 2.5, sm: 5, md: 8, lg: 10 },
            height: { xs: 'auto', md: 96 },
            pt: { xs: 2, md: 0 },
            pb: { xs: 2, md: 0 },
            alignItems: { xs: 'center', md: 'flex-end' },
            borderBottom: 0,
            maxWidth: 1380,
            mx: 'auto',
            width: '100%',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                ...theme.typography.h3,
                color: 'text.primary',
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentDatabase ? `${currentDatabase} schema` : 'Schema Mindmap'}
            </Typography>
          </Box>
          <Button
            onClick={onClose}
            size="small"
            aria-label="Close schema mindmap"
            sx={{
              ...theme.typography.uiNavItem,
              mb: { xs: 0, md: 1.5 },
              textTransform: 'none',
              fontWeight: 500,
              color: 'text.secondary',
              borderRadius: '8px',
              px: 1.5,
              height: 34,
              ...getInteractiveControlSx(theme, { size: 34, radius: '8px' }),
            }}
          >
            Close
          </Button>
        </Box>

        <DialogContent
          sx={{
            width: '100%',
            maxWidth: 1380,
            mx: 'auto',
            px: { xs: 2.5, sm: 5, md: 8, lg: 10 },
            pt: { xs: 2, md: 4 },
            pb: { xs: 4, md: 6 },
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            contain: 'layout paint style',
            ...getScrollbarStyles(theme),
          }}
        >
          {schemaLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress />
            </Box>
          ) : schemaData ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <Suspense
                  fallback={
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '100%',
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  }
                >
                  <SchemaFlowDiagram
                    active={open}
                    database={schemaData.database}
                    tables={schemaData.tables || []}
                    columns={schemaData.columns || {}}
                  />
                </Suspense>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Typography color="text.secondary">
                No schema data available. Connect to a database first.
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    );
  },
  (prevProps, nextProps) => prevProps.open === nextProps.open,
);

export default SchemaMindmapDialog;
