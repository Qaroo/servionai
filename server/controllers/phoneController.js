const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

/**
 * קבלת כל מספרי הטלפון של משתמש
 */
const getUserPhones = async (req, res) => {
  try {
    const userId = req.params.userId;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'מזהה משתמש לא תקין' 
      });
    }

    const phonesRef = db.collection('phone_numbers');
    const snapshot = await phonesRef.where('userId', '==', userId).get();
    
    if (snapshot.empty) {
      return res.json({ 
        success: true, 
        phones: [] 
      });
    }
    
    const phones = [];
    snapshot.forEach(doc => {
      const phoneData = doc.data();
      phones.push({
        id: doc.id,
        phoneNumber: phoneData.phoneNumber,
        phoneNumberId: phoneData.phoneNumberId,
        facebookToken: phoneData.facebookToken
      });
    });
    
    return res.json({ 
      success: true, 
      phones 
    });
    
  } catch (error) {
    console.error('Error fetching user phones:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'אירעה שגיאה בטעינת מספרי הטלפון' 
    });
  }
};

/**
 * קבלת פרטי מספר טלפון ספציפי
 */
const getPhoneDetails = async (req, res) => {
  try {
    const phoneId = req.params.phoneId;
    const userId = req.query.userId;
    
    if (!phoneId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'מזהה מספר טלפון או מזהה משתמש לא תקינים' 
      });
    }
    
    // בדיקה שהמספר שייך למשתמש הנוכחי
    const phoneDoc = await db.collection('phone_numbers').doc(phoneId).get();
    
    if (!phoneDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'מספר הטלפון לא נמצא' 
      });
    }
    
    const phoneData = phoneDoc.data();
    
    if (phoneData.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'אין הרשאה לגשת למספר טלפון זה' 
      });
    }
    
    return res.json({ 
      success: true, 
      phone: {
        id: phoneDoc.id,
        phoneNumber: phoneData.phoneNumber,
        phoneNumberId: phoneData.phoneNumberId,
        facebookToken: phoneData.facebookToken
      } 
    });
    
  } catch (error) {
    console.error('Error fetching phone details:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'אירעה שגיאה בטעינת פרטי מספר הטלפון' 
    });
  }
};

/**
 * הוספת מספר טלפון חדש
 */
const registerPhone = async (req, res) => {
  try {
    const { userId, phoneNumber, phoneNumberId, facebookToken } = req.body;
    
    if (!userId || !phoneNumber || !phoneNumberId || !facebookToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'כל השדות הם חובה' 
      });
    }
    
    // בדיקה אם המספר כבר קיים למשתמש זה
    const existingPhones = await db.collection('phone_numbers')
      .where('userId', '==', userId)
      .where('phoneNumber', '==', phoneNumber)
      .get();
      
    if (!existingPhones.empty) {
      return res.status(400).json({ 
        success: false, 
        error: 'מספר טלפון זה כבר קיים במערכת' 
      });
    }
    
    // הוספת המספר החדש
    const newPhoneRef = await db.collection('phone_numbers').add({
      userId,
      phoneNumber,
      phoneNumberId,
      facebookToken,
      createdAt: new Date().toISOString()
    });
    
    return res.status(201).json({ 
      success: true, 
      phoneId: newPhoneRef.id,
      message: 'מספר הטלפון נוסף בהצלחה' 
    });
    
  } catch (error) {
    console.error('Error registering phone:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'אירעה שגיאה בהוספת מספר הטלפון' 
    });
  }
};

/**
 * עדכון פרטי מספר טלפון
 */
const updatePhone = async (req, res) => {
  try {
    const phoneId = req.params.phoneId;
    const { userId, phoneNumber, phoneNumberId, facebookToken } = req.body;
    
    if (!phoneId || !userId || !phoneNumber || !phoneNumberId || !facebookToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'כל השדות הם חובה' 
      });
    }
    
    // בדיקה שהמספר שייך למשתמש הנוכחי
    const phoneDoc = await db.collection('phone_numbers').doc(phoneId).get();
    
    if (!phoneDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'מספר הטלפון לא נמצא' 
      });
    }
    
    const phoneData = phoneDoc.data();
    
    if (phoneData.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'אין הרשאה לעדכן מספר טלפון זה' 
      });
    }
    
    // עדכון פרטי המספר
    await db.collection('phone_numbers').doc(phoneId).update({
      phoneNumber,
      phoneNumberId,
      facebookToken,
      updatedAt: new Date().toISOString()
    });
    
    return res.json({ 
      success: true, 
      message: 'מספר הטלפון עודכן בהצלחה' 
    });
    
  } catch (error) {
    console.error('Error updating phone:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'אירעה שגיאה בעדכון פרטי מספר הטלפון' 
    });
  }
};

/**
 * מחיקת מספר טלפון
 */
const deletePhone = async (req, res) => {
  try {
    const phoneId = req.params.phoneId;
    const { userId } = req.body;
    
    if (!phoneId || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'מזהה מספר טלפון ומזהה משתמש הם שדות חובה' 
      });
    }
    
    // בדיקה שהמספר שייך למשתמש הנוכחי
    const phoneDoc = await db.collection('phone_numbers').doc(phoneId).get();
    
    if (!phoneDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'מספר הטלפון לא נמצא' 
      });
    }
    
    const phoneData = phoneDoc.data();
    
    if (phoneData.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'אין הרשאה למחוק מספר טלפון זה' 
      });
    }
    
    // מחיקת המספר
    await db.collection('phone_numbers').doc(phoneId).delete();
    
    return res.json({ 
      success: true, 
      message: 'מספר הטלפון נמחק בהצלחה' 
    });
    
  } catch (error) {
    console.error('Error deleting phone:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'אירעה שגיאה במחיקת מספר הטלפון' 
    });
  }
};

module.exports = {
  getUserPhones,
  getPhoneDetails,
  registerPhone,
  updatePhone,
  deletePhone
}; 