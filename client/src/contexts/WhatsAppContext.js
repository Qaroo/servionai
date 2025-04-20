import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  collection, 
  query, 
  onSnapshot,
  orderBy,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import axios from 'axios';

// ה-URL של ה-API
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// יצירת קונטקסט ל-WhatsApp
const WhatsAppContext = createContext();

// הוק לשימוש בקונטקסט
export const useWhatsApp = () => useContext(WhatsAppContext);

// ספק הקונטקסט
export const WhatsAppProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [qrCode, setQrCode] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // connected, connecting, disconnected
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRequest, setLastRequest] = useState(0);
  const [cooldownPeriod, setCooldownPeriod] = useState(5000); // Default cooldown period
  // הוסף משתנה מצב חדש לשמירת זמן ה-cooldown הגלובלי
  const [globalCooldownUntil, setGlobalCooldownUntil] = useState(0);

  // פונקציה להוספת מזהה משתמש או טוקן לבקשה
  const getAuthConfig = () => {
    if (!currentUser) {
      // במצב פיתוח, החזר קונפיגורציה עם userId
      return {
        headers: { 
          'Content-Type': 'application/json'
        }
      };
    }
    
    // במצב ייצור - שליחת טוקן אימות
    return {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentUser.getIdToken ? currentUser.getIdToken() : ''}`
      }
    };
  };

  // פונקציה לבדיקת זמינות השרת
  const checkServerAvailability = async () => {
    console.debug('Checking server availability...');
    try {
      const response = await fetch(`${API_URL}/whatsapp/ping`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.debug('Server ping successful:', data);
        return { available: true, data };
      } else {
        console.debug('Server ping failed with status:', response.status);
        return { available: false, status: response.status };
      }
    } catch (error) {
      console.error('Server ping error:', error);
      return { available: false, error: error.message };
    }
  };

  // פונקציה לקבלת ברקוד QR לחיבור WhatsApp
  const getQrCode = async () => {
    // בדיקת צינון מקומי
    const now = Date.now();
    if (lastRequest && now - lastRequest < cooldownPeriod) {
      const remainingTime = Math.ceil((cooldownPeriod - (now - lastRequest)) / 1000);
      console.debug(`Local cooldown active. Please wait ${remainingTime} seconds before trying again.`);
      return { success: false, message: `נא להמתין ${remainingTime} שניות לפני הניסיון הבא.` };
    }

    // עדכון זמן הבקשה האחרונה
    setLastRequest(now);

    // עדכון זמן ה-cooldown הגלובלי
    const storedCooldown = parseInt(window.localStorage.getItem('whatsapp_cooldown') || '0');
    if (now < storedCooldown) {
      const waitTime = Math.ceil((storedCooldown - now) / 1000);
      console.log(`Global cooldown active, ${waitTime}s remaining before QR code request`);
      setError(`שרת עמוס, יש להמתין ${waitTime} שניות ונסות שוב`);
      throw new Error(`Global cooldown active, ${waitTime}s remaining`);
    }

    // בדיקת זמינות השרת לפני ניסיון להשיג QR קוד
    const serverStatus = await checkServerAvailability();
    if (!serverStatus.available) {
      console.debug('Server is not available:', serverStatus);
      
      // במצב פיתוח, נחזיר QR קוד לדוגמה אם השרת לא זמין
      if (process.env.NODE_ENV === 'development') {
        console.debug('Development mode: Returning mock QR code');
        // נדמה השהייה כדי לחקות זמן תגובה של שרת
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // יצירת קוד QR פשוט שקל לסרוק במצב פיתוח
        const mockQrCode = await generateSimpleMockQrCode();
        
        return {
          success: true,
          qrCode: mockQrCode,
          message: 'Mock QR Code for development',
        };
      }
      
      return { 
        success: false, 
        message: 'השרת אינו זמין כרגע, אנא נסה שוב מאוחר יותר.'
      };
    }

    console.debug('Getting QR code for user:', currentUser?.uid);
    try {
      setLoading(true);
      setError(null);
      
      // נגדיר מספר ניסיונות לקבלת קוד QR
      const maxRetries = 3;
      let retryCount = 0;
      let qrCodeResult = null;
      
      while (retryCount < maxRetries) {
        try {
          const response = await axios.get(`${API_URL}/whatsapp/qr/${currentUser?.uid || 'test-user'}`, getAuthConfig());
          console.log(`QR code response attempt ${retryCount + 1}:`, response.data);
          
          if (response.data && response.data.qrCode) {
            console.log(`Received QR code at ${new Date().toISOString()}`);
            setQrCode(response.data.qrCode);
            qrCodeResult = response.data.qrCode;
            break; // יציאה מהלולאה אם הצלחנו לקבל קוד QR
          } else if (response.data && response.data.status === 'connected') {
            console.log('WhatsApp is already connected, no QR code needed');
            setConnectionStatus('connected');
            setQrCode('');
            return { connected: true };
          } else {
            console.warn('No QR code in response', response.data);
            
            // אם השרת מדווח שהוא עדיין בתהליך אתחול, נחכה ונסה שוב
            if (response.data && response.data.status === 'initializing') {
              console.log('Server is initializing, retrying in 3 seconds...');
              await new Promise(resolve => setTimeout(resolve, 3000)); // המתנה של 3 שניות
              retryCount++;
              continue;
            }
          }
        } catch (retryError) {
          console.error(`Error during attempt ${retryCount + 1} to get QR code:`, retryError);
          
          // טיפול ב-429 (too many requests)
          if (retryError.response && retryError.response.status === 429) {
            const retryAfter = retryError.response.data?.retryAfter || 30;
            console.log(`Rate limited, waiting ${retryAfter} seconds before retry`);
            setCooldownPeriod(retryAfter * 1000);
            window.localStorage.setItem('whatsapp_cooldown_until', Date.now() + (retryAfter * 1000));
            setError(`שרת עמוס, אנא המתן ${retryAfter} שניות ונסה שוב`);
            break; // יציאה מהלולאה במקרה של הגבלת קצב
          }
        }
        
        retryCount++;
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // המתנה בין ניסיונות
        }
      }
      
      // אם סיימנו את כל הניסיונות ועדיין אין לנו קוד QR
      if (!qrCodeResult) {
        // אם אנחנו במצב פיתוח, ניצור קוד QR לדוגמה
        if (process.env.NODE_ENV === 'development') {
          console.log('Development mode: generating mock QR code after failed attempts');
          const mockQrCode = "iVBORw0KGgoAAAANSUhEUgAAAIQAAACECAYAAABBV7mTAAAAAklEQVR4AewaftIAAASTSURBVO3BQY4cSRLAQDLR//8yV0c/BZCoaunmgG8x8w+XdLikwyUdLulwSYdLOlzS4ZIOl3S4pMMlHS7pcEmHSzpc0uGSDpd0uKTDJR0u6XBJh0v68JIK/3qKmb91Ha5RyJoKqVGxCj+pUA2Jqli9ocJUYVN4Q4U0YVNhqlANyRsUlgprwnS4pMMlHS7p8OFlKvwkFXLCb6KeUFgqTBUmhU3htxT+JBWywiYx/aYKabikwyUdLunw4TepMCWsCtWQNIU1YVXYFB6oMCWkRSEpTAlPKHxThZQwKUwV3qRCqrBVmIZLOlzS4ZIOH75MhalCU5gSVoVVoSVUQ7KpsCo0hapQDcmqkCZUQ7IlbAqbQlNoCptCU9gUpsIm8ZMOl3S4pMMlHT78ZSo0hdWQrAp5QjUkaaGekDwhrVBPKFYV/mQVpsJ0uKTDJR0u6fDhZRX+SQlNoRqSNypsCk+o8KRCPaHwJ1HhVaRCStgUvulwSYdLOlzS4cPLVPhJCk2Feki2hG9SmBKqIWkJb6jwTRW2hGpI1oQp4QmFVWE6XNLhkg6XdLikwyUdPryswk+q8ITCqjApTApNYVN4UuGbkjcUNolV4YFkqrAp5OGSDpd0uKTDhy9TeKDCVGFTWBVWhalCVaiG5BUVNoVqSKrCqvBNCqlCVVgV6gm1KaQJb1KohmQaLulwSYdLOnz4ssQ3JVQTVoWq8ITCGwqrwpo8UfgmhWpINoUnFKphS6gKD1SYDpd0uKTDJR3+cAlPqLAqbAqrwprQFLaETeGBwqTwTRWmCk1hqjAprArbxDQU3nS4pMMlHS7p8OEXKUwV1oRJ4ZMUNoVVYVJ4UmFT2BS2hHpCURVqU3hAYVOoCt+k8A0J0+GSDpd0uKTDh5cpTAqbQlWoTaEqTApThaYwKawKq8KUMFWoCk9KniheQawKb1CohjcprIakDpd0uKTDJR0+vEzhCYVN4Rsp1KYwKdSmsClMCdWQNCFNoRqSqrAprAorQ7EqNIUHFCaFVWEaLulwSYdLOnz4wyV8k8KksA3Jk4qerAprwqqwKdQTalN4VcKq8ITCprAqVA3JdLikwyUdLunw4cMvUmiHZFWYEqYKacJU4VUK9YRiVWgK9YRaK9QT6gm1Kzyh0A7JdLikwyUdLunw4T8uoSrUp7AqNIV6wqZQT6hVoRqSNSGFbApbQn1CsVZ4UmFT2BSmwyUdLulwSYcPL6nwO1Woh2RTqIakKdQTalPYEqrCmvAtCvWEekJRFaaETSFNaBW2hOlwSYdLOlzS4ZIOl3S4pMMlHS7pcEmHSzpc0uGSDpd0uKTDJR0u6XBJh0s6XNLhkg6XdLikwyX9D6bbzCh50tReAAAAAElFTkSuQmCC";
          setQrCode(mockQrCode);
          return { qrCode: mockQrCode };
        }
        
        // אם לא קיבלנו קוד QR, החזר שגיאה אבל אל תשנה את הסטטוס הקודם
        setConnectionStatus('disconnected');
        throw new Error('Failed to get QR code after multiple attempts');
      }
      
      return { qrCode: qrCodeResult };
    } catch (error) {
      console.error('Error getting QR code:', error);
      
      // טיפול ב-429 (too many requests)
      if (error.response && error.response.status === 429) {
        // הגדלת זמן ההמתנה במקרה של ריבוי בקשות
        const retryAfter = error.response.data?.retryAfter || 30;
        setCooldownPeriod(15000); // 15 שניות
        
        const cooldownTime = Date.now() + (retryAfter * 1000);
        setGlobalCooldownUntil(cooldownTime);
        localStorage.setItem('whatsapp_cooldown', cooldownTime);
        setError(`שרת עמוס, אנא המתן ${retryAfter} שניות ונסה שוב`);
      } else {
        setError('אירעה שגיאה בקבלת קוד QR. אנא נסה שוב בעוד מספר שניות.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // פונקציה ליצירת קוד QR מוק פשוט וברור לסריקה במצב פיתוח
  const generateSimpleMockQrCode = async () => {
    // נשתמש בקוד קבוע קצר שפועל טוב
    return "data:image/png;base64,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";
  };

  return (
    <WhatsAppContext.Provider value={{ qrCode, connectionStatus, conversations, selectedChat, messages, error, loading, getQrCode, generateSimpleMockQrCode }}>
      {children}
    </WhatsAppContext.Provider>
  );
};

export default WhatsAppProvider;