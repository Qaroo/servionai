// הגדרת משתנים גלובליים
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

// משתנים גלובליים לשמירת מידע על לקוחות WhatsApp
let whatsappClients = {}; // Object to store client instances by userId
let qrCodes = {}; // QR codes by userId
let clientStatus = {}; // Ready status by userId
let processedMessages = new Set(); // מונע עיבוד כפול של הודעות

// פונקציה לקבלת לקוח WhatsApp עבור משתמש ספציפי
function getClientForUser(userId) {
  return whatsappClients[userId] || null;
}

// פונקציה לבדיקה אם לקוח מוכן לשימוש
function isClientReady(userId) {
  return clientStatus[userId] === 'READY';
}

// פונקציה חדשה להתנתקות מ-WhatsApp
const logoutClient = async (req, res) => {
  try {
    const { userId, phoneId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    let clientKey = userId;
    
    // אם יש מזהה מספר ספציפי, נשתמש בו כחלק מהמפתח של הלקוח
    if (phoneId) {
      clientKey = `${userId}_${phoneId}`;
    }
    
    const client = whatsappClients[clientKey];
    
    if (!client) {
      return res.status(400).json({ 
        error: 'WhatsApp client not initialized for this user' 
      });
    }
    
    // ניתוק הלקוח
    try {
      await client.logout();
      await client.destroy();
    } catch (err) {
      console.warn(`Error during logout: ${err.message}`);
    }
    
    // ניקוי המשתנים
    delete whatsappClients[clientKey];
    delete qrCodes[clientKey];
    delete clientStatus[clientKey];
    
    return res.json({ 
      success: true, 
      message: 'Logged out from WhatsApp successfully' 
    });
    
  } catch (error) {
    console.error('Error in logoutClient:', error);
    return res.status(500).json({ error: 'Failed to logout from WhatsApp' });
  }
};

// יצירת ווב הוק שיוכל להתמודד עם מספרים מרובים
const handleWebhook = async (req, res) => {
  try {
    const { entry } = req.body;
    
    // בדיקה אם ההודעה הגיעה בפורמט הנכון
    if (!entry || !Array.isArray(entry) || entry.length === 0) {
      return res.status(400).json({ error: 'Invalid webhook data format' });
    }
    
    for (const item of entry) {
      if (item.changes && Array.isArray(item.changes)) {
        for (const change of item.changes) {
          if (change.value && change.value.messages && Array.isArray(change.value.messages)) {
            
            // מקבלים את מזהה המספר שאליו הגיעה ההודעה
            const phoneNumberId = change.value.metadata.phone_number_id;
            
            // מחפשים את מספר הטלפון בבסיס הנתונים
            const phoneQuery = await db.collection('phone_numbers')
              .where('phoneNumberId', '==', phoneNumberId)
              .limit(1)
              .get();
              
            if (phoneQuery.empty) {
              console.warn(`Received message for unknown phone number ID: ${phoneNumberId}`);
              continue;
            }
            
            const phoneDoc = phoneQuery.docs[0];
            const phoneData = phoneDoc.data();
            const userId = phoneData.userId;
            const phoneId = phoneDoc.id;
            
            // מעבר על ההודעות שהתקבלו
            for (const message of change.value.messages) {
              const fromNumber = message.from;
              const messageBody = message.text?.body || ''; // יכול להיות גם הודעת מדיה
              const currentTime = new Date().toISOString();
              
              // חיפוש שיחה קיימת או יצירת שיחה חדשה
              const conversationQuery = await db.collection('conversations')
                .where('userId', '==', userId)
                .where('customer.phone', '==', fromNumber)
                .limit(1)
                .get();
                
              let conversationId;
              let isNewConversation = false;
              
              if (conversationQuery.empty) {
                // יצירת שיחה חדשה
                isNewConversation = true;
                
                const conversationData = {
                  userId,
                  customer: {
                    name: 'לקוח חדש',
                    phone: fromNumber
                  },
                  whatsappPhone: {
                    id: phoneId,
                    phoneNumber: phoneData.phoneNumber
                  },
                  createdAt: currentTime,
                  lastMessage: messageBody,
                  lastMessageAt: currentTime,
                  unread: true,
                  status: 'active'
                };
                
                const newConversation = await db.collection('conversations').add(conversationData);
                conversationId = newConversation.id;
              } else {
                // עדכון שיחה קיימת
                const conversationDoc = conversationQuery.docs[0];
                conversationId = conversationDoc.id;
                
                await conversationDoc.ref.update({
                  lastMessage: messageBody,
                  lastMessageAt: currentTime,
                  unread: true,
                  status: 'active'
                });
              }
              
              // שמירת ההודעה
              await db.collection('messages').add({
                conversationId,
                userId,
                content: messageBody,
                timestamp: currentTime,
                sender: 'customer',
                isRead: false
              });
              
              console.log(`Webhook: Message from ${fromNumber} saved for user ${userId}`);
            }
          }
        }
      }
    }
    
    return res.status(200).send('OK');
    
  } catch (error) {
    console.error('Error in handleWebhook:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
};

// פונקציה חדשה לקבלת מצב ה-WhatsApp
const getStatus = async (req, res) => {
  try {
    // קריאה של userId מהפרמטרים בנתיב במקום מהגוף של הבקשה
    const userId = req.params.userId;
    // אם יש phoneId, נקרא אותו מהבקשה
    const { phoneId } = req.body || {};
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    let clientKey = userId;
    
    // אם יש מזהה מספר ספציפי, נשתמש בו כחלק מהמפתח של הלקוח
    if (phoneId) {
      clientKey = `${userId}_${phoneId}`;
    }
    
    const client = whatsappClients[clientKey];
    
    // אם אין לקוח, נחזיר סטטוס מתאים במקום שגיאה
    if (!client) {
      return res.json({
        status: 'NOT_INITIALIZED',
        ready: false,
        qrCode: null,
        clientKey
      });
    }
    
    // מעבר על ההודעות שהתקבלו
    client.on('qr', (qr) => {
      // המר את קוד ה-QR ל-base64 באופן מפורש
      const qrCodeBase64 = Buffer.from(qr).toString('base64');
      qrCodes[clientKey] = qrCodeBase64;
      clientStatus[clientKey] = 'WAITING_FOR_SCAN';
      console.log(`QR code generated for ${clientKey}`);
    });
    
    // מחזרת מצב ה-WhatsApp
    const status = clientStatus[clientKey] || 'NOT_INITIALIZED';
    const isReady = status === 'READY';
    
    return res.json({
      status,
      ready: isReady,
      qrCode: qrCodes[clientKey] || null,
      clientKey
    });
    
  } catch (error) {
    console.error('Error in getStatus:', error);
    return res.status(500).json({ error: 'Failed to get WhatsApp status' });
  }
};

// עדכון פונקציית האתחול
const initializeClient = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // אם יש כבר לקוח קיים, נאפס אותו
    if (whatsappClients[userId]) {
      console.log(`Resetting existing client for ${userId}`);
      try {
        await whatsappClients[userId].destroy();
      } catch (err) {
        console.warn(`Error destroying existing client: ${err.message}`);
      }
      delete whatsappClients[userId];
      delete qrCodes[userId];
      delete clientStatus[userId];
    }
    
    // יצירת לקוח WhatsApp חדש
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: userId }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
    
    // הגדרת אירועי הלקוח
    client.on('qr', (qr) => {
      qrCodes[userId] = qr;
      clientStatus[userId] = 'WAITING_FOR_SCAN';
      console.log(`QR code generated for ${userId}`);
    });
    
    client.on('ready', () => {
      clientStatus[userId] = 'READY';
      console.log(`WhatsApp client ready for ${userId}`);
    });
    
    client.on('authenticated', () => {
      clientStatus[userId] = 'AUTHENTICATED';
      console.log(`WhatsApp client authenticated for ${userId}`);
    });
    
    client.on('auth_failure', (msg) => {
      clientStatus[userId] = 'AUTH_FAILURE';
      console.error(`Authentication failure for ${userId}: ${msg}`);
    });
    
    client.on('disconnected', (reason) => {
      clientStatus[userId] = 'DISCONNECTED';
      console.log(`WhatsApp client disconnected for ${userId}: ${reason}`);
      
      // ניקוי הלקוח בעת התנתקות
      delete whatsappClients[userId];
      delete qrCodes[userId];
    });
    
    // טיפול בהודעות נכנסות
    client.on('message', async (message) => {
      try {
        // התעלמות מהודעות קבוצתיות
        if (message.isGroupMsg) return;
        
        const currentTime = new Date().toISOString();
        const fromNumber = message.from.split('@')[0];
        
        // שמירת ההודעה בפיירסטור
        const conversationQuery = await db.collection('conversations')
          .where('userId', '==', userId)
          .where('customer.phone', '==', fromNumber)
          .limit(1)
          .get();
          
        let conversationId;
        let isNewConversation = false;
        
        if (conversationQuery.empty) {
          // יצירת שיחה חדשה
          isNewConversation = true;
          const customerName = message.notifyName || 'לקוח חדש';
          
          const conversationData = {
            userId,
            customer: {
              name: customerName,
              phone: fromNumber
            },
            createdAt: currentTime,
            lastMessage: message.body,
            lastMessageAt: currentTime,
            unread: true,
            status: 'active'
          };
          
          const newConversation = await db.collection('conversations').add(conversationData);
          conversationId = newConversation.id;
        } else {
          // עדכון שיחה קיימת
          const conversationDoc = conversationQuery.docs[0];
          conversationId = conversationDoc.id;
          
          await conversationDoc.ref.update({
            lastMessage: message.body,
            lastMessageAt: currentTime,
            unread: true,
            status: 'active'
          });
        }
        
        // שמירת ההודעה
        await db.collection('messages').add({
          conversationId,
          userId,
          content: message.body,
          timestamp: currentTime,
          sender: 'customer',
          isRead: false,
          mediaUrl: message.hasMedia ? await message.downloadMedia() : null
        });
        
        console.log(`Message from ${fromNumber} saved for ${userId}`);
        
      } catch (error) {
        console.error(`Error processing message for ${userId}:`, error);
      }
    });
    
    // הפעלת הלקוח
    await client.initialize();
    
    // שמירת הלקוח
    whatsappClients[userId] = client;
    
    return res.json({ success: true, message: 'WhatsApp client initialized' });
    
  } catch (error) {
    console.error('Error in initializeClient:', error);
    return res.status(500).json({ error: 'Failed to initialize WhatsApp client' });
  }
};

// פונקציה לשליחת הודעת WhatsApp
const sendMessage = async (req, res) => {
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
};

module.exports = {
  initializeClient,
  getStatus,
  sendMessage,
  logoutClient,
  handleWebhook
}; 