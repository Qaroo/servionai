const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, query, where, getDocs, limit, serverTimestamp } = require('firebase/firestore');
const axios = require('axios');
const dotenv = require('dotenv');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config();

// הגדרות גלובליות - הוסף זה
// הוסף סט גלובלי לשמירת הודעות שכבר עובדו
const processedMessages = new Set();
// דגל שמציין אם Firestore זמין
let firestoreEnabled = true;
// db יוגדר כמשתנה גלובלי אבל יאותחל אחר כך
let db;
// מטמון עבור תצורות משתמשים
let userConfigCache = {};
// WhatsApp Web.js client
let whatsappClients = {}; // Object to store client instances by userId
let qrCodeData = {}; // QR codes by userId
let clientsReady = {}; // Ready status by userId
let lastMessageTime = {};
let pollingIntervals = {};

// לקח את ההגדרות החדשות מה-ENV
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// אתחול Firebase
try {
  // אתחול Firebase app
  const firebaseApp = initializeApp(firebaseConfig);
  
  // אתחול Firestore
  db = getFirestore(firebaseApp);
  
  console.log('Firebase initialized successfully');
  firestoreEnabled = true;
} catch (fbError) {
  console.error('Firebase initialization error:', fbError);
  console.error('Firebase credentials issue. Running without database.');
  firestoreEnabled = false;
  console.warn('Running in NO-DATABASE mode - data will not be saved');
  
  // יצירת mock db אם הייתה שגיאה
  db = createMockFirestore();
}

