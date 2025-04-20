import React, { useState, useEffect, useRef } from 'react';
import { useWhatsApp } from '../contexts/WhatsAppContext';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  QrCodeIcon,
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

// פונקציית עזר ליצירת debounce
const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  
  const debouncedCallback = (...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  };
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedCallback;
};

// פונקציה לקיצור קוד ה-QR אם הוא ארוך מדי
const shortenQrValue = (qrValue) => {
  // בדיקה אם זה קוד base64 של תמונה
  if (qrValue && typeof qrValue === 'string' && qrValue.startsWith('data:image')) {
    return qrValue; // אם זה תמונה, נחזיר את התמונה כמו שהיא
  }
  
  // אם קוד ה-QR ארוך מדי, נקצר אותו
  if (qrValue && typeof qrValue === 'string' && qrValue.length > 500) {
    console.log('QR code value is too long, shortening it');
    return 'https://servionai.com/whatsapp';
  }
  
  return qrValue;
};

const WhatsAppConnect = () => {
  const { qrCode, getQrCode, connectionStatus, checkConnectionStatus, disconnect, error: contextError, loading: contextLoading } = useWhatsApp();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localQrCode, setLocalQrCode] = useState('');
  const [lastRefresh, setLastRefresh] = useState(0);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // הגבלת זמן בין בדיקות סטטוס
  const MIN_REFRESH_INTERVAL = 3000; // 3 שניות
  const MAX_LOADING_TIME = 10000; // 10 שניות טעינה מקסימלית

  // יצירת גרסה מוגבלת של בדיקת הסטטוס
  const debouncedCheckStatus = useDebounce(async () => {
    try {
      const now = Date.now();
      if (now - lastRefresh < MIN_REFRESH_INTERVAL) {
        console.log('Status check throttled, skipping in component');
        return;
      }
      
      setIsRefreshing(true);
      setLastRefresh(now);
      await checkConnectionStatus();
    } catch (error) {
      console.error('Error refreshing status:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, 500); // 500ms דיליי בטיפול בלחיצות חוזרות

  // עדכון קוד QR מקומי כאשר יש קוד QR חדש מהקונטקסט
  useEffect(() => {
    if (qrCode) {
      setLocalQrCode(qrCode);
      setLoading(false); // אם יש קוד QR, בטוח שהטעינה הסתיימה
    }
  }, [qrCode]);

  // הצגת שגיאות מהקונטקסט בקומפוננט
  useEffect(() => {
    if (contextError) {
      setError(contextError);
    }
  }, [contextError]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        setLoading(true);
        
        // נבדוק את הסטטוס רק אם:
        // 1. אין לנו קוד QR מקומי
        // 2. עברו מספיק זמן מהבדיקה האחרונה
        const now = Date.now();
        if (!localQrCode && (now - lastRefresh > MIN_REFRESH_INTERVAL)) {
          setLastRefresh(now);
          await checkConnectionStatus();
        }
      } catch (error) {
        console.error('Error checking connection status:', error);
      } finally {
        // נגדיר טיימר שיסיים את הטעינה אחרי זמן מקסימלי
        setTimeout(() => {
          if (loading) {
            console.log('Max loading time reached, resetting loading state');
            setLoading(false);
          }
        }, MAX_LOADING_TIME);
      }
    };

    checkStatus();
    
    // ניקוי בעת יציאה מהקומפוננטה
    return () => {
      // איפוס מצב הטעינה בעת ניווט משמור שלא ישאר באמצע טעינה
      setLoading(false);
    };
  }, []);

  const handleGetQrCode = async () => {
    try {
      // מניעת כפילות בקשות
      if (isRefreshing || contextLoading) return;
      
      setIsRefreshing(true);
      setLocalQrCode(''); // נקה קוד QR מקומי לפני קבלת קוד חדש
      setError(''); // נקה שגיאות קודמות
      
      // הגדרת טיימר לאיפוס מצב הריענון אם הבקשה נתקעת
      const refreshTimeout = setTimeout(() => {
        if (isRefreshing) {
          console.log('QR code request timeout, resetting refresh state');
          setIsRefreshing(false);
        }
      }, 15000); // 15 שניות מקסימום
      
      try {
        await getQrCode();
        clearTimeout(refreshTimeout);
      } catch (error) {
        console.error('Error getting QR code:', error);
        clearTimeout(refreshTimeout);
        
        // אם השרת חזר עם 429, נציג הודעה ידידותית
        if (error.response && error.response.status === 429) {
          setError('שרת עמוס, אנא המתן מספר שניות ונסה שוב');
        } else {
          setError('אירעה שגיאה בקבלת קוד QR. אנא נסה שוב.');
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('האם אתה בטוח שברצונך להתנתק מ-WhatsApp? פעולה זו תסיר את כל החיבורים הקיימים.')) {
      try {
        // מניעת כפילות בקשות
        if (isRefreshing || contextLoading) return;
        
        setError(''); // נקה שגיאות קודמות
        setLoading(true);
        setLocalQrCode(''); // נקה קוד QR מקומי
        await disconnect();
      } catch (error) {
        console.error('Error disconnecting:', error);
        setError('אירעה שגיאה בניתוק החיבור. אנא נסה שוב.');
      } finally {
        setLoading(false);
      }
    }
  };

  const refreshStatus = async () => {
    // מניעת כפילות בקשות
    if (isRefreshing || contextLoading) return;
    
    debouncedCheckStatus();
  };

  if (loading && !localQrCode) {
    return <LoadingSpinner message="טוען נתונים..." />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white flex items-center">
              <PhoneIcon className="h-5 w-5 ml-2 text-primary-600" />
              חיבור WhatsApp
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              חבר את המספר העסקי שלך למערכת
            </p>
          </div>
          <div className="flex items-center">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
              connectionStatus === 'connected'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
            }`}>
              {connectionStatus === 'connected'
                ? 'מחובר'
                : connectionStatus === 'connecting'
                ? 'מתחבר...'
                : 'מנותק'}
            </span>
            <button
              onClick={refreshStatus}
              disabled={isRefreshing || contextLoading}
              className="mr-2 p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
              title="רענן סטטוס"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshing || contextLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-4 py-5 sm:p-6">
          {connectionStatus === 'connected' ? (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircleIcon
                  className="h-12 w-12 text-green-600 dark:text-green-300"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-3 text-lg font-medium text-gray-900 dark:text-gray-100">
                WhatsApp מחובר בהצלחה
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                החשבון שלך מחובר כעת למערכת וסוכן ה-AI יוכל להגיב להודעות נכנסות באופן אוטומטי.
              </p>
              <div className="mt-4">
                <button
                  onClick={handleDisconnect}
                  disabled={isRefreshing || contextLoading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                >
                  <XCircleIcon className="ml-2 -mr-1 h-5 w-5 text-red-500" aria-hidden="true" />
                  {isRefreshing || contextLoading ? 'מנתק...' : 'נתק חיבור'}
                </button>
              </div>
            </div>
          ) : connectionStatus === 'connecting' || localQrCode ? (
            <div className="text-center">
              <div className="flex flex-col items-center">
                <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">
                  סרוק את קוד ה-QR
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  פתח את WhatsApp בטלפון שלך, לחץ על שלוש הנקודות {'>'} התקנים מקושרים, ואז סרוק את הקוד
                </p>
                <div className="mt-6 mb-4 p-4 bg-white rounded-lg shadow-sm">
                  {localQrCode ? (
                    localQrCode.startsWith('data:image') ? (
                      <img 
                        src={localQrCode}
                        alt="QR Code"
                        className="mx-auto"
                        width={300}
                        height={300}
                      />
                    ) : (
                      <QRCodeSVG 
                        value={shortenQrValue(localQrCode)} 
                        size={300} 
                        level="H"
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                        includeMargin={true}
                      />
                    )
                  ) : (
                    <div className="h-48 w-48 flex items-center justify-center bg-gray-100">
                      <LoadingSpinner size="medium" message="טוען קוד QR..." />
                    </div>
                  )}
                </div>
                <div className="mt-2 flex space-x-4 space-x-reverse">
                  <button
                    onClick={handleGetQrCode}
                    disabled={isRefreshing || contextLoading}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                  >
                    <ArrowPathIcon
                      className={`ml-2 -mr-1 h-5 w-5 text-gray-500 ${isRefreshing || contextLoading ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    {isRefreshing || contextLoading ? 'טוען...' : 'רענן קוד QR'}
                  </button>
                </div>
                <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  <p>הקוד תקף ל-60 שניות בלבד. אם לא הצלחת לסרוק בזמן, לחץ על "רענן קוד QR"</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 dark:bg-red-900">
                <XCircleIcon className="h-12 w-12 text-red-600 dark:text-red-300" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-lg font-medium text-gray-900 dark:text-gray-100">
                WhatsApp לא מחובר
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                כדי להשתמש בשירות זה, עליך לחבר את WhatsApp שלך למערכת.
              </p>
              <div className="mt-4">
                <button
                  onClick={handleGetQrCode}
                  disabled={isRefreshing || contextLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
                >
                  <QrCodeIcon
                    className={`ml-2 -mr-1 h-5 w-5 ${isRefreshing || contextLoading ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  {isRefreshing || contextLoading ? 'טוען...' : 'חבר עכשיו'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <XCircleIcon
                    className="h-5 w-5 text-red-400 dark:text-red-500"
                    aria-hidden="true"
                  />
                </div>
                <div className="mr-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            הנחיות לחיבור WhatsApp
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            עקוב אחר השלבים הבאים כדי לחבר את המספר שלך למערכת
          </p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <dl>
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-8 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-200 ml-1">1</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-7">
                פתח את אפליקציית WhatsApp בטלפון שלך
              </dd>
            </div>
            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-8 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-200 ml-1">2</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-7">
                הקש על שלוש הנקודות בפינה הימנית העליונה (אנדרואיד) או הגדרות (אייפון)
              </dd>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-8 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-200 ml-1">3</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-7">
                הקש על "התקנים מקושרים" ואז "קישור מכשיר"
              </dd>
            </div>
            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-8 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-200 ml-1">4</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-7">
                סרוק את קוד ה-QR שמופיע על המסך באמצעות המצלמה של הטלפון
              </dd>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-8 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-900 dark:text-gray-200 ml-1">5</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200 sm:mt-0 sm:col-span-7">
                לאחר סריקה מוצלחת, המכשיר שלך יהיה מחובר למערכת והסוכן הווירטואלי יוכל לקבל ולשלוח הודעות
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnect;