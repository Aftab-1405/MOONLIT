import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  logoutAuthenticatedUserSession as logoutBackend,
  setAuthenticatedUserSession as setBackendSession,
} from '@/api';
import { queryClient } from '@/api/queryClient';
import {
  getFirebaseAuth,
  getGithubProvider,
  getGoogleProvider,
  initializeFirebase,
} from '@/config/firebase';
import { normalizeAuthUser } from '@/utils/authUserProfile';
import logger from '@/utils/logger';

/**
 * Helper utility to check if the app is running on a mobile device.
 * Used to decide between popup and redirect auth methods since popups
 * are often blocked or have bad UX on mobile screens.
 */
const isMobileDevice = () => {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );
};

/**
 * Standard Firebase Auth error code mappings.
 * Translates Firebase technical error codes into user-friendly UI messages.
 */
const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Email already registered.',
  'auth/invalid-email': 'Invalid email address.',
  'auth/operation-not-allowed': 'Sign-in method not enabled.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-disabled': 'Account disabled.',
  'auth/user-not-found': 'No account found.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/popup-closed-by-user': 'Sign-in cancelled.',
  'auth/account-exists-with-different-credential': 'Email exists with different sign-in method.',
};

/**
 * Helper to retrieve a mapped friendly error message or default to the raw error message.
 */
const getErrorMessage = (error) => ERROR_MESSAGES[error.code] || error.message;

// The core React Context object used to share authentication state.
const AuthContext = createContext(null);

/**
 * Helper to safely extract user information from the backend session payload.
 */
const getSessionUser = (sessionResponse) =>
  sessionResponse?.data?.user || sessionResponse?.user || {};

/**
 * Custom hook to easily consume the authentication context values in pages/components.
 * Ensures the consumer is wrapped in an AuthProvider.
 */
// This hook intentionally shares the provider module's private context.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Main AuthProvider component that wraps the application.
 * Manages Firebase state, local storage, API handshake, and auth callbacks.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Holds the active normalized user object or null
  const [loading, setLoading] = useState(true); // Indicates if session verification is in progress
  const [error, setError] = useState(null); // Holds the current sign-in/up error messages to display in UI
  const [initialized, setInitialized] = useState(false); // Flag showing if Firebase Client SDK has finished initializing

  /**
   * Handshake function: Takes the Firebase user token, passes it to the backend's
   * /set_authenticated_user_session route to establish a secure backend cookie session, and normalizes the output.
   */
  const establishBackendSession = useCallback(async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const sessionResponse = await setBackendSession({ idToken });
    return normalizeAuthUser(firebaseUser, getSessionUser(sessionResponse));
  }, []);

  /**
   * Main authentication initialization and listener hook.
   * Runs once on app mount to verify redirects and listen to login state changes.
   */
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        // Step 1: Initialize Firebase Configuration
        await initializeFirebase();
        if (active) setInitialized(true);

        const auth = getFirebaseAuth();
        if (auth) {
          try {
            // Step 2: Retrieve the result of a redirect login (for mobile OAuth login flows)
            await getRedirectResult(auth);
          } catch (redirectError) {
            logger.error('Redirect result error:', redirectError);
            if (redirectError.code && redirectError.code !== 'auth/popup-closed-by-user') {
              if (active) setError(getErrorMessage(redirectError));
            }
          }

          // Step 3: Listen for login/logout state transitions from Firebase Client
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              try {
                // If logged in on Firebase, sync the session with the backend API
                const sessionUser = await establishBackendSession(firebaseUser);
                if (active) setUser(sessionUser);
              } catch (err) {
                logger.error('Failed to set session:', err);
                if (active) {
                  setUser(null);
                  setError('Unable to start a secure session. Please sign in again.');
                }
                // If backend session fails, log out client to keep states synchronized
                try {
                  await signOut(auth);
                  await logoutBackend();
                } catch (logoutError) {
                  logger.error('Failed to clear auth after session error:', logoutError);
                }
              }
            } else {
              // User has logged out or token has expired
              if (active) setUser(null);
            }
            if (active) setLoading(false);
          });

          return () => {
            active = false;
            unsubscribe();
          };
        }

        if (active) setLoading(false);
      } catch (err) {
        logger.error('Firebase init error:', err);
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    const cleanupPromise = init();
    return () => {
      active = false;
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [establishBackendSession]);

  /**
   * Action: Register a new user using Email and Password.
   * Calls Firebase Auth, optionally updates the user's display name, and triggers onAuthStateChanged.
   */
  const signUpWithEmail = useCallback(async (email, password, displayName = '') => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth)
        throw new Error(
          'Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.',
        );

      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName) {
        await updateProfile(result.user, { displayName });
      }

      return result.user;
    } catch (err) {
      logger.error('Sign up error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  }, []);

  /**
   * Action: Log in an existing user using Email and Password.
   */
  const signInWithEmail = useCallback(async (email, password) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth)
        throw new Error(
          'Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.',
        );

      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      logger.error('Sign in error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  }, []);

  /**
   * Action: Trigger a password reset email via Firebase.
   */
  const resetPassword = useCallback(async (email) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth)
        throw new Error(
          'Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.',
        );

      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      logger.error('Password reset error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  }, []);

  /**
   * Action: Authenticate using Google OAuth.
   * Chooses redirect flow for mobile screens and popup dialog for desktop screens.
   */
  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();

      if (!auth || !provider) {
        throw new Error(
          'Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.',
        );
      }

      if (isMobileDevice()) {
        await signInWithRedirect(auth, provider);
        return null;
      } else {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      }
    } catch (err) {
      logger.error('Google sign in error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  }, []);

  /**
   * Action: Authenticate using GitHub OAuth.
   * Chooses redirect flow for mobile screens and popup dialog for desktop screens.
   */
  const signInWithGitHub = useCallback(async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGithubProvider();

      if (!auth || !provider) {
        throw new Error(
          'Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.',
        );
      }

      if (isMobileDevice()) {
        await signInWithRedirect(auth, provider);
        return null;
      } else {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      }
    } catch (err) {
      logger.error('GitHub sign in error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  }, []);

  /**
   * Action: Log out the active session.
   * Signs out from the Firebase client, calls the backend's /logout_authenticated_user_session endpoint to clear cookies,
   * resets user state to null, and flushes React Query cache so data is not leaked.
   */
  const logout = useCallback(async () => {
    try {
      const auth = getFirebaseAuth();
      if (auth) {
        await signOut(auth);
      }
      await logoutBackend();
      queryClient.clear(); // Reset React Query cache to prevent stale user data exposure
      setUser(null);
    } catch (err) {
      logger.error('Logout error:', err);
      setError(getErrorMessage(err));
    }
  }, []);

  // Utility to clear UI auth errors.
  const clearError = useCallback(() => setError(null), []);

  // Memoized context payload value to prevent redundant renders.
  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      initialized,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithGitHub,
      resetPassword,
      logout,
      clearError,
      isAuthenticated: !!user,
    }),
    [
      user,
      loading,
      error,
      initialized,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      signInWithGitHub,
      resetPassword,
      logout,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
