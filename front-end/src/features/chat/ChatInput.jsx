import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Button,
  Tooltip,
  Typography,
  Chip,
  Switch,
  Skeleton,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { AppPopover } from '@/components';
import CodeEditorIcon from '@/components/icons/CodeEditorIcon';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import SchemaIcon from '@/components/icons/SchemaIcon';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import { getSchemas, selectSchema } from '@/api';
import { HOVER_CAPABLE_QUERY } from '@/styles/mediaQueries';
import logger from '@/utils/logger';
import {
  getComposerHoverShadow,
  getComposerSurfaceSx,
} from '@/features/styles/interfaceChrome';
import {
  getInteractionColors,
  getPopoverSectionLabelSx,
  getSelectableMenuItemSx,
  UI_LAYOUT,
} from '@/styles/shared';


function ChatInput({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  isConnected = false,
  dbType = null,
  currentDatabase = null,
  availableDatabases = [],
  onDatabaseSwitch,
  showSuggestions = true,
  onOpenSqlEditor,
  selectedProvider = '',
  selectedModel = '',
  providerOptions = [],
  llmOptionsLoading = false,
  onSelectLlm,
}) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const theme = useTheme();
  const isCompactMobile = useMediaQuery(theme.breakpoints.down('sm'));
  useAppTheme();
  const [schemas, setSchemas] = useState([]);
  const [currentSchema, setCurrentSchema] = useState('public');
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaAnchor, setSchemaAnchor] = useState(null);
  const [dbAnchor, setDbAnchor] = useState(null);
  const [llmAnchor, setLlmAnchor] = useState(null);

  const isPostgreSQL = useMemo(() =>
    dbType?.toLowerCase() === 'postgresql',
  [dbType]);

  const showSchemaSelector = useMemo(() =>
    isConnected && isPostgreSQL && schemas.length > 0,
  [isConnected, isPostgreSQL, schemas.length]);
  const showDatabaseSelector = useMemo(() =>
    isConnected && currentDatabase,
  [isConnected, currentDatabase]);
  const canSwitchDatabase = useMemo(() =>
    availableDatabases.length > 1,
  [availableDatabases.length]);

  const hasText = useMemo(() =>
    message.trim().length > 0,
  [message]);

  const neutralInteraction = useMemo(() => getInteractionColors(theme), [theme]);
  const toolbarActionButtonStyles = useMemo(() => ({
    height: 32,
    minHeight: 32,
    minWidth: 32,
    maxWidth: { xs: 'min(42vw, 152px)', sm: 208 },
    flexShrink: 0,
    borderRadius: '8px',
    px: { xs: 1, sm: 1.25 },
    py: 0,
    gap: 0.5,
    justifyContent: 'flex-start',
    borderColor: neutralInteraction.border,
    color: 'text.secondary',
    backgroundColor: 'transparent',
    ...theme.typography.uiCaptionSm,
    lineHeight: 1,
    transition: theme.transitions.create(['background-color', 'border-color', 'color', 'transform'], {
      duration: theme.transitions.duration.shorter,
    }),
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
    '&:active': { transform: 'scale(0.995)' },
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
    '&.Mui-disabled': {
      opacity: 0.42,
      borderColor: 'transparent',
      color: 'text.secondary',
      backgroundColor: 'transparent',
    },
  }), [neutralInteraction, theme]);

  const errorInteraction = useMemo(() => getInteractionColors(theme, { tone: 'error' }), [theme]);
  const composerSurfaceSx = useMemo(
    () => getComposerSurfaceSx(theme, { isFocused }),
    [theme, isFocused],
  );
  const inputPlaceholder = isConnected
    ? 'Ask about your database or anything else...'
    : 'How can I help you today?';

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

  const handleCloseDbMenu = useCallback(() => setDbAnchor(null), []);
  const handleCloseSchemaMenu = useCallback(() => setSchemaAnchor(null), []);
  const handleCloseLlmPopover = useCallback(() => setLlmAnchor(null), []);



  const fetchSchemas = useCallback(async () => {
    setSchemaLoading(true);
    try {
      const response = await getSchemas();
      if (response.status === 'success') {
        setSchemas(response.data.schemas || []);
        setCurrentSchema(response.data.current_schema || 'public');
      }
    } catch (err) {
      logger.error('Failed to fetch schemas:', err);
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  const handleSchemaChange = useCallback(async (schema) => {
    setSchemaAnchor(null);
    if (schema === currentSchema) return;

    setSchemaLoading(true);
    try {
      const response = await selectSchema(schema);
      if (response.status === 'success') {
        setCurrentSchema(schema);
      }
    } catch (err) {
      logger.error('Failed to select schema:', err);
    } finally {
      setSchemaLoading(false);
    }
  }, [currentSchema]);

  const handleDatabaseChange = useCallback((dbName) => {
    setDbAnchor(null);
    if (dbName === currentDatabase) return;
    onDatabaseSwitch?.(dbName);
  }, [currentDatabase, onDatabaseSwitch]);

  const handleSubmit = useCallback((e) => {
    e?.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  }, [message, disabled, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleInputChange = useCallback((e) => {
    setMessage(e.target.value);
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
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

  const handleLlmSelection = useCallback((providerName, modelName) => {
    onSelectLlm?.(providerName, modelName);
    setLlmAnchor(null);
  }, [onSelectLlm]);

  const suggestions = useMemo(() => [
    {
      label: 'Check Connection',
      icon: <DatabaseIcon sx={{ width: 16, height: 16 }} />,
      prompt: 'Check my database connection status and show connection details',
    },
    {
      label: 'Schema Details',
      icon: <SchemaIcon sx={{ width: 16, height: 16 }} />,
      prompt: 'Show me the database schema with all tables and their columns',
    },
    {
      label: 'Open SQL Editor',
      icon: <CodeEditorIcon sx={{ width: 16, height: 16 }} />,
      prompt: 'Open the SQL editor and help me write a query',
    },
  ], []);

  const handleSuggestionClick = useCallback((prompt) => {
    onSend?.(prompt);
  }, [onSend]);

  useEffect(() => {
    if (isConnected && currentDatabase && isPostgreSQL) {
      fetchSchemas();
    } else {
      setSchemas([]);
      setCurrentSchema('public');
    }
  }, [isConnected, currentDatabase, isPostgreSQL, fetchSchemas]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        px: { xs: 0.5, sm: 0.75 },
        pb: { xs: 'max(env(safe-area-inset-bottom), 8px)', sm: 0.75 },
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
                onClick={() => handleDatabaseChange(db)}
                sx={getSelectableMenuItemSx(theme, { isActive })}
              >
                <Typography sx={{ ...theme.typography.uiNavItem, color: isActive ? 'text.primary' : 'text.primary', fontWeight: isActive ? 500 : 400 }}>
                  {db}
                </Typography>
                {isActive && <CheckRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />}
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
        <Typography sx={getPopoverSectionLabelSx(theme)}>
          PostgreSQL Schema
        </Typography>
        <Box sx={{ maxHeight: 260, overflowY: 'auto', mt: 0.5 }}>
          {schemas.map((schema) => {
            const isActive = schema === currentSchema;
            return (
              <Box
                component="div"
                role="menuitemradio"
                aria-checked={isActive}
                key={schema}
                onClick={() => handleSchemaChange(schema)}
                sx={getSelectableMenuItemSx(theme, { isActive })}
              >
                <Typography sx={{ ...theme.typography.uiNavItem, color: isActive ? 'text.primary' : 'text.primary', fontWeight: isActive ? 500 : 400 }}>
                  {schema}
                </Typography>
                {isActive && <CheckRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />}
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
        <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
          {llmOptionsLoading ? (
            <Box sx={{ display: 'grid', gap: 0.5 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} variant="rounded" height={44} sx={{ borderRadius: '8px' }} />
              ))}
            </Box>
          ) : hasLlmOptions ? (
            llmSections.map((section, sectionIndex) => (
              <Box key={section.name}>
                {sectionIndex > 0 && (
                  <Box sx={{ height: '0.5px', backgroundColor: alpha(theme.palette.text.primary, 0.07), my: 0.75, mx: 0.5 }} />
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
                      key={`${section.name}-${model}`}
                      onClick={() => handleLlmSelection(section.name, model)}
                      sx={getSelectableMenuItemSx(theme, { isActive })}
                    >
                      <Box>
                        <Typography sx={{ ...theme.typography.uiNavItem, color: 'text.primary', fontWeight: isActive ? 500 : 400 }}>
                          {model}
                        </Typography>
                      </Box>
                      {isActive && (
                        <CheckRoundedIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                      )}
                    </Box>
                  );
                })}
              </Box>
            ))
          ) : (
            <Box sx={{ px: 1, py: 1 }}>
              <Typography sx={{ ...theme.typography.uiNavItem, fontWeight: 500, color: 'text.primary' }}>
                No models available
              </Typography>
              <Typography sx={{ ...theme.typography.uiNavShortcut, color: 'text.secondary', mt: 0.25 }}>
                Model options could not be loaded.
              </Typography>
            </Box>
          )}
        </Box>

      </AppPopover>
      <Box
        sx={{
          maxWidth: UI_LAYOUT.chatInputMaxWidth,
          mx: 'auto',
          position: 'relative',
          ...composerSurfaceSx,
          [HOVER_CAPABLE_QUERY]: {
            '&:hover': {
              boxShadow: getComposerHoverShadow(theme, { isFocused }),
            },
          },
          cursor: 'text',
        }}
      >
        <Box
          sx={{
            p: { xs: 1.75, sm: 1.75 },
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
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
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          variant="standard"
          InputProps={{
            disableUnderline: true,
            sx: {
              lineHeight: 1.5,
              py: 0,
              px: 0,
              color: 'text.primary',
              alignItems: 'flex-start',
            },
          }}
          inputProps={{ 'data-ui-target': 'chat_input' }}
          sx={{
            '& .MuiInputBase-root': { p: 0 },
            '& .MuiInputBase-input': {
              py: 0.1,
              ...theme.typography.uiInput,
              '&::placeholder': {
                color: 'text.secondary',
                opacity: 0.72,
              },
            },
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0, flex: 1, overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>

            {showDatabaseSelector && (
              <Tooltip title={canSwitchDatabase ? `Database: ${currentDatabase} (click to switch)` : `Database: ${currentDatabase}`}>
                <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DatabaseIcon />}
                  onClick={canSwitchDatabase ? handleOpenDbMenu : undefined}
                  disabled={!canSwitchDatabase}
                  sx={{
                    ...toolbarActionButtonStyles,
                    '&.Mui-disabled': {
                      opacity: 1,
                      borderColor: neutralInteraction.border,
                      color: 'text.secondary',
                      backgroundColor: 'transparent',
                    },
                  }}
                >
                  <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentDatabase}
                  </Box>
                </Button>
                </span>
              </Tooltip>
            )}
            {showSchemaSelector && (
              <Tooltip title={`Schema: ${schemaLoading ? '...' : currentSchema}`}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SchemaIcon />}
                  onClick={handleOpenSchemaMenu}
                  sx={toolbarActionButtonStyles}
                >
                  <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {schemaLoading ? '...' : currentSchema}
                  </Box>
                </Button>
              </Tooltip>
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
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    SQL Editor
                  </Box>
                </Button>
              </Tooltip>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Tooltip title={activeProviderLabel ? `${selectedModel || 'Select model'} - ${activeProviderLabel}` : 'Select model'}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleOpenLlmPopover}
                  disabled={!hasLlmOptions && !llmOptionsLoading}
                  aria-expanded={Boolean(llmAnchor)}
                  aria-label="Select model"
                  endIcon={(
                    <KeyboardArrowDownRoundedIcon sx={{
                      transform: llmAnchor ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: theme.transitions.create('transform', { duration: 150 }),
                    }}
                    />
                  )}
                  sx={{
                    ...toolbarActionButtonStyles,
                    maxWidth: { xs: 'min(44vw, 144px)', sm: 208 },
                  }}
                >
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                    {selectedModel || (llmOptionsLoading ? 'Loading...' : 'Choose model')}
                  </Box>
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={isStreaming ? 'Stop generating' : (hasText ? 'Send message' : 'Type a message')}>
              <span>
                <IconButton
                  type={isStreaming ? 'button' : 'submit'}
                  onClick={isStreaming ? handleStopClick : undefined}
                  disabled={!isStreaming && (!hasText || disabled)}
                  aria-label={isStreaming ? 'Stop generating response' : 'Send message'}
                  sx={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    borderRadius: '10px',
                    color: isStreaming
                      ? theme.palette.error.main
                      : (hasText ? '#ffffff' : alpha(theme.palette.text.primary, 0.28)),
                    backgroundColor: isStreaming
                      ? errorInteraction.activeBackground
                      : (hasText ? theme.palette.primary.main : alpha(theme.palette.text.primary, 0.05)),
                    backgroundImage: (!isStreaming && hasText)
                      ? `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
                      : 'none',
                    border: '1px solid',
                    borderColor: isStreaming
                      ? alpha(theme.palette.error.main, 0.2)
                      : (hasText ? 'transparent' : alpha(theme.palette.text.primary, 0.07)),
                    boxShadow: (!isStreaming && hasText)
                      ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`
                      : 'none',
                    transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    '&:hover': {
                      transform: (!isStreaming && hasText) ? 'scale(1.06)' : 'none',
                      backgroundColor: isStreaming
                        ? errorInteraction.activeHoverBackground
                        : (hasText ? theme.palette.primary.dark : alpha(theme.palette.text.primary, 0.08)),
                      boxShadow: (!isStreaming && hasText)
                        ? `0 6px 16px ${alpha(theme.palette.primary.main, 0.45)}`
                        : 'none',
                    },
                    '&:active': { transform: 'scale(0.92)' },
                    '&.Mui-disabled': {
                      backgroundColor: alpha(theme.palette.text.primary, 0.04),
                      borderColor: alpha(theme.palette.text.primary, 0.06),
                      color: alpha(theme.palette.text.primary, 0.2),
                    },
                  }}
                >
                  {isStreaming
                    ? <StopRoundedIcon sx={{ fontSize: 14 }} />
                    : <SendRoundedIcon sx={{ fontSize: 14, ml: '1px' }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        </Box>
      </Box>
      {showSuggestions && (
        <Box sx={{ maxWidth: UI_LAYOUT.chatInputMaxWidth, mx: 'auto', mt: 1.25, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          {suggestions.map((chip) => (
            <Chip
              key={chip.label}
              icon={chip.icon}
              label={chip.label}
              onClick={() => handleSuggestionClick(chip.prompt)}
              size="small"
              sx={{
                height: 32,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: neutralInteraction.border,
                color: 'text.secondary',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                transition: theme.transitions.create(['background-color', 'border-color', 'color', 'transform'], {
                  duration: theme.transitions.duration.shorter,
                }),
                '&:active': { transform: 'scale(0.995)' },
                '& .MuiChip-label': {
                  px: 1.25,
                  ...theme.typography.uiCaptionSm,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
                '& .MuiChip-icon': {
                  color: alpha(theme.palette.text.primary, 0.45),
                  ml: 1,
                  mr: -0.25,
                  fontSize: 16,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                },
                [HOVER_CAPABLE_QUERY]: {
                  '&:hover': {
                    borderColor: neutralInteraction.hoverBorder,
                    backgroundColor: neutralInteraction.hoverBackground,
                    color: 'text.primary',
                    '& .MuiChip-icon': {
                      color: alpha(theme.palette.text.primary, 0.65),
                    },
                  },
                },
              }}
            />
          ))}
        </Box>
      )}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          textAlign: 'center',
          mt: 1,
          px: 1,
          ...theme.typography.uiCaption2xs,
          color: 'text.secondary',
          opacity: 0.55,
          letterSpacing: '0.015em',
        }}
      >
        Moonlit can make mistakes. Verify important info.
      </Typography>
    </Box>
  );
}

function arePropsEqual(prevProps, nextProps) {
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  if (prevProps.disabled !== nextProps.disabled) return false;
  if (prevProps.isConnected !== nextProps.isConnected) return false;
  if (prevProps.dbType !== nextProps.dbType) return false;
  if (prevProps.currentDatabase !== nextProps.currentDatabase) return false;
  if (prevProps.showSuggestions !== nextProps.showSuggestions) return false;
  if (prevProps.selectedProvider !== nextProps.selectedProvider) return false;
  if (prevProps.selectedModel !== nextProps.selectedModel) return false;
  if (prevProps.llmOptionsLoading !== nextProps.llmOptionsLoading) return false;
  if (prevProps.providerOptions !== nextProps.providerOptions) return false;
  if (prevProps.onSend !== nextProps.onSend) return false;
  if (prevProps.onStop !== nextProps.onStop) return false;
  if (prevProps.onOpenSqlEditor !== nextProps.onOpenSqlEditor) return false;
  if (prevProps.onDatabaseSwitch !== nextProps.onDatabaseSwitch) return false;
  if (prevProps.onSelectLlm !== nextProps.onSelectLlm) return false;
  if (prevProps.availableDatabases?.length !== nextProps.availableDatabases?.length) return false;
  return true;
}

export default memo(ChatInput, arePropsEqual);
