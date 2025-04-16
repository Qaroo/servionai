const admin = require('firebase-admin');
const path = require('path');

const firebaseConfig = {
  apiKey: "AIzaSyC_piviejkPh1v-qLjHKxc0xH22EKGpbA0",
  authDomain: "eli-gram.firebaseapp.com",
  databaseURL: "https://eli-gram.firebaseio.com",
  projectId: "eli-gram",
  storageBucket: "eli-gram.firebasestorage.app",
  messagingSenderId: "1056446506927",
  appId: "1:1056446506927:web:361271b56158a1fb5f715a",
  measurementId: "G-N4XVLH2SW4"
};

const initializeFirebase = () => {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: firebaseConfig.projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-iqad7@eli-gram.iam.gserviceaccount.com",
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
      }),
      databaseURL: firebaseConfig.databaseURL,
      storageBucket: firebaseConfig.storageBucket
    });
    console.log('Firebase initialized successfully');
    return admin.firestore();
  } catch (error) {
    console.error('Firebase initialization error:', error);
    console.error('Firebase credentials issue. Running without database.');
    console.warn('Running in NO-DATABASE mode - data will not be saved');
    return null;
  }
};

module.exports = {
  initializeFirebase,
  firebaseConfig
}; 