import { memo, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  Select,
  MenuItem,
  FormControl,
  Fade,
  useMediaQuery,
  Typography,
} from '@mui/material';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import MemoryIcon from '@mui/icons-material/Memory';
import DatabaseIcon from '@/components/icons/DatabaseIcon';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import UserDBContextManagerForAI from '@/features/overlays/settings/UserDBContextManagerForAI';
import { DialogShell } from '@/components';
import { getPopoverPaperSx, UI_Z_INDEX } from '@/styles/shared';
import {
  PreferenceFooterActions,
  PreferenceLayout,
  PreferenceNavItem,
  PreferenceNavList,
  PreferencePageHeader,
  PreferenceRow,
  PreferenceSection,
  getPreferenceBackdropSx,
  getPreferenceBodySx,
  getPreferenceButtonSx,
  getPreferenceControlSx,
  getPreferencePaperSx,
  getPreferenceRootSx,
  getPreferenceToggleGroupSx,
} from '@/features/overlays/preference-surface';

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: PaletteRoundedIcon },
  { id: 'ai', label: 'Moonlit', icon: AutoAwesomeRoundedIcon },
  { id: 'database', label: 'Database', icon: DatabaseIcon },
  { id: 'context', label: 'AI Context', icon: MemoryIcon },
];

function SettingsModal({
  open,
  onClose,
  initialSection = null,
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
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const selectMenuProps = useMemo(() => ({
    PaperProps: { sx: getPopoverPaperSx(theme, theme.palette.mode === 'dark') },
    sx: { zIndex: UI_Z_INDEX.mainContentModal + 10 },
  }), [theme]);

  const settingsSurfaceLeft = '0px';
  const settingsSurfaceWidth = '100vw';
  const mainContentDialogRootSx = useMemo(() => getPreferenceRootSx(), []);
  const controlSx = useMemo(() => getPreferenceControlSx(theme), [theme]);
  const toggleGroupSx = useMemo(() => getPreferenceToggleGroupSx(theme), [theme]);
  const subtleButtonSx = useMemo(() => getPreferenceButtonSx(theme), [theme]);

  const NavContent = (
    <PreferenceNavList ariaLabel="Settings">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <PreferenceNavItem
            key={section.id}
            active={activeSection === section.id}
            onClick={() => setActiveSection(section.id)}
            icon={<Icon />}
          >
            {section.label}
          </PreferenceNavItem>
        );
      })}
    </PreferenceNavList>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'appearance':
        return (
          <Fade in key="appearance">
            <Box>
              <PreferenceSection title="Appearance">
                <PreferenceRow label="Theme" description="Choose light or dark interface">
                  <ToggleButtonGroup
                    value={settings.theme}
                    exclusive
                    onChange={(e, value) => value && updateSetting('theme', value)}
                    size="small"
                    sx={toggleGroupSx}
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
                </PreferenceRow>
              </PreferenceSection>
            </Box>
          </Fade>
        );
      case 'ai':
        return (
          <Fade in key="ai">
            <Box>
              <PreferenceSection title="AI Settings">

                <PreferenceRow label="Response Style" description="How AI formats responses" htmlFor="setting-response-style">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      id="setting-response-style"
                      value={settings.responseStyle ?? 'balanced'}
                      onChange={(e) => updateSetting('responseStyle', e.target.value)}
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value="concise">Concise</MenuItem>
                      <MenuItem value="balanced">Balanced</MenuItem>
                      <MenuItem value="detailed">Detailed</MenuItem>
                    </Select>
                  </FormControl>
                </PreferenceRow>

                <PreferenceRow label="Reasoning Effort" description="Token budget for models that support reasoning" htmlFor="setting-reasoning-effort">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      id="setting-reasoning-effort"
                      value={settings.reasoningEffort ?? 'medium'}
                      onChange={(e) => updateSetting('reasoningEffort', e.target.value)}
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value="low">Low (1,024 Tokens)</MenuItem>
                      <MenuItem value="medium">Medium (5,000 Tokens)</MenuItem>
                      <MenuItem value="high">High (16,000 Tokens)</MenuItem>
                    </Select>
                  </FormControl>
                </PreferenceRow>
              </PreferenceSection>
            </Box>
          </Fade>
        );
      case 'database':
        return (
          <Fade in key="database">
            <Box>
              <PreferenceSection title="Database Settings">
                <PreferenceRow 
                  label="Confirm Before Running" 
                  description="Show dialog before executing SQL"
                  onClick={() => updateSetting('confirmBeforeRun', !(settings.confirmBeforeRun ?? true))}
                >
                  <Switch
                    inputProps={{ id: 'setting-confirm-run' }}
                    checked={settings.confirmBeforeRun ?? true}
                    onChange={(e) => updateSetting('confirmBeforeRun', e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                  />
                </PreferenceRow>
                <PreferenceRow label="Query Timeout" description="Max wait time for results" htmlFor="setting-query-timeout">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      id="setting-query-timeout"
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
                </PreferenceRow>
                <PreferenceRow
                  label="Max Rows"
                  description={settings.maxRows === 0 ? '⚠️ No limit — may slow down' : 'Limit results to prevent slowdown'}
                  htmlFor="setting-max-rows"
                >
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      id="setting-max-rows"
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
                </PreferenceRow>
                <PreferenceRow label="NULL Display" description="How to show NULL values" htmlFor="setting-null-display">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      id="setting-null-display"
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
                </PreferenceRow>
              </PreferenceSection>
              <PreferenceSection title="Connection">
                <PreferenceRow 
                  label="Remember Connection" 
                  description="Auto-fill on next visit"
                  onClick={() => updateSetting('rememberConnection', !(settings.rememberConnection ?? false))}
                >
                  <Switch
                    inputProps={{ id: 'setting-remember-connection' }}
                    checked={settings.rememberConnection ?? false}
                    onChange={(e) => updateSetting('rememberConnection', e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    size="small"
                  />
                </PreferenceRow>
                <PreferenceRow label="Connection Persistence" description="Keep alive after closing tab" htmlFor="setting-connection-persistence">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      id="setting-connection-persistence"
                      value={settings.connectionPersistence ?? 0}
                      MenuProps={selectMenuProps}
                      onChange={(e) => updateSetting('connectionPersistence', Number(e.target.value))}
                    >
                      <MenuItem value={0}>Never</MenuItem>
                      <MenuItem value={5}>5 min</MenuItem>
                      <MenuItem value={15}>15 min</MenuItem>
                      <MenuItem value={30}>30 min</MenuItem>
                      <MenuItem value={60}>1 hour</MenuItem>
                    </Select>
                  </FormControl>
                </PreferenceRow>
                <PreferenceRow label="Default Database Type" description="Pre-selected when connecting" htmlFor="setting-default-db-type">
                  <FormControl size="small" sx={controlSx}>
                    <Select
                      id="setting-default-db-type"
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
                </PreferenceRow>
              </PreferenceSection>
            </Box>
          </Fade>
        );
      case 'context':
        return (
          <Fade in key="context">
            <Box>
              <Box sx={{ mb: { xs: 5, md: 6.5 } }}>
                <Typography
                  component="h2"
                  sx={(theme) => ({
                    ...theme.typography.uiCardTitle,
                    color: "text.primary",
                    fontWeight: 650,
                    pb: { xs: 1.5, md: 2 },
                    letterSpacing: 0,
                  })}
                >
                  AI Context
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <UserDBContextManagerForAI />
                </Box>
              </Box>
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
      disableAutoFocus
      disableEnforceFocus
      disableRestoreFocus
      keepMounted
      transitionDuration={180}
      rootSx={mainContentDialogRootSx}
      paperSx={getPreferencePaperSx(theme, settingsSurfaceLeft, settingsSurfaceWidth)}
      backdropSx={getPreferenceBackdropSx(settingsSurfaceLeft, settingsSurfaceWidth)}
      bodySx={getPreferenceBodySx(theme)}
    >
      <PreferencePageHeader title="Settings" onClose={onClose} />

      <PreferenceLayout sidebar={NavContent}>
        {renderContent()}

        <PreferenceFooterActions sx={{ justifyContent: 'flex-start' }}>
          <Button
            color="secondary"
            onClick={() => {
              resetSettings();
            }}
            size="small"
            sx={subtleButtonSx}
          >
            Reset to defaults
          </Button>
        </PreferenceFooterActions>
      </PreferenceLayout>
    </DialogShell>
  );
}

export default memo(SettingsModal, (prevProps, nextProps) => prevProps.open === nextProps.open);
