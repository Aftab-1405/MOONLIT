import { Box, Typography, Button, Container, Paper, Stack, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import GoogleIcon from '@mui/icons-material/Google';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useAuth } from '../contexts/AuthContext';

function Auth() {
  const navigate = useNavigate();
  const { signInWithGoogle, isAuthenticated, loading, error } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat');
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      navigate('/chat');
    } catch (err) {
      console.error('Sign in failed:', err);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
        }}
      >
        <CircularProgress sx={{ color: 'primary.main' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Immersive Background Effects */}
      <Box
        sx={{
          position: 'absolute',
          top: '-30%',
          left: '-20%',
          width: '60%',
          height: '60%',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-30%',
          right: '-20%',
          width: '60%',
          height: '60%',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        {/* Glassmorphism Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, sm: 5 },
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 4,
          }}
        >
          <Stack spacing={4} alignItems="center">
            {/* Brand Logo */}
            <Box
              component="img"
              src="/brand-logo.png"
              alt="DB-Genie"
              sx={{
                width: 80,
                height: 'auto',
                filter: 'drop-shadow(0 12px 24px rgba(139, 92, 246, 0.4))',
              }}
            />

            {/* Title */}
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                Welcome Back
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to start querying with AI
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  width: '100%',
                  backgroundColor: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                }}
              >
                {error}
              </Alert>
            )}

            {/* Google Sign-In Button */}
            <Button
              fullWidth
              variant="outlined"
              size="large"
              startIcon={<GoogleIcon />}
              onClick={handleGoogleSignIn}
              sx={{
                py: 1.75,
                fontSize: '1rem',
                fontWeight: 600,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                },
              }}
            >
              Continue with Google
            </Button>

            {/* Divider */}
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
              <Typography variant="caption" color="text.secondary">or</Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
            </Box>

            {/* Back to Home */}
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
              sx={{
                color: 'text.secondary',
                '&:hover': { color: 'primary.main', backgroundColor: 'transparent' },
              }}
            >
              Back to home
            </Button>
          </Stack>
        </Paper>

        {/* Footer Text */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', textAlign: 'center', mt: 4 }}
        >
          By signing in, you agree to our Terms and Privacy Policy
        </Typography>
      </Container>
    </Box>
  );
}

export default Auth;
