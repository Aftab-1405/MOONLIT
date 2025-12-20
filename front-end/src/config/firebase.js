import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase configuration - fetched from backend for security
let firebaseApp = null;
let auth = null;
let googleProvider = null;

export const initializeFirebase = async () => {
  if (firebaseApp) return { auth, googleProvider };

  try {
    // Fetch Firebase config from backend
    const response = await fetch('/firebase-config');
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error('Failed to fetch Firebase config');
    }

    const firebaseConfig = data.config;
    
    // Initialize Firebase
    firebaseApp = initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    googleProvider = new GoogleAuthProvider();
    
    // Configure Google provider
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });

    console.log('Firebase initialized successfully');
    return { auth, googleProvider };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    throw error;
  }
};

export const getFirebaseAuth = () => auth;
export const getGoogleProvider = () => googleProvider;
