import { useState, useCallback, useMemo, memo } from "react";
import {
  Box,
  TextField,
  IconButton,
  Button,
  Tooltip,
  Typography,
  Skeleton,
  useMediaQuery,
} from "@mui/material";
import { alpha, keyframes, useTheme } from "@mui/material/styles";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";

import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import { AppPopover } from "@/components";
import CodeEditorIcon from "@/components/icons/CodeEditorIcon";
import DatabaseIcon from "@/components/icons/DatabaseIcon";
import SchemaIcon from "@/components/icons/SchemaIcon";
import { useDatabaseConnection } from "@/contexts/DatabaseContext";
import { HOVER_CAPABLE_QUERY } from "@/styles/mediaQueries";
import logger from "@/utils/logger";
import {
  getComposerHoverShadow,
  getComposerSurfaceSx,
} from "@/features/styles/interfaceChrome";
import {
  getInteractionColors,
  getPopoverSectionLabelSx,
  getSelectableMenuItemSx,
  UI_LAYOUT,
} from "@/styles/shared";

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

  let color = theme.palette.success.main;
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
        transform: "rotate(-90deg)",
        transformOrigin: "center",
        flexShrink: 0,
        display: "block",
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
          transition: "stroke-dashoffset 0.35s ease-in-out",
        }}
      />
    </Box>
  );
};

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
  onOpenSqlEditor,
  selectedProvider = "",
  selectedModel = "",
  providerOptions = [],
  llmOptionsLoading = false,
  onSelectLlm,
  usageMetrics = null,
  children,
}) {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const theme = useTheme();
  const isCompactMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [schemaAnchor, setSchemaAnchor] = useState(null);
  const [dbAnchor, setDbAnchor] = useState(null);
  const [llmAnchor, setLlmAnchor] = useState(null);
  const {
    availableSchemas = [],
    currentSchema = null,
    selectSchema,
  } = useDatabaseConnection();

  const isPostgreSQL = useMemo(
    () => dbType?.toLowerCase() === "postgresql",
    [dbType],
  );

  const connectionMetadataReady = useMemo(
    () => Boolean(isConnected && currentDatabase && dbType),
    [isConnected, currentDatabase, dbType],
  );
  const connectionChipKey = useMemo(
    () => `${dbType || "unknown"}:${currentDatabase || ""}`,
    [dbType, currentDatabase],
  );
  const showSchemaSelector = useMemo(
    () => connectionMetadataReady && isPostgreSQL && Boolean(currentSchema),
    [connectionMetadataReady, isPostgreSQL, currentSchema],
  );
  const showDatabaseSelector = useMemo(
    () => connectionMetadataReady,
    [connectionMetadataReady],
  );
  const canSwitchDatabase = useMemo(
    () => availableDatabases.length > 1,
    [availableDatabases.length],
  );

  const hasText = useMemo(() => message.trim().length > 0, [message]);

  const neutralInteraction = useMemo(
    () => getInteractionColors(theme),
    [theme],
  );
  const toolbarActionButtonStyles = useMemo(
    () => ({
      height: 30,
      minHeight: 30,
      minWidth: 32,
      maxWidth: { xs: "min(42vw, 152px)", sm: 208 },
      flexShrink: 0,
      borderRadius: "8px",
      px: { xs: 1, sm: 1.25 },
      py: 0,
      gap: 0.5,
      justifyContent: "flex-start",
      borderColor: neutralInteraction.border,
      color: "text.secondary",
      backgroundColor: "transparent",
      ...theme.typography.uiBodySm,
      lineHeight: 1,
      transition: theme.transitions.create(
        ["background-color", "border-color", "color", "transform"],
        {
          duration: theme.transitions.duration.shorter,
        },
      ),
      "& .MuiButton-startIcon": {
        m: 0,
        mr: 0.5,
        color: alpha(theme.palette.text.primary, 0.45),
        flexShrink: 0,
        "& > *:nth-of-type(1)": {
          fontSize: 16,
        },
      },
      "& .MuiButton-endIcon": {
        m: 0,
        ml: 0.25,
        color: "inherit",
        flexShrink: 0,
        opacity: 0.75,
        "& > *:nth-of-type(1)": {
          fontSize: 12,
        },
      },
      "& .MuiButton-iconSizeSmall": {
        "& > *:nth-of-type(1)": {
          fontSize: 16,
        },
      },
      "&:active": { transform: "translateY(1px)" },
      [HOVER_CAPABLE_QUERY]: {
        "&:hover": {
          borderColor: neutralInteraction.hoverBorder,
          backgroundColor: neutralInteraction.hoverBackground,
          color: "text.primary",
          "& .MuiButton-startIcon": {
            color: alpha(theme.palette.text.primary, 0.65),
          },
        },
      },
      '&[aria-expanded="true"]': {
        borderColor: neutralInteraction.activeBorder,
        backgroundColor: neutralInteraction.activeBackground,
        color: "text.primary",
      },
      "&.Mui-disabled": {
        opacity: 0.42,
        borderColor: "transparent",
        color: "text.secondary",
        backgroundColor: "transparent",
      },
    }),
    [neutralInteraction, theme],
  );

  const errorInteraction = useMemo(
    () => getInteractionColors(theme, { tone: "error" }),
    [theme],
  );
  const connectedControlSx = useMemo(
    () => ({
      borderColor: neutralInteraction.border,
      [HOVER_CAPABLE_QUERY]: {
        "&:hover": {
          borderColor: neutralInteraction.hoverBorder,
          backgroundColor: neutralInteraction.hoverBackground,
        },
      },
    }),
    [neutralInteraction],
  );
  const composerSurfaceSx = useMemo(
    () => getComposerSurfaceSx(theme, { isFocused }),
    [theme, isFocused],
  );
  const inputPlaceholder = isStreaming
    ? "Please wait for response to finish..."
    : isConnected
      ? "Ask about your database or anything else..."
      : "How can I help you today?";

  const selectedProviderOption = useMemo(() => {
    return (
      providerOptions.find((provider) => provider.name === selectedProvider) ||
      null
    );
  }, [providerOptions, selectedProvider]);
  const activeProviderLabel =
    selectedProviderOption?.label || selectedProvider || "";
  const llmSections = useMemo(() => {
    return providerOptions
      .filter(
        (provider) =>
          Array.isArray(provider.models) && provider.models.length > 0,
      )
      .map((provider) => ({
        name: provider.name,
        label: provider.label || provider.name,
        models: provider.models,
      }));
  }, [providerOptions]);
  const hasLlmOptions = llmSections.length > 0;
  const contextUsage = useMemo(() => {
    if (!usageMetrics) return null;
    const activeUsed =
      usageMetrics.inputPayloadTokens ?? usageMetrics.totalTokens;
    const activeBudget =
      usageMetrics.pressureTriggerTokens ?? usageMetrics.activeContextBudget;
    const modelWindow =
      usageMetrics.modelContextWindow ?? usageMetrics.totalContextWindow;
    if (activeUsed == null || activeBudget == null) return null;
    return {
      activeUsed,
      activeBudget,
      modelWindow,
      tokenCountingMode: usageMetrics.tokenCountingMode,
      contextPhase: usageMetrics.contextPhase,
      summaryThresholdTokens: usageMetrics.summaryThresholdTokens,
    };
  }, [usageMetrics]);

  const handleCloseDbMenu = useCallback(() => setDbAnchor(null), []);
  const handleCloseSchemaMenu = useCallback(() => setSchemaAnchor(null), []);
  const handleCloseLlmPopover = useCallback(() => setLlmAnchor(null), []);

  const handleSchemaChange = useCallback(
    async (schema) => {
      setSchemaAnchor(null);
      if (schema === currentSchema) return;

      const result = await selectSchema?.(schema);
      if (result && !result.success) {
        logger.error("Failed to select schema:", result.error);
      }
    },
    [currentSchema, selectSchema],
  );

  const handleDatabaseChange = useCallback(
    (dbName) => {
      setDbAnchor(null);
      if (dbName === currentDatabase) return;
      onDatabaseSwitch?.(dbName);
    },
    [currentDatabase, onDatabaseSwitch],
  );

  const handleSubmit = useCallback(
    (e) => {
      e?.preventDefault();
      if (message.trim() && !disabled && !isStreaming) {
        onSend(message.trim());
        setMessage("");
      }
    },
    [message, disabled, isStreaming, onSend],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

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
  const handleOpenSchemaMenu = useCallback(
    (e) => setSchemaAnchor(e.currentTarget),
    [],
  );
  const handleOpenLlmPopover = useCallback(
    (e) => setLlmAnchor(e.currentTarget),
    [],
  );

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
        ?.querySelectorAll(
          '[role="menuitemradio"]:not([aria-disabled="true"])',
        ) || [],
    );
    const currentIndex = items.indexOf(event.currentTarget);
    const focusItem = (index) => {
      items[index]?.focus();
    };

    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        onSelect();
        break;
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        focusItem((currentIndex + 1) % items.length);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        focusItem((currentIndex - 1 + items.length) % items.length);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
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
        pb: { xs: "max(env(safe-area-inset-bottom), 8px)", sm: 0.75 },
        position: "relative",
        zIndex: 2,
      }}
    >
      <AppPopover
        anchorEl={dbAnchor}
        open={Boolean(dbAnchor)}
        onClose={handleCloseDbMenu}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        width={220}
        paperSx={{ mt: -1 }}
      >
        <Typography sx={getPopoverSectionLabelSx(theme)}>
          Switch Database
        </Typography>
        <Box
          role="menu"
          aria-label="Switch database"
          sx={{ maxHeight: 280, overflowY: "auto", mt: 0.5 }}
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
                onKeyDown={(event) =>
                  handleMenuItemKeyDown(event, () => handleDatabaseChange(db))
                }
                sx={getSelectableMenuItemSx(theme, { isActive })}
              >
                <Typography
                  sx={{
                    ...theme.typography.uiNavItem,
                    color: "text.primary",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {db}
                </Typography>
                {isActive && (
                  <CheckRoundedIcon
                    sx={{
                      fontSize: 14,
                      color: "text.secondary",
                      flexShrink: 0,
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </AppPopover>
      <AppPopover
        anchorEl={schemaAnchor}
        open={Boolean(schemaAnchor)}
        onClose={handleCloseSchemaMenu}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
        width={200}
        paperSx={{ mt: -1 }}
      >
        <Typography sx={getPopoverSectionLabelSx(theme)}>
          PostgreSQL Schema
        </Typography>
        <Box
          role="menu"
          aria-label="Select PostgreSQL schema"
          sx={{ maxHeight: 260, overflowY: "auto", mt: 0.5 }}
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
                sx={getSelectableMenuItemSx(theme, { isActive })}
              >
                <Typography
                  sx={{
                    ...theme.typography.uiNavItem,
                    color: "text.primary",
                    fontWeight: isActive ? 500 : 400,
                  }}
                >
                  {schema}
                </Typography>
                {isActive && (
                  <CheckRoundedIcon
                    sx={{
                      fontSize: 14,
                      color: "text.secondary",
                      flexShrink: 0,
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </AppPopover>
      <AppPopover
        anchorEl={llmAnchor}
        open={Boolean(llmAnchor)}
        onClose={handleCloseLlmPopover}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "bottom", horizontal: "right" }}
        width={288}
        paperSx={{ mt: -1 }}
      >
        {/* Model list */}
        <Box
          role="menu"
          aria-label="Select model"
          sx={{ maxHeight: 280, overflowY: "auto" }}
        >
          {llmOptionsLoading ? (
            <Box sx={{ display: "grid", gap: 0.5 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton
                  key={i}
                  variant="rounded"
                  height={44}
                  sx={{ borderRadius: "8px" }}
                />
              ))}
            </Box>
          ) : hasLlmOptions ? (
            llmSections.map((section, sectionIndex) => (
              <Box key={section.name}>
                {sectionIndex > 0 && (
                  <Box
                    sx={{
                      height: "0.5px",
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
                  const isActive =
                    section.name === selectedProvider &&
                    model === selectedModel;
                  return (
                    <Box
                      component="div"
                      role="menuitemradio"
                      aria-checked={isActive}
                      tabIndex={0}
                      key={`${section.name}-${model}`}
                      onClick={() => handleLlmSelection(section.name, model)}
                      onKeyDown={(event) =>
                        handleMenuItemKeyDown(event, () =>
                          handleLlmSelection(section.name, model),
                        )
                      }
                      sx={getSelectableMenuItemSx(theme, { isActive })}
                    >
                      <Box>
                        <Typography
                          sx={{
                            ...theme.typography.uiNavItem,
                            color: "text.primary",
                            fontWeight: isActive ? 500 : 400,
                          }}
                        >
                          {model}
                        </Typography>
                      </Box>
                      {isActive && (
                        <CheckRoundedIcon
                          sx={{
                            fontSize: 14,
                            color: "text.secondary",
                            flexShrink: 0,
                          }}
                        />
                      )}
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
                  color: "text.primary",
                }}
              >
                No models available
              </Typography>
              <Typography
                sx={{
                  ...theme.typography.uiNavShortcut,
                  color: "text.secondary",
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
        sx={{
          maxWidth: UI_LAYOUT.chatInputMaxWidth,
          mx: "auto",
          position: "relative",
          ...composerSurfaceSx,
          opacity: isStreaming ? 0.72 : 1,
          transition: theme.transitions.create(
            ["opacity", "box-shadow", "border-color", "transform"],
            {
              duration: theme.transitions.duration.shorter,
            },
          ),
          [HOVER_CAPABLE_QUERY]: {
            "&:hover": {
              boxShadow: getComposerHoverShadow(theme, { isFocused }),
            },
          },
          cursor: isStreaming ? "wait" : "text",
          "@media (prefers-reduced-motion: no-preference)": {
            transform: isFocused ? "translateY(-1px)" : "translateY(0)",
          },
        }}
      >
        <Box
          sx={{
            p: { xs: 1.25, sm: 1.5 },
            display: "flex",
            flexDirection: "column",
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
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={disabled || isStreaming}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                lineHeight: 1.55,
                py: 0,
                px: 0,
                color: "text.primary",
                alignItems: "flex-start",
              },
            }}
            inputProps={{ "data-ui-target": "chat_input" }}
            sx={{
              "& .MuiInputBase-root": { p: 0 },
              "& .MuiInputBase-input": {
                py: 0.1,
                ...theme.typography.uiInput,
                lineHeight: 1.55,
                "&::placeholder": {
                  color: "text.secondary",
                  opacity: 0.62,
                },
              },
            }}
          />

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 0.75,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                minWidth: 0,
                flex: 1,
                overflowX: "auto",
                overflowY: "hidden",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {showDatabaseSelector && (
                <Box
                  key={`database-${connectionChipKey}`}
                  sx={{
                    display: "inline-flex",
                    flexShrink: 0,
                    animation: `${softReveal} 180ms ease-out both`,
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
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
                        onClick={
                          canSwitchDatabase ? handleOpenDbMenu : undefined
                        }
                        disabled={!canSwitchDatabase}
                        sx={{
                          ...toolbarActionButtonStyles,
                          ...connectedControlSx,
                          "&.Mui-disabled": {
                            opacity: 1,
                            borderColor: neutralInteraction.border,
                            color: "text.secondary",
                            backgroundColor: "transparent",
                          },
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {currentDatabase}
                        </Box>
                      </Button>
                    </span>
                  </Tooltip>
                </Box>
              )}
              {showSchemaSelector && (
                <Box
                  key={`schema-${connectionChipKey}`}
                  sx={{
                    display: "inline-flex",
                    flexShrink: 0,
                    animation: `${softReveal} 180ms ease-out both`,
                    animationDelay: "35ms",
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
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
                      <Box
                        component="span"
                        sx={{
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {currentSchema}
                      </Box>
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
                      justifyContent: "center",
                      "& .MuiButton-startIcon": {
                        ...toolbarActionButtonStyles["& .MuiButton-startIcon"],
                        mr: { xs: 0, sm: 0.5 },
                      },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: { xs: "none", sm: "inline" },
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      SQL Editor
                    </Box>
                  </Button>
                </Tooltip>
              )}
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                flexShrink: 0,
              }}
            >
              <Tooltip
                title={
                  contextUsage ? (
                    <Box sx={{ p: 0.5 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: "inherit", mb: 0.5 }}
                      >
                        {selectedModel || "Select model"}
                      </Typography>
                      {activeProviderLabel && (
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ opacity: 0.8, mb: 0.5 }}
                        >
                          Provider: {activeProviderLabel}
                        </Typography>
                      )}
                      {contextUsage.tokenCountingMode === "estimated" && (
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ opacity: 0.8, mb: 0.5 }}
                        >
                          Token usage: conservative estimate
                        </Typography>
                      )}
                      {contextUsage.contextPhase === "pre_summary" && (
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ opacity: 0.8, mb: 0.5 }}
                        >
                          Context pressure: summarizing unsummarized tail
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ opacity: 0.8 }}
                      >
                        {contextUsage.contextPhase === "pre_summary"
                          ? "Summary pressure"
                          : "Active context"}
                        : {contextUsage.activeUsed.toLocaleString()} /{" "}
                        {contextUsage.activeBudget.toLocaleString()} (
                        {Math.round(
                          (contextUsage.activeUsed /
                            contextUsage.activeBudget) *
                            100,
                        )}
                        %)
                      </Typography>
                      {contextUsage.summaryThresholdTokens != null && (
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ opacity: 0.65 }}
                        >
                          Summary trigger:{" "}
                          {contextUsage.summaryThresholdTokens.toLocaleString()}{" "}
                          tokens
                        </Typography>
                      )}
                      {contextUsage.modelWindow != null && (
                        <Typography
                          variant="caption"
                          display="block"
                          sx={{ opacity: 0.8 }}
                        >
                          Model window:{" "}
                          {contextUsage.activeUsed.toLocaleString()} /{" "}
                          {contextUsage.modelWindow.toLocaleString()} (
                          {Math.round(
                            (contextUsage.activeUsed /
                              contextUsage.modelWindow) *
                              100,
                          )}
                          %)
                        </Typography>
                      )}
                      {usageMetrics.systemPromptTokens != null &&
                        usageMetrics.toolSchemaTokens != null && (
                          <Typography
                            variant="caption"
                            display="block"
                            sx={{ opacity: 0.65, mt: 0.5 }}
                          >
                            Static: SI{" "}
                            {usageMetrics.systemPromptTokens.toLocaleString()} ·
                            tools{" "}
                            {usageMetrics.toolSchemaTokens.toLocaleString()}
                          </Typography>
                        )}
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{ opacity: 0.5, mt: 0.5, fontSize: "10px" }}
                      >
                        (Older history dynamically trimmed to stay within
                        budget)
                      </Typography>
                    </Box>
                  ) : activeProviderLabel ? (
                    `${selectedModel || "Select model"} - ${activeProviderLabel}`
                  ) : (
                    "Select model"
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
                          total={contextUsage.activeUsed}
                          budget={contextUsage.activeBudget}
                          theme={theme}
                        />
                      ) : undefined
                    }
                    endIcon={
                      <KeyboardArrowDownRoundedIcon
                        sx={{
                          transform: llmAnchor
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                          transition: theme.transitions.create("transform", {
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
                    <Box
                      component="span"
                      sx={{
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        flex: 1,
                        textAlign: "left",
                      }}
                    >
                      {selectedModel ||
                        (llmOptionsLoading ? "Loading..." : "Choose model")}
                    </Box>
                  </Button>
                </span>
              </Tooltip>

              <Tooltip
                title={
                  isStreaming
                    ? "Stop generating"
                    : hasText
                      ? "Send message"
                      : "Type a message"
                }
              >
                <span>
                  <IconButton
                    type={isStreaming ? "button" : "submit"}
                    onClick={isStreaming ? handleStopClick : undefined}
                    disabled={!isStreaming && (!hasText || disabled)}
                    aria-label={
                      isStreaming ? "Stop generating response" : "Send message"
                    }
                    sx={{
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      borderRadius: "9px",
                      color: isStreaming
                        ? theme.palette.error.main
                        : hasText
                          ? theme.palette.primary.contrastText
                          : alpha(theme.palette.text.primary, 0.28),
                      backgroundColor: isStreaming
                        ? errorInteraction.activeBackground
                        : hasText
                          ? theme.palette.primary.main
                          : alpha(theme.palette.text.primary, 0.05),
                      backgroundImage: "none",
                      border: "1px solid",
                      borderColor: isStreaming
                        ? alpha(theme.palette.error.main, 0.2)
                        : hasText
                          ? "transparent"
                          : alpha(theme.palette.text.primary, 0.07),
                      boxShadow:
                        !isStreaming && hasText
                          ? `0 5px 14px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.28 : 0.16)}`
                          : "none",
                      transition:
                        "transform 120ms ease, background-color 120ms ease, color 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
                      "&:hover": {
                        transform:
                          !isStreaming && hasText ? "translateY(-1px)" : "none",
                        backgroundColor: isStreaming
                          ? errorInteraction.activeHoverBackground
                          : hasText
                            ? theme.palette.primary.dark
                            : alpha(theme.palette.text.primary, 0.08),
                        boxShadow:
                          !isStreaming && hasText
                            ? `0 7px 18px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.32 : 0.2)}`
                            : "none",
                      },
                      "&:active": { transform: "translateY(0) scale(0.97)" },
                      "&.Mui-disabled": {
                        backgroundColor: alpha(
                          theme.palette.text.primary,
                          0.04,
                        ),
                        borderColor: alpha(theme.palette.text.primary, 0.06),
                        color: alpha(theme.palette.text.primary, 0.2),
                      },
                    }}
                  >
                    {isStreaming ? (
                      <StopRoundedIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <SendRoundedIcon sx={{ fontSize: 14, ml: "1px" }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Box>
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
  if (prevProps.usageMetrics !== nextProps.usageMetrics) return false;
  if (prevProps.children !== nextProps.children) return false;
  if (
    prevProps.availableDatabases?.length !==
    nextProps.availableDatabases?.length
  )
    return false;
  // Compare actual database identifiers, not just count, so a rename still
  // triggers a re-render even when the number of databases is unchanged.
  const prevDbKey = prevProps.availableDatabases
    ?.map((db) => db?.name || db?.database || db?.id || String(db))
    .join("\x1f");
  const nextDbKey = nextProps.availableDatabases
    ?.map((db) => db?.name || db?.database || db?.id || String(db))
    .join("\x1f");
  if (prevDbKey !== nextDbKey) return false;
  return true;
}

export default memo(ChatInput, arePropsEqual);
