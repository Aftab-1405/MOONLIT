/**
 * SlashCommandMenu — inline command palette triggered by typing "/" at the
 * start of the chat input.
 *
 * Currently supports task-mode selection:
 *   /standard  → set task mode to Standard (50 steps)
 *   /tool      → set task mode to Tool Task (100 steps)
 *   /long      → set task mode to Long Task (200 steps)
 *
 * Why a slash menu instead of a toolbar button?
 * ----------------------------------------------
 * The composer toolbar was getting visually noisy (Database, Schema,
 * SQL Editor, Task Mode, Model, Send). Slash commands are a familiar
 * pattern from Slack / Discord / Notion that keeps the toolbar clean
 * while still giving power users fast, keyboard-driven access to every
 * option. The menu only appears when the user types "/" as the first
 * character — zero chrome at rest.
 *
 * Behavior
 * --------
 * - Opens when message starts with "/" and the user has typed at least
 *   one character after it.
 * - Filters commands by prefix match (case-insensitive).
 * - Keyboard: ArrowUp/Down to move highlight, Enter/Tab to select,
 *   Escape to close without selecting.
 * - Mouse: hover to highlight, click to select.
 * - On select: calls onSelect(command) with the chosen command. The
 *   caller is responsible for stripping the slash text from the input
 *   and applying the command's action.
 * - The menu is positioned absolutely relative to the composer wrapper,
 *   anchored to the top-left of the input area so it floats above the
 *   text field.
 */
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import {
  Box,
  MenuItem,
  Paper,
  Popper,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TASK_MODE_OPTIONS } from '@/config/userSettings';

/**
 * Build the list of available slash commands.
 *
 * Each command has:
 *   - id: stable identifier
 *   - label: what to show in the menu (e.g., "Long Task")
 *   - command: the slash token the user types (e.g., "/long")
 *   - alias: alternative triggers (e.g., "/longtask")
 *   - description: one-line help text
 *   - value: the backend task_mode value to apply
 *   - group: "Task Mode" (used for the section header)
 */
export function buildSlashCommands(currentTaskMode) {
  const commands = [];

  // One command per actionable task-mode option. "Auto" is omitted
  // because it's the default — there's no need for a slash command to
  // return to the default state; just don't set a mode.
  for (const option of TASK_MODE_OPTIONS) {
    if (option.value === 'auto') continue;

    const shorthand =
      option.value === 'normal'
        ? 'standard'
        : option.value === 'tool_task'
          ? 'tool'
          : 'long';
    commands.push({
      id: `mode-${option.value}`,
      label: option.label,
      command: `/${shorthand}`,
      aliases:
        option.value === 'tool_task'
          ? ['/tooltask', '/tool_task']
          : option.value === 'long_task'
            ? ['/longtask', '/long_task']
            : option.value === 'normal'
              ? ['/normal']
              : [],
      description: option.description,
      value: option.value,
      group: 'Task Mode',
      isCurrent: currentTaskMode === option.value,
    });
  }

  return commands;
}

/**
 * Extract the slash query from a message string.
 *
 * Returns null if the message does not start with "/" — the menu should
 * not be shown. Returns the substring after "/" (lowercased for
 * matching) otherwise.
 *
 *   "/long"          → "long"
 *   "/mode analyze"  → "mode"   (only the first token matters for filtering)
 *   "hello /mode"    → null     (slash not at start)
 *   "/"              → ""       (menu open, no filter)
 */
export function extractSlashQuery(message) {
  if (!message || !message.startsWith('/')) return null;
  // Only consider up to the first whitespace — once the user types a
  // space, they've moved past the command token and the menu closes.
  const firstToken = message.split(/\s/, 1)[0];
  if (!firstToken) return null;
  return firstToken.slice(1).toLowerCase();
}

