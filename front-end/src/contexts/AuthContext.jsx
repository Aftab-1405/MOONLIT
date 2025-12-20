import { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { initializeFirebase, getFirebaseAuth, getGoogleProvider } from '../config/firebase';

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
                displayName: firebaseUser.displayName,
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
      console.error('Sign in error:', err);
      setError(err.message);
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
      setError(err.message);
    }
  };

  const value = {
    user,
    loading,
    error,
    initialized,
    signInWithGoogle,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
