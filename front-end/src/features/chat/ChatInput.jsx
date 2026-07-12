/**
 * ChatInput — the message composer at the bottom of the chat workspace.
 *
 * Layout:
 *   ┌────────────────────────────────────────────┐
 *   │  multiline text field                       │
 *   ├────────────────────────────────────────────┤
 *   │  [Database] [Schema] [SQL Editor]   [Model] [→] │
 *   └────────────────────────────────────────────┘
 *
 * Features:
 *   - Enter sends; Shift+Enter inserts newline.
 *   - Toolbar buttons open AppPopover menus for database/schema/model selection.
 *   - Context-usage ring on the model button when `usageMetrics` is provided.
 *   - Streaming state: send button becomes stop; input is disabled.
 *   - Mobile: toolbar buttons shrink to icons (SQL Editor) or use smaller
 *     maxWidth; all buttons stay accessible.
 *
 * The composer surface itself uses `getComposerSurfaceSx` (resting) and
 * `getComposerHoverShadow` (hover/focus) from interfaceChrome — those are
 * the single source of truth for the composer's elevation.
 */

import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, keyframes, useTheme } from '@mui/material/styles';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { AppPopover } from '@/components';
import CodeEditorIcon from '@/components/icons/CodeEditorIcon';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import SchemaIcon from '@/components/icons/SchemaIcon';
import SlashCommandMenu, { extractSlashQuery } from '@/features/chat/SlashCommandMenu';
import { getComposerHoverShadow, getComposerSurfaceSx } from '@/features/styles/interfaceChrome';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import {
  getInteractionColors,
  getPopoverSectionLabelSx,
  getSelectableMenuItemSx,
  UI_LAYOUT,
} from '@/styles/shared';
import { BRAND } from '@/theme/tokens';
import logger from '@/utils/logger';

