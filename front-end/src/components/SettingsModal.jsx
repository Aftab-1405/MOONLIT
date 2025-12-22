import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  Box, 
  Typography, 
  IconButton, 
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import { useTheme } from '../contexts/ThemeContext';

function SettingsModal({ open, onClose }) {
  const { settings, updateSetting, resetSettings } = useTheme();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <SettingsRoundedIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={600}>
            Settings
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Appearance Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
            Appearance
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body1" fontWeight={500}>Theme</Typography>
              <Typography variant="body2" color="text.secondary">Choose interface color scheme</Typography>
            </Box>
            <ToggleButtonGroup
              value={settings.theme}
              exclusive
              onChange={(e, value) => value && updateSetting('theme', value)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 0.75,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                    '&:hover': { backgroundColor: 'primary.dark' },
                  },
                },
              }}
            >
              <ToggleButton value="light">
                <LightModeRoundedIcon sx={{ mr: 0.5, fontSize: 18 }} /> Light
              </ToggleButton>
              <ToggleButton value="dark">
                <DarkModeRoundedIcon sx={{ mr: 0.5, fontSize: 18 }} /> Dark
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* AI Assistant Section (NEW) */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PsychologyRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
              AI Assistant
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Enable Reasoning Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={settings.enableReasoning ?? true}
                  onChange={(e) => updateSetting('enableReasoning', e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Enable reasoning</Typography>
                  <Typography variant="caption" color="text.secondary">Show AI's thinking process before answering</Typography>
                </Box>
              }
              sx={{ ml: 0, alignItems: 'flex-start' }}
            />

            {/* Reasoning Effort - only visible when enabled */}
            {settings.enableReasoning && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" fontWeight={500}>Reasoning depth</Typography>
                  <Typography variant="caption" color="text.secondary">Higher = more thorough but slower</Typography>
                </Box>
                <ToggleButtonGroup
                  value={settings.reasoningEffort ?? 'medium'}
                  exclusive
                  onChange={(e, v) => v && updateSetting('reasoningEffort', v)}
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      px: 1.5,
                      py: 0.5,
                      fontSize: '0.75rem',
                      '&.Mui-selected': {
                        backgroundColor: 'primary.main',
                        color: 'white',
                        '&:hover': { backgroundColor: 'primary.dark' },
                      },
                    },
                  }}
                >
                  <ToggleButton value="low">Low</ToggleButton>
                  <ToggleButton value="medium">Med</ToggleButton>
                  <ToggleButton value="high">High</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Query Execution Section */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PlayArrowRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
              Query Execution
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.confirmBeforeRun ?? true}
                  onChange={(e) => updateSetting('confirmBeforeRun', e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Confirm before running queries</Typography>
                  <Typography variant="caption" color="text.secondary">Show confirmation dialog before executing SQL</Typography>
                </Box>
              }
              sx={{ ml: 0, alignItems: 'flex-start' }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>Query timeout</Typography>
                <Typography variant="caption" color="text.secondary">Maximum seconds to wait for query results</Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={settings.queryTimeout ?? 30}
                  onChange={(e) => updateSetting('queryTimeout', e.target.value)}
                >
                  <MenuItem value={10}>10 sec</MenuItem>
                  <MenuItem value={30}>30 sec</MenuItem>
                  <MenuItem value={60}>1 min</MenuItem>
                  <MenuItem value={120}>2 min</MenuItem>
                  <MenuItem value={300}>5 min</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Results Display Section */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TableChartRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
              Results Display
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>Maximum rows to display</Typography>
                <Typography variant="caption" color="text.secondary">Limit results to prevent browser slowdown</Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={settings.maxRows ?? 1000}
                  onChange={(e) => updateSetting('maxRows', e.target.value)}
                >
                  <MenuItem value={100}>100</MenuItem>
                  <MenuItem value={500}>500</MenuItem>
                  <MenuItem value={1000}>1,000</MenuItem>
                  <MenuItem value={5000}>5,000</MenuItem>
                  <MenuItem value={10000}>10,000</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>NULL value display</Typography>
                <Typography variant="caption" color="text.secondary">How to show NULL values in results</Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <Select
                  value={settings.nullDisplay ?? 'NULL'}
                  onChange={(e) => updateSetting('nullDisplay', e.target.value)}
                >
                  <MenuItem value="NULL">NULL</MenuItem>
                  <MenuItem value="(null)">(null)</MenuItem>
                  <MenuItem value="-">-</MenuItem>
                  <MenuItem value="">(empty)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Connection Section */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <StorageRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.7rem' }}>
              Connection
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.rememberConnection ?? false}
                  onChange={(e) => updateSetting('rememberConnection', e.target.checked)}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Remember last connection</Typography>
                  <Typography variant="caption" color="text.secondary">Auto-fill connection details on next visit</Typography>
                </Box>
              }
              sx={{ ml: 0, alignItems: 'flex-start' }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2" fontWeight={500}>Default database type</Typography>
                <Typography variant="caption" color="text.secondary">Pre-selected when opening connection modal</Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={settings.defaultDbType ?? 'postgresql'}
                  onChange={(e) => updateSetting('defaultDbType', e.target.value)}
                >
                  <MenuItem value="mysql">MySQL</MenuItem>
                  <MenuItem value="postgresql">PostgreSQL</MenuItem>
                  <MenuItem value="sqlite">SQLite</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
        <Button
          startIcon={<RestartAltRoundedIcon />}
          onClick={resetSettings}
          color="inherit"
          sx={{ color: 'text.secondary' }}
        >
          Reset to Defaults
        </Button>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default SettingsModal;
