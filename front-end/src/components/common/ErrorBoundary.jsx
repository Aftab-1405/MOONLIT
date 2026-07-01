import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Box, Button, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }

    this.setState({ errorInfo });

    // TODO: Send to an error reporting service when one is configured.
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const { fallback, minimal } = this.props;
      if (fallback) {
        return fallback;
      }
      if (minimal) {
        return (
          <Box
            role="alert"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              p: { xs: 2.5, sm: 3 },
              gap: 1.5,
              minHeight: 200,
              textAlign: 'center',
            }}
          >
            <Box
              sx={(theme) => ({
                width: 42,
                height: 42,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '12px',
                color: 'error.main',
                backgroundColor: alpha(
                  theme.palette.error.main,
                  theme.palette.mode === 'dark' ? 0.14 : 0.07,
                ),
                border: `1px solid ${alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.24 : 0.14)}`,
              })}
            >
              <ErrorOutlineRoundedIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 650, color: 'text.primary' }}>
                This section could not load
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Try rendering it again.
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={this.handleRetry}
              startIcon={<RefreshRoundedIcon sx={{ fontSize: 17 }} />}
              sx={{ borderRadius: '10px', px: 1.5 }}
            >
              Try again
            </Button>
          </Box>
        );
      }
      return (
        <Box
          sx={(theme) => ({
            minHeight: '100vh',
            '@supports (height: 100dvh)': { minHeight: '100dvh' },
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'background.default',
            backgroundImage: `radial-gradient(circle at 50% 38%, ${alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.06 : 0.035)}, transparent 38%)`,
            p: { xs: 2, sm: 3 },
          })}
        >
          <Paper
            role="alert"
            aria-live="assertive"
            elevation={0}
            sx={(theme) => ({
              position: 'relative',
              overflow: 'hidden',
              maxWidth: 540,
              width: '100%',
              p: { xs: 2.5, sm: 4 },
              textAlign: 'center',
              border: '1px solid',
              borderColor: alpha(
                theme.palette.text.primary,
                theme.palette.mode === 'dark' ? 0.12 : 0.09,
              ),
              borderRadius: '18px',
              bgcolor: alpha(
                theme.palette.background.paper,
                theme.palette.mode === 'dark' ? 0.94 : 0.98,
              ),
              boxShadow:
                theme.palette.mode === 'dark'
                  ? `0 24px 70px ${alpha(theme.palette.common.black, 0.42)}`
                  : `0 24px 70px ${alpha(theme.palette.common.black, 0.1)}`,
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: '0 18% auto',
                height: 1,
                background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.text.primary, 0.32)}, transparent)`,
              },
            })}
          >
            <Box
              sx={(theme) => ({
                width: 52,
                height: 52,
                mx: 'auto',
                mb: 2.25,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '15px',
                color: 'error.main',
                backgroundColor: alpha(
                  theme.palette.error.main,
                  theme.palette.mode === 'dark' ? 0.14 : 0.07,
                ),
                border: `1px solid ${alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.26 : 0.15)}`,
              })}
            >
              <ErrorOutlineRoundedIcon sx={{ fontSize: 27 }} />
            </Box>

            <Typography
              component="p"
              sx={(theme) => ({
                ...theme.typography.uiMonoLabel,
                mb: 1,
                color: 'text.disabled',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              })}
            >
              Recovery mode
            </Typography>
            <Typography
              variant="h5"
              sx={{ fontWeight: 650, letterSpacing: '-0.025em', color: 'text.primary' }}
            >
              Moonlit hit an unexpected error
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, mb: 3, lineHeight: 1.65 }}
            >
              Reload the app to restore your workspace. If the problem continues, return home and
              try again.
            </Typography>
            {import.meta.env.DEV && this.state.error && (
              <Box
                sx={(theme) => ({
                  mb: 3,
                  p: 1.75,
                  bgcolor: alpha(
                    theme.palette.error.main,
                    theme.palette.mode === 'dark' ? 0.09 : 0.045,
                  ),
                  border: `1px solid ${alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`,
                  borderRadius: '12px',
                  textAlign: 'left',
                  overflow: 'auto',
                  maxHeight: 200,
                })}
              >
                <Typography
                  sx={(theme) => ({
                    ...theme.typography.uiMonoLabel,
                    color: 'error.main',
                    mb: 1,
                  })}
                >
                  Development details
                </Typography>
                <Typography
                  variant="caption"
                  component="pre"
                  sx={(theme) => ({
                    fontFamily: theme.typography.fontFamilyMono,
                    ...theme.typography.uiCaptionXs,
                    whiteSpace: 'pre',
                    overflowX: 'auto',
                    m: 0,
                  })}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshRoundedIcon />}
                onClick={this.handleReload}
                sx={{ borderRadius: '10px', px: 1.75 }}
              >
                Reload page
              </Button>
              <Button
                variant="text"
                startIcon={<HomeRoundedIcon />}
                onClick={this.handleGoHome}
                color="inherit"
                sx={{ borderRadius: '10px', px: 1.5 }}
              >
                Go home
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