const SlashCommandMenu = memo(function SlashCommandMenu({
  anchorEl,
  query,
  currentTaskMode,
  onSelect,
  onClose,
}) {
  const theme = useTheme();
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef(null);

  const allCommands = useMemo(
    () => buildSlashCommands(currentTaskMode),
    [currentTaskMode],
  );

  // Filter by the typed query. Empty query shows everything.
  const filteredCommands = useMemo(() => {
    if (!query) return allCommands;
    return allCommands.filter((cmd) => {
      const tokens = [cmd.command, ...(cmd.aliases || [])].map((t) =>
        t.toLowerCase(),
      );
      return tokens.some((t) => t.includes(query));
    });
  }, [allCommands, query]);

  // Reset highlight when the filtered list changes.
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Scroll the highlighted item into view.
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.querySelector(
      `[data-slash-index="${highlightedIndex}"]`,
    );
    if (item && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // Listen for keyboard events on the anchor's owner document. We use
  // a capture-phase listener so we can intercept Arrow/Enter/Escape
  // before the TextField processes them.
  //
  // FIX [SCOPE-KEYS]: The listener only intercepts events whose target
  // is inside the composer (anchorEl) or the menu itself (listRef).
  // Without this guard, Arrow/Enter/Tab/Escape from other focusable
  // elements on the page (sidebar, modals, etc.) would be swallowed.
  useEffect(() => {
    if (!anchorEl) return;
    const handleKey = (e) => {
      // Only intercept when focus is inside the composer or the menu.
      const target = e.target;
      const isInsideComposer = anchorEl?.contains?.(target);
      const isInsideMenu = listRef.current?.contains?.(target);
      if (!isInsideComposer && !isInsideMenu) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex((prev) =>
          Math.min(prev + 1, filteredCommands.length - 1),
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filteredCommands[highlightedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(filteredCommands[highlightedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // Capture phase so we beat the TextField's own keydown handler.
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [anchorEl, filteredCommands, highlightedIndex, onSelect, onClose]);

  const handleItemClick = useCallback(
    (cmd) => {
      onSelect(cmd);
    },
    [onSelect],
  );

  const handleItemMouseEnter = useCallback((idx) => {
    setHighlightedIndex(idx);
  }, []);

  if (!anchorEl || filteredCommands.length === 0) return null;

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="top-start"
      modifiers={[
        {
          name: 'offset',
          options: { offset: [0, 8] },
        },
      ]}
      style={{ zIndex: theme.zIndex.modal + 100 }}
    >
      <Paper
        elevation={4}
        sx={{
          width: 320,
          maxWidth: 'calc(100vw - 32px)',
          p: 1,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
          boxShadow: theme.shadows[8],
        }}
      >
        <Typography
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: 'text.secondary',
            px: 1,
            py: 0.5,
          }}
        >
          Slash Commands
        </Typography>
        <Box ref={listRef} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {filteredCommands.map((cmd, idx) => {
            const isHighlighted = idx === highlightedIndex;
            return (
              <MenuItem
                key={cmd.id}
                data-slash-index={idx}
                onClick={() => handleItemClick(cmd)}
                onMouseEnter={() => handleItemMouseEnter(idx)}
                sx={{
                  borderRadius: 1,
                  px: 1,
                  py: 0.85,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 0.25,
                  bgcolor: isHighlighted
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Typography
                    component="code"
                    sx={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'primary.main',
                      mr: 1,
                    }}
                  >
                    {cmd.command}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, flex: 1, color: 'text.primary' }}
                  >
                    {cmd.label}
                  </Typography>
                  {cmd.isCurrent && (
                    <CheckCircleOutlineRoundedIcon
                      sx={{ fontSize: 14, color: 'primary.main' }}
                    />
                  )}
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', pl: 0.5 }}
                >
                  {cmd.description}
                </Typography>
              </MenuItem>
            );
          })}
        </Box>
        <Typography
          sx={{
            fontSize: 10,
            color: 'text.disabled',
            px: 1,
            pt: 0.75,
            mt: 0.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
          }}
        >
          ↑↓ navigate · ↵ select · esc close
        </Typography>
      </Paper>
    </Popper>
  );
});

export default SlashCommandMenu;
