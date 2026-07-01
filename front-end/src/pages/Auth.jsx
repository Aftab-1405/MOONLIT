import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Snackbar,
  Stack,
  SvgIcon,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ButtonLoadingSpinner } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useFormValidation } from '@/hooks/useFormValidation';
import { BACKDROP_FILTER_FALLBACK_QUERY } from '@/styles/mediaQueries';
import { getMoonlitBrandGradients } from '@/theme/themeEffects';
import logger from '@/utils/logger';
import {
  authFieldSchemas,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/utils/validationSchemas';

import { AUTH_KEYFRAMES } from './Auth/auth.keyframes';
import ProductAuroraShowcase from './Auth/ProductAuroraShowcase';

function GoogleBrandIcon(props) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.26h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.55z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.06v2.58A10 10 0 0 0 12 22z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.9A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.52H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.48l3.35-2.58z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.78.5 3.82 1.49l2.87-2.87C16.95 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.35 2.58C7.2 7.74 9.4 5.98 12 5.98z"
      />
    </SvgIcon>
  );
}

// ─── TabPanel ─────────────────────────────────────────────────────────────────
function TabPanel({ children, value, index }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ width: '100%' }}>
      {value === index && children}
    </Box>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function Auth() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const brandGradients = getMoonlitBrandGradients(theme);

  useEffect(() => {
    document.title = 'Moonlit - Sign In';
  }, []);

  const {
    signInWithGoogle,
    signInWithGitHub,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    isAuthenticated,
    loading,
    error,
    clearError: clearAuthError,
  } = useAuth();

  const [tabValue, setTabValue] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('error');
  const [forgotDialogOpen, setForgotDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const {
    errors: fieldErrors,
    validateField,
    validateForm,
    clearError: clearFieldError,
    resetErrors,
  } = useFormValidation(authFieldSchemas);

  useEffect(() => {
    if (isAuthenticated) navigate('/chat');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    resetErrors();
    clearAuthError?.();
  }, [clearAuthError, resetErrors]);

  useEffect(() => {
    if (error) {
      setSnackbarMessage(error);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  }, [error]);

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
    clearAuthError?.();
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!validateForm(signInSchema, { email, password })) return;

    setFormLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      logger.error('Sign in failed:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    if (
      !validateForm(signUpSchema, {
        email,
        passwordSignUp: password,
        confirmPassword,
        displayName,
      })
    )
      return;

    setFormLoading(true);
    try {
      await signUpWithEmail(email, password, displayName);
    } catch (err) {
      logger.error('Sign up failed:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch {
      // surfaced by AuthContext
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      await signInWithGitHub();
    } catch {
      // surfaced by AuthContext
    }
  };

  const handlePasswordReset = async () => {
    if (!validateForm(resetPasswordSchema, { email: resetEmail })) return;

    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      setForgotDialogOpen(false);
      setResetEmail('');
    } catch (err) {
      logger.error('Password reset failed:', err);
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          height: '100dvh',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          overflow: 'hidden',
        }}
      >
        <CircularProgress sx={{ color: 'primary.main' }} size={28} />
      </Box>
    );
  }

  const tabsSx = {
    width: '100%',
    minHeight: 36,
    borderRadius: 1.5,
    backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.05 : 0.04),
    border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06)}`,
    p: 0.5,
    '& .MuiTabs-indicator': {
      height: '100%',
      borderRadius: 1,
      backgroundImage: brandGradients.static,
      backgroundColor: 'transparent',
      boxShadow: `0 1px 4px ${alpha(theme.palette.common.black, isDark ? 0.28 : 0.1)}`,
      zIndex: 0,
    },
    '& .MuiTab-root': {
      minHeight: 32,
      py: 0.5,
      borderRadius: 1,
      fontWeight: 500,
      color: 'text.secondary',
      zIndex: 1,
      transition: theme.transitions.create('color', { duration: 150 }),
      '&.Mui-selected': {
        color: theme.palette.primary.contrastText,
        fontWeight: 600,
      },
    },
  };

  return (
    <>
      {AUTH_KEYFRAMES}

      <Box
        data-auth-page=""
        sx={{
          height: '100dvh',
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          backgroundColor: 'background.default',
          backgroundImage: isDark
            ? 'none'
            : `linear-gradient(
                180deg,
                ${alpha(theme.palette.text.primary, 0.015)} 0%,
                transparent 30%
              )`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {!isMobile && (
          <Box
            sx={{
              flex: '0 0 50%',
              minWidth: 0,
              minHeight: 0,
              height: '100%',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: { md: 4, lg: 6 },
              py: { md: 3.5, lg: 4.5 },
              overflow: 'hidden',
              animation: 'authFadeUp 0.5s ease-out both',
              borderRight: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.07 : 0.08)}`,
              backgroundColor: isDark ? 'transparent' : alpha(theme.palette.background.paper, 0.72),
              backgroundImage: isDark
                ? 'none'
                : `
                    radial-gradient(circle at 12% 8%, ${alpha(theme.palette.text.primary, 0.045)}, transparent 32%),
                    linear-gradient(180deg, ${alpha(theme.palette.text.primary, 0.02)} 0%, transparent 42%)
                  `,
            }}
          >
            <Box
              aria-hidden
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                backgroundImage: `radial-gradient(${alpha(
                  theme.palette.text.primary,
                  isDark ? 0.07 : 0.08,
                )} 1px, transparent 1px)`,
                backgroundSize: '26px 26px',
                maskImage:
                  'radial-gradient(ellipse 90% 90% at 40% 50%, black 20%, transparent 90%)',
                WebkitMaskImage:
                  'radial-gradient(ellipse 90% 90% at 40% 50%, black 20%, transparent 90%)',
                pointerEvents: 'none',
                opacity: isDark ? 1 : 0.55,
              }}
            />

            <ProductAuroraShowcase isDark={isDark} />
          </Box>
        )}

        <Box
          sx={{
            flex: { xs: '1 1 auto', md: '0 0 50%' },
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: { xs: 2, sm: 3, md: 4 },
            px: { xs: 2, sm: 3, md: 4 },
            backgroundColor: isDark
              ? alpha(theme.palette.background.paper, 0.3)
              : alpha(theme.palette.background.default, 0.68),
            overflow: 'hidden',
          }}
        >
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: '20%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '80%',
              height: '50%',
              background: `radial-gradient(ellipse at center, ${alpha(
                theme.palette.text.primary,
                isDark ? 0.055 : 0.035,
              )}, transparent 70%)`,
              filter: 'blur(50px)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          <Container
            maxWidth="xs"
            disableGutters
            sx={{
              width: '100%',
              maxWidth: { xs: 420, sm: 440 },
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 0,
            }}
          >
            {isMobile && (
              <Stack
                spacing={0.5}
                alignItems="center"
                mb={{ xs: 2, sm: 2.5 }}
                sx={{
                  animation: 'authFadeUp 0.5s ease-out both',
                  '@media (prefers-reduced-motion: reduce)': {
                    animation: 'none',
                  },
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    ...theme.typography.uiBrandWordmark,
                    background: brandGradients.shimmer,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: 0,
                  }}
                >
                  Moonlit
                </Typography>

                <Typography
                  sx={{
                    color: 'text.secondary',
                    opacity: 0.55,
                    ...theme.typography.uiCaptionSm,
                    letterSpacing: 0,
                    textTransform: 'none',
                  }}
                >
                  AI Database Assistant
                </Typography>
              </Stack>
            )}

            <Paper
              elevation={0}
              sx={{
                width: '100%',
                p: { xs: 2.25, sm: 3 },
                backgroundColor: isDark
                  ? alpha(theme.palette.background.paper, 0.78)
                  : alpha(theme.palette.background.paper, 0.94),
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                [BACKDROP_FILTER_FALLBACK_QUERY]: {
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                  backgroundColor: theme.palette.background.paper,
                },
                [theme.breakpoints.down('sm')]: {
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                  backgroundColor: theme.palette.background.paper,
                },
                border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08)}`,
                borderRadius: { xs: 2.5, sm: 3 },
                boxShadow: isDark
                  ? `0 32px 64px -16px ${alpha('#000', 0.45)}`
                  : `0 24px 48px -12px ${alpha('#000', 0.1)}`,
                animation: 'authSlideIn 0.45s cubic-bezier(0.4, 0, 0.2, 1) 0.15s both',
                '@media (prefers-reduced-motion: reduce)': {
                  animation: 'none',
                },
                '& .MuiInputBase-input': { ...theme.typography.uiInput },
              }}
            >
              <Stack spacing={{ xs: 2, sm: 2.5 }} alignItems="center">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography
                    variant="h5"
                    sx={{
                      mb: 0.35,
                      fontWeight: 700,
                      fontSize: {
                        xs: '1.45rem',
                        sm: theme.typography.h5.fontSize,
                      },
                    }}
                  >
                    {tabValue === 0 ? 'Welcome back' : 'Create account'}
                  </Typography>

                  <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.72 }}>
                    {tabValue === 0
                      ? 'Sign in to start querying with AI'
                      : 'Join Moonlit and unlock your data'}
                  </Typography>
                </Box>

                <Tabs
                  value={tabValue}
                  onChange={(_, v) => setTabValue(v)}
                  variant="fullWidth"
                  sx={tabsSx}
                >
                  <Tab label="Sign In" />
                  <Tab label="Sign Up" />
                </Tabs>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.25}
                  sx={{ width: '100%' }}
                >
                  {[
                    {
                      label: 'Google',
                      icon: <GoogleBrandIcon sx={{ fontSize: 17 }} />,
                      handler: handleGoogleSignIn,
                    },
                    {
                      label: 'GitHub',
                      icon: <GitHubIcon sx={{ fontSize: 17 }} />,
                      handler: handleGitHubSignIn,
                    },
                  ].map(({ label, icon, handler }) => (
                    <Button
                      key={label}
                      fullWidth
                      variant="outlined"
                      startIcon={icon}
                      onClick={handler}
                      sx={{
                        py: 0.8,
                        borderRadius: 1.5,
                        borderColor: alpha(theme.palette.text.primary, isDark ? 0.12 : 0.1),
                        color: 'text.primary',
                        backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.03 : 0.02),
                        fontWeight: 500,
                        transition: theme.transitions.create(
                          ['border-color', 'background-color', 'box-shadow'],
                          { duration: 180 },
                        ),
                        '@media (hover: hover)': {
                          '&:hover': {
                            borderColor: alpha(theme.palette.text.primary, isDark ? 0.28 : 0.18),
                            backgroundColor: alpha(
                              theme.palette.text.primary,
                              isDark ? 0.07 : 0.04,
                            ),
                            boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, isDark ? 0.22 : 0.08)}`,
                          },
                        },
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </Stack>

                <Divider sx={{ width: '100%' }}>
                  <Typography
                    sx={{
                      color: 'text.secondary',
                      opacity: 0.5,
                      ...theme.typography.uiCaptionXs,
                    }}
                  >
                    or continue with email
                  </Typography>
                </Divider>

                <TabPanel value={tabValue} index={0}>
                  <Stack spacing={{ xs: 1.5, sm: 2 }} component="form" onSubmit={handleEmailSignIn}>
                    <TextField
                      fullWidth
                      size="small"
                      type="email"
                      label="Email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      onBlur={() => validateField('email', email)}
                      error={!!fieldErrors.email}
                      helperText={fieldErrors.email}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailOutlinedIcon
                              sx={{
                                color: 'text.secondary',
                                fontSize: 17,
                                opacity: 0.65,
                              }}
                            />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      fullWidth
                      size="small"
                      type={showPassword ? 'text' : 'password'}
                      label="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('password');
                      }}
                      onBlur={() => validateField('password', password)}
                      error={!!fieldErrors.password}
                      helperText={fieldErrors.password}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon
                              sx={{
                                color: 'text.secondary',
                                fontSize: 17,
                                opacity: 0.65,
                              }}
                            />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              onClick={() => setShowPassword((p) => !p)}
                              edge="end"
                              size="small"
                              sx={{ color: 'text.secondary', opacity: 0.55 }}
                            >
                              {showPassword ? (
                                <VisibilityOffOutlinedIcon fontSize="small" />
                              ) : (
                                <VisibilityOutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Box sx={{ textAlign: 'right' }}>
                      <Link
                        component="button"
                        type="button"
                        variant="caption"
                        onClick={() => {
                          setResetEmail(email);
                          setForgotDialogOpen(true);
                        }}
                        sx={{
                          color: 'text.secondary',
                          opacity: 0.72,
                          textDecoration: 'none',
                          ...theme.typography.uiCaptionXs,
                          transition: theme.transitions.create(['opacity', 'color'], {
                            duration: 150,
                          }),
                          '@media (hover: hover)': {
                            '&:hover': { opacity: 1, color: 'text.primary' },
                          },
                        }}
                      >
                        Forgot password?
                      </Link>
                    </Box>

                    <Button
                      fullWidth
                      type="submit"
                      disabled={formLoading}
                      variant="contained"
                      color="primary"
                      startIcon={formLoading ? <ButtonLoadingSpinner size={18} /> : null}
                    >
                      {formLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </Stack>
                </TabPanel>

                <TabPanel value={tabValue} index={1}>
                  <Stack spacing={{ xs: 1.5, sm: 2 }} component="form" onSubmit={handleEmailSignUp}>
                    <TextField
                      fullWidth
                      size="small"
                      type="text"
                      label="Display Name (optional)"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <PersonOutlineRoundedIcon
                              sx={{
                                color: 'text.secondary',
                                fontSize: 17,
                                opacity: 0.65,
                              }}
                            />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      fullWidth
                      size="small"
                      type="email"
                      label="Email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFieldError('email');
                      }}
                      onBlur={() => validateField('email', email)}
                      error={!!fieldErrors.email}
                      helperText={fieldErrors.email}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailOutlinedIcon
                              sx={{
                                color: 'text.secondary',
                                fontSize: 17,
                                opacity: 0.65,
                              }}
                            />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      fullWidth
                      size="small"
                      type={showPassword ? 'text' : 'password'}
                      label="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearFieldError('passwordSignUp');
                      }}
                      onBlur={() => validateField('passwordSignUp', password)}
                      error={!!fieldErrors.passwordSignUp}
                      helperText={fieldErrors.passwordSignUp || 'At least 6 characters'}
                      FormHelperTextProps={{ sx: { mt: 0.25 } }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon
                              sx={{
                                color: 'text.secondary',
                                fontSize: 17,
                                opacity: 0.65,
                              }}
                            />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              onClick={() => setShowPassword((p) => !p)}
                              edge="end"
                              size="small"
                              sx={{ color: 'text.secondary', opacity: 0.55 }}
                            >
                              {showPassword ? (
                                <VisibilityOffOutlinedIcon fontSize="small" />
                              ) : (
                                <VisibilityOutlinedIcon fontSize="small" />
                              )}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      fullWidth
                      size="small"
                      type={showPassword ? 'text' : 'password'}
                      label="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        clearFieldError('confirmPassword');
                      }}
                      onBlur={() => validateField('confirmPassword', confirmPassword)}
                      error={!!fieldErrors.confirmPassword}
                      helperText={fieldErrors.confirmPassword}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockOutlinedIcon
                              sx={{
                                color: 'text.secondary',
                                fontSize: 17,
                                opacity: 0.65,
                              }}
                            />
                          </InputAdornment>
                        ),
                      }}
                    />

                    <Button
                      fullWidth
                      type="submit"
                      disabled={formLoading}
                      variant="contained"
                      color="primary"
                      startIcon={formLoading ? <ButtonLoadingSpinner size={18} /> : null}
                    >
                      {formLoading ? 'Creating...' : 'Create Account'}
                    </Button>
                  </Stack>
                </TabPanel>
              </Stack>
            </Paper>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                textAlign: 'center',
                mt: 1.5,
                opacity: 0.45,
                ...theme.typography.uiCaptionXs,
              }}
            >
              By signing in, you agree to our Terms and Privacy Policy
            </Typography>
          </Container>
        </Box>
      </Box>

      <Dialog
        open={forgotDialogOpen}
        onClose={() => {
          setForgotDialogOpen(false);
          clearAuthError?.();
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: isDark
              ? alpha(theme.palette.background.paper, 0.9)
              : alpha(theme.palette.background.paper, 0.96),
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            [BACKDROP_FILTER_FALLBACK_QUERY]: {
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              backgroundColor: theme.palette.background.paper,
            },
            border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.1 : 0.08)}`,
            boxShadow: isDark
              ? `0 32px 64px -16px ${alpha('#000', 0.5)}`
              : `0 24px 48px -12px ${alpha('#000', 0.12)}`,
            m: 2,
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle sx={{ pb: 0.5, fontWeight: 700, fontSize: '1rem' }}>
          Reset Password
        </DialogTitle>

        <DialogContent sx={{ pt: '12px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, opacity: 0.7 }}>
            Enter your email and we'll send you a reset link.
          </Typography>

          <TextField
            fullWidth
            type="email"
            label="Email"
            value={resetEmail}
            onChange={(e) => {
              setResetEmail(e.target.value);
              clearFieldError('email');
            }}
            onBlur={() => validateField('email', resetEmail)}
            error={!!fieldErrors.email}
            helperText={fieldErrors.email}
            size="small"
            autoFocus
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            size="small"
            onClick={() => setForgotDialogOpen(false)}
            variant="outlined"
            color="inherit"
            sx={{
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>

          <Button
            size="small"
            onClick={handlePasswordReset}
            disabled={resetLoading}
            variant="outlined"
            color="primary"
            startIcon={resetLoading ? <ButtonLoadingSpinner size={14} /> : null}
          >
            {resetLoading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: isSmall ? 'center' : 'right',
        }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default Auth;
