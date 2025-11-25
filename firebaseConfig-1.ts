
export const firebaseConfig = {
  apiKey: "AIzaSyD7fJ0V4AMjsi6_CcpLmYdDSsnhnr_nRDs",
  authDomain: "borset-alnajjar.firebaseapp.com",
  projectId: "borset-alnajjar",
  storageBucket: "borset-alnajjar.firebasestorage.app",
  messagingSenderId: "1056162272270",
  appId: "1:1056162272270:web:7b3b4a022895743948585f",
  measurementId: "G-DPY6KQKGNY"
};

// هذه الدالة تتأكد هل قمت بوضع البيانات أم لا
export const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";
};
