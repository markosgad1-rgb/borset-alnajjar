import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyD7fJ0V4AMjsi6_CcpLmYdDSsnhnr_nRDs",
  authDomain: "borset-alnajjar.firebaseapp.com",
  projectId: "borset-alnajjar",
  storageBucket: "borset-alnajjar.firebasestorage.app",
  messagingSenderId: "1056162272270",
  appId: "1:1056162272270:web:7b3b4a022895743948585f",
  measurementId: "G-DPY6KQKGNY"
};

// Returns true if Firebase config is valid
export const isFirebaseConfigured = (): boolean => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY_HERE");
};

// Initialize Firebase App instance safely (singleton)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize & Export live Firestore instance
export const db = getFirestore(app);

// Initialize & Export Auth
export const auth = getAuth(app);