const softReveal = keyframes`
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ContextProgressRing = ({ total, budget, theme }) => {
  if (total == null || budget == null || budget <= 0) return null;
  const ratio = Math.min(1, total / budget);
  const radius = 7;
  const strokeWidth = 2.2;
  const size = 18;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ratio * circumference;

  let color = theme.palette.primary.main;
  if (ratio > 0.9) {
    color = theme.palette.error.main;
  } else if (ratio > 0.75) {
    color = theme.palette.warning.main;
  }

  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      sx={{
        transform: 'rotate(-90deg)',
        transformOrigin: 'center',
        flexShrink: 0,
        display: 'block',
      }}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke={alpha(theme.palette.text.primary, 0.08)}
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.35s ease-in-out',
        }}
      />
    </Box>
  );
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const TruncatedLabel = ({ children, sx = {} }) => (
  <Box
    component="span"
    sx={{
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      ...sx,
    }}
  >
    {children}
  </Box>
);

const ContextUsageBar = ({ label, value, color }) => (
  <Box>
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        mb: 0.5,
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 550 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.78 }}>
        {Math.round(value)}%
      </Typography>
    </Box>
    <LinearProgress
      variant="determinate"
      value={value}
      color={color}
      sx={{
        height: 6,
        borderRadius: 3,
        bgcolor: 'background.default',
      }}
    />
  </Box>
);

const getUsageColor = (value) => {
  if (value > 90) return 'error';
  if (value > 75) return 'warning';
  return 'primary';
};

const ContextUsageTooltip = ({ contextUsage, selectedModel }) => (
  <Box sx={{ width: 252, p: 0.5 }}>
    <Typography variant="body2" sx={{ fontWeight: 650, color: 'inherit', mb: 0.5 }}>
      {selectedModel || 'Select model'}
    </Typography>
    <Box sx={{ display: 'grid', gap: 1.25, mt: 1.5, mb: 1 }}>
      <ContextUsageBar
        label={contextUsage.contextPhase === 'pre_summary' ? 'Summary Trigger' : 'Active Context'}
        value={contextUsage.activePercent}
        color={getUsageColor(contextUsage.activePercent)}
      />
      {contextUsage.modelPercent != null && (
        <ContextUsageBar
          label="Model Capacity"
          value={contextUsage.modelPercent}
          color={getUsageColor(contextUsage.modelPercent)}
        />
      )}
    </Box>
    <Typography
      variant="caption"
      display="block"
      sx={{ color: 'text.secondary', mt: 1, fontSize: '10px', lineHeight: 1.25 }}
    >
      Background context manages these budgets to prevent memory crashes.
    </Typography>
  </Box>
);

function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  isConnected = false,
  dbType = null,
  currentDatabase = null,
  availableDatabases = [],
  availableSchemas = [],
  currentSchema = null,
  onSchemaChange,
  onDatabaseSwitch,
  onOpenSqlEditor,
  selectedProvider = '',
  selectedModel = '',
  providerOptions = [],
  llmOptionsLoading = false,
  onSelectLlm,
  usageMetrics = null,
  // ENH [AUTO-TASK-MODE]: User's task-mode preference ('auto' | 'normal' |
  // 'tool_task' | 'long_task') and the backend-reported effective mode for
  // the current turn (null when not streaming / no turn yet).
  taskMode = 'auto',
  onTaskModeChange = null,
  effectiveTaskMode = null,
  children,
}) {
  const [message, setMessage] = useState('');
  const theme = useTheme();
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [schemaAnchor, setSchemaAnchor] = useState(null);
  const [dbAnchor, setDbAnchor] = useState(null);
  const [llmAnchor, setLlmAnchor] = useState(null);
  // ENH [SLASH-COMMAND]: Ref to the composer wrapper so the slash command
  // menu can anchor to it. The menu only opens when the message starts
  // with "/" — zero chrome at rest.
  const composerRef = useRef(null);

  const isPostgreSQL = useMemo(() => dbType?.toLowerCase() === 'postgresql', [dbType]);

  const connectionMetadataReady = useMemo(
    () => Boolean(isConnected && currentDatabase && dbType),
    [isConnected, currentDatabase, dbType],
  );
  const connectionChipKey = useMemo(
    () => `${dbType || 'unknown'}:${currentDatabase || ''}`,
    [dbType, currentDatabase],
  );
  const showSchemaSelector = useMemo(
    () => connectionMetadataReady && isPostgreSQL && Boolean(currentSchema),
    [connectionMetadataReady, isPostgreSQL, currentSchema],
  );
  const showDatabaseSelector = useMemo(() => connectionMetadataReady, [connectionMetadataReady]);
  const canSwitchDatabase = useMemo(
    () => availableDatabases.length > 1,
    [availableDatabases.length],
  );

  const hasText = useMemo(() => message.trim().length > 0, [message]);

  const neutralInteraction = useMemo(() => getInteractionColors(theme), [theme]);
  const toolbarActionButtonStyles = useMemo(
    () => ({
      height: 30,
      minHeight: 30,
      minWidth: 32,
      // Mobile toolbar buttons get a bit more breathing room so labels don't
      // truncate awkwardly. The previous `min(42vw, 152px)` was too tight —
      // even short labels like "public" got clipped.
      maxWidth: { xs: 'min(46vw, 168px)', sm: 208 },
      flexShrink: 0,
      borderRadius: '8px',
      px: { xs: 1, sm: 1.25 },
      py: 0,
      gap: 0.5,
      justifyContent: 'flex-start',
      borderColor: neutralInteraction.border,
      color: 'text.secondary',
      backgroundColor: 'transparent',
      ...theme.typography.uiBodySm,
      lineHeight: 1,
      transition: theme.transitions.create(
        ['background-color', 'border-color', 'color', 'transform'],
        {
          duration: theme.transitions.duration.shorter,
        },
      ),
      '& .MuiButton-startIcon': {
        m: 0,
        mr: 0.5,
        color: alpha(theme.palette.text.primary, 0.45),
        flexShrink: 0,
        '& > *:nth-of-type(1)': {
          fontSize: 16,
        },
      },
      '& .MuiButton-endIcon': {
        m: 0,
        ml: 0.25,
        color: 'inherit',
        flexShrink: 0,
        opacity: 0.75,
        '& > *:nth-of-type(1)': {
          fontSize: 12,
        },
      },
      '& .MuiButton-iconSizeSmall': {
        '& > *:nth-of-type(1)': {
          fontSize: 16,
        },
      },
      '&:active': { transform: 'translateY(1px)' },
      [HOVER_CAPABLE_QUERY]: {
        '&:hover': {
          borderColor: neutralInteraction.hoverBorder,
          backgroundColor: neutralInteraction.hoverBackground,
          color: 'text.primary',
          '& .MuiButton-startIcon': {
            color: alpha(theme.palette.text.primary, 0.65),
          },
        },
      },
      '&[aria-expanded="true"]': {
        borderColor: neutralInteraction.activeBorder,
        backgroundColor: neutralInteraction.activeBackground,
        color: 'text.primary',
      },
      // Visible focus ring for keyboard navigation — consistent with the rest of the app.
      '&.Mui-focusVisible': {
        outline: `2px solid ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.32 : 0.22)}`,
        outlineOffset: 2,
      },
      '&.Mui-disabled': {
        opacity: 0.68,
        borderColor: 'transparent',
        color: 'text.secondary',
        backgroundColor: 'transparent',
      },
    }),
    [neutralInteraction, theme],
  );

  const errorInteraction = useMemo(() => getInteractionColors(theme, { tone: 'error' }), [theme]);
  const inputSx = useMemo(
    () => ({
      '& .MuiInputBase-root': { p: 0 },
      '& .MuiInputBase-input': {
        py: 0.1,
        ...theme.typography.uiInput,
        lineHeight: 1.55,
        '&::placeholder': {
          color: 'text.secondary',
          opacity: 0.72,
        },
      },
    }),
    [theme],
  );
  const toolbarScrollSx = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
      minWidth: 0,
      flex: 1,
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    }),
    [],
  );
  const sendActionSx = useMemo(
    () => ({
      width: 36,
      height: 36,
      flexShrink: 0,
      borderRadius: '9px',
      // Solid brand purple when there's text to send — the semantic "primary
      // action" signal. Empty state is neutral monochrome. Streaming switches
      // to the error tone (stop button).
      color: isStreaming
        ? theme.palette.error.main
        : hasText
          ? '#ffffff'
          : alpha(theme.palette.text.primary, 0.28),
      backgroundColor: isStreaming
        ? errorInteraction.activeBackground
        : hasText
          ? BRAND.main
          : alpha(theme.palette.text.primary, 0.05),
      border: '1px solid',
      borderColor: isStreaming
        ? alpha(theme.palette.error.main, 0.2)
        : hasText
          ? 'transparent'
          : alpha(theme.palette.text.primary, 0.07),
      // Subtle resting elevation on the active send button.
      boxShadow:
        hasText && !isStreaming
          ? `0 1px 3px ${alpha(BRAND.main, theme.palette.mode === 'dark' ? 0.45 : 0.25)}`
          : 'none',
      transition: theme.transitions.create(
        ['transform', 'background-color', 'color', 'box-shadow', 'border-color'],
        { duration: theme.transitions.duration.shorter },
      ),
      [HOVER_CAPABLE_QUERY]: {
        '&:hover': {
          transform: 'none',
          backgroundColor: isStreaming
            ? errorInteraction.activeHoverBackground
            : hasText
              ? BRAND.dark
              : alpha(theme.palette.text.primary, 0.08),
          color: isStreaming
            ? theme.palette.error.main
            : hasText
              ? '#ffffff'
              : alpha(theme.palette.text.primary, 0.45),
          boxShadow:
            hasText && !isStreaming
              ? `0 2px 8px ${alpha(BRAND.main, theme.palette.mode === 'dark' ? 0.55 : 0.32)}`
              : 'none',
        },
      },
      '&:active': { transform: 'translateY(0) scale(0.97)' },
      '&.Mui-focusVisible': {
        outline: `2px solid ${alpha(BRAND.main, 0.6)}`,
        outlineOffset: 2,
      },
      '&.Mui-disabled': {
        backgroundColor: alpha(theme.palette.text.primary, 0.04),
        borderColor: alpha(theme.palette.text.primary, 0.06),
        color: alpha(theme.palette.text.primary, 0.2),
        boxShadow: 'none',
      },
    }),
    [errorInteraction, hasText, isStreaming, theme],
  );
  const connectedControlSx = useMemo(
    () => ({
      borderColor: neutralInteraction.border,
      [HOVER_CAPABLE_QUERY]: {
        '&:hover': {
          borderColor: neutralInteraction.hoverBorder,
          backgroundColor: neutralInteraction.hoverBackground,
        },
      },
    }),
    [neutralInteraction],
  );
  const composerSurfaceSx = useMemo(() => getComposerSurfaceSx(theme), [theme]);
  const inputPlaceholder = isStreaming
    ? 'Please wait for response to finish...'
    : isConnected
      ? 'Ask about your database… (type / for commands)'
      : 'How can I help you today?… (type / for commands)';

  const selectedProviderOption = useMemo(() => {
    return providerOptions.find((provider) => provider.name === selectedProvider) || null;
  }, [providerOptions, selectedProvider]);
  const activeProviderLabel = selectedProviderOption?.label || selectedProvider || '';
  const llmSections = useMemo(() => {
    return providerOptions
      .filter((provider) => Array.isArray(provider.models) && provider.models.length > 0)
      .map((provider) => ({
        name: provider.name,
        label: provider.label || provider.name,
        models: provider.models,
      }));
  }, [providerOptions]);
  const hasLlmOptions = llmSections.length > 0;
  const contextUsage = useMemo(() => {
    if (!usageMetrics) return null;
    // ENH [CTX-SINGLE-SOURCE]: The back-end now computes the percentages.
    // The front-end does ZERO calculation — just renders the values.
    // This eliminates all sync issues between the indicator and the
    // summarization trigger, because both use the same formula in the
    // same code (build_usage_metrics in stream_events.py).
    //
    // The back-end sends:
    //   activePercent: 0-100 (when this hits 90, summarization triggers)
    //   modelPercent:  0-100 (total payload vs. model's context window)
    //
    // Fallback: for OLD conversations (stored before the back-end computed
    // percentages), compute from raw values so the indicator still works.
    const activePercent =
      usageMetrics.activePercent ??
      (usageMetrics.inputPayloadTokens && usageMetrics.pressureTriggerTokens
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                (usageMetrics.inputPayloadTokens / usageMetrics.pressureTriggerTokens) * 100,
              ),
            ),
          )
        : null);
    const modelPercent =
      usageMetrics.modelPercent ??
      (usageMetrics.inputPayloadTokens &&
      (usageMetrics.modelContextWindow || usageMetrics.totalContextWindow)
        ? Math.min(
            100,
            Math.max(
              0,
              Math.round(
                (usageMetrics.inputPayloadTokens /
                  (usageMetrics.modelContextWindow || usageMetrics.totalContextWindow)) *
                  100,
              ),
            ),
          )
        : null);
    if (activePercent == null) return null;
    return {
      activePercent,
      modelPercent,
      contextPhase: usageMetrics.contextPhase,
      tokenCountingMode: usageMetrics.tokenCountingMode,
    };
  }, [usageMetrics]);

  const handleCloseDbMenu = useCallback(() => setDbAnchor(null), []);
  const handleCloseSchemaMenu = useCallback(() => setSchemaAnchor(null), []);
  const handleCloseLlmPopover = useCallback(() => setLlmAnchor(null), []);

  const handleSchemaChange = useCallback(
    async (schema) => {
      setSchemaAnchor(null);
      if (schema === currentSchema) return;

      const result = await onSchemaChange?.(schema);
      if (result && !result.success) {
        logger.error('Failed to select schema:', result.error);
      }
    },
    [currentSchema, onSchemaChange],
  );

  const handleDatabaseChange = useCallback(
    (dbName) => {
      setDbAnchor(null);
      if (dbName === currentDatabase) return;
      onDatabaseSwitch?.(dbName);
    },
    [currentDatabase, onDatabaseSwitch],
  );

  // ENH [SLASH-COMMAND]: Detect slash commands typed at the start of the
  // message. When the message starts with "/" and has no whitespace yet,
  // we show the SlashCommandMenu anchored to the composer. The menu
  // filters its options by the text after "/" (e.g., "/lon" → "Long Task").
  // Typing a space, deleting the "/", or selecting a command closes it.
  //
  // NOTE: These must be declared BEFORE handleSubmit and handleKeyDown,
  // because handleKeyDown references `isSlashMenuOpen` in its dependency
  // array, which is evaluated immediately during render. Declaring it
  // after would cause a temporal-dead-zone ReferenceError.
  const slashQuery = useMemo(() => extractSlashQuery(message), [message]);
  const isSlashMenuOpen = slashQuery !== null && !message.includes(' ');

  const handleSlashCommandSelect = useCallback(
    (command) => {
      // Apply the task-mode change (if the command has a value).
      if (command.value && onTaskModeChange) {
        onTaskModeChange(command.value);
      }
      // Strip the slash text from the message so the user can continue
      // typing their actual prompt. If the command was the picker
      // ("/mode" with value=null), we still clear the slash so the menu
      // closes and the user can type their prompt.
      setMessage((prev) => {
        // Remove the first token (the slash command) and any single
        // trailing space, preserving the rest of the message.
        const remainder = prev.split(/\s+(.*)/s, 2)[1] || '';
        return remainder;
      });
    },
    [onTaskModeChange],
  );

  const handleSlashCommandClose = useCallback(() => {
    // Closing the menu without selecting: clear the slash so it doesn't
    // reopen on the next keystroke. The user can retype "/" to reopen.
    setMessage((prev) => {
      if (!prev.startsWith('/')) return prev;
      const remainder = prev.split(/\s+(.*)/s, 2)[1] || '';
      return remainder;
    });
  }, []);

  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault();
      if (message.trim() && !disabled && !isStreaming) {
        onSend(message.trim());
        setMessage('');
      }
    },
    [message, disabled, isStreaming, onSend],
  );

  // ENH [SLASH-COMMAND]: When the slash command menu is open, Enter and
  // Tab are intercepted by the menu's document-level keydown listener
  // (capture phase) to select the highlighted command. We also guard
  // here so that even if the event reaches the input, we don't submit
  // a half-typed slash command. ArrowUp/ArrowDown/Escape are handled
  // the same way in the menu's listener.
  const handleKeyDown = useCallback(
    (e) => {
      if (isSlashMenuOpen) {
        // The slash menu's capture-phase listener will handle
        // Enter/Tab/Arrow/Escape. For any other key, fall through so
        // the user can keep typing to filter the menu.
        if (
          e.key === 'Enter' ||
          e.key === 'Tab' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'Escape'
        ) {
          return;
        }
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isSlashMenuOpen],
  );

  const handleInputChange = useCallback((e) => {
    setMessage(e.target.value);
  }, []);

  const handleOpenDbMenu = useCallback((e) => setDbAnchor(e.currentTarget), []);
  const handleOpenSchemaMenu = useCallback((e) => setSchemaAnchor(e.currentTarget), []);
  const handleOpenLlmPopover = useCallback((e) => setLlmAnchor(e.currentTarget), []);

  const handleOpenSqlEditorClick = useCallback(() => {
    onOpenSqlEditor?.();
  }, [onOpenSqlEditor]);

  const handleStopClick = useCallback(() => {
    onStop?.();
  }, [onStop]);

  const handleLlmSelection = useCallback(
    (providerName, modelName) => {
      onSelectLlm?.(providerName, modelName);
      setLlmAnchor(null);
    },
    [onSelectLlm],
  );

  const handleMenuItemKeyDown = useCallback((event, onSelect) => {
    const items = Array.from(
      event.currentTarget
        .closest('[role="menu"]')
        ?.querySelectorAll('[role="menuitemradio"]:not([aria-disabled="true"])') || [],
    );
    const currentIndex = items.indexOf(event.currentTarget);
    const focusItem = (index) => {
      items[index]?.focus();
    };

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect();
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        focusItem((currentIndex + 1) % items.length);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        focusItem((currentIndex - 1 + items.length) % items.length);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      default:
        break;
    }
  }, []);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        px: { xs: 0.5, sm: 0.75 },
        pb: { xs: 'max(env(safe-area-inset-bottom), 8px)', sm: 0.75 },
        position: 'relative',
        zIndex: 2,
      }}
    >
      <AppPopover
        anchorEl={dbAnchor}
        open={Boolean(dbAnchor)}
        onClose={handleCloseDbMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        width={220}
        paperSx={{ mt: -1 }}
      >
        <Typography sx={getPopoverSectionLabelSx(theme)}>Switch Database</Typography>
        <Box
          role="menu"
          aria-label="Switch database"
          sx={{ maxHeight: 280, overflowY: 'auto', mt: 0.5 }}
        >
          {availableDatabases.map((db) => {
            const isActive = db === currentDatabase;
            return (
              <Box
                component="div"
                role="menuitemradio"
                aria-checked={isActive}
                tabIndex={0}
                key={db}
                onClick={() => handleDatabaseChange(db)}
                onKeyDown={(event) => handleMenuItemKeyDown(event, () => handleDatabaseChange(db))}
                sx={getSelectableMenuItemSx(theme, { isActive, columns: '16px minmax(0, 1fr)' })}
              >
                {isActive ? (
                  <CheckCircleOutlineRoundedIcon
                    sx={{
                      fontSize: 16,
                      color: 'primary.main',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Box sx={{ width: 16, height: 16 }} />
                )}
                <Typography
                  sx={{
                    ...theme.typography.uiNavItem,
                    color: 'text.primary',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {db}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </AppPopover>
      <AppPopover
        anchorEl={schemaAnchor}
        open={Boolean(schemaAnchor)}
        onClose={handleCloseSchemaMenu}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        width={200}
        paperSx={{ mt: -1 }}
      >
        <Typography sx={getPopoverSectionLabelSx(theme)}>PostgreSQL Schema</Typography>
        <Box
          role="menu"
          aria-label="Select PostgreSQL schema"
          sx={{ maxHeight: 260, overflowY: 'auto', mt: 0.5 }}
        >
          {availableSchemas.map((schema) => {
            const isActive = schema === currentSchema;
            return (
              <Box
                component="div"
                role="menuitemradio"
                aria-checked={isActive}
                tabIndex={0}
                key={schema}
                onClick={() => handleSchemaChange(schema)}
                onKeyDown={(event) =>
                  handleMenuItemKeyDown(event, () => handleSchemaChange(schema))
                }
                sx={getSelectableMenuItemSx(theme, { isActive, columns: '16px minmax(0, 1fr)' })}
              >
                {isActive ? (
                  <CheckCircleOutlineRoundedIcon
                    sx={{
                      fontSize: 16,
                      color: 'primary.main',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <Box sx={{ width: 16, height: 16 }} />
                )}
                <Typography
                  sx={{
                    ...theme.typography.uiNavItem,
                    color: 'text.primary',
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {schema}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </AppPopover>
      <AppPopover
        anchorEl={llmAnchor}
        open={Boolean(llmAnchor)}
        onClose={handleCloseLlmPopover}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        width={288}
        paperSx={{ mt: -1 }}
      >
        {/* Model list */}
        <Box role="menu" aria-label="Select model" sx={{ maxHeight: 280, overflowY: 'auto' }}>
          {llmOptionsLoading ? (
            // Model-list loading skeleton — mimics the structure of a real
            // menu item: a 16px circular avatar-like slot + a 70%-width
            // text bar. Reads as "model list is loading" rather than a
            // generic gray block.
            <Box sx={{ display: 'grid', gap: 0.5, p: 0.5 }}>
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '16px minmax(0, 1fr)',
                    alignItems: 'center',
                    gap: 1,
                    height: 44,
                    px: 1,
                    py: 0.75,
                  }}
                >
                  <Skeleton variant="circular" width={16} height={16} animation="wave" />
                  <Skeleton
                    variant="rounded"
                    animation="wave"
                    sx={{
                      width: `${78 - i * 12}%`,
                      height: 11,
                      borderRadius: 999,
                    }}
                  />
                </Box>
              ))}
            </Box>
          ) : hasLlmOptions ? (
            llmSections.map((section, sectionIndex) => (
              <Box key={section.name}>
                {sectionIndex > 0 && (
                  <Box
                    sx={{
                      height: '0.5px',
                      backgroundColor: alpha(theme.palette.text.primary, 0.07),
                      my: 0.75,
                      mx: 0.5,
                    }}
                  />
                )}
                <Typography sx={getPopoverSectionLabelSx(theme, { pt: 0.75 })}>
                  {section.label}
                </Typography>
                {section.models.map((model) => {
                  const isActive = section.name === selectedProvider && model === selectedModel;
                  return (
                    <Box
                      component="div"
                      role="menuitemradio"
                      aria-checked={isActive}
                      tabIndex={0}
                      key={`${section.name}-${model}`}
                      onClick={() => handleLlmSelection(section.name, model)}
                      onKeyDown={(event) =>
                        handleMenuItemKeyDown(event, () => handleLlmSelection(section.name, model))
                      }
                      sx={getSelectableMenuItemSx(theme, {
                        isActive,
                        columns: '16px minmax(0, 1fr)',
                      })}
                    >
                      {isActive ? (
                        <CheckCircleOutlineRoundedIcon
                          sx={{
                            fontSize: 16,
                            color: 'primary.main',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <Box sx={{ width: 16, height: 16 }} />
                      )}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        <Typography
                          sx={{
                            ...theme.typography.uiNavItem,
                            color: 'text.primary',
                            fontWeight: isActive ? 500 : 400,
                          }}
                        >
                          {model}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ))
          ) : (
            <Box sx={{ px: 1, py: 1 }}>
              <Typography
                sx={{
                  ...theme.typography.uiNavItem,
                  fontWeight: 500,
                  color: 'text.primary',
                }}
              >
                No models available
              </Typography>
              <Typography
                sx={{
                  ...theme.typography.uiNavShortcut,
                  color: 'text.secondary',
                  mt: 0.25,
                }}
              >
                Model options could not be loaded.
              </Typography>
            </Box>
          )}
        </Box>
      </AppPopover>

      <Box
        ref={composerRef}
        sx={{
          maxWidth: UI_LAYOUT.chatInputMaxWidth,
          mx: 'auto',
          position: 'relative',
          ...composerSurfaceSx,
          opacity: isStreaming ? 0.72 : 1,
          transition: theme.transitions.create(['opacity', 'box-shadow', 'border-color'], {
            duration: theme.transitions.duration.shorter,
          }),
          [HOVER_CAPABLE_QUERY]: {
            '&:hover': {
              boxShadow: getComposerHoverShadow(theme),
            },
          },
          // Visible focus-within ring so keyboard users see the composer is active.
          '&:focus-within': {
            boxShadow: getComposerHoverShadow(theme),
          },
          cursor: isStreaming ? 'wait' : 'text',
        }}
      >
        <Box
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            display: 'flex',
            flexDirection: 'column',
            gap: { xs: 1.1, sm: 1.25 },
          }}
        >
          <TextField
            fullWidth
            multiline
            minRows={isCompactMobile ? 1 : 2}
            maxRows={6}
            placeholder={inputPlaceholder}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={disabled || isStreaming}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                lineHeight: 1.55,
                py: 0,
                px: 0,
                color: 'text.primary',
                alignItems: 'flex-start',
              },
            }}
            inputProps={{ 'data-ui-target': 'chat_input' }}
            sx={inputSx}
          />

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 0.75,
            }}
          >
            <Box sx={toolbarScrollSx}>
              {showDatabaseSelector && (
                <Box
                  key={`database-${connectionChipKey}`}
                  sx={{
                    display: 'inline-flex',
                    flexShrink: 0,
                    animation: `${softReveal} 180ms ease-out both`,
                    '@media (prefers-reduced-motion: reduce)': {
                      animation: 'none',
                    },
                  }}
                >
                  <Tooltip
                    title={
                      canSwitchDatabase
                        ? `Database: ${currentDatabase} (click to switch)`
                        : `Database: ${currentDatabase}`
                    }
                  >
                    <span>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DatabaseIcon />}
                        onClick={canSwitchDatabase ? handleOpenDbMenu : undefined}
                        disabled={!canSwitchDatabase}
                        sx={{
                          ...toolbarActionButtonStyles,
                          ...connectedControlSx,
                          '&.Mui-disabled': {
                            opacity: 1,
                            borderColor: neutralInteraction.border,
                            color: 'text.secondary',
                            backgroundColor: 'transparent',
                          },
                        }}
                      >
                        <TruncatedLabel>{currentDatabase}</TruncatedLabel>
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              )}
              {showSchemaSelector && (
                <Box
                  key={`schema-${connectionChipKey}`}
                  sx={{
                    display: 'inline-flex',
                    flexShrink: 0,
                    animation: `${softReveal} 180ms ease-out both`,
                    animationDelay: '35ms',
                    '@media (prefers-reduced-motion: reduce)': {
                      animation: 'none',
                    },
                  }}
                >
                  <Tooltip title={`Schema: ${currentSchema}`}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SchemaIcon />}
                      onClick={handleOpenSchemaMenu}
                      sx={{
                        ...toolbarActionButtonStyles,
                        ...connectedControlSx,
                      }}
                    >
                      <TruncatedLabel>{currentSchema}</TruncatedLabel>
                    </Button>
                  </Tooltip>
                </Box>
              )}
              {onOpenSqlEditor && (
                <Tooltip title="Open SQL Editor">
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CodeEditorIcon />}
                    onClick={handleOpenSqlEditorClick}
                    sx={{
                      ...toolbarActionButtonStyles,
                      maxWidth: { xs: 40, sm: 128 },
                      px: { xs: 0, sm: 1.25 },
                      justifyContent: 'center',
                      '& .MuiButton-startIcon': {
                        ...toolbarActionButtonStyles['& .MuiButton-startIcon'],
                        mr: { xs: 0, sm: 0.5 },
                      },
                    }}
                  >
                    <TruncatedLabel
                      sx={{
                        display: { xs: 'none', sm: 'inline' },
                      }}
                    >
                      SQL Editor
                    </TruncatedLabel>
                  </Button>
                </Tooltip>
              )}
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flexShrink: 0,
              }}
            >
              <Tooltip
                title={
                  contextUsage ? (
                    <ContextUsageTooltip
                      contextUsage={contextUsage}
                      selectedModel={selectedModel}
                    />
                  ) : activeProviderLabel ? (
                    `${selectedModel || 'Select model'} - ${activeProviderLabel}`
                  ) : (
                    'Select model'
                  )
                }
              >
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleOpenLlmPopover}
                    disabled={!hasLlmOptions && !llmOptionsLoading}
                    aria-expanded={Boolean(llmAnchor)}
                    aria-label="Select model"
                    startIcon={
                      contextUsage ? (
                        <ContextProgressRing
                          total={contextUsage.indicatorUsed}
                          budget={contextUsage.indicatorBudget}
                          theme={theme}
                        />
                      ) : undefined
                    }
                    endIcon={
                      <KeyboardArrowDownRoundedIcon
                        sx={{
                          transform: llmAnchor ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: theme.transitions.create('transform', {
                            duration: 150,
                          }),
                        }}
                      />
                    }
                    sx={{
                      ...toolbarActionButtonStyles,
                      width: { xs: 124, sm: 164 },
                      flexShrink: 0,
                    }}
                  >
                    <TruncatedLabel
                      sx={{
                        flex: 1,
                        textAlign: 'left',
                      }}
                    >
                      {selectedModel || (llmOptionsLoading ? 'Loading...' : 'Choose model')}
                    </TruncatedLabel>
                  </Button>
                </span>
              </Tooltip>

              <Tooltip
                title={
                  isStreaming ? 'Stop generating' : hasText ? 'Send message' : 'Type a message'
                }
              >
                <span>
                  <IconButton
                    type={isStreaming ? 'button' : 'submit'}
                    onClick={isStreaming ? handleStopClick : undefined}
                    disabled={!isStreaming && (!hasText || disabled)}
                    aria-label={isStreaming ? 'Stop generating response' : 'Send message'}
                    sx={sendActionSx}
                  >
                    {isStreaming ? (
                      <StopRoundedIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <SendRoundedIcon sx={{ fontSize: 14, ml: '1px' }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Box>

        {/*
          ENH [SLASH-COMMAND]: Subtle effective-mode chip in the top-right
          corner of the composer. Shows the backend-reported effective mode
          when the agent is running (or just finished) a turn. Hidden when
          there's no effective mode (resting state) so the composer stays
          clean. The chip is non-interactive — it's a status indicator, not
          a control. Mode selection happens via the slash command menu
          (type "/" at the start of the input).
        */}
        {effectiveTaskMode && (
          <Box
            aria-label={`Effective task mode: ${effectiveTaskMode.label}`}
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.85,
              py: 0.25,
              borderRadius: 0.75,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              lineHeight: 1.4,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: theme.palette.primary.main,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
              pointerEvents: 'none',
              opacity: isStreaming ? 0.95 : 0.7,
              transition: theme.transitions.create('opacity', {
                duration: theme.transitions.duration.shorter,
              }),
            }}
          >
            {effectiveTaskMode.label}
            {effectiveTaskMode.recursion_limit ? ` · ${effectiveTaskMode.recursion_limit}` : ''}
            {effectiveTaskMode.source === 'auto' && (
              <Box
                component="span"
                sx={{
                  fontSize: 8,
                  px: 0.4,
                  py: 0.1,
                  borderRadius: 0.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.22),
                  lineHeight: 1,
                }}
              >
                Auto
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/*
        ENH [SLASH-COMMAND]: Inline command menu. Opens when the user types
        "/" at the start of the message. Lets them pick the task mode
        (Auto / Standard / Tool Task / Long Task) without adding a button
        to the toolbar. Filtered by the text after "/" — e.g., "/lon"
        shows only "Long Task". Keyboard: ↑↓ navigate, ↵/Tab select,
        Esc close. On select, the slash text is stripped from the message
        and the mode is applied.
      */}
      {isSlashMenuOpen && composerRef.current && (
        <SlashCommandMenu
          anchorEl={composerRef.current}
          query={slashQuery}
          currentTaskMode={taskMode ?? 'auto'}
          onSelect={handleSlashCommandSelect}
          onClose={handleSlashCommandClose}
        />
      )}
      {children}
    </Box>
  );
}

function arePropsEqual(prevProps, nextProps) {
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  if (prevProps.disabled !== nextProps.disabled) return false;
  if (prevProps.isConnected !== nextProps.isConnected) return false;
  if (prevProps.dbType !== nextProps.dbType) return false;
  if (prevProps.currentDatabase !== nextProps.currentDatabase) return false;
  if (prevProps.selectedProvider !== nextProps.selectedProvider) return false;
  if (prevProps.selectedModel !== nextProps.selectedModel) return false;
  if (prevProps.llmOptionsLoading !== nextProps.llmOptionsLoading) return false;
  if (prevProps.providerOptions !== nextProps.providerOptions) return false;
  if (prevProps.onSend !== nextProps.onSend) return false;
  if (prevProps.onStop !== nextProps.onStop) return false;
  if (prevProps.onOpenSqlEditor !== nextProps.onOpenSqlEditor) return false;
  if (prevProps.onDatabaseSwitch !== nextProps.onDatabaseSwitch) return false;
  if (prevProps.onSelectLlm !== nextProps.onSelectLlm) return false;
  if (prevProps.onSchemaChange !== nextProps.onSchemaChange) return false;
  if (prevProps.currentSchema !== nextProps.currentSchema) return false;
  if (prevProps.usageMetrics !== nextProps.usageMetrics) return false;
  // ENH [AUTO-TASK-MODE]: Re-render when the task-mode setting or the
  // backend-reported effective mode changes.
  if (prevProps.taskMode !== nextProps.taskMode) return false;
  if (prevProps.onTaskModeChange !== nextProps.onTaskModeChange) return false;
  if (prevProps.effectiveTaskMode !== nextProps.effectiveTaskMode) return false;
  if (prevProps.children !== nextProps.children) return false;
  if (prevProps.availableDatabases?.length !== nextProps.availableDatabases?.length) return false;
  // Compare actual database identifiers, not just count, so a rename still
  // triggers a re-render even when the number of databases is unchanged.
  const prevDbKey = prevProps.availableDatabases
    ?.map((db) => db?.name || db?.database || db?.id || String(db))
    .join('\x1f');
  const nextDbKey = nextProps.availableDatabases
    ?.map((db) => db?.name || db?.database || db?.id || String(db))
    .join('\x1f');
  if (prevDbKey !== nextDbKey) return false;
  return true;
}

export default memo(ChatInput, arePropsEqual);
