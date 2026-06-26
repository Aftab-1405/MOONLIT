import { lazy, memo, Suspense, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  List,
  Dialog,
  DialogContent,
  CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { AppPopover } from '@/components';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import { HistoryPopoverItem } from '@/features/sidebar-left/components/SidebarPrimitives';
import { ICON_COL } from '@/features/sidebar-left/styles/sidebarStyles';
import {
  getDialogPaperSx,
  getDialogHeaderSx,
  getInteractionColors,
  getInteractiveControlSx,
  getPopoverSectionLabelSx,
  getSelectableMenuItemSx,
  getScrollbarStyles,
} from '@/styles/shared';

const SchemaFlowDiagram = lazy(() => import('@/features/overlays/database/SchemaFlowDiagram'));

const getPopoverScrollSx = (theme, maxHeight = 360) => ({
  maxHeight,
  overflowY: 'auto',
  mt: 0.5,
  pr: 0.25,
  ...getScrollbarStyles(theme),
});

const getPopoverEmptyStateSx = (theme) => ({
  mx: 0.5,
  px: 1.25,
  py: 1.25,
  borderRadius: '8px',
  border: '1px solid',
  borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.06),
  bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.35 : 0.65),
});

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

const SchemaMindmapDialog = memo(function SchemaMindmapDialog({
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
      <Box sx={{
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
      }}>
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
                fallback={(
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                  </Box>
                )}
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
}, (prevProps, nextProps) => prevProps.open === nextProps.open);

function SidebarOverlays({
  theme,
  isPopoverOpen,
  dbPopoverAnchor,
  handleCloseDbPopover,
  availableDatabases,
  currentDatabase,
  handleDatabaseSelect,
  handleOpenNewConnection,
  isSearchPopoverOpen,
  searchPopoverAnchor,
  handleCloseSearchPopover,
  searchQuery,
  setSearchQuery,
  isHistoryPopoverOpen,
  historyPopoverAnchor,
  handleCloseHistoryPopover,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  mindmapOpen,
  handleCloseMindmap,
  schemaLoading,
  schemaData,
}) {
  const neutralInteraction = useMemo(() => getInteractionColors(theme), [theme]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchedConversations = normalizedSearchQuery
    ? conversations.filter((conv) =>
        (conv.title || 'New Conversation').toLowerCase().includes(normalizedSearchQuery))
    : conversations;

  return (
    <>
      <AppPopover
        open={isPopoverOpen}
        anchorEl={dbPopoverAnchor}
        onClose={handleCloseDbPopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        width={220}
        paperSx={{ mt: 1 }}
      >
        <Typography sx={getPopoverSectionLabelSx(theme)}>
          Switch Database
        </Typography>
        <Box sx={getPopoverScrollSx(theme, 280)}>
          {availableDatabases.map((db) => {
            const isActive = db === currentDatabase;
            return (
              <Box
                component="div"
                role="menuitemradio"
                aria-checked={isActive}
                key={db}
                onClick={() => handleDatabaseSelect(db)}
                sx={{
                  ...getSelectableMenuItemSx(theme, {
                    isActive,
                    minHeight: 36,
                    columns: `${ICON_COL}px minmax(0, 1fr)`,
                    gap: 0,
                  }),
                  height: 36,
                  py: 0,
                  pl: 0,
                  pr: 1,
                  boxShadow: 'none',
                  '&:hover': {
                    boxShadow: 'none',
                  },
                }}
              >
                <Box
                  component="span"
                  aria-hidden
                  sx={{
                    width: ICON_COL,
                    minWidth: ICON_COL,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isActive ? 'success.main' : 'text.secondary',
                  }}
                >
                  {isActive ? (
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <DatabaseIcon sx={{ fontSize: 16 }} />
                  )}
                </Box>
                <Typography
                  sx={{
                    ...theme.typography.uiNavItem,
                    minWidth: 0,
                    color: 'text.primary',
                    fontWeight: isActive ? 500 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'clip',
                    maskImage: 'linear-gradient(to right, black 78%, transparent 98%)',
                    WebkitMaskImage: 'linear-gradient(to right, black 78%, transparent 98%)',
                  }}
                >
                  {db}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ height: '0.5px', backgroundColor: alpha(theme.palette.text.primary, 0.07), my: 0.75, mx: 0.5 }} />
        <Box
          component="div"
          role="menuitem"
          onClick={handleOpenNewConnection}
          sx={{
            ...getSelectableMenuItemSx(theme, {
              minHeight: 36,
              columns: `${ICON_COL}px minmax(0, 1fr)`,
              gap: 0,
            }),
            height: 36,
            py: 0,
            pl: 0,
            pr: 1,
          }}
        >
          <Box
            component="span"
            aria-hidden
            sx={{
              width: ICON_COL,
              minWidth: ICON_COL,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <AddCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
          <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary' }}>
            New Connection
          </Typography>
        </Box>
      </AppPopover>

      <AppPopover
        open={isSearchPopoverOpen}
        anchorEl={searchPopoverAnchor}
        onClose={handleCloseSearchPopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        paperSx={{ mt: 1 }}
        width={280}
      >
        <TextField
          autoFocus
          fullWidth
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search chats"
          size="small"
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{
            px: 1,
            py: 0.75,
            mb: 0.5,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.06),
            backgroundColor: neutralInteraction.hoverBackground,
            transition: theme.transitions.create(['background-color', 'border-color'], {
              duration: theme.transitions.duration.shorter,
            }),
            '&:focus-within': {
              borderColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.18 : 0.14),
              backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.48 : 0.8),
            },
            '& .MuiInputBase-input': {
              ...theme.typography.uiNavItem,
              fontSize: '0.88rem',
              lineHeight: 1.4,
              color: 'text.primary',
              '&::placeholder': {
                color: 'text.secondary',
                opacity: 0.75,
              },
            },
          }}
        />
        <Box sx={getPopoverScrollSx(theme)}>
          {searchedConversations.length === 0 ? (
            <Box
              role="status"
              aria-live="polite"
              sx={getPopoverEmptyStateSx(theme)}
            >
              <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.secondary', lineHeight: 1.35 }}>
                {conversations.length === 0 ? 'No conversations yet' : 'No matching chats'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {searchedConversations.map((conv) => (
                <HistoryPopoverItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === currentConversationId}
                  onSelect={onSelectConversation}
                  onDelete={onDeleteConversation}
                  onRename={onRenameConversation}
                  onClosePopover={handleCloseSearchPopover}
                  theme={theme}
                />
              ))}
            </List>
          )}
        </Box>
      </AppPopover>

      <AppPopover
        open={isHistoryPopoverOpen}
        anchorEl={historyPopoverAnchor}
        onClose={handleCloseHistoryPopover}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        paperSx={{ ml: 1 }}
        width={240}
      >
        <Typography sx={getPopoverSectionLabelSx(theme)}>
          Conversation History
        </Typography>
        <Box sx={getPopoverScrollSx(theme)}>
          {conversations.length === 0 ? (
            <Box
              role="status"
              aria-live="polite"
              sx={getPopoverEmptyStateSx(theme)}
            >
              <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.secondary', lineHeight: 1.35 }}>
                No conversations yet
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {conversations.map((conv) => (
                <HistoryPopoverItem
                  key={conv.id}
                  conv={conv}
                  isActive={conv.id === currentConversationId}
                  onSelect={onSelectConversation}
                  onDelete={onDeleteConversation}
                  onRename={onRenameConversation}
                  onClosePopover={handleCloseHistoryPopover}
                  theme={theme}
                />
              ))}
            </List>
          )}
        </Box>
      </AppPopover>

      <SchemaMindmapDialog
        open={mindmapOpen}
        onClose={handleCloseMindmap}
        theme={theme}
        currentDatabase={currentDatabase}
        schemaLoading={schemaLoading}
        schemaData={schemaData}
      />
    </>
  );
}

export default memo(SidebarOverlays);
