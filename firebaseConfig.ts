import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
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
// Offline-first: local persistent cache (works across multiple tabs). Falls back to the
// default Firestore instance if persistence is unavailable (e.g. private mode / old browser).
const createDb = () => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: 200 * 1024 * 1024
      })
    });
  } catch (e) {
    console.warn('Offline persistence unavailable, using default Firestore:', e);
    return getFirestore(app);
  }
};
export const db = createDb();

// Initialize & Export Auth
export const auth = getAuth(app);
