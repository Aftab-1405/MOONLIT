import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { initializeFirebase, getFirebaseAuth, getGoogleProvider, getGithubProvider } from '../config/firebase';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Initialize Firebase on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeFirebase();
        setInitialized(true);
        
        const auth = getFirebaseAuth();
        if (auth) {
          // Listen for auth state changes
          const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
              // User is signed in
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
                photoURL: firebaseUser.photoURL,
              });
              
              // Set session on backend
              try {
                await fetch('/set_session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user: firebaseUser.email }),
                });
              } catch (err) {
                console.error('Failed to set session:', err);
              }
            } else {
              setUser(null);
            }
            setLoading(false);
          });
          
          return () => unsubscribe();
        }
      } catch (err) {
        console.error('Firebase init error:', err);
        setError(err.message);
        setLoading(false);
      }
    };
    
    init();
  }, []);

  // Helper to get user-friendly error messages
  const getErrorMessage = (error) => {
    const errorMessages = {
      'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/operation-not-allowed': 'This sign-in method is not enabled.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password. Please try again.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
      'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    };
    return errorMessages[error.code] || error.message;
  };

  // Email/Password Sign Up
  const signUpWithEmail = async (email, password, displayName = '') => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase not initialized');
      
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name if provided
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      
      return result.user;
    } catch (err) {
      console.error('Sign up error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  };

  // Email/Password Sign In
  const signInWithEmail = async (email, password) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase not initialized');
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      console.error('Sign in error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  };

  // Password Reset
  const resetPassword = async (email) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase not initialized');
      
      await sendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      console.error('Password reset error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  };

  // Google Sign In
  const signInWithGoogle = async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();
      
      if (!auth || !provider) {
        throw new Error('Firebase not initialized');
      }
      
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  };

  // GitHub Sign In
  const signInWithGitHub = async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGithubProvider();
      
      if (!auth || !provider) {
        throw new Error('Firebase not initialized');
      }
      
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      console.error('GitHub sign in error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  };

  // Sign Out
  const logout = async () => {
    try {
      const auth = getFirebaseAuth();
      if (auth) {
        await signOut(auth);
      }
      
      // Clear backend session
      await fetch('/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError(getErrorMessage(err));
    }
  };

  // Clear error manually
  const clearError = () => setError(null);

  const value = {
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
