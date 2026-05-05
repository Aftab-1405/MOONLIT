import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  Select,
  MenuItem,
  FormControl,
  Fade,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme as useMuiTheme } from '@mui/material/styles';
import { getAppPopoverPaperSx } from './AppPopover';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { useTheme as useAppTheme } from '../contexts/ThemeContext';
import UserDBContextManagerForAI from './UserDBContextManagerForAI';
import DialogShell from './DialogShell';
import { saveUserSettings } from '../api';
import { getScrollbarStyles, UI_LAYOUT } from '../styles/shared';
import logger from '../utils/logger';

const SECTIONS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'ai', label: 'AI' },
  { id: 'database', label: 'Database' },
  { id: 'context', label: 'AI Context' },
];

function SettingsSection({ title, children }) {
  const theme = useMuiTheme();
  return (
    <Box sx={{ mb: { xs: 5, md: 6 }, '&:last-of-type': { mb: 0 } }}>
      <Typography
        variant="subtitle1"
        sx={{
          ...theme.typography.uiCardTitle,
          color: 'text.primary',
          fontWeight: 600,
          mb: 0,
          pb: { xs: 1.5, md: 2 },
        }}
      >
        {title}
      </Typography>
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function SettingItem({ label, description, children, disabled = false }) {
  const theme = useMuiTheme();
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        display: 'flex',
        alignItems: { xs: 'stretch', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        gap: { xs: 1.25, sm: 4 },
        opacity: disabled ? 0.45 : 1,
        transition: 'opacity 150ms ease',
        minHeight: { sm: 56 },
        py: { xs: 1.75, sm: 1.25 },
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ ...theme.typography.uiBodySm, color: 'text.primary', fontWeight: 500 }}>
          {label}
        </Typography>
        {description ? (
          <Typography
            sx={{ ...theme.typography.uiCaptionMd, display: 'block', mt: 0.25, color: 'text.secondary' }}
          >
            {description}
          </Typography>
        ) : null}
      </Box>
      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: { xs: 'stretch', sm: 'flex-end' },
          alignItems: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function SettingsModal({
  open,
  onClose,
  initialSection = null,
  sidebarOpen = true,
  isNarrowLayout = false,
}) {
  const { settings, updateSetting, resetSettings } = useAppTheme();
  const [activeSection, setActiveSection] = useState('appearance');

  useEffect(() => {
    if (open && initialSection) {
      const isValid = SECTIONS.some((s) => s.id === initialSection);
      if (isValid) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Preserve initial-section routing when settings opens from UI actions.
        setActiveSection(initialSection);
      } else {
        setActiveSection('appearance');
      }
    }
  }, [open, initialSection]);

  const theme = useMuiTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const selectMenuProps = useMemo(() => ({
    PaperProps: { sx: getAppPopoverPaperSx(theme, isDark) },
  }), [theme, isDark]);

  const isDarkTheme = settings.theme === 'dark';
  const idleAnimationEnabled = isDarkTheme && (settings.idleAnimation ?? true);
  const idleControlsDisabled = !isDarkTheme || !idleAnimationEnabled;

  const sidebarOffset = !isNarrowLayout && !isMobile
    ? (sidebarOpen ? UI_LAYOUT.sidebarExpandedWidth : UI_LAYOUT.sidebarCollapsedWidth)
    : 0;
  const settingsSurfaceLeft = `${sidebarOffset}px`;
  const settingsSurfaceWidth = sidebarOffset > 0 ? `calc(100vw - ${sidebarOffset}px)` : '100vw';

  // Compact pill-style toggle matching Claude.ai segment control
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
      transition: 'background-color 150ms ease, color 150ms ease, box-shadow 150ms ease',
      '&.Mui-selected': {
        color: 'text.primary',
        fontWeight: 600,
        backgroundColor: theme.palette.background.paper,
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, isDark ? 0.3 : 0.1)}, inset 0 0 0 1px ${alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08)}`,
        '&:hover': {
          backgroundColor: theme.palette.background.paper,
        },
      },
      '&:hover:not(.Mui-selected)': {
        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
        color: 'text.primary',
      },
    },
  }), [isDark, theme]);

  // Minimal ghost select — no visible border, right-aligned value
  const controlSx = {
    '& .MuiInputBase-root': {
      height: 32,
      borderRadius: '8px',
      backgroundColor: 'transparent',
      transition: 'background-color 150ms ease',
      '&:hover': {
        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.07 : 0.05),
      },
      '&.Mui-focused': {
        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.07 : 0.05),
      },
    },
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '& .Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '& .MuiSelect-select': {
      py: 0,
      pr: '28px !important',
      pl: '10px',
      ...theme.typography.uiNavItem,
      fontWeight: 500,
      color: 'text.primary',
    },
    '& .MuiSelect-icon': {
      color: 'text.secondary',
      opacity: 0.6,
    },
  };

  const NavContent = (
    <Box
      component="nav"
      aria-label="Settings"
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
        {SECTIONS.map((section) => (
          <Box component="li" key={section.id} sx={{ flexShrink: 0 }}>
            <Button
              type="button"
              aria-current={activeSection === section.id ? 'page' : undefined}
              onClick={() => setActiveSection(section.id)}
              sx={{
                height: 36,
                width: { xs: 'auto', md: '100%' },
                justifyContent: 'flex-start',
                px: 1.5,
                py: 0,
                borderRadius: '8px',
                textTransform: 'none',
                whiteSpace: 'nowrap',
                color: activeSection === section.id ? 'text.primary' : 'text.secondary',
                ...theme.typography.uiNavItem,
                fontWeight: activeSection === section.id ? 600 : 400,
                backgroundColor: activeSection === section.id
                  ? alpha(theme.palette.text.primary, isDark ? 0.1 : 0.07)
                  : 'transparent',
                transition: 'background-color 150ms ease, color 150ms ease',
                '&:hover': {
                  backgroundColor: activeSection === section.id
                    ? alpha(theme.palette.text.primary, isDark ? 0.12 : 0.09)
                    : alpha(theme.palette.text.primary, isDark ? 0.06 : 0.05),
                  color: 'text.primary',
                },
              }}
            >
              {section.label}
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );

  const mobileNav = isMobile ? (
    <Box
      sx={{
        mb: 4,
        mx: { xs: -2.5, sm: -5 },
        px: { xs: 2.5, sm: 5 },
        pb: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        ...getScrollbarStyles(theme),
      }}
    >
      {NavContent}
    </Box>
  ) : null;

  const desktopNav = !isMobile ? (
    <Box sx={{ width: 200, flexShrink: 0 }}>
      <Box sx={{ position: 'sticky', top: 86 }}>
        {NavContent}
      </Box>
    </Box>
  ) : null;

  const renderContent = () => {
    switch (activeSection) {
      case 'appearance':
        return (
          <Fade in key="appearance">
            <Box>
              <SettingsSection title="Appearance">
                <SettingItem label="Theme" description="Choose light or dark interface">
                  <ToggleButtonGroup
                    value={settings.theme}
                    exclusive
                    onChange={(e, value) => value && updateSetting('theme', value)}
                    size="small"
                    sx={toggleStyles}
                  >
                    <ToggleButton value="light" aria-label="Light theme">
                      <LightModeRoundedIcon sx={{ fontSize: 16, mr: 0.75 }} />
                      Light
                    </ToggleButton>
                    <ToggleButton value="dark" aria-label="Dark theme">
                      <DarkModeRoundedIcon sx={{ fontSize: 16, mr: 0.75 }} />
                      Dark
                    </ToggleButton>
                  </ToggleButtonGroup>
                </SettingItem>
                <SettingItem
                  label="Idle Animation"
                  description={isDarkTheme ? 'Show starfield effect when idle' : 'Only available in dark theme'}
                  disabled={!isDarkTheme}
                >
                  <Switch
                    checked={idleAnimationEnabled}
                    onChange={(e) => updateSetting('idleAnimation', e.target.checked)}
                    disabled={!isDarkTheme}
                    size="small"
                  />
                </SettingItem>
                <SettingItem
                  label="Idle Intensity"
                  description="Control starfield brightness when idle"
                  disabled={idleControlsDisabled}
                >
                  <ToggleButtonGroup
                    value={settings.idleAnimationIntensity ?? 'medium'}
                    exclusive
                    onChange={(e, value) => value && updateSetting('idleAnimationIntensity', value)}
                    size="small"
                    disabled={idleControlsDisabled}
                    sx={toggleStyles}
                  >
                    <ToggleButton value="low">Low</ToggleButton>
                    <ToggleButton value="medium">Med</ToggleButton>
                    <ToggleButton value="high">High</ToggleButton>
                  </ToggleButtonGroup>
                </SettingItem>
              </SettingsSection>
            </Box>
          </Fade>
        );
      case 'ai':
        return (
          <Fade in key="ai">
            <Box>
              <SettingsSection title="AI Settings">
                <SettingItem label="Enable Thinking" description="Show AI's reasoning process">
                  <Switch
                    checked={settings.enableReasoning ?? true}
                    onChange={(e) => updateSetting('enableReasoning', e.target.checked)}
                    size="small"
                  />
                </SettingItem>
                {settings.enableReasoning ? (
                  <SettingItem label="Thinking Depth" description="Higher = more thorough but slower">
                    <ToggleButtonGroup
                      value={settings.reasoningEffort ?? 'medium'}
                      exclusive
                      onChange={(e, value) => value && updateSetting('reasoningEffort', value)}
                      size="small"
                      sx={toggleStyles}
                    >
                      <ToggleButton value="low">Low</ToggleButton>
                      <ToggleButton value="medium">Med</ToggleButton>
                      <ToggleButton value="high">High</ToggleButton>
                    </ToggleButtonGroup>
                  </SettingItem>
                ) : null}
                <SettingItem label="Response Style" description="How AI formats responses">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      value={settings.responseStyle ?? 'balanced'}
                      onChange={(e) => updateSetting('responseStyle', e.target.value)}
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value="concise">Concise</MenuItem>
                      <MenuItem value="balanced">Balanced</MenuItem>
                      <MenuItem value="detailed">Detailed</MenuItem>
                    </Select>
                  </FormControl>
                </SettingItem>
              </SettingsSection>
            </Box>
          </Fade>
        );
      case 'database':
        return (
          <Fade in key="database">
            <Box>
              <SettingsSection title="Database Settings">
                <SettingItem label="Confirm Before Running" description="Show dialog before executing SQL">
                  <Switch
                    checked={settings.confirmBeforeRun ?? true}
                    onChange={(e) => updateSetting('confirmBeforeRun', e.target.checked)}
                    size="small"
                  />
                </SettingItem>
                <SettingItem label="Query Timeout" description="Max wait time for results">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      value={settings.queryTimeout ?? 30}
                      onChange={(e) => updateSetting('queryTimeout', e.target.value)}
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value={10}>10 sec</MenuItem>
                      <MenuItem value={30}>30 sec</MenuItem>
                      <MenuItem value={60}>1 min</MenuItem>
                      <MenuItem value={120}>2 min</MenuItem>
                      <MenuItem value={300}>5 min</MenuItem>
                    </Select>
                  </FormControl>
                </SettingItem>
                <SettingItem
                  label="Max Rows"
                  description={settings.maxRows === 0 ? '⚠️ No limit — may slow down' : 'Limit results to prevent slowdown'}
                >
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      value={settings.maxRows ?? 1000}
                      onChange={(e) => updateSetting('maxRows', e.target.value)}
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value={100}>100</MenuItem>
                      <MenuItem value={500}>500</MenuItem>
                      <MenuItem value={1000}>1,000</MenuItem>
                      <MenuItem value={5000}>5,000</MenuItem>
                      <MenuItem value={10000}>10,000</MenuItem>
                      <MenuItem value={0} sx={{ color: 'warning.main', fontWeight: 500 }}>No Limit ⚠️</MenuItem>
                    </Select>
                  </FormControl>
                </SettingItem>
                <SettingItem label="NULL Display" description="How to show NULL values">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      value={settings.nullDisplay ?? 'NULL'}
                      onChange={(e) => updateSetting('nullDisplay', e.target.value)}
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value="NULL">NULL</MenuItem>
                      <MenuItem value="(null)">(null)</MenuItem>
                      <MenuItem value="-">—</MenuItem>
                      <MenuItem value="">(empty)</MenuItem>
                    </Select>
                  </FormControl>
                </SettingItem>
              </SettingsSection>
              <SettingsSection title="Connection">
                <SettingItem label="Remember Connection" description="Auto-fill on next visit">
                  <Switch
                    checked={settings.rememberConnection ?? false}
                    onChange={(e) => updateSetting('rememberConnection', e.target.checked)}
                    size="small"
                  />
                </SettingItem>
                <SettingItem label="Connection Persistence" description="Keep alive after closing tab">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      value={settings.connectionPersistence ?? 0}
                      MenuProps={selectMenuProps}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateSetting('connectionPersistence', value);
                        saveUserSettings({ connectionPersistenceMinutes: value })
                          .catch((error) => logger.warn('Failed to sync setting:', error));
                      }}
                    >
                      <MenuItem value={0}>Never</MenuItem>
                      <MenuItem value={5}>5 min</MenuItem>
                      <MenuItem value={15}>15 min</MenuItem>
                      <MenuItem value={30}>30 min</MenuItem>
                      <MenuItem value={60}>1 hour</MenuItem>
                    </Select>
                  </FormControl>
                </SettingItem>
                <SettingItem label="Default Database Type" description="Pre-selected when connecting">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      value={settings.defaultDbType ?? 'postgresql'}
                      onChange={(e) => updateSetting('defaultDbType', e.target.value)}
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value="mysql">MySQL</MenuItem>
                      <MenuItem value="postgresql">PostgreSQL</MenuItem>
                      <MenuItem value="sqlserver">SQL Server</MenuItem>
                      <MenuItem value="oracle">Oracle</MenuItem>
                    </Select>
                  </FormControl>
                </SettingItem>
              </SettingsSection>
            </Box>
          </Fade>
        );
      case 'context':
        return (
          <Fade in key="context">
            <Box>
              <SettingsSection title="AI Context">
                <Box sx={{ pt: 2 }}>
                  <UserDBContextManagerForAI />
                </Box>
              </SettingsSection>
            </Box>
          </Fade>
        );
      default:
        return null;
    }
  };

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      isMobile={isMobile}
      maxWidth={false}
      fullWidth={false}
      desktopMaxHeight="100vh"
      desktopMinHeight="100vh"
      showCloseButton={false}
      paperSx={{
        position: 'fixed',
        inset: '0 auto auto auto',
        left: settingsSurfaceLeft,
        top: 0,
        width: settingsSurfaceWidth,
        maxWidth: settingsSurfaceWidth,
        height: '100vh',
        maxHeight: '100vh',
        minHeight: '100vh',
        m: 0,
        borderRadius: 0,
        backgroundColor: theme.palette.background.default,
        boxShadow: 'none',
      }}
      backdropSx={{
        left: settingsSurfaceLeft,
        width: settingsSurfaceWidth,
      }}
      bodySx={{
        display: 'block',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: theme.palette.background.default,
        ...getScrollbarStyles(theme),
      }}
    >
      {/* Page header with title + close */}
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
          Settings
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

      {/* Main content */}
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
          {mobileNav}
          {desktopNav}

          {/* Content pane */}
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
            {renderContent()}

            {/* Footer actions */}
            <Box
              sx={{
                mt: { xs: 6, md: 8 },
                pt: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Button
                variant="text"
                onClick={resetSettings}
                color="inherit"
                size="small"
                sx={{
                  ...theme.typography.uiNavItem,
                  textTransform: 'none',
                  fontWeight: 500,
                  px: 0,
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary', backgroundColor: 'transparent' },
                }}
              >
                Reset to defaults
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </DialogShell>
  );
}

export default SettingsModal;
