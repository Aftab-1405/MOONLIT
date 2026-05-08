import { memo, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  List,
  Dialog,
  DialogContent,
  CircularProgress,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { AppPopover } from '../../../components';
import { HistoryPopoverItem } from './SidebarPrimitives';
import { SchemaFlowDiagram } from '../../main/overlays/database';
import {
  getDialogPaperSx,
  getDialogHeaderSx,
  getPopoverSectionLabelSx,
  getSelectableMenuItemSx,
  getScrollbarStyles,
  UI_LAYOUT,
} from '../../../styles/shared';

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
  mindmapOpen,
  handleCloseMindmap,
  schemaLoading,
  schemaData,
  sidebarOpen = true,
}) {
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const sidebarOffset = !isMobile
    ? (sidebarOpen ? UI_LAYOUT.sidebarExpandedWidth : UI_LAYOUT.sidebarCollapsedWidth)
    : 0;
  const schemaSurfaceLeft = `${sidebarOffset}px`;
  const schemaSurfaceWidth = sidebarOffset > 0 ? `calc(100vw - ${sidebarOffset}px)` : '100vw';
  const mainContentContainer = useMemo(
    () => () => (typeof document === 'undefined' ? null : document.getElementById('main-content')),
    [],
  );
  const mainContentDialogRootSx = useMemo(() => ({
    pointerEvents: 'none',
    '& .MuiBackdrop-root': { pointerEvents: 'auto' },
    '& .MuiDialog-container': { pointerEvents: 'none' },
    '& .MuiDialog-paper': { pointerEvents: 'auto' },
  }), []);
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
        <Box sx={{ maxHeight: 280, overflowY: 'auto', mt: 0.5 }}>
          {availableDatabases.map((db) => {
            const isActive = db === currentDatabase;
            return (
              <Box
                component="div"
                role="menuitemradio"
                aria-checked={isActive}
                key={db}
                onClick={() => handleDatabaseSelect(db)}
                sx={getSelectableMenuItemSx(theme, { isActive })}
              >
                <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary', fontWeight: isActive ? 500 : 400 }}>
                  {db}
                </Typography>
                {isActive && <CheckRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />}
              </Box>
            );
          })}
        </Box>
        <Box sx={{ height: '0.5px', backgroundColor: alpha(theme.palette.text.primary, 0.07), my: 0.75, mx: 0.5 }} />
        <Box
          component="div"
          role="menuitem"
          onClick={handleOpenNewConnection}
          sx={getSelectableMenuItemSx(theme, { columns: 'auto minmax(0, 1fr)' })}
        >
          <AddCircleOutlineRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
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
        paperSx={{ mt: 1, p: 0.75 }}
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
            borderRadius: '10px',
            backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.055 : 0.045),
            '& .MuiInputBase-input': {
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
        <Box sx={{ maxHeight: 360, overflowY: 'auto', mt: 0.25 }}>
          {searchedConversations.length === 0 ? (
            <Box sx={{ px: 1, py: 1.5 }}>
              <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.secondary' }}>
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
        <Box sx={{ maxHeight: 360, overflowY: 'auto', mt: 0.5 }}>
          {conversations.length === 0 ? (
            <Box sx={{ px: 1, py: 1.5 }}>
              <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.secondary' }}>
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
                  onClosePopover={handleCloseHistoryPopover}
                  theme={theme}
                />
              ))}
            </List>
          )}
        </Box>
      </AppPopover>

      <Dialog
        open={mindmapOpen}
        onClose={handleCloseMindmap}
        fullScreen={false}
        maxWidth={false}
        fullWidth={false}
        container={mainContentContainer}
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        keepMounted
        transitionDuration={180}
        sx={mainContentDialogRootSx}
        slotProps={{
          backdrop: {
            transitionDuration: 180,
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
            onClick={handleCloseMindmap}
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
              '&:hover': {
                backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.06),
                color: 'text.primary',
              },
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
                <SchemaFlowDiagram
                  database={schemaData.database}
                  tables={schemaData.tables || []}
                  columns={schemaData.columns || {}}
                />
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
    </>
  );
}

export default memo(SidebarOverlays);

