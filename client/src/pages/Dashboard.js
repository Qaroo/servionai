import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsApp } from '../contexts/WhatsAppContext';
import { useAI } from '../contexts/AIContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  PhoneIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/solid';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { connectionStatus, conversations, checkConnectionStatus, disconnectWhatsApp } = useWhatsApp();
  const { trainingState, businessInfo, loadBusinessInfo } = useAI();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalConversations: 0,
    todayConversations: 0,
    totalMessages: 0,
    weekMessages: 0
  });
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState({ checking: true, available: false });

  // רענון סטטוס החיבור והאימון
  const refreshStatus = async () => {
    try {
      setRefreshing(true);
      await checkConnectionStatus();
      await loadBusinessInfo();
    } catch (error) {
      console.error('Error refreshing status', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await refreshStatus();
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    // בדיקת זמינות השרת כשהדף נטען
    const checkServerAvailability = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/whatsapp/ping`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.debug('Server ping successful:', data);
          setServerStatus({ checking: false, available: true, data });
        } else {
          console.warn('Server ping failed with status:', response.status);
          setServerStatus({ checking: false, available: false, status: response.status });
        }
      } catch (error) {
        console.error('Server ping error:', error);
        setServerStatus({ checking: false, available: false, error: error.message });
      }
    };

    checkServerAvailability();
  }, []);

  // אם בטעינה, הצג ספינר
  if (loading) {
    return <LoadingSpinner message="טוען נתונים..." />;
  }

  // חישוב הסטטוס הכללי של המערכת
  const whatsappConnected = connectionStatus === 'connected';
  const agentTrained = trainingState === 'trained';
  const systemReady = whatsappConnected && agentTrained;
  
  // חישוב מספר השיחות
  const conversationsCount = conversations ? conversations.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">דשבורד</h1>
        <button 
          onClick={refreshStatus} 
          className="flex items-center px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          disabled={refreshing}
        >
          <ArrowPathIcon className={`h-4 w-4 ml-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          רענן נתונים
        </button>
      </div>

      {/* סטטוס שרת */}
      {serverStatus.checking ? (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg mb-6 text-right animate-pulse">
          <p>בודק זמינות שרת...</p>
        </div>
      ) : serverStatus.available ? (
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg mb-6 text-right">
          <p>
            <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
            <span className="font-medium">השרת פעיל ומגיב</span>
            {serverStatus.data?.timestamp && (
              <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                (נבדק בשעה {new Date(serverStatus.data.timestamp).toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg mb-6 text-right">
          <p>
            <span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-2"></span>
            <span className="font-medium">השרת אינו זמין כרגע</span>
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
              {serverStatus.error ? `(${serverStatus.error})` : ''}
            </span>
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
          >
            בדוק שוב
          </button>
        </div>
      )}

      {/* כרטיס ברוכים הבאים */}
      <div className="bg-gradient-to-l from-primary-600 to-primary-800 text-white rounded-lg p-6">
        <h2 className="text-xl font-bold mb-2">שלום, {currentUser.displayName || 'משתמש יקר'}</h2>
        <p className="text-primary-100">
          ברוכים הבאים למערכת ServionAI לניהול WhatsApp באמצעות סוכן AI.
          {systemReady 
            ? ' המערכת שלך מוכנה לשימוש ופעילה!' 
            : ' השלם את ההגדרות להפעלת המערכת.'}
        </p>
      </div>

      {/* כרטיסי סטטוס */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* סטטוס חיבור WhatsApp */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">חיבור WhatsApp</h3>
                <div className="flex items-center">
                  {whatsappConnected ? (
                    <>
                      <CheckCircleIcon className="h-5 w-5 text-green-500 ml-1.5" />
                      <span className="text-sm text-green-600 dark:text-green-400">מחובר</span>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="h-5 w-5 text-red-500 ml-1.5" />
                      <span className="text-sm text-red-600 dark:text-red-400">לא מחובר</span>
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-full p-2 bg-primary-100 dark:bg-primary-900">
                <PhoneIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {whatsappConnected 
                ? 'WhatsApp מחובר ומוכן לקבל הודעות.' 
                : 'חבר את חשבון ה-WhatsApp שלך למערכת כדי לקבל ולשלוח הודעות.'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-5 py-3">
            <Link
              to="/whatsapp"
              className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-800 dark:hover:text-primary-300 flex items-center"
            >
              {whatsappConnected ? 'נהל חיבור' : 'התחבר עכשיו'}
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
            </Link>
          </div>
        </div>

        {/* סטטוס אימון הסוכן */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">סוכן AI</h3>
                <div className="flex items-center">
                  {agentTrained ? (
                    <>
                      <CheckCircleIcon className="h-5 w-5 text-green-500 ml-1.5" />
                      <span className="text-sm text-green-600 dark:text-green-400">מאומן</span>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="h-5 w-5 text-red-500 ml-1.5" />
                      <span className="text-sm text-red-600 dark:text-red-400">לא מאומן</span>
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-full p-2 bg-primary-100 dark:bg-primary-900">
                <AcademicCapIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {agentTrained 
                ? `הסוכן מאומן ומוכן לענות ללקוחות של ${businessInfo?.name || 'העסק שלך'}.` 
                : 'אמן את הסוכן שלך כדי שיוכל לענות ללקוחות בצורה אוטומטית.'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-5 py-3">
            <Link
              to="/train"
              className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-800 dark:hover:text-primary-300 flex items-center"
            >
              {agentTrained ? 'עדכן אימון' : 'אמן עכשיו'}
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
            </Link>
          </div>
        </div>

        {/* סטטוס שיחות */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">שיחות פעילות</h3>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">{conversationsCount}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400 mr-1.5">שיחות</span>
                </div>
              </div>
              <div className="rounded-full p-2 bg-primary-100 dark:bg-primary-900">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              {conversationsCount > 0 
                ? 'צפה בשיחות האחרונות ונהל את התגובות.' 
                : 'אין שיחות פעילות כרגע. שיחות חדשות יופיעו כאן.'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-5 py-3">
            <Link
              to="/conversations"
              className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-800 dark:hover:text-primary-300 flex items-center"
            >
              צפה בשיחות
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* מצב מערכת */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-5">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">מצב המערכת</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">חיבור WhatsApp</span>
            <span className={whatsappConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {whatsappConnected ? 'מחובר' : 'לא מחובר'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">אימון סוכן AI</span>
            <span className={agentTrained ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              {agentTrained ? 'מאומן' : 'לא מאומן'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">מצב מערכת</span>
            <span className={systemReady ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
              {systemReady ? 'פעילה' : 'דורשת הגדרה'}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
            <div 
              className="bg-primary-600 h-2.5 rounded-full" 
              style={{ width: `${(whatsappConnected && agentTrained) ? 100 : (whatsappConnected || agentTrained) ? 50 : 0}%` }}>
            </div>
          </div>
        </div>
      </div>

      {/* חוסר הגדרות */}
      {!systemReady && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="mr-3">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">נדרשת השלמת הגדרות</h3>
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-400">
                <p>
                  כדי שהמערכת תפעל באופן מלא, יש להשלים את ההגדרות הבאות:
                </p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {!whatsappConnected && (
                    <li>
                      <Link to="/whatsapp" className="underline hover:text-amber-900 dark:hover:text-amber-200">
                        חבר את WhatsApp למערכת
                      </Link>
                    </li>
                  )}
                  {!agentTrained && (
                    <li>
                      <Link to="/train" className="underline hover:text-amber-900 dark:hover:text-amber-200">
                        אמן את סוכן ה-AI שלך
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 