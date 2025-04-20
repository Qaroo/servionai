import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCyf45mQN1HsN4nsnHw38spETfcyq9e3Ok",
  authDomain: "servion-ai.firebaseapp.com",
  projectId: "servion-ai",
  storageBucket: "servion-ai.firebasestorage.app",
  messagingSenderId: "235803029985",
  appId: "1:235803029985:web:121d387ca71a0cacd7e2a0",
  measurementId: "G-VZ4SHMBK4P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Force Hebrew language for Google Auth
googleProvider.setCustomParameters({
  'lang': 'he'
});

export { auth, db, storage, googleProvider }; 