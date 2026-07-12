import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { Box, List, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { memo, useMemo } from 'react';
import { AppPopover } from '@/components';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import { HistoryPopoverItem } from '@/features/sidebar-left/components/SidebarPrimitives';
import { ICON_COL } from '@/features/sidebar-left/styles/sidebarStyles';
import {
  getInteractionColors,
  getPopoverSectionLabelSx,
  getScrollbarStyles,
  getSelectableMenuItemSx,
} from '@/styles/shared';

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
}) {
  const neutralInteraction = useMemo(() => getInteractionColors(theme), [theme]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchedConversations = normalizedSearchQuery
    ? conversations.filter((conv) =>
        (conv.title || 'New Conversation').toLowerCase().includes(normalizedSearchQuery),
      )
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
        <Typography sx={getPopoverSectionLabelSx(theme)}>Switch Database</Typography>
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
                    color: isActive ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {isActive ? (
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <DatabaseIcon sx={{ fontSize: 18 }} />
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
        <Box
          sx={{
            height: '0.5px',
            backgroundColor: alpha(theme.palette.text.primary, 0.07),
            my: 0.75,
            mx: 0.5,
          }}
        />
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
            <AddCircleOutlineRoundedIcon sx={{ fontSize: 18 }} />
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
            borderColor: alpha(
              theme.palette.text.primary,
              theme.palette.mode === 'dark' ? 0.08 : 0.06,
            ),
            backgroundColor: neutralInteraction.hoverBackground,
            transition: theme.transitions.create(['background-color', 'border-color'], {
              duration: theme.transitions.duration.shorter,
            }),
            '&:focus-within': {
              borderColor: alpha(
                theme.palette.text.primary,
                theme.palette.mode === 'dark' ? 0.18 : 0.14,
              ),
              backgroundColor: alpha(
                theme.palette.background.paper,
                theme.palette.mode === 'dark' ? 0.48 : 0.8,
              ),
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
            <Box role="status" aria-live="polite" sx={getPopoverEmptyStateSx(theme)}>
              <Typography
                sx={{ ...theme.typography.uiNavItem, color: 'text.secondary', lineHeight: 1.35 }}
              >
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
        <Typography sx={getPopoverSectionLabelSx(theme)}>Conversation History</Typography>
        <Box sx={getPopoverScrollSx(theme)}>
          {conversations.length === 0 ? (
            <Box role="status" aria-live="polite" sx={getPopoverEmptyStateSx(theme)}>
              <Typography
                sx={{ ...theme.typography.uiNavItem, color: 'text.secondary', lineHeight: 1.35 }}
              >
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
    </>
  );
}

export default memo(SidebarOverlays);
