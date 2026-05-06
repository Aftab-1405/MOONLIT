import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  useMediaQuery,
  Slide,
  Stack,
  Fade,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { useSettings } from '../contexts/SettingsContext';
import { useLocalStorage } from '../hooks';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import {
  getDatabases,
  connectDb,
  disconnectDb,
  switchDatabase,
  selectDatabase,
} from '../api';
import {
  useFormValidation,
  credentialsSchema,
  connectionStringSchema,
  dbFieldSchemas,
} from '../validation';
import { DB_TYPES } from '../config/databases';
import DialogShell from './DialogShell';
import {
  getCompactActionSx,
  getScrollbarStyles,
  UI_LAYOUT,
} from '../styles/shared';
import logger from '../utils/logger';

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function DatabaseSection({ title, children, sx = {}, noDivider = false }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        mb: { xs: 5, md: 6 },
        '&:last-of-type': { mb: 0 },
        ...sx,
      }}
    >
      {title ? (
        <Typography
          variant="subtitle1"
          sx={{
            ...theme.typography.uiCardTitle,
            color: 'text.primary',
            fontWeight: 600,
            pb: { xs: 1.5, md: 2 },
          }}
        >
          {title}
        </Typography>
      ) : null}
      {noDivider ? children : (
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

function FieldGrid({ children }) {
  return (
    <Box
      sx={{
        mt: 2,
        mb: 1,
        '& .MuiTextField-root': {
          '& .MuiInputBase-root': {
            borderRadius: '8px',
            backgroundColor: 'transparent',
          },
        },
      }}
    >
      {children}
    </Box>
  );
}

const VisibilityToggleAdornment = memo(({ show, onToggle }) => (
  <InputAdornment position="end">
    <IconButton
      size="small"
      onClick={onToggle}
      edge="end"
      aria-label={show ? 'Hide password' : 'Show password'}
      sx={(theme) => getCompactActionSx(theme)}
    >
      {show ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
    </IconButton>
  </InputAdornment>
));

function EmptyState({ icon, title, subtitle }) {
  const Icon = icon;
  const theme = useTheme();
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
      <Icon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
      <Typography sx={{ ...theme.typography.uiBodySm, color: 'text.secondary', fontWeight: 500 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography sx={{ ...theme.typography.uiCaptionMd, color: 'text.disabled', mt: 0.5, display: 'block' }}>
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}

const DatabaseList = memo(({ databases, currentDatabase, onSelect, loading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (databases.length === 0) {
    return (
      <EmptyState
        icon={StorageRoundedIcon}
        title="No databases found"
        subtitle="Connect to a server first"
      />
    );
  }

  return (
    <Box
      sx={{
        borderTop: '1px solid',
        borderColor: 'divider',
        pt: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
      }}
    >
      {databases.map((db) => {
        const isSelected = db === currentDatabase;
        return (
          <Box
            key={db}
            role="button"
            tabIndex={loading ? -1 : 0}
            onClick={() => !loading && onSelect(db)}
            onKeyDown={(e) => {
              if (!loading && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelect(db);
              }
            }}
            aria-pressed={isSelected}
            sx={{
              px: 1.5,
              py: 1,
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'background-color 120ms ease',
              minHeight: { xs: UI_LAYOUT.touchTarget, sm: 40 },
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              backgroundColor: isSelected
                ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.07)
                : 'transparent',
              '&:hover': !loading ? {
                backgroundColor: isSelected
                  ? alpha(theme.palette.text.primary, isDark ? 0.12 : 0.09)
                  : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
              } : undefined,
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 1,
              },
            }}
          >
            {isSelected ? (
              <CheckRoundedIcon sx={{ fontSize: 16, color: 'text.primary', flexShrink: 0 }} />
            ) : (
              <StorageRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
            )}
            <Typography
              sx={{
                ...theme.typography.uiBodySm,
                fontWeight: isSelected ? 600 : 400,
                color: isSelected ? 'text.primary' : 'text.secondary',
              }}
            >
              {db}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
});

function DatabaseModal({
  open,
  onClose,
  onConnect,
  isConnected,
  currentDatabase,
  initialDbType = null,
  sidebarOpen = true,
  isNarrowLayout = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { settings } = useSettings();
  const defaultDbType = settings.defaultDbType || 'postgresql';
  const rememberConnection = settings.rememberConnection ?? false;
  const [savedConnection, setSavedConnection] = useLocalStorage('moonlit-saved-connection', null);
  const [dbType, setDbType] = useState(defaultDbType);
  const [connectionMode, setConnectionMode] = useState('credentials');
  const [connectionString, setConnectionString] = useState('');
  const [mobileSection, setMobileSection] = useState('connect');
  const [formData, setFormData] = useState({
    host: '',
    port: '5432',
    user: '',
    password: '',
    database: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConnectionString, setShowConnectionString] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [isRemote, setIsRemote] = useState(false);
  const { errors: fieldErrors, validateForm, clearError } = useFormValidation(dbFieldSchemas);
  const currentDbConfig = useMemo(() => DB_TYPES.find((db) => db.value === dbType) || DB_TYPES[1], [dbType]);
  const supportsConnectionString = currentDbConfig.supportsConnectionString;
  const hasDatabases = databases.length > 0;
  const sidebarOffset = !isNarrowLayout && !isMobile
    ? (sidebarOpen ? UI_LAYOUT.sidebarExpandedWidth : UI_LAYOUT.sidebarCollapsedWidth)
    : 0;
  const databaseSurfaceLeft = `${sidebarOffset}px`;
  const databaseSurfaceWidth = sidebarOffset > 0 ? `calc(100vw - ${sidebarOffset}px)` : '100vw';
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

  useEffect(() => {
    if (rememberConnection && open && savedConnection) {
      if (savedConnection.dbType) setDbType(savedConnection.dbType);
      if (savedConnection.connectionMode) setConnectionMode(savedConnection.connectionMode);
      if (savedConnection.formData) {
        setFormData((prev) => ({ ...prev, ...savedConnection.formData }));
      }
    }
  }, [open, rememberConnection, savedConnection]);

  useEffect(() => {
    if (open && initialDbType) {
      const isValid = DB_TYPES.some((db) => db.value === initialDbType);
      if (isValid) {
        setDbType(initialDbType);
        // Also update the port to match the new db type
        const dbConfig = DB_TYPES.find((db) => db.value === initialDbType);
        if (dbConfig?.defaultPort) {
          setFormData((prev) => ({ ...prev, port: dbConfig.defaultPort.toString() }));
        }
      }
    }
  }, [open, initialDbType]);

  const fetchDatabases = useCallback(async () => {
    try {
      const data = await getDatabases();
      if (data.status === 'success' && data.databases) {
        setDatabases(data.databases);
        if (data.is_remote) {
          setIsRemote(true);
          if (data.db_type) {
            setDbType(data.db_type);
          }
          setConnectionMode('connection_string');
        }
      }
    } catch (err) {
      logger.error('Failed to fetch databases:', err);
    }
  }, []);

  useEffect(() => {
    if (open && isConnected && databases.length === 0) {
      fetchDatabases();
    }
  }, [open, isConnected, databases.length, fetchDatabases]);

  useEffect(() => {
    if (!hasDatabases && mobileSection === 'databases') {
      setMobileSection('connect');
    }
  }, [hasDatabases, mobileSection]);

  const handleDbTypeChange = useCallback((newValue) => {
    setDbType(newValue);
    const dbConfig = DB_TYPES.find((db) => db.value === newValue);
    setFormData((prev) => ({
      ...prev,
      port: dbConfig?.defaultPort?.toString() || '',
    }));
    setError(null);
  }, []);

  const handleInputChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearError(name);
    setError(null);
  }, [clearError]);

  const handleConnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let payload;
      let isValid = false;

      if (connectionMode === 'connection_string' && supportsConnectionString) {
        isValid = validateForm(connectionStringSchema, { connectionString });
        payload = { db_type: dbType, connection_string: connectionString };
      } else {
        isValid = validateForm(credentialsSchema, formData);
        payload = { db_type: dbType, ...formData };
      }

      if (!isValid) {
        setLoading(false);
        return;
      }

      const data = await connectDb(payload);

      if (data.status === 'connected') {
        setSuccess(data.message);
        setDatabases(data.schemas || []);
        setIsRemote(data.is_remote || false);
        onConnect?.({ ...data, db_type: dbType });

        if (rememberConnection) {
          setSavedConnection({
            dbType,
            connectionMode,
            formData: {
              host: formData.host,
              port: formData.port,
              user: formData.user,
              database: formData.database,
            },
          });
        }

      } else {
        setError(data.message || 'Failed to connect');
      }
    } catch (err) {
      setError(err.message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  }, [
    connectionMode,
    connectionString,
    dbType,
    formData,
    onConnect,
    rememberConnection,
    setSavedConnection,
    supportsConnectionString,
    validateForm,
  ]);

  const handleSelectDatabase = useCallback(async (dbName) => {
    setLoading(true);
    setError(null);
    try {
      const data = isRemote ? await switchDatabase(dbName) : await selectDatabase(dbName);
      if (data.status === 'connected') {
        setSuccess(`Switched to ${dbName}`);
        onConnect?.({ ...data, selectedDatabase: dbName });
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError(err.message || 'Failed to select database');
    } finally {
      setLoading(false);
    }
  }, [isRemote, onConnect]);

  const handleDisconnect = useCallback(async () => {
    setLoading(true);
    try {
      await disconnectDb();
      setDatabases([]);
      setSuccess(null);
      onConnect?.(null);
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  }, [onConnect]);

  const isDark = theme.palette.mode === 'dark';

  const toggleStyles = useMemo(() => ({
    width: { xs: '100%', sm: 'auto' },
    borderRadius: '8px',
    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06),
    p: '2px',
    gap: 0,
    '& .MuiToggleButtonGroup-grouped': {
      border: 0,
      '&:not(:first-of-type)': { borderLeft: 0, marginLeft: 0 },
    },
    '& .MuiToggleButton-root': {
      px: { xs: 1.25, sm: 1.5 },
      py: 0,
      height: 32,
      minWidth: { sm: 44 },
      flex: { xs: 1, sm: 'unset' },
      border: '0 !important',
      borderRadius: '6px !important',
      color: 'text.secondary',
      ...theme.typography.uiNavItem,
      fontWeight: 500,
      textTransform: 'none',
      gap: 0.75,
      transition: 'background-color 150ms ease, color 150ms ease, box-shadow 150ms ease',
      '&.Mui-selected': {
        color: 'text.primary',
        fontWeight: 600,
        backgroundColor: theme.palette.background.paper,
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, isDark ? 0.3 : 0.1)}, inset 0 0 0 1px ${alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08)}`,
        '&:hover': { backgroundColor: theme.palette.background.paper },
      },
      '&:hover:not(.Mui-selected)': {
        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
        color: 'text.primary',
      },
    },
  }), [isDark, theme]);

  const navContent = (
    <Box
      component="nav"
      aria-label="Database type"
      sx={{ minWidth: 0 }}
    >
      <Box
        component="ul"
        sx={{
          display: 'flex',
          flexDirection: { xs: 'row', md: 'column' },
          gap: { xs: 0.25, md: 0.5 },
          m: 0,
          p: 0,
          listStyle: 'none',
          minWidth: 0,
        }}
      >
      {DB_TYPES.map((type) => (
        <Box component="li" key={type.value} sx={{ flexShrink: 0 }}>
          <Button
            type="button"
            aria-current={dbType === type.value ? 'page' : undefined}
            onClick={() => handleDbTypeChange(type.value)}
            sx={{
              height: 36,
              width: { xs: 'auto', md: '100%' },
              justifyContent: 'flex-start',
              gap: 1,
              px: 1.5,
              py: 0,
              borderRadius: '8px',
              textTransform: 'none',
              whiteSpace: 'nowrap',
              color: dbType === type.value ? 'text.primary' : 'text.secondary',
              ...theme.typography.uiNavItem,
              fontWeight: dbType === type.value ? 600 : 400,
              backgroundColor: dbType === type.value
                ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.07)
                : 'transparent',
              transition: 'background-color 150ms ease, color 150ms ease',
              '&:hover': {
                backgroundColor: dbType === type.value
                  ? alpha(theme.palette.text.primary, isDark ? 0.12 : 0.09)
                  : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
                color: 'text.primary',
              },
            }}
            startIcon={(
              <Box
                component="img"
                src={type.icon}
                alt=""
                sx={{ width: 18, height: 18, objectFit: 'contain' }}
              />
            )}
          >
            {type.label}
          </Button>
        </Box>
      ))}
      </Box>
    </Box>
  );

  const renderConnectionForm = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        '& .MuiInputBase-input': {
          ...theme.typography.uiInput,
        },
      }}
    >
      {supportsConnectionString ? (
        <DatabaseSection title="Connection Method">
          <Box sx={{ pt: 2 }}>
            <ToggleButtonGroup
              value={connectionMode}
              exclusive
              onChange={(event, value) => value && setConnectionMode(value)}
              size="small"
              sx={toggleStyles}
            >
              <ToggleButton value="credentials">
                <VpnKeyRoundedIcon sx={{ fontSize: 16 }} />
                Credentials
              </ToggleButton>
              <ToggleButton value="connection_string">
                <LinkRoundedIcon sx={{ fontSize: 16 }} />
                Connection String
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DatabaseSection>
      ) : null}
      <DatabaseSection title="Connection Details">
        <FieldGrid>
        {connectionMode === 'connection_string' && supportsConnectionString ? (
          <TextField
            fullWidth
            label="Connection String"
            value={connectionString}
            onChange={(event) => {
              setConnectionString(event.target.value);
              clearError('connectionString');
            }}
            type={showConnectionString ? 'text' : 'password'}
            error={!!fieldErrors.connectionString}
            helperText={fieldErrors.connectionString || 'e.g., postgresql://user:pass@host:5432/db'}
            size="small"
            InputProps={{
              endAdornment: <VisibilityToggleAdornment show={showConnectionString} onToggle={() => setShowConnectionString(!showConnectionString)} />,
            }}
          />
        ) : (
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                name="host"
                label="Host"
                placeholder="e.g., db.example.com"
                value={formData.host}
                onChange={handleInputChange}
                error={!!fieldErrors.host}
                helperText={fieldErrors.host}
                size="small"
              />
              <TextField
                sx={{ width: { xs: '100%', sm: 100 }, flexShrink: 0 }}
                name="port"
                label="Port"
                value={formData.port}
                onChange={handleInputChange}
                error={!!fieldErrors.port}
                size="small"
              />
            </Stack>
            <TextField
              fullWidth
              name="user"
              label="Username"
              autoCapitalize="none"
              value={formData.user}
              onChange={handleInputChange}
              error={!!fieldErrors.user}
              size="small"
            />
            <TextField
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleInputChange}
              error={!!fieldErrors.password}
              size="small"
              InputProps={{
                endAdornment: <VisibilityToggleAdornment show={showPassword} onToggle={() => setShowPassword(!showPassword)} />,
              }}
            />
            <TextField
              fullWidth
              name="database"
              label="Database (Optional)"
              value={formData.database}
              onChange={handleInputChange}
              autoCapitalize="none"
              size="small"
            />
          </Stack>
        )}
        </FieldGrid>
      </DatabaseSection>
      {error ? <Alert severity="error" sx={{ borderRadius: 2, mt: 1 }}>{error}</Alert> : null}
      {success ? <Alert severity="success" sx={{ borderRadius: 2, mt: 1 }}>{success}</Alert> : null}
    </Box>
  );

  const renderDatabaseSection = (sx = {}) => (
    <Box sx={{ ...sx }}>
      <DatabaseSection title="Available Databases" sx={{ mb: 0 }} noDivider>
        <DatabaseList
          databases={databases}
          currentDatabase={currentDatabase}
          onSelect={handleSelectDatabase}
          loading={loading}
        />
      </DatabaseSection>
    </Box>
  );

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      isMobile={isMobile}
      maxWidth={false}
      fullWidth={false}
      TransitionComponent={isMobile ? Transition : undefined}
      desktopMaxHeight="100vh"
      desktopMinHeight="100vh"
      showCloseButton={false}
      container={mainContentContainer}
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      keepMounted
      transitionDuration={180}
      rootSx={mainContentDialogRootSx}
      paperSx={{
        position: 'fixed',
        inset: '0 auto auto auto',
        left: databaseSurfaceLeft,
        top: 0,
        width: databaseSurfaceWidth,
        maxWidth: databaseSurfaceWidth,
        height: '100vh',
        maxHeight: '100vh',
        minHeight: '100vh',
        m: 0,
        borderRadius: 0,
        backgroundColor: theme.palette.background.default,
        boxShadow: 'none',
      }}
      backdropSx={{
        left: databaseSurfaceLeft,
        width: databaseSurfaceWidth,
        backgroundColor: 'transparent',
      }}
      bodySx={{
        display: 'block',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: theme.palette.background.default,
        ...getScrollbarStyles(theme),
      }}
    >
      <Box
        component="header"
        sx={{
          display: 'flex',
          alignItems: { xs: 'center', md: 'flex-end' },
          justifyContent: 'space-between',
          height: { xs: 'auto', md: 96 },
          px: { xs: 2.5, sm: 5, md: 8, lg: 10 },
          pt: { xs: 3, md: 0 },
          pb: { xs: 2, md: 0 },
          maxWidth: 1380,
          mx: 'auto',
          width: '100%',
        }}
      >
        <Typography
          component="h1"
          sx={{
            ...theme.typography.h3,
            color: 'text.primary',
            pb: { xs: 0, md: 2 },
          }}
        >
          Connect Database
        </Typography>
        <Button
          onClick={onClose}
          size="small"
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
              backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06),
              color: 'text.primary',
            },
          }}
        >
          Close
        </Button>
      </Box>

      <Box
        component="main"
        sx={{
          width: '100%',
          maxWidth: 1380,
          mx: 'auto',
          px: { xs: 2.5, sm: 5, md: 8, lg: 10 },
          pt: { xs: 3, md: 4 },
          pb: { xs: 6, md: 8 },
        }}
      >
        <Box
          sx={{
            display: { xs: 'block', md: 'grid' },
            gridTemplateColumns: '200px minmax(0, 1fr)',
            columnGap: { md: 8, lg: 10 },
            alignItems: 'start',
          }}
        >
          <Box
            sx={{
              mb: { xs: 3, md: 0 },
              overflowX: { xs: 'auto', md: 'visible' },
              overflowY: 'hidden',
              mx: { xs: -2.5, sm: -5, md: 0 },
              px: { xs: 2.5, sm: 5, md: 0 },
              ...getScrollbarStyles(theme),
            }}
          >
            <Box sx={{ position: { md: 'sticky' }, top: { md: 86 } }}>
              {navContent}
            </Box>
          </Box>

          <Box
            tabIndex={-1}
            sx={{
              outline: 'none',
              flex: 1,
              minWidth: 0,
              maxWidth: 860,
              mt: { xs: 0, md: 4 },
            }}
          >
            {hasDatabases ? (
              <Box sx={{ mb: 4 }}>
                <ToggleButtonGroup
                  value={mobileSection}
                  exclusive
                  onChange={(event, value) => value && setMobileSection(value)}
                  size="small"
                  sx={toggleStyles}
                >
                  <ToggleButton value="connect">
                    <LinkRoundedIcon sx={{ fontSize: 16 }} />
                    Connection
                  </ToggleButton>
                  <ToggleButton value="databases">
                    <StorageRoundedIcon sx={{ fontSize: 16 }} />
                    Databases
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            ) : null}

            <Fade in key={mobileSection}>
              <Box>
                {mobileSection === 'databases' && hasDatabases ? (
                  renderDatabaseSection()
                ) : (
                  <>
                    {renderConnectionForm()}
                    {hasDatabases ? renderDatabaseSection({ mt: { xs: 5, md: 6 } }) : null}
                  </>
                )}
              </Box>
            </Fade>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 2,
                mt: { xs: 6, md: 8 },
                pt: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              {isConnected ? (
                <Button
                  variant="text"
                  onClick={handleDisconnect}
                  color="error"
                  disabled={loading}
                  size="small"
                  sx={{
                    ...theme.typography.uiNavItem,
                    textTransform: 'none',
                    fontWeight: 500,
                    px: 0,
                    '&:hover': { backgroundColor: 'transparent' },
                  }}
                >
                  Disconnect
                </Button>
              ) : <Box />}
              <Button
                variant="contained"
                onClick={handleConnect}
                disabled={loading || isConnected}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                size="small"
                disableElevation
                sx={{
                  ...theme.typography.uiNavItem,
                  height: 36,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontWeight: 600,
                  px: 2,
                }}
              >
                {loading ? 'Connecting…' : isConnected ? 'Connected' : 'Connect'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </DialogShell>
  );
}

export default memo(DatabaseModal);
