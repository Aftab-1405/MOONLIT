import { Box, TextField } from '@mui/material';
import { memo, useRef } from 'react';
import {
  AppPopover,
  AppPopoverEmptyState,
  AppPopoverItem,
  AppPopoverList,
  AppPopoverSectionLabel,
} from '@/components';
import { AddIcon, CheckIcon, DatabaseIcon } from '@/components/icons';
import { HistoryPopoverItem } from '@/features/sidebar-left/components/SidebarPrimitives';
import { getPopoverDividerSx, UI_POPOVER } from '@/styles/shared';

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
  inlineRename,
  handleInlineRenameStart,
  handleInlineRenameChange,
  handleInlineRenameCancel,
  handleInlineRenameCommit,
}) {
  const searchInputRef = useRef(null);
  const historyFirstItemRef = useRef(null);
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
        width={260}
        paperSx={{ mt: 1 }}
      >
        <AppPopoverSectionLabel>Switch database</AppPopoverSectionLabel>
        <AppPopoverList role="menu" aria-label="Databases" maxHeight={280}>
          {availableDatabases.map((db) => {
            const isActive = db === currentDatabase;
            return (
              <AppPopoverItem
                role="menuitemradio"
                ariaChecked={isActive}
                key={db}
                onClick={() => handleDatabaseSelect(db)}
                selected={isActive}
                icon={<DatabaseIcon />}
                label={db}
                reserveTrailing
                trailing={isActive ? <CheckIcon /> : null}
              />
            );
          })}
        </AppPopoverList>
        <Box aria-hidden sx={getPopoverDividerSx(theme, { my: 0.5 })} />
        <AppPopoverItem
          role="menuitem"
          onClick={handleOpenNewConnection}
          icon={<AddIcon />}
          label="New connection"
        />
      </AppPopover>

      <AppPopover
        open={isSearchPopoverOpen}
        anchorEl={searchPopoverAnchor}
        onClose={handleCloseSearchPopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        paperSx={{ mt: 1 }}
        width={280}
        slotProps={{
          transition: {
            onEntered: () => searchInputRef.current?.focus(),
          },
        }}
      >
        <TextField
          inputRef={searchInputRef}
          fullWidth
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search chats"
          size="small"
          variant="standard"
          InputProps={{ disableUnderline: true }}
          sx={{
            px: 1,
            py: 0.5,
            minHeight: UI_POPOVER.rowMinHeight,
            mb: 0.5,
            borderRadius: '8px',
            border: 0,
            backgroundColor: theme.palette.background.input,
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
        <AppPopoverList role="list" aria-label="Search results" maxHeight={360}>
          {searchedConversations.length === 0 ? (
            <Box component="li" sx={{ listStyle: 'none' }}>
              <AppPopoverEmptyState
                aria-live="polite"
                title={conversations.length === 0 ? 'No conversations yet' : 'No matching chats'}
              />
            </Box>
          ) : (
            searchedConversations.map((conv) => (
              <HistoryPopoverItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === currentConversationId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                inlineRename={
                  inlineRename.surface === 'search' && inlineRename.conversationId === conv.id
                    ? inlineRename
                    : null
                }
                renameSurface="search"
                onRenameStart={handleInlineRenameStart}
                onRenameChange={handleInlineRenameChange}
                onRenameCancel={handleInlineRenameCancel}
                onRenameCommit={handleInlineRenameCommit}
                onClosePopover={handleCloseSearchPopover}
                theme={theme}
              />
            ))
          )}
        </AppPopoverList>
      </AppPopover>

      <AppPopover
        open={isHistoryPopoverOpen}
        anchorEl={historyPopoverAnchor}
        onClose={handleCloseHistoryPopover}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        paperSx={{ ml: 1 }}
        width={280}
        slotProps={{
          transition: {
            onEntered: () => historyFirstItemRef.current?.focus(),
          },
        }}
      >
        <AppPopoverSectionLabel>Conversation history</AppPopoverSectionLabel>
        <AppPopoverList role="list" aria-label="Conversation history" maxHeight={360}>
          {conversations.length === 0 ? (
            <Box component="li" sx={{ listStyle: 'none' }}>
              <AppPopoverEmptyState aria-live="polite" title="No conversations yet" />
            </Box>
          ) : (
            conversations.map((conv, index) => (
              <HistoryPopoverItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === currentConversationId}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
                inlineRename={
                  inlineRename.surface === 'history' && inlineRename.conversationId === conv.id
                    ? inlineRename
                    : null
                }
                renameSurface="history"
                onRenameStart={handleInlineRenameStart}
                onRenameChange={handleInlineRenameChange}
                onRenameCancel={handleInlineRenameCancel}
                onRenameCommit={handleInlineRenameCommit}
                onClosePopover={handleCloseHistoryPopover}
                autoFocus={index === 0}
                selectionRef={index === 0 ? historyFirstItemRef : undefined}
                theme={theme}
              />
            ))
          )}
        </AppPopoverList>
      </AppPopover>
    </>
  );
}

export default memo(SidebarOverlays);
