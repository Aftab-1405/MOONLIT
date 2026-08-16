import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
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
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ButtonLoadingSpinner from '@/components/common/ButtonLoadingSpinner';
import { GitHubBrandIcon } from '@/components/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useFormValidation } from '@/hooks/useFormValidation';
import { getOutlinedFieldStateSx } from '@/styles/shared';
import logger from '@/utils/logger';
import {
  authFieldSchemas,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from '@/utils/validationSchemas';

function GoogleBrandIcon(props) {
  const theme = useTheme();
  const provider = theme.palette.identity.provider;
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path fill={provider.googleBlue} d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.26h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.55z" />
      <path fill={provider.googleGreen} d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.06v2.58A10 10 0 0 0 12 22z" />
      <path fill={provider.googleYellow} d="M6.41 13.9A6 6 0 0 1 6.1 12c0-.66.11-1.3.31-1.9V7.52H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.48l3.35-2.58z" />
      <path fill={provider.googleRed} d="M12 5.98c1.47 0 2.78.5 3.82 1.49l2.87-2.87C16.95 2.98 14.7 2 12 2a10 10 0 0 0-8.94 5.52l3.35 2.58C7.2 7.74 9.4 5.98 12 5.98z" />
    </SvgIcon>
  );
}

function Auth() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
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
    document.title = 'Moonlit - Sign In';
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/chat');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    resetErrors();
    clearAuthError?.();
  }, [clearAuthError, resetErrors]);

  useEffect(() => {
    if (!error) return;
    setSnackbarMessage(error);
    setSnackbarSeverity('error');
    setSnackbarOpen(true);
  }, [error]);

  const fieldSx = useMemo(
    () => {
      const outlinedFieldSx = getOutlinedFieldStateSx(theme, { radius: '8px' });
      const outlinedInputRootSx = outlinedFieldSx['& .MuiOutlinedInput-root'];

      return {
        ...outlinedFieldSx,
        '& .MuiOutlinedInput-root': {
          ...outlinedInputRootSx,
          minHeight: 48,
        },
        '& .MuiFormHelperText-root': { mx: 0, mt: 0.5 },
      };
    },
    [theme],
  );

  const changeMode = (next) => {
    setTabValue(next);
    resetErrors();
    clearAuthError?.();
  };

  const handleSnackbarClose = (_, reason) => {
    if (reason === 'clickaway') return;
    setSnackbarOpen(false);
    clearAuthError?.();
  };

  const handleEmailSignIn = async (event) => {
    event.preventDefault();
    if (!validateForm(signInSchema, { email, password })) return;
    setFormLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (signInError) {
      logger.error('Sign in failed:', signInError);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEmailSignUp = async (event) => {
    event.preventDefault();
    if (!validateForm(signUpSchema, { email, passwordSignUp: password, confirmPassword, displayName })) return;
    setFormLoading(true);
    try {
      await signUpWithEmail(email, password, displayName);
    } catch (signUpError) {
      logger.error('Sign up failed:', signUpError);
    } finally {
      setFormLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!validateForm(resetPasswordSchema, { email: resetEmail })) return;
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      setForgotDialogOpen(false);
      setResetEmail('');
      setSnackbarMessage('Password reset link sent.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (resetError) {
      logger.error('Password reset failed:', resetError);
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ height: '100dvh', display: 'grid', placeItems: 'center', backgroundColor: 'background.default' }}>
        <CircularProgress size={28} color="inherit" />
      </Box>
    );
  }

  return (
    <>
      <Box
        data-auth-page=""
        sx={{
          height: '100dvh',
          overflowY: 'auto',
          backgroundColor: 'background.default',
          color: 'text.primary',
          px: { xs: 2, sm: 3 },
          py: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 480, mx: 'auto' }}>
          <Button variant="text" onClick={() => navigate('/')} sx={{ px: 0, mb: 5, borderRadius: 0 }}>
            <Typography sx={(muiTheme) => muiTheme.typography.uiBrandWordmark}>Moonlit</Typography>
          </Button>

          <Box sx={{ p: { xs: 3, sm: 4 }, border: '1px solid', borderColor: 'border.subtle', borderRadius: '8px', backgroundColor: 'background.paper' }}>
            <Typography sx={(muiTheme) => ({ ...muiTheme.typography.captionMonoSm, color: 'text.secondary' })}>
              Account access
            </Typography>
            <Typography component="h1" sx={(muiTheme) => ({ ...muiTheme.typography.displaySm, mt: 1.5 })}>
              {tabValue === 0 ? 'Welcome back.' : 'Create your account.'}
            </Typography>
            <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>
              {tabValue === 0
                ? 'Sign in to continue your database conversations.'
                : 'Start querying and visualizing your databases with Moonlit.'}
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, p: 0.5, mt: 4, border: '1px solid', borderColor: 'border.subtle', borderRadius: 999 }}>
              {['Sign in', 'Sign up'].map((label, index) => (
                <Button
                  key={label}
                  variant="text"
                  onClick={() => changeMode(index)}
                  aria-pressed={tabValue === index}
                  sx={{ backgroundColor: tabValue === index ? 'action.selected' : 'transparent' }}
                >
                  {label}
                </Button>
              ))}
            </Box>

            <Stack
              component="form"
              onSubmit={tabValue === 0 ? handleEmailSignIn : handleEmailSignUp}
              spacing={2}
              sx={{ mt: 3 }}
            >
              {tabValue === 1 && (
                <TextField
                  fullWidth
                  label="Display name"
                  placeholder="Enter your name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  error={Boolean(fieldErrors.displayName)}
                  helperText={fieldErrors.displayName}
                  sx={fieldSx}
                />
              )}
              <TextField
                fullWidth
                type="email"
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError('email');
                }}
                onBlur={() => validateField('email', email)}
                error={Boolean(fieldErrors.email)}
                helperText={fieldErrors.email}
                sx={fieldSx}
              />
              <TextField
                fullWidth
                type="password"
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFieldError(tabValue === 0 ? 'password' : 'passwordSignUp');
                }}
                onBlur={() => validateField(tabValue === 0 ? 'password' : 'passwordSignUp', password)}
                error={Boolean(fieldErrors[tabValue === 0 ? 'password' : 'passwordSignUp'])}
                helperText={fieldErrors[tabValue === 0 ? 'password' : 'passwordSignUp'] || (tabValue === 1 ? 'At least 6 characters' : '')}
                sx={fieldSx}
              />
              {tabValue === 1 && (
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    clearFieldError('confirmPassword');
                  }}
                  onBlur={() => validateField('confirmPassword', confirmPassword)}
                  error={Boolean(fieldErrors.confirmPassword)}
                  helperText={fieldErrors.confirmPassword}
                  sx={fieldSx}
                />
              )}

              {tabValue === 0 && (
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={{ xs: 1.25, sm: 0 }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Checkbox id="remember-me" size="small" sx={{ p: 0 }} />
                    <Typography component="label" htmlFor="remember-me" sx={{ color: 'text.secondary', cursor: 'pointer' }}>
                      Remember me
                    </Typography>
                  </Stack>
                  <Link
                    component="button"
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setForgotDialogOpen(true);
                    }}
                  >
                    Forgot password?
                  </Link>
                </Stack>
              )}

              <Button fullWidth type="submit" variant="contained" size="large" disabled={formLoading} sx={{ mt: '8px !important' }}>
                {formLoading ? (tabValue === 0 ? 'Signing in…' : 'Creating account…') : tabValue === 0 ? 'Sign in' : 'Create account'}
              </Button>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                <Button fullWidth variant="outlined" startIcon={<GoogleBrandIcon sx={{ fontSize: 18 }} />} onClick={() => signInWithGoogle().catch(() => {})}>
                  Google
                </Button>
                <Button fullWidth variant="outlined" startIcon={<GitHubBrandIcon sx={{ fontSize: 18 }} />} onClick={() => signInWithGitHub().catch(() => {})}>
                  GitHub
                </Button>
              </Box>
            </Stack>

            <Typography sx={{ mt: 4, textAlign: 'center', color: 'text.secondary' }}>
              {tabValue === 0 ? 'New to Moonlit? ' : 'Already have an account? '}
              <Link component="button" onClick={() => changeMode(tabValue === 0 ? 1 : 0)}>
                {tabValue === 0 ? 'Create an account' : 'Sign in'}
              </Link>
            </Typography>
          </Box>

          <Typography sx={(muiTheme) => ({ ...muiTheme.typography.captionMonoSm, mt: 3, color: 'text.disabled', textAlign: 'center' })}>
            Secure account access
          </Typography>
        </Box>
      </Box>

      <Dialog open={forgotDialogOpen} onClose={() => setForgotDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={(muiTheme) => ({ ...muiTheme.typography.displayXs, pb: 1 })}>Reset password</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', mb: 2 }}>
            Enter your email and Moonlit will send you a reset link.
          </Typography>
          <TextField
            fullWidth
            type="email"
            label="Email"
            value={resetEmail}
            onChange={(event) => {
              setResetEmail(event.target.value);
              clearFieldError('email');
            }}
            onBlur={() => validateField('email', resetEmail)}
            error={Boolean(fieldErrors.email)}
            helperText={fieldErrors.email}
            autoFocus
            sx={fieldSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={() => setForgotDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handlePasswordReset} disabled={resetLoading} startIcon={resetLoading ? <ButtonLoadingSpinner size={14} /> : null}>
            {resetLoading ? 'Sending…' : 'Send reset link'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose} anchorOrigin={{ vertical: 'top', horizontal: isSmall ? 'center' : 'right' }}>
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
      </Snackbar>
    </>
  );
}

export default Auth;
