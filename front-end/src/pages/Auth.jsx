import GitHubIcon from '@mui/icons-material/GitHub';
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
  Link,
  Snackbar,
  Stack,
  SvgIcon,
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
import { BRAND } from '@/theme/tokens';
import logger from '@/utils/logger';
import {
  authFieldSchemas,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/utils/validationSchemas';



/**
 * Auth page — sign-in / sign-up screen.
 *
 * Layout (md and up):
 *   ┌───────────────────────────┬───────────────────────────┐
 *   │  Aurora showcase (left)    │  Auth form card (right)    │
 *   │  brand-marketing panel     │  Tabs: Sign In | Sign Up   │
 *   │                            │  OAuth + email/password    │
 *   └───────────────────────────┴───────────────────────────┘
 *
 * On narrow viewports the aurora panel collapses; the brand wordmark moves
 * above the form card. The card uses backdrop-filter (with a solid fallback)
 * so the aurora subtly bleeds through on desktop.
 *
 * Accessibility:
 *   - All interactive controls have visible focus rings.
 *   - Tab panels use `role="tabpanel"` with `hidden` (not unmount) so input
 *     focus state survives tab switches.
 *   - Password reveal button has a descriptive `aria-label`.
 */

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



// ─── Auth ─────────────────────────────────────────────────────────────────────
function Auth() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));

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

  return (
    <>
      <Box
        data-auth-page=""
        sx={{
          height: '100dvh',
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          backgroundColor: 'background.default',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left Column: Minimalist Auth Form */}
        <Box
          sx={{
            flex: { xs: '1 1 auto', md: '0 0 50%' },
            width: { xs: '100%', md: '50%' },
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: { xs: 4, sm: 6 },
            px: { xs: 3, sm: 6, md: 8, lg: 12 },
            backgroundColor: 'background.default',
            overflowY: 'auto',
          }}
        >
          <Container
            maxWidth="xs"
            disableGutters
            sx={{
              width: '100%',
              maxWidth: 400,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Logo / Brand Header */}
            <Stack spacing={0.5} mb={5}>
              <Typography
                component="span"
                sx={{
                  ...theme.typography.uiBrandWordmark,
                  color: 'text.primary',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                Moonlit
              </Typography>
            </Stack>

            <Box sx={{ mb: 4.5 }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.85rem', sm: '2.1rem' },
                  letterSpacing: '-0.02em',
                  textTransform: 'uppercase',
                  mb: 1.2,
                  color: 'text.primary',
                }}
              >
                {tabValue === 0 ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: 'text.secondary', opacity: 0.72 }}
              >
                {tabValue === 0
                  ? 'Welcome back! Please enter your details.'
                  : 'Join Moonlit and start querying databases with AI.'}
              </Typography>
            </Box>

            {/* Email/Password Form */}
            <Stack
              spacing={2.5}
              component="form"
              onSubmit={tabValue === 0 ? handleEmailSignIn : handleEmailSignUp}
              sx={{ width: '100%' }}
            >
              {tabValue === 1 && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      display: 'block',
                      mb: 1,
                      color: 'text.primary',
                      fontSize: '0.8125rem',
                    }}
                  >
                    Display Name
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Enter your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        backgroundColor: isDark ? alpha(theme.palette.background.paper, 0.4) : 'rgba(0,0,0,0.02)',
                        '& fieldset': {
                          borderColor: alpha(theme.palette.text.primary, 0.1),
                        },
                        '&:hover fieldset': {
                          borderColor: alpha(theme.palette.text.primary, 0.2),
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: BRAND.main,
                        },
                      },
                    }}
                  />
                </Box>
              )}

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    display: 'block',
                    mb: 1,
                    color: 'text.primary',
                    fontSize: '0.8125rem',
                  }}
                >
                  Email
                </Typography>
                <TextField
                  fullWidth
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  onBlur={() => validateField('email', email)}
                  error={!!fieldErrors.email}
                  helperText={fieldErrors.email}
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: isDark ? alpha(theme.palette.background.paper, 0.4) : 'rgba(0,0,0,0.02)',
                      '& fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.1),
                      },
                      '&:hover fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.2),
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: BRAND.main,
                      },
                    },
                    '& .MuiFormHelperText-root': {
                      mx: 0,
                      mt: 0.5,
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    display: 'block',
                    mb: 1,
                    color: 'text.primary',
                    fontSize: '0.8125rem',
                  }}
                >
                  Password
                </Typography>
                <TextField
                  fullWidth
                  type="password"
                  placeholder="**********"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearFieldError(tabValue === 0 ? 'password' : 'passwordSignUp');
                  }}
                  onBlur={() =>
                    validateField(
                      tabValue === 0 ? 'password' : 'passwordSignUp',
                      password,
                    )
                  }
                  error={!!fieldErrors[tabValue === 0 ? 'password' : 'passwordSignUp']}
                  helperText={
                    fieldErrors[tabValue === 0 ? 'password' : 'passwordSignUp'] ||
                    (tabValue === 1 ? 'At least 6 characters' : '')
                  }
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: isDark ? alpha(theme.palette.background.paper, 0.4) : 'rgba(0,0,0,0.02)',
                      '& fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.1),
                      },
                      '&:hover fieldset': {
                        borderColor: alpha(theme.palette.text.primary, 0.2),
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: BRAND.main,
                      },
                    },
                    '& .MuiFormHelperText-root': {
                      mx: 0,
                      mt: 0.5,
                    },
                  }}
                />
              </Box>

              {tabValue === 1 && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      display: 'block',
                      mb: 1,
                      color: 'text.primary',
                      fontSize: '0.8125rem',
                    }}
                  >
                    Confirm Password
                  </Typography>
                  <TextField
                    fullWidth
                    type="password"
                    placeholder="**********"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      clearFieldError('confirmPassword');
                    }}
                    onBlur={() => validateField('confirmPassword', confirmPassword)}
                    error={!!fieldErrors.confirmPassword}
                    helperText={fieldErrors.confirmPassword}
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '12px',
                        backgroundColor: isDark ? alpha(theme.palette.background.paper, 0.4) : 'rgba(0,0,0,0.02)',
                        '& fieldset': {
                          borderColor: alpha(theme.palette.text.primary, 0.1),
                        },
                        '&:hover fieldset': {
                          borderColor: alpha(theme.palette.text.primary, 0.2),
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: BRAND.main,
                        },
                      },
                      '& .MuiFormHelperText-root': {
                        mx: 0,
                        mt: 0.5,
                      },
                    }}
                  />
                </Box>
              )}

              {tabValue === 0 && (
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ width: '100%', mt: 0.5 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <input
                      type="checkbox"
                      id="remember-me"
                      style={{
                        width: '16px',
                        height: '16px',
                        accentColor: BRAND.main,
                        cursor: 'pointer',
                      }}
                    />
                    <label
                      htmlFor="remember-me"
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: theme.palette.text.secondary,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      Remember me
                    </label>
                  </Stack>
                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    onClick={() => {
                      setResetEmail(email);
                      setForgotDialogOpen(true);
                    }}
                    sx={{
                      color: 'text.primary',
                      fontWeight: 600,
                      textDecoration: 'none',
                      fontSize: '0.8125rem',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    Forgot password
                  </Link>
                </Stack>
              )}

              <Stack spacing={1.75} sx={{ width: '100%', pt: 1.5 }}>
                <Button
                  fullWidth
                  type="submit"
                  disabled={formLoading}
                  variant="contained"
                  sx={{
                    py: 1.35,
                    borderRadius: '12px',
                    fontWeight: 600,
                    textTransform: 'none',
                    backgroundColor: formLoading ? undefined : BRAND.main,
                    color: '#ffffff',
                    '&:hover': {
                      backgroundColor: BRAND.dark,
                    },
                    boxShadow: formLoading
                      ? 'none'
                      : `0 4px 12px ${alpha(BRAND.main, isDark ? 0.35 : 0.2)}`,
                  }}
                >
                  {formLoading
                    ? tabValue === 0
                      ? 'Signing in...'
                      : 'Creating...'
                    : tabValue === 0
                      ? 'Sign in'
                      : 'Sign up'}
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<GoogleBrandIcon sx={{ fontSize: 18 }} />}
                  onClick={handleGoogleSignIn}
                  sx={{
                    py: 1.35,
                    borderRadius: '12px',
                    textTransform: 'none',
                    borderColor: alpha(theme.palette.text.primary, 0.15),
                    color: 'text.primary',
                    backgroundColor: isDark
                      ? alpha(theme.palette.text.primary, 0.03)
                      : '#ffffff',
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: alpha(theme.palette.text.primary, 0.3),
                      backgroundColor: isDark
                        ? alpha(theme.palette.text.primary, 0.07)
                        : alpha(theme.palette.text.primary, 0.02),
                    },
                  }}
                >
                  Sign in with Google
                </Button>

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<GitHubIcon sx={{ fontSize: 18, color: 'text.primary' }} />}
                  onClick={handleGitHubSignIn}
                  sx={{
                    py: 1.35,
                    borderRadius: '12px',
                    textTransform: 'none',
                    borderColor: alpha(theme.palette.text.primary, 0.15),
                    color: 'text.primary',
                    backgroundColor: isDark
                      ? alpha(theme.palette.text.primary, 0.03)
                      : '#ffffff',
                    fontWeight: 600,
                    '&:hover': {
                      borderColor: alpha(theme.palette.text.primary, 0.3),
                      backgroundColor: isDark
                        ? alpha(theme.palette.text.primary, 0.07)
                        : alpha(theme.palette.text.primary, 0.02),
                    },
                  }}
                >
                  Sign in with GitHub
                </Button>
              </Stack>
            </Stack>

            {/* Footer Switcher */}
            <Typography
              variant="body2"
              sx={{
                textAlign: 'center',
                mt: 4,
                color: 'text.secondary',
              }}
            >
              {tabValue === 0 ? "Don't have an account? " : 'Already have an account? '}
              <Link
                component="button"
                onClick={() => {
                  setTabValue(tabValue === 0 ? 1 : 0);
                  resetErrors();
                }}
                sx={{
                  color: BRAND.main,
                  fontWeight: 600,
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                }}
              >
                {tabValue === 0 ? 'Sign up for free!' : 'Sign in!'}
              </Link>
            </Typography>

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

        {/* Right Column: Premium Showcase Vector Illustration */}
        {!isMobile && (
          <Box
            sx={{
              flex: '0 0 50%',
              width: '50%',
              minWidth: 0,
              minHeight: 0,
              height: '100%',
              backgroundColor: isDark
                ? alpha(theme.palette.background.paper, 0.2)
                : alpha(theme.palette.background.paper, 0.5),
              borderLeft: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.08 : 0.06)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
            }}
          >
            <Box
              component="img"
              src="/auth-illustration-transparent.png"
              alt="Premium database illustration"
              sx={{
                width: '100%',
                height: '100%',
                maxHeight: '90%',
                objectFit: 'contain',
                borderRadius: '16px',
              }}
            />
          </Box>
        )}
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