const app = express();
app.use(cors({
  origin: 'https://eli-gram.web.app',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(bodyParser.json());

// בדוק אם התיקייה קיימת לפני הגדרת השירות
const buildPath = path.join(__dirname, 'build');

if (fs.existsSync(buildPath)) {
  console.log('Serving static files from:', buildPath);
  app.use(express.static(buildPath));
} else {
  console.log('Build directory not found at:', buildPath);
}

// הוסף זאת לאחר הגדרת המשתנים הגלובליים
const isDevelopment = process.env.NODE_ENV === 'development';

// פונקציה לבדיקה אם קיים לקוח למשתמש מסוים
function getClientForUser(userId) {
  return whatsappClients[userId] || null;
}

// פונקציה לבדיקה אם לקוח מוכן לשימוש
function isClientReady(userId) {
  return clientsReady[userId] || false;
}

// פונקציה לקבלת קוד QR של משתמש
function getQrForUser(userId) {
  return qrCodeData[userId] || null;
}

// הגדר את מפתח API של OpenAI באופן מפורש
process.env.OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
console.log(`OpenAI API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);

// הפוך את פונקציית הבדיקה לפשוטה יותר ועדכן אותה לשימוש ב-firebase במקום firebase-admin
async function checkFirestoreConnection() {
  if (!firestoreEnabled) return false;
  
  try {
    console.log('Attempting to enable Firestore...');
    const testRef = doc(collection(db, 'system_checks'), 'connection_test');
    await setDoc(testRef, {
      timestamp: new Date(),
      server: 'render'
    });
    console.log('Firestore connection is working properly');
    firestoreEnabled = true;
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    firestoreEnabled = false;
    console.warn('Running in NO-DATABASE mode - data will not be saved');
    
    // כאן נוסיף אובייקט db פיקטיבי שלא זורק שגיאות כדי שהשרת ימשיך לעבוד
    if (!db) {
      console.log('Creating mock Firestore DB...');
      db = createMockFirestore();
    }
    
    return false;
  }
}

// פונקציה ליצירת אובייקט Firestore מדומה
function createMockFirestore() {
  console.log('Setting up mock Firestore - NO DATA WILL BE SAVED');
  
  // יצירת אובייקט מדומה שמחקה את ממשק ה-Firestore של Firebase SDK v9
  const mockDB = {
    // הפונקציות האלה הן המטה-פונקציות שלנו, לא חלק מהממשק של Firestore
    _mockCollection: {},
    
    // להוסיף נתונים מדומים למסד הנתונים כדי לאפשר שליפת נתונים כלשהם
    _seedMockData: function() {
      this._mockCollection = {
        'agents': {
          'default': {
            businessInfo: "This is a default agent for testing purposes."
          }
        },
        'conversations': {},
        'system_checks': {}
      };
    }
  };
  
  // זריעת נתונים מדומים
  mockDB._seedMockData();
  
  return mockDB;
}

// יצירת פונקציות מדומות לממשק Firestore v9
// הפונקציות האלה יוגדרו לאחר שה-db נוצר
function attachMockFirestoreMethods() {
  if (!firestoreEnabled && db) {
    // מהווה mock עבור collection() ב-Firestore v9
    global.collection = function(db, collectionName) {
      console.log(`[MOCK] Accessing collection: ${collectionName}`);
      return { _collection: collectionName };
    };
    
    // מהווה mock עבור doc() ב-Firestore v9
    global.doc = function(collectionRef, docId) {
      console.log(`[MOCK] Accessing document: ${docId} in collection ${collectionRef._collection}`);
      return { 
        _collection: collectionRef._collection, 
        _id: docId 
      };
    };
    
    // מהווה mock עבור getDoc() ב-Firestore v9
    global.getDoc = async function(docRef) {
      console.log(`[MOCK] Getting document: ${docRef._id} from collection ${docRef._collection}`);
      return {
        exists: () => false,
        data: () => ({
          businessInfo: "This is a mock business info for testing.",
          messages: []
        }),
        id: docRef._id
      };
    };
    
    // מהווה mock עבור setDoc() ב-Firestore v9
    global.setDoc = async function(docRef, data) {
      console.log(`[MOCK] Setting document: ${docRef._id} in collection ${docRef._collection}`);
      console.log(`[MOCK] Data:`, data);
      return { id: docRef._id };
    };
    
    // מהווה mock עבור updateDoc() ב-Firestore v9
    global.updateDoc = async function(docRef, data) {
      console.log(`[MOCK] Updating document: ${docRef._id} in collection ${docRef._collection}`);
      console.log(`[MOCK] Data:`, data);
      return { id: docRef._id };
    };
    
    // מהווה mock עבור addDoc() ב-Firestore v9
    global.addDoc = async function(collectionRef, data) {
      const id = `mock-${Date.now()}`;
      console.log(`[MOCK] Adding document to collection ${collectionRef._collection}`);
      console.log(`[MOCK] Data:`, data);
      return { id };
    };
    
    // מהווה mock עבור query(), where() ו-limit() ב-Firestore v9
    global.query = function(collectionRef, ...queryConstraints) {
      console.log(`[MOCK] Creating query on collection ${collectionRef._collection}`);
      return { 
        _collection: collectionRef._collection,
        _constraints: queryConstraints 
      };
    };
    
    global.where = function(field, operator, value) {
      return { type: 'where', field, operator, value };
    };
    
    global.limit = function(limitCount) {
      return { type: 'limit', limit: limitCount };
    };
    
    // מהווה mock עבור getDocs() ב-Firestore v9
    global.getDocs = async function(queryRef) {
      console.log(`[MOCK] Getting documents from collection ${queryRef._collection}`);
      return {
        empty: true,
        docs: [],
        forEach: (callback) => {}
      };
    };
    
    // מהווה mock עבור serverTimestamp() ב-Firestore v9
    global.serverTimestamp = function() {
      return new Date();
    };
    
    console.log('Attached mock Firestore methods to globals');
  }
}

// הוספת הפונקציות הגלובליות כאשר Firestore לא מופעל
if (!firestoreEnabled) {
  attachMockFirestoreMethods();
}

// בדוק תחילה אם יש תקלה בהאזנה לפורט
checkFirestoreConnection().then(isConnected => {
  console.log(`Firestore enabled: ${isConnected}`);
}).catch(err => {
  console.error('Could not check Firestore connection:', err);
  firestoreEnabled = false;
});

// Endpoint to initialize WhatsApp Web connection for a specific user
app.post('/api/whatsapp/initialize', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    // Reset existing client for this user
    await resetWhatsAppClient(userId);
    
    console.log(`Initializing WhatsApp client for user ${userId}`);
    
    // Create a new client instance for this user
    const clientId = `agent-saas-${userId}`;
    const authPath = path.join(__dirname, '.wwebjs_auth', clientId);
    
    // וודא שתיקיית Auth קיימת
    if (!fs.existsSync(path.dirname(authPath))) {
      fs.mkdirSync(path.dirname(authPath), { recursive: true });
    }
    whatsappClients[userId] = new Client({
      authStrategy: new LocalAuth({ 
        clientId: clientId,
        dataPath: path.join(__dirname, '.wwebjs_auth')
      }),
      puppeteer: {
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-extensions',
          '--ignore-certificate-errors',
          '--disable-storage-reset',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--window-size=1280,720'
        ],
        ignoreHTTPSErrors: true,
        timeout: 120000,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
      },
      webVersionCache: {
        type: 'none'
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
      webVersion: '2.2402.5',
      qrMaxRetries: 5,
      authTimeoutMs: 120000,
      restartOnAuthFail: true,
      takeoverOnConflict: true,
      disableReconnect: false,
      maxReconnects: 5,
      takeoverFailedAttempts: 3,
      ffmpegPath: process.env.FFMPEG_PATH
    });

    // QR code event
    whatsappClients[userId].on('qr', (qr) => {
      console.log(`QR code received for user ${userId}`);
      qrCodeData[userId] = qr;
    });
    
    // Ready event
    whatsappClients[userId].on('ready', () => {
      console.log(`WhatsApp client is ready for user ${userId}`);
      clientsReady[userId] = true;
      qrCodeData[userId] = null;
      
      // התחל polling אחרי שהלקוח מוכן
      startMessagePolling(userId);
    });
    
    // Auth failure event
    whatsappClients[userId].on('auth_failure', (msg) => {
      console.error(`WhatsApp authentication failed for user ${userId}:`, msg);
      clientsReady[userId] = false;
      qrCodeData[userId] = null;
    });
    
    // Disconnected event
    whatsappClients[userId].on('disconnected', (reason) => {
      console.log(`WhatsApp client disconnected for user ${userId}:`, reason);
      clientsReady[userId] = false;
      qrCodeData[userId] = null;
      whatsappClients[userId] = null;
    });
    
    // Message event
    whatsappClients[userId].on('message', async (message) => {
      console.log(`====== NEW MESSAGE RECEIVED ======`);
      console.log(`TIMESTAMP: ${new Date().toISOString()}`);
      console.log(`FROM: ${message.from}`);
      console.log(`TO USER: ${userId}`);
      console.log(`MESSAGE BODY: ${message.body}`);
      console.log(`MESSAGE TYPE: ${message._data.type}`);
      console.log(`MESSAGE ID: ${message.id._serialized}`);
      console.log(`==================================`);
      
      if (message.body && !message.fromMe) {
        try {
          // בדוק אם ההודעה כבר טופלה
          const messageKey = `${message.id._serialized}_${userId}`;
          if (processedMessages.has(messageKey)) {
            console.log(`Message ${messageKey} already processed, skipping`);
            return;
          }
          
          // סמן את ההודעה כמטופלת לפני העיבוד
          processedMessages.add(messageKey);
          
          console.log(`Starting to process message from ${message.from}`);
          const result = await processIncomingMessage(message, userId);
          console.log(`Message processing completed with result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
          if (!result.success) {
            console.error(`Processing error: ${result.error}`);
          }
        } catch (err) {
          console.error(`CRITICAL ERROR handling message:`, err);
          console.error(err.stack);
        }
      } else {
        console.log(`Message ignored: ${message.fromMe ? 'sent by me' : 'empty body'}`);
      }
    });
    
    // הוסף אירועי לוג נוספים
    whatsappClients[userId].on('message_ack', (msg, ack) => {
      // ACK values
      // 0: פג תוקף
      // 1: נשלח למכשיר שלנו
      // 2: התקבל בשרת של WhatsApp
      // 3: התקבל במכשיר של הנמען
      // 4: נקרא על ידי הנמען
      
      let ackStatus = '';
      switch(ack) {
        case 0: ackStatus = 'פג תוקף/לא נשלח'; break;
        case 1: ackStatus = 'נשלח למכשיר שלנו'; break;
        case 2: ackStatus = 'התקבל בשרת'; break;
        case 3: ackStatus = 'התקבל במכשיר היעד'; break;
        case 4: ackStatus = 'נקרא'; break;
        default: ackStatus = `לא ידוע (${ack})`;
      }
      
      console.log(`[ACK] Message status update: ID ${msg.id._serialized} | Status: ${ackStatus}`);
      console.log(`[ACK] Message to: ${msg.to} | Content: ${msg.body.substring(0, 50)}${msg.body.length > 50 ? '...' : ''}`);
      
      // אם ההודעה נכשלה או פג תוקפה, נסה לשלוח שוב
      if (ack === 0 && msg.fromMe) {
        console.log(`[ACK] Message delivery failed, will attempt resend`);
        
        setTimeout(async () => {
          try {
            if (whatsappClients[userId] && clientsReady[userId]) {
              console.log(`[ACK] Resending message to ${msg.to}`);
              await whatsappClients[userId].sendMessage(msg.to, msg.body);
              console.log(`[ACK] Message resent successfully`);
            }
          } catch (resendError) {
            console.error(`[ACK] Error resending message:`, resendError);
          }
        }, 5000); // המתן 5 שניות לפני ניסיון שליחה מחדש
      }
    });

    // עדכן את אירוע message_create לספק מידע מפורט יותר
    whatsappClients[userId].on('message_create', (msg) => {
      console.log(`Message created [${msg.id._serialized}]: ${msg.from} -> ${msg.to}`);
      console.log(`Body: ${msg.body.substring(0, 100)}${msg.body.length > 100 ? '...' : ''}`);
      console.log(`Is from me: ${msg.fromMe}`);
    });

    // הוסף טיפול באירועי שגיאה כדי לוודא שאנחנו רואים כל בעיה
    whatsappClients[userId].on('message_reaction', (reaction) => {
      console.log(`Message reaction: ${reaction.text} to message: ${reaction.msgId}`);
    });

    // העשר את אירוע change_state
    whatsappClients[userId].on('change_state', (state) => {
      console.log(`WhatsApp state changed to: ${state} for user ${userId}`);
      
      // אם החיבור נותק, נסה לחבר מחדש
      if (state === 'DISCONNECTED') {
        console.log(`Attempting to reconnect for user ${userId}...`);
        setTimeout(() => {
          if (whatsappClients[userId]) {
            console.log(`Re-initialization attempt for user ${userId}`);
            whatsappClients[userId].initialize().catch(err => 
              console.error(`Re-initialization error: ${err.message}`));
          }
        }, 5000);
      }
    });

    // הוסף לוג לאירוע authenticated
    whatsappClients[userId].on('authenticated', () => {
      console.log(`WhatsApp client AUTHENTICATED for user ${userId}`);
    });

    // הוסף אירועים נוספים - להוסיף יחד עם האירועים הקיימים
    whatsappClients[userId].on('message_revoke_everyone', (after, before) => {
      console.log(`Message revoked: ${before?.body}`);
    });

    whatsappClients[userId].on('contact_changed', (message, oldId, newId, isContact) => {
      console.log(`Contact changed from ${oldId} to ${newId}`);
    });

    whatsappClients[userId].on('group_join', (notification) => {
      console.log(`User joined group: ${notification.id.participant}`);
    });

    whatsappClients[userId].on('group_leave', (notification) => {
      console.log(`User left group: ${notification.id.participant}`);
    });

    whatsappClients[userId].on('group_update', (notification) => {
      console.log(`Group updated: ${notification.author}`);
    });
    
    // Initialize client
    whatsappClients[userId].initialize().then(() => {
      console.log(`WhatsApp client initialized successfully for user ${userId}`);
      
      // רשום את כל האירועים הפעילים
      console.log(`Active event listeners for ${userId}:`, 
        Object.keys(whatsappClients[userId]._events).join(', '));
      
      // בדוק את מצב החיבור
      whatsappClients[userId].getState().then(state => {
        console.log(`Client state after initialization: ${state}`);
      }).catch(err => {
        console.error(`Error getting state: ${err.message}`);
      });
      
    }).catch(err => {
      console.error(`Error during WhatsApp initialization for user ${userId}:`, err);
      qrCodeData[userId] = 'ERROR: Failed to initialize WhatsApp: ' + err.message;
      clientsReady[userId] = false;
    });
    
    res.json({ success: true, message: `WhatsApp initialization started for user ${userId}` });
  } catch (error) {
    console.error('Error initializing WhatsApp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint לדיבוג
app.get('/api/debug', (req, res) => {
  const info = {
    env: process.env.NODE_ENV,
    uptime: process.uptime(),
    clients: Object.keys(whatsappClients).map(id => ({
      id,
      ready: clientsReady[id] || false,
      hasQR: !!qrCodeData[id]
    })),
    openai: {
      keyConfigured: !!(process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY)
    }
  };
  res.json(info);
});

// Endpoint to get WhatsApp connection status for a specific user
app.get('/api/whatsapp/status/:userId', (req, res) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  // בסביבת פיתוח, החזר QR קוד לדוגמה אחרי 5 שניות
  if (isDevelopment && !getQrForUser(userId) && !isClientReady(userId)) {
    setTimeout(() => {
      if (!qrCodeData[userId]) {
        qrCodeData[userId] = 'https://api.qrserver.com/v1/create-qr-code/?data=ExampleWhatsAppQR&size=200x200';
      }
    }, 5000);
  }
  
  res.json({
    ready: isClientReady(userId),
    qrCode: getQrForUser(userId)
  });
});

// Endpoint to send a WhatsApp message from a specific user
app.post('/api/whatsapp/send', async (req, res) => {
  const { userId, to, text } = req.body;
  
  if (!userId || !to || !text) {
    return res.status(400).json({ success: false, error: 'User ID, phone number and message text are required' });
  }
  
  const client = getClientForUser(userId);
  
  if (!client) {
    return res.status(400).json({ success: false, error: 'WhatsApp client is not initialized for this user' });
  }
  
  if (!isClientReady(userId)) {
    return res.status(400).json({ success: false, error: 'WhatsApp client is not ready yet for this user' });
  }
  
  // פורמט מספר הטלפון
  let cleanNumber = to.replace(/\D/g, '');
  
  // הסר את הספרה 0 מההתחלה אם קיימת
  if (cleanNumber.startsWith('0')) {
    cleanNumber = cleanNumber.substring(1);
  }
  
  // וודא שיש קידומת מדינה (ברירת מחדל 972 לישראל)
  if (!cleanNumber.startsWith('972')) {
    cleanNumber = '972' + cleanNumber;
  }
  
  // הוסף את הסיומת של WhatsApp
  const formattedNumber = `${cleanNumber}@c.us`;
  
  console.log(`Attempting to send message to ${formattedNumber} from user ${userId}:`, text);
  
  try {
    // שלח את ההודעה
    const result = await client.sendMessage(formattedNumber, text);
    console.log(`Message sent successfully from user ${userId}:`, result);
    
    return res.json({ 
      success: true, 
      message: 'Message sent successfully',
      result
    });
  } catch (error) {
    console.error(`Error sending WhatsApp message from user ${userId}:`, error);
    return res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// פונקציה חדשה לאיפוס לקוח ה-WhatsApp
async function resetWhatsAppClient(userId) {
  try {
    console.log(`Resetting WhatsApp client for user ${userId}...`);
    
    if (whatsappClients[userId]) {
      try {
        await whatsappClients[userId].destroy().catch(e => console.log(`Error destroying client for user ${userId}:`, e.message));
      } catch (err) {
        console.log(`Error during client destroy for user ${userId}:`, err.message);
      }
    }
    
    whatsappClients[userId] = null;
    clientsReady[userId] = false;
    qrCodeData[userId] = null;
    
    console.log(`WhatsApp client has been reset for user ${userId}`);
  } catch (error) {
    console.error(`Error resetting WhatsApp client for user ${userId}:`, error);
  }
}

// Endpoint to logout from WhatsApp for a specific user
app.post('/api/whatsapp/logout', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  
  try {
    await resetWhatsAppClient(userId);
    return res.json({ success: true, message: `Logged out successfully for user ${userId}` });
  } catch (error) {
    console.error(`Error logging out from WhatsApp for user ${userId}:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Original webhook endpoints
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Set this verify token in your Facebook app settings
  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'your_verify_token';
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('Webhook verification failed');
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  
  // Check if this is a WhatsApp message
  if (body.object === 'whatsapp_business_account' && body.entry && body.entry.length > 0) {
    const entry = body.entry[0];
    
    if (entry.changes && entry.changes.length > 0) {
      const change = entry.changes[0];
      
      if (change.value && change.value.messages && change.value.messages.length > 0) {
        const message = change.value.messages[0];
        const phoneNumberId = change.value.metadata.phone_number_id;
        const from = message.from; // Customer's phone number
        const messageText = message.text.body;
        
        console.log(`Received message from ${from}: ${messageText}`);
        
        try {
          // מצא את כל המשתמשים שיש להם את מספר הטלפון הזה
          const phoneConfig = await getDocs(query(collection(db, 'phone_configs'), where('phoneNumberId', '==', phoneNumberId), limit(1)));
          
          if (phoneConfig.empty) {
            console.error(`No agent found for phone number ID ${phoneNumberId}`);
            res.sendStatus(200);
            return;
          }
          
          // נשתמש במשתמש הראשון שמצאנו שתואם למספר הטלפון הזה
          const firstPhoneConfig = phoneConfig.docs[0];
          const userId = firstPhoneConfig.data().userId;
          
          // המשך כרגיל עם הטיפול בהודעה והתגובה עבור המשתמש הספציפי
          
          // טפל בהודעה ושמור אותה...
          
          // יצור תגובת AI...
          
          // שלח את התגובה באמצעות API של WhatsApp Business
          // הערה: אנחנו משתמשים ב-API ולא ב-WhatsApp Web כאן
          await axios.post(
            `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
            {
              messaging_product: 'whatsapp',
              to: from,
              text: { body: aiResponseText }
            },
            {
              headers: {
                'Authorization': `Bearer ${facebookToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
        } catch (error) {
          console.error('Error processing message:', error.message);
          if (error.response) {
            console.error('Error response data:', error.response.data);
          }
        }
      }
    }
  }
  
  // Always return a 200 OK to acknowledge receipt
  res.sendStatus(200);
});

// Catch all other routes and return the React app
app.get('*', (req, res) => {
  // בדוק אם הקובץ קיים לפני הניסיון לשלוח אותו
  const indexPath = path.join(__dirname, 'build', 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // אם הקובץ לא קיים, שלח תשובה פשוטה
    res.send('WhatsApp API Server is running');
  }
});

// הוסף טיפול שגיאות כללי לתהליך
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Don't exit the process
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process
});

// הוסף endpoint חדש לבדיקת החיבור
app.get('/api/whatsapp/connection-status', async (req, res) => {
  try {
    if (!whatsappClients[req.query.userId]) {
      return res.json({ connected: false, status: 'no-client' });
    }
    
    try {
      const state = await whatsappClients[req.query.userId].getState();
      console.log('Current WhatsApp state:', state);
      return res.json({ 
        connected: state === 'CONNECTED', 
        status: state 
      });
    } catch (error) {
      console.error('Error checking WhatsApp state:', error);
      return res.json({ 
        connected: false, 
        status: 'error',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error in connection status endpoint:', error);
    return res.status(500).json({ 
      connected: false, 
      status: 'error',
      error: error.message 
    });
  }
});

app.get('/api/whatsapp/test', async (req, res) => {
  try {
    if (!whatsappClients[req.query.userId] || !clientsReady[req.query.userId]) {
      return res.json({ 
        success: false, 
        message: 'WhatsApp client is not ready',
        status: clientsReady[req.query.userId] ? 'ready' : 'not ready',
        clientExists: !!whatsappClients[req.query.userId]
      });
    }
    
    // בדוק את הסטטוס
    const state = await whatsappClients[req.query.userId].getState().catch(e => 'ERROR: ' + e.message);
    const info = await whatsappClients[req.query.userId].getWid().catch(e => 'ERROR: ' + e.message);
    
    return res.json({
      success: true,
      state,
      info,
      ready: clientsReady[req.query.userId]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// יצירת מנגנון לבדיקת חיבורים פעילים כל כמה זמן
// זה יכול לעזור לאתר חיבורים שהתנתקו

// פונקציה לבדיקת כל החיבורים
async function checkAllConnections() {
  console.log('Checking all WhatsApp connections...');
  
  for (const userId in whatsappClients) {
    const client = whatsappClients[userId];
    if (client) {
      try {
        const state = await client.getState().catch(e => null);
        console.log(`User ${userId} connection state:`, state);
        
        if (state !== 'CONNECTED') {
          clientsReady[userId] = false;
          
          // נסיון לחבר מחדש אם הסטטוס לא תקין
          if (state === undefined || state === null) {
            console.log(`Attempting to reconnect for user ${userId}...`);
            try {
              // אם יש חיבור מקומי שמור, ננסה לחבר ללא קוד QR
              client.initialize().catch(err => {
                console.log(`Re-initialization error for user ${userId}:`, err.message);
              });
            } catch (error) {
              console.error(`Error reconnecting for user ${userId}:`, error.message);
            }
          }
        } else {
          clientsReady[userId] = true;
        }
      } catch (error) {
        console.error(`Error checking connection for user ${userId}:`, error.message);
        clientsReady[userId] = false;
      }
    }
  }
}

// הפעל בדיקה כל 5 דקות
setInterval(checkAllConnections, 5 * 60 * 1000);

// Endpoint to register a business WhatsApp phone number
app.post('/api/whatsapp/register-phone', async (req, res) => {
  try {
    const { userId, phoneNumber, phoneNumberId, facebookToken } = req.body;
    
    if (!userId || !phoneNumber || !phoneNumberId || !facebookToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID, phone number, phone number ID, and Facebook token are required' 
      });
    }
    
    // בדוק אם Firestore זמין
    if (!firestoreEnabled) {
      return res.json({ 
        success: true, 
        message: 'Running in NO-DATABASE mode, phone number registered in memory only' 
      });
    }
    
    // שמור את נתוני הטלפון ב-Firestore
    await setDoc(doc(collection(db, 'phone_configs'), phoneNumberId), {
      userId,
      phoneNumber,
      phoneNumberId,
      facebookToken,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    return res.json({ 
      success: true, 
      message: 'WhatsApp phone number registered successfully' 
    });
  } catch (error) {
    console.error('Error registering WhatsApp phone number:', error);
    firestoreEnabled = false; // כבה Firestore בגלל שגיאה
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to get all registered phone numbers for a user
app.get('/api/whatsapp/phones/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    // אם Firestore מושבת, החזר רשימה ריקה
    if (!firestoreEnabled) {
      return res.json({ success: true, phones: [] });
    }
    
    const phonesSnapshot = await getDocs(query(collection(db, 'phone_configs'), where('userId', '==', userId)));
    
    const phones = [];
    phonesSnapshot.forEach(doc => {
      phones.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return res.json({ success: true, phones });
  } catch (error) {
    console.error('Error getting WhatsApp phone numbers:', error);
    firestoreEnabled = false; // כבה Firestore בגלל שגיאה
    return res.status(500).json({ success: false, error: error.message });
  }
});

// להוסיף לפני ה-app.listen בסוף הקובץ
app.get('/api/whatsapp/message-test/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { phone, message } = req.query;
    
    if (!userId || !phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing parameters: userId, phone, and message are required'
      });
    }
    
    // בדוק אם הקליינט מוכן
    if (!whatsappClients[userId] || !clientsReady[userId]) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp client not ready',
        ready: !!clientsReady[userId],
        clientExists: !!whatsappClients[userId]
      });
    }
    
    // בדוק אם יש חיבור פעיל
    const state = await whatsappClients[userId].getState().catch(e => 'ERROR: ' + e.message);
    
    // סימולציה של קבלת הודעה
    console.log(`⚡ SIMULATING RECEIVED MESSAGE from ${phone} to user ${userId}: ${message}`);
    
    // קריאה ישירה לפונקציית עיבוד ההודעה (יש ליצור את זו אם עוד לא קיימת)
    const mockMessage = {
      from: phone.includes('@c.us') ? phone : `${phone}@c.us`,
      body: message,
      fromMe: false
    };
    
    // עבד את ההודעה באופן ידני
    await processIncomingMessage(mockMessage, userId);
    
    return res.json({
      success: true,
      state,
      mockMessage,
      message: 'Test message processed'
    });
  } catch (error) {
    console.error('Error in message test:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// פונקציה עצמאית לעיבוד הודעות - הוסף את זה
async function processIncomingMessage(message, userId) {
  console.log(`[PROCESS] Starting message processing for ${userId} from ${message.from}`);
  console.log(`[PROCESS] Message body: "${message.body}"`);
  
  try {
    // שלב 1: טעינת פרטי המשתמש
    console.log(`[PROCESS] Step 1: Loading user config for ${userId}`);
    const userDoc = await loadUserConfig(userId);
    if (!userDoc.success) {
      console.error(`[PROCESS] Failed to load user config: ${userDoc.error}`);
      return { success: false, error: userDoc.error };
    }
    
    const agentConfig = userDoc.data;
    console.log(`[PROCESS] User config loaded successfully. Business info length: ${agentConfig.businessInfo.length} chars`);
    
    // שלב 2: שמירת ההודעה בשיחה
    console.log(`[PROCESS] Step 2: Saving message to conversation`);
    const saveResult = await saveMessageToConversation(userId, message.from, message.body);
    if (!saveResult.success) {
      console.error(`[PROCESS] Failed to save message: ${saveResult.error}`);
      // המשך בכל זאת ליצירת תשובה
    } else {
      console.log(`[PROCESS] Message saved successfully to conversation`);
    }
    
    // שלב 3: יצירת תשובת AI
    console.log(`[PROCESS] Step 3: Generating AI response`);
    const aiResponse = await generateAIResponse(userId, message.from, message.body, agentConfig.businessInfo);
    if (!aiResponse.success) {
      console.error(`[PROCESS] Failed to generate AI response: ${aiResponse.error}`);
      return { success: false, error: aiResponse.error };
    }
    
    console.log(`[PROCESS] AI response generated successfully, length: ${aiResponse.text.length} chars`);
    console.log(`[PROCESS] AI response preview: "${aiResponse.text.substring(0, 50)}..."`);
    
    // שלב 4: שמירת תשובת ה-AI בשיחה
    console.log(`[PROCESS] Step 4: Saving AI response to conversation`);
    if (saveResult.success) {
      const saveAIResult = await saveAIResponseToConversation(userId, message.from, aiResponse.text);
      if (!saveAIResult.success) {
        console.error(`[PROCESS] Failed to save AI response: ${saveAIResult.error}`);
        // המשך בכל זאת
      } else {
        console.log(`[PROCESS] AI response saved successfully to conversation`);
      }
    }
    
    // שלב 5: שליחת תשובת AI ללקוח
    console.log(`[PROCESS] Step 5: Sending AI response to customer`);
    if (whatsappClients[userId] && clientsReady[userId]) {
      console.log(`[PROCESS] WhatsApp client is ready for user ${userId}, sending message to ${message.from}`);
      await whatsappClients[userId].sendMessage(message.from, aiResponse.text);
      console.log(`[PROCESS] ✅ AI response sent successfully to ${message.from}`);
    } else {
      console.error(`[PROCESS] ❌ Cannot send message - WhatsApp client not ready for user ${userId}`);
      console.log(`[PROCESS] Client exists: ${!!whatsappClients[userId]}, Client ready: ${!!clientsReady[userId]}`);
    }
    
    console.log(`[PROCESS] Message processing completed successfully for ${userId} from ${message.from}`);
    return { success: true };
  } catch (error) {
    console.error(`[PROCESS] ❌ ERROR processing message for user ${userId}:`, error);
    console.error(`[PROCESS] Error stack:`, error.stack);
    
    if (error.response) {
      console.error('[PROCESS] Error response status:', error.response.status);
      console.error('[PROCESS] Error response data:', JSON.stringify(error.response.data));
    }
    
    // נסה לשלוח הודעת שגיאה ללקוח
    try {
      if (whatsappClients[userId] && clientsReady[userId]) {
        console.log(`[PROCESS] Attempting to send error message to customer ${message.from}`);
        await whatsappClients[userId].sendMessage(message.from, 
          "מצטערים, אירעה שגיאה בעיבוד ההודעה שלך. צוות התמיכה שלנו יבדוק את הבעיה בהקדם.");
        console.log(`[PROCESS] Error message sent to customer`);
      }
    } catch (sendError) {
      console.error(`[PROCESS] Failed to send error message:`, sendError);
    }
    
    return { success: false, error: error.message };
  }
}

// פונקציה לטעינת פרטי המשתמש
async function loadUserConfig(userId) {
  try {
    // אם Firestore מושבת, החזר נתונים פיקטיביים
    if (!firestoreEnabled) {
      console.log(`Using fallback user config for ${userId} (NO-DATABASE mode)`);
      return { 
        success: true, 
        data: {
          businessInfo: "This is a customer service agent for a business. The agent will try to assist customers with their inquiries in a helpful, clear and concise manner."
        }
      };
    }
    
    // בדוק אם יש מידע בזיכרון המטמון (cache)
    if (userConfigCache && userConfigCache[userId] && 
        userConfigCache[userId].timestamp > Date.now() - 5 * 60 * 1000) {
      return { success: true, data: userConfigCache[userId].data };
    }
    
    try {
      const userDocRef = doc(collection(db, 'agents'), userId);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        console.warn(`No agent found for user ${userId}, using default config`);
        return {
          success: true,
          data: { 
            businessInfo: "This is a customer service agent that will try to help answer customer inquiries in a clear and helpful manner."
          }
        };
      }
      
      const agentConfig = userDocSnap.data();
      
      if (!agentConfig.businessInfo) {
        console.warn(`Agent has no business info configured for user ${userId}, using default`);
        agentConfig.businessInfo = "This is a customer service agent that will try to help answer customer inquiries.";
      }
      
      // שמור במטמון
      if (!userConfigCache) userConfigCache = {};
      userConfigCache[userId] = {
        data: agentConfig,
        timestamp: Date.now()
      };
      
      return { success: true, data: agentConfig };
    } catch (dbError) {
      console.error(`Database error loading user config for ${userId}:`, dbError);
      firestoreEnabled = false; // Disable Firestore for future calls
      return {
        success: true,
        data: { 
          businessInfo: "This is a customer service agent. The agent will try to help customers."
        }
      };
    }
  } catch (error) {
    console.error(`Error loading user config for ${userId}:`, error);
    return { 
      success: true, 
      data: { 
        businessInfo: "This is a customer service agent."
      }
    };
  }
}

// פונקציה לשמירת הודעה בשיחה - מעודכנת לפיירבייס החדש
async function saveMessageToConversation(userId, from, text) {
  // אם Firestore מושבת, החזר הצלחה מדומה
  if (!firestoreEnabled) {
    console.log(`[NO-DATABASE] Would save message from ${from} for user ${userId}: ${text}`);
    return { success: true };
  }
  
  try {
    const conversationId = `${userId}_${from}`;
    const conversationRef = doc(collection(db, 'conversations'), conversationId);
    
    console.log(`Saving message to conversation ${conversationId}`);
    
    const customerMessage = {
      text: text,
      sender: 'customer',
      timestamp: new Date()
    };
    
    const conversationSnapshot = await getDoc(conversationRef);
    
    if (conversationSnapshot.exists()) {
      // עדכון שיחה קיימת
      const conversation = conversationSnapshot.data();
      const updatedMessages = [...(conversation.messages || []), customerMessage];
      
      await updateDoc(conversationRef, {
        messages: updatedMessages,
        updatedAt: new Date()
      });
    } else {
      // יצירת שיחה חדשה
      await setDoc(conversationRef, {
        userId,
        customerPhone: from,
        messages: [customerMessage],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error saving message to conversation:`, error);
    firestoreEnabled = false; // כבה Firestore בגלל שגיאה
    console.warn('Disabling Firestore operations due to error');
    return { success: false, error: error.message };
  }
}

// פונקציה ליצירת תשובת AI
async function generateAIResponse(userId, from, customerMessage, businessInfo) {
  try {
    // נסה לקבל היסטוריית שיחה אם אפשר
    let historyMessages = [];
    
    // נסה לקבל היסטוריה רק אם Firestore מופעל
    if (firestoreEnabled) {
      try {
        const conversationId = `${userId}_${from}`;
        const conversationRef = doc(collection(db, 'conversations'), conversationId);
        const conversationSnapshot = await getDoc(conversationRef);
        
        if (conversationSnapshot.exists) {
          const conversationHistory = conversationSnapshot.data().messages || [];
          historyMessages = conversationHistory
            .slice(-10) // קח רק 10 הודעות אחרונות להקשר
            .map(msg => ({
              role: msg.sender === 'customer' ? 'user' : 'assistant',
              content: msg.text
            }));
        }
      } catch (historyError) {
        console.error(`Error fetching conversation history:`, historyError);
        firestoreEnabled = false; // כבה Firestore בגלל שגיאה
        // המשך עם היסטוריה ריקה
        historyMessages = [];
      }
    }
    
    // אם אין היסטוריה או שיש שגיאה, צור הודעה בודדת
    if (historyMessages.length === 0) {
      historyMessages = [{ role: 'user', content: customerMessage }];
    }
    
    console.log(`Sending request to OpenAI for user ${userId}`);
    
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a customer service agent for the following business. 
            Please help the customer with their inquiry:
            ${businessInfo}`
          },
          ...historyMessages
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY || process.env.REACT_APP_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`OpenAI response status: ${openaiResponse.status}`);
    
    const aiResponseText = openaiResponse.data.choices[0].message.content;
    console.log(`AI response for user ${userId}: ${aiResponseText}`);
    
    return { success: true, text: aiResponseText };
  } catch (error) {
    console.error(`Error generating AI response:`, error);
    return { success: false, error: error.message, text: "מצטערים, לא הצלחנו לעבד את הבקשה שלך כרגע. אנא נסה שוב מאוחר יותר." };
  }
}

// פונקציה לשמירת תשובת ה-AI בשיחה - מעודכנת לפיירבייס החדש
async function saveAIResponseToConversation(userId, from, aiResponseText) {
  // אם Firestore מושבת, החזר הצלחה מדומה
  if (!firestoreEnabled) {
    console.log(`[NO-DATABASE] Would save AI response to ${from} for user ${userId}: ${aiResponseText.substring(0, 30)}...`);
    return { success: true };
  }
  
  try {
    const conversationId = `${userId}_${from}`;
    const conversationRef = doc(collection(db, 'conversations'), conversationId);
    
    const aiMessage = {
      text: aiResponseText,
      sender: 'agent',
      timestamp: new Date()
    };
    
    const currentConversation = await getDoc(conversationRef);
    
    if (!currentConversation.exists()) {
      console.error(`Cannot save AI response - conversation doesn't exist`);
      return { success: false, error: "Conversation not found" };
    }
    
    const currentMessages = currentConversation.data().messages || [];
    
    await updateDoc(conversationRef, {
      messages: [...currentMessages, aiMessage],
      updatedAt: new Date()
    });
    
    return { success: true };
  } catch (error) {
    console.error(`Error saving AI response:`, error);
    firestoreEnabled = false; // כבה Firestore בגלל שגיאה
    console.warn('Disabling Firestore operations due to error');
    return { success: false, error: error.message };
  }
}

// הוסף פונקציית polling לבדיקת הודעות חדשות במקרה שהאירועים לא נקלטים
async function startMessagePolling(userId) {
  if (!whatsappClients[userId] || !clientsReady[userId]) {
    console.log(`Cannot start polling for user ${userId} - client not ready`);
    return;
  }
  
  console.log(`Starting message polling for user ${userId}`);
  
  // שמור את הזמן הנוכחי כנקודת התחלה
  if (!lastMessageTime[userId]) {
    lastMessageTime[userId] = new Date();
  }
  
  // המתן 30 שניות לפני התחלת ה-polling כדי לתת זמן לאירועים הרגילים להיתפס
  await new Promise(resolve => setTimeout(resolve, 30000));
  console.log(`Polling activated for user ${userId} after delay`);
  
  // התחל polling כל 30 שניות (מרווח גדול יותר מקטין את הסיכוי לכפילויות)
  const pollingInterval = setInterval(async () => {
    try {
      if (!whatsappClients[userId] || !clientsReady[userId]) {
        console.log(`Stopping polling for user ${userId} - client not ready`);
        clearInterval(pollingInterval);
        return;
      }
      
      console.log(`[POLLING] Running message check for user ${userId}`);
      
      const chats = await whatsappClients[userId].getChats();
      console.log(`[POLLING] Found ${chats.length} chats`);
      
      // עבור על כל הצ'אטים ובדוק אם יש הודעות חדשות
      let checkedMessages = 0;
      let newMessagesFound = 0;
      
      for (const chat of chats) {
        if (chat.isGroup) continue; // דלג על קבוצות
        
        try {
          // קבל את ההודעות האחרונות
          const messages = await chat.fetchMessages({ limit: 5 });
          checkedMessages += messages.length;
          
          for (const msg of messages) {
            // בדוק רק הודעות שהתקבלו אחרי הזמן האחרון שבדקנו והן לא מאיתנו
            if (msg.timestamp * 1000 > lastMessageTime[userId].getTime() && !msg.fromMe && msg.body) {
              const key = `${msg.id._serialized}_${userId}`;
              
              // בדוק אם זו הודעה חדשה (שלא טופלה כבר)
              if (!processedMessages.has(key)) {
                console.log(`[POLLING] Found new message: ${msg.body}`);
                newMessagesFound++;
                
                // סמן את ההודעה כמטופלת לפני העיבוד
                processedMessages.add(key);
                
                // עבד את ההודעה כאילו התקבלה מאירוע
                console.log(`[POLLING] Processing message: ${msg.body}`);
                await processIncomingMessage(msg, userId);
              } else {
                console.log(`[POLLING] Message ${key} already processed, skipping`);
              }
            }
          }
        } catch (chatError) {
          console.error(`Error fetching messages for chat ${chat.id._serialized}:`, chatError);
        }
      }
      
      console.log(`[POLLING] Checked ${checkedMessages} messages, found ${newMessagesFound} new messages`);
      
      // עדכן את הזמן האחרון
      lastMessageTime[userId] = new Date();
      
    } catch (error) {
      console.error(`Error during message polling for user ${userId}:`, error);
    }
  }, 30000); // בדוק כל 30 שניות
  
  // שמור את ה-interval כדי שנוכל לעצור אותו אם צריך
  if (!pollingIntervals) pollingIntervals = {};
  pollingIntervals[userId] = pollingInterval;
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// בדיקה ידנית של הודעות עבור משתמש
app.get('/api/whatsapp/check-messages/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    if (!whatsappClients[userId] || !clientsReady[userId]) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp client not ready',
        clientExists: !!whatsappClients[userId],
        ready: !!clientsReady[userId]
      });
    }
    
    console.log(`Manual check for new messages for user ${userId}`);
    
    // בצע בדיקה ידנית של הודעות
    const chats = await whatsappClients[userId].getChats();
    const recentMessages = [];
    
    // עבור על 5 הצ'אטים האחרונים
    for (const chat of chats.slice(0, 5)) {
      try {
        const messages = await chat.fetchMessages({ limit: 3 });
        
        for (const msg of messages) {
          recentMessages.push({
            from: msg.from,
            to: msg.to,
            body: msg.body,
            timestamp: new Date(msg.timestamp * 1000),
            fromMe: msg.fromMe,
            id: msg.id._serialized
          });
        }
      } catch (error) {
        console.error(`Error fetching messages from chat:`, error);
      }
    }
    
    return res.json({
      success: true,
      chatsCount: chats.length,
      recentMessages,
      lastCheckTime: lastMessageTime[userId]
    });
  } catch (error) {
    console.error('Error checking messages:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// שליחת הודעה ידנית (שימושי לבדיקות)
app.post('/api/whatsapp/send-manual', async (req, res) => {
  try {
    const { userId, to, message } = req.body;
    
    if (!userId || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: userId, to, message'
      });
    }
    
    if (!whatsappClients[userId] || !clientsReady[userId]) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp client not ready',
        clientExists: !!whatsappClients[userId],
        ready: !!clientsReady[userId]
      });
    }
    
    // פורמט מספר הטלפון
    let formattedNumber = to;
    if (!formattedNumber.includes('@c.us')) {
      // נקה את המספר
      let cleanNumber = to.replace(/\D/g, '');
      
      // הסר את הספרה 0 מההתחלה אם קיימת
      if (cleanNumber.startsWith('0')) {
        cleanNumber = cleanNumber.substring(1);
      }
      
      // וודא שיש קידומת מדינה (ברירת מחדל 972 לישראל)
      if (!cleanNumber.startsWith('972')) {
        cleanNumber = '972' + cleanNumber;
      }
      
      formattedNumber = `${cleanNumber}@c.us`;
    }
    
    console.log(`Sending manual message to ${formattedNumber} from user ${userId}`);
    
    // שלח את ההודעה
    const result = await whatsappClients[userId].sendMessage(formattedNumber, message);
    
    return res.json({
      success: true,
      result: {
        to: formattedNumber,
        messageId: result.id._serialized,
        timestamp: result.timestamp
      }
    });
  } catch (error) {
    console.error('Error sending manual message:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// אנדפוינט לבדיקת חיבור WhatsApp
app.get('/api/whatsapp/debug-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    if (!whatsappClients[userId]) {
      return res.json({
        success: false,
        error: 'No WhatsApp client for this user',
        status: 'no-client'
      });
    }
    
    const clientInfo = {
      ready: !!clientsReady[userId],
      hasQR: !!qrCodeData[userId],
      events: Object.keys(whatsappClients[userId]._events),
      eventsCount: Object.keys(whatsappClients[userId]._events).length
    };
    
    // נסה לקבל מידע נוסף אם הלקוח מחובר
    if (clientsReady[userId]) {
      try {
        const state = await whatsappClients[userId].getState();
        clientInfo.state = state;
        
        const info = await whatsappClients[userId].getWwebVersion();
        clientInfo.webVersion = info;
        
        const battery = await whatsappClients[userId].getBatteryStatus();
        clientInfo.battery = battery;
        
        const chats = await whatsappClients[userId].getChats();
        clientInfo.chatsCount = chats.length;
      } catch (infoError) {
        clientInfo.error = infoError.message;
      }
    }
    
    return res.json({
      success: true,
      clientInfo,
      pollingActive: !!pollingIntervals[userId]
    });
  } catch (error) {
    console.error('Error checking WhatsApp status:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}); 