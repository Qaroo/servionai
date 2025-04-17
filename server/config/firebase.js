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

// משתנה גלובלי לשמירת אובייקט מדומה
let mockFirestore = null;

const initializeFirebase = () => {
  try {
    // בדוק אם יש כבר אפליקציית Firebase שאותחלה
    if (admin.apps.length === 0) {
      // נסה להתחבר בגישה האנונימית ההיקפית עם Application Default Credentials
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
        databaseURL: firebaseConfig.databaseURL,
        storageBucket: firebaseConfig.storageBucket
      });
      console.log('Firebase initialized with default configuration');
    }
    
    // נסה לגשת ל-Firestore כדי לוודא שהחיבור עובד
    const db = admin.firestore();
    console.log('Firebase Firestore access successful');
    
    return db;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    console.error('Firebase credentials issue. Running without database.');
    console.warn('Running in NO-DATABASE mode - data will not be saved');
    
    // יצירת אובייקט מדומה של Firestore
    mockFirestore = createMockFirestore();
    return mockFirestore;
  }
};

// פונקציה ליצירת firestore מדומה
function createMockFirestore() {
  console.log('Creating mock Firestore for development');
  
  // אחסון נתונים זמניים
  const collections = {
    agents: {},
    conversations: {},
    messages: {},
    phone_numbers: {}
  };
  
  // החזרת אובייקט עם API דומה ל-Firestore
  return {
    collection: (name) => ({
      doc: (id) => ({
        set: (data) => {
          if (!collections[name]) collections[name] = {};
          collections[name][id] = data;
          return Promise.resolve();
        },
        get: () => Promise.resolve({
          exists: () => collections[name] && collections[name][id],
          data: () => collections[name] && collections[name][id] ? collections[name][id] : null,
          id
        }),
        update: (data) => {
          if (!collections[name]) collections[name] = {};
          if (!collections[name][id]) collections[name][id] = {};
          
          collections[name][id] = { ...collections[name][id], ...data };
          return Promise.resolve();
        },
        delete: () => {
          if (collections[name] && collections[name][id]) {
            delete collections[name][id];
          }
          return Promise.resolve();
        }
      }),
      add: (data) => {
        const id = `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        if (!collections[name]) collections[name] = {};
        collections[name][id] = data;
        return Promise.resolve({ id });
      },
      where: () => ({
        where: () => ({
          limit: () => ({
            get: () => Promise.resolve({
              empty: true,
              docs: []
            })
          })
        }),
        limit: () => ({
          get: () => Promise.resolve({
            empty: true,
            docs: []
          })
        }),
        get: () => Promise.resolve({
          empty: true,
          docs: []
        })
      }),
      get: () => Promise.resolve({
        empty: Object.keys(collections[name] || {}).length === 0,
        docs: Object.entries(collections[name] || {}).map(([id, data]) => ({
          id,
          data: () => data,
          ref: {
            update: (updateData) => {
              collections[name][id] = { ...collections[name][id], ...updateData };
              return Promise.resolve();
            }
          }
        }))
      })
    })
  };
}

module.exports = {
  initializeFirebase,
  firebaseConfig
}; 