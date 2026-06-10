import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { initializeFirebase, getFirebaseAuth, getGoogleProvider, getGithubProvider } from '@/config/firebase';
import { setSession as setBackendSession, logout as logoutBackend } from '@/api';
import logger from '@/utils/logger';
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
};
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

const getErrorMessage = (error) => ERROR_MESSAGES[error.code] || error.message;

const AuthContext = createContext(null);

const normalizeAuthUser = (firebaseUser, backendUser = {}) => ({
  uid: backendUser.uid || firebaseUser.uid,
  email: backendUser.email || firebaseUser.email,
  displayName:
    backendUser.displayName ||
    backendUser.name ||
    firebaseUser.displayName ||
    firebaseUser.email?.split('@')[0],
  photoURL: backendUser.photoURL || backendUser.picture || firebaseUser.photoURL,
});

const getSessionUser = (sessionResponse) => (
  sessionResponse?.data?.user || sessionResponse?.user || {}
);

// eslint-disable-next-line react-refresh/only-export-components -- Hook export alongside Provider is valid React pattern
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  if (typeof window !== 'undefined' && window.__MOCK_AUTH__) {
    const mockValue = useMemo(() => ({
      loading: false,
      isAuthenticated: true,
      user: { uid: 'mock-user-123', email: 'mock@example.com', displayName: 'Mock User' },
      logout: () => Promise.resolve(),
      signInWithGoogle: () => Promise.resolve({ uid: 'mock-user-123' }),
      signInWithEmail: () => Promise.resolve({ uid: 'mock-user-123' }),
      signUpWithEmail: () => Promise.resolve({ uid: 'mock-user-123' }),
      resetPassword: () => Promise.resolve(true),
    }), []);

    return (
      <AuthContext.Provider value={mockValue}>
        {children}
      </AuthContext.Provider>
    );
  }

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const establishBackendSession = useCallback(async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    const sessionResponse = await setBackendSession({ idToken });
    return normalizeAuthUser(firebaseUser, getSessionUser(sessionResponse));
  }, []);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        await initializeFirebase();
        if (active) setInitialized(true);

        const auth = getFirebaseAuth();
        if (auth) {
          try {
            await getRedirectResult(auth);
          } catch (redirectError) {
            logger.error('Redirect result error:', redirectError);
            if (redirectError.code && redirectError.code !== 'auth/popup-closed-by-user') {
              if (active) setError(getErrorMessage(redirectError));
            }
          }
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              try {
                const sessionUser = await establishBackendSession(firebaseUser);
                if (active) setUser(sessionUser);
              } catch (err) {
                logger.error('Failed to set session:', err);
                if (active) {
                  setUser(null);
                  setError('Unable to start a secure session. Please sign in again.');
                }
                try {
                  await signOut(auth);
                  await logoutBackend();
                } catch (logoutError) {
                  logger.error('Failed to clear auth after session error:', logoutError);
                }
              }
            } else {
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
  const signUpWithEmail = useCallback(async (email, password, displayName = '') => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.');

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
  const signInWithEmail = useCallback(async (email, password) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.');

      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      logger.error('Sign in error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  }, []);
  const resetPassword = useCallback(async (email) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.');

      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      logger.error('Password reset error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  }, []);
  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();

      if (!auth || !provider) {
        throw new Error('Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.');
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
  const signInWithGitHub = useCallback(async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGithubProvider();

      if (!auth || !provider) {
        throw new Error('Firebase not initialized. Please ensure the backend server is running on port 5000 and configured correctly.');
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
  const logout = useCallback(async () => {
    try {
      const auth = getFirebaseAuth();
      if (auth) {
        await signOut(auth);
      }
      await logoutBackend();
      setUser(null);
    } catch (err) {
      logger.error('Logout error:', err);
      setError(getErrorMessage(err));
    }
  }, []);
  const clearError = useCallback(() => setError(null), []);
  const value = useMemo(() => ({
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
  }), [
    user, loading, error, initialized,
    signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithGitHub,
    resetPassword, logout, clearError
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
