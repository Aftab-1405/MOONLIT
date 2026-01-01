import { createContext, useContext, useState, useEffect } from 'react';
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
import { initializeFirebase, getFirebaseAuth, getGoogleProvider, getGithubProvider } from '../config/firebase';

// Detect if user is on mobile device
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
};

const AuthContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components -- Hook export alongside Provider is valid React pattern
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
          // Check for redirect result (for mobile OAuth)
          try {
            await getRedirectResult(auth);
          } catch (redirectError) {
            console.error('Redirect result error:', redirectError);
            // Only set error if it's a real auth error, not just "no redirect"
            if (redirectError.code && redirectError.code !== 'auth/popup-closed-by-user') {
              setError(getErrorMessage(redirectError));
            }
          }
          
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
              
              // Set session on backend with verified ID token
              try {
                // Get Firebase ID token for backend verification
                const idToken = await firebaseUser.getIdToken();
                
                await fetch('/set_session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include', // Required for session cookies
                  body: JSON.stringify({ 
                    user: {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      displayName: firebaseUser.displayName,
                      photoURL: firebaseUser.photoURL
                    },
                    idToken  // Backend verifies this cryptographically
                  }),
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

  // Google Sign In - Uses redirect on mobile, popup on desktop
  const signInWithGoogle = async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGoogleProvider();
      
      if (!auth || !provider) {
        throw new Error('Firebase not initialized');
      }
      
      // Use redirect on mobile, popup on desktop
      if (isMobileDevice()) {
        // Redirect will navigate away, result handled in useEffect
        await signInWithRedirect(auth, provider);
        return null; // Won't reach here, page navigates away
      } else {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      }
    } catch (err) {
      console.error('Google sign in error:', err);
      setError(getErrorMessage(err));
      throw err;
    }
  };

  // GitHub Sign In - Uses redirect on mobile, popup on desktop
  const signInWithGitHub = async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const provider = getGithubProvider();
      
      if (!auth || !provider) {
        throw new Error('Firebase not initialized');
      }
      
      // Use redirect on mobile, popup on desktop
      if (isMobileDevice()) {
        // Redirect will navigate away, result handled in useEffect
        await signInWithRedirect(auth, provider);
        return null; // Won't reach here, page navigates away
      } else {
        const result = await signInWithPopup(auth, provider);
        return result.user;
      }
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
      await fetch('/logout', { method: 'POST', credentials: 'include' });
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
