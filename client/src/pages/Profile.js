import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  UserCircleIcon,
  KeyIcon,
  ArrowRightOnRectangleIcon,
  MoonIcon,
  SunIcon,
  InformationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { ThemeContext } from '../utils/ThemeContext';

const Profile = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userData, setUserData] = useState(null);
  const [stats, setStats] = useState({
    conversationsCount: 0,
    messagesCount: 0,
    aiResponsesCount: 0,
  });
  
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);
        if (!currentUser) return;
        
        // טעינת פרטי המשתמש
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          console.log('No user document found');
        }
        
        // טעינת סטטיסטיקות
        await loadStats();
      } catch (error) {
        console.error('Error loading user data:', error);
        setError('אירעה שגיאה בטעינת נתוני המשתמש. אנא נסה שוב מאוחר יותר.');
      } finally {
        setLoading(false);
      }
    };
    
    loadUserData();
  }, [currentUser]);
  
  // טעינת סטטיסטיקות
  const loadStats = async () => {
    try {
      if (!currentUser) return;
      
      // ספירת מספר השיחות
      const conversationsRef = collection(db, 'users', currentUser.uid, 'conversations');
      const conversationsSnapshot = await getDocs(conversationsRef);
      const conversationsCount = conversationsSnapshot.size;
      
      // חישוב סטטיסטיקות נוספות
      let totalMessages = 0;
      let aiResponses = 0;
      
      // עבור כל שיחה, ספור את מספר ההודעות וכמה מהן הן תשובות AI
      for (const convDoc of conversationsSnapshot.docs) {
        const messagesRef = collection(db, 'users', currentUser.uid, 'conversations', convDoc.id, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        
        totalMessages += messagesSnapshot.size;
        
        // ספירת תשובות AI
        for (const msgDoc of messagesSnapshot.docs) {
          const msgData = msgDoc.data();
          if (msgData.isAI) {
            aiResponses++;
          }
        }
      }
      
      setStats({
        conversationsCount,
        messagesCount: totalMessages,
        aiResponsesCount: aiResponses,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };
  
  // פונקציה לשמירת הגדרות
  const saveSettings = async (settings) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, { settings });
      
      setSuccess('ההגדרות נשמרו בהצלחה');
    } catch (error) {
      console.error('Error saving settings:', error);
      setError('אירעה שגיאה בשמירת ההגדרות. אנא נסה שוב.');
    } finally {
      setSaving(false);
    }
  };
  
  // התנתקות
  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setError('אירעה שגיאה בהתנתקות. אנא נסה שוב.');
      setLoading(false);
    }
  };
  
  if (loading) {
    return <LoadingSpinner message="טוען פרופיל..." />;
  }
  
  return (
    <ThemeContext.Consumer>
      {({ theme, toggleTheme }) => (
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">הפרופיל שלי</h1>
          
          {/* כרטיס פרופיל */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6 flex items-center">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <UserCircleIcon className="h-10 w-10 text-primary-600 dark:text-primary-400" />
                </div>
              )}
              <div className="mr-5">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {currentUser.displayName || 'משתמש'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentUser.email}
                </p>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    חשבון Google
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {currentUser.email}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    הצטרף בתאריך
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {userData && userData.createdAt ? new Date(userData.createdAt.toDate()).toLocaleDateString('he-IL') : 'לא ידוע'}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    סטטוס חשבון
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white flex items-center">
                    <span className="h-2 w-2 bg-green-500 rounded-full inline-block ml-1.5"></span>
                    פעיל
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    כניסה אחרונה
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {userData && userData.lastLogin ? new Date(userData.lastLogin.toDate()).toLocaleString('he-IL') : 'לא ידוע'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          
          {/* סטטיסטיקות */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                סטטיסטיקות
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                נתונים על הפעילות שלך במערכת
              </p>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-3">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    שיחות פעילות
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.conversationsCount}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    סה"כ הודעות
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.messagesCount}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    תגובות AI
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                    {stats.aiResponsesCount}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          
          {/* הגדרות */}
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                הגדרות
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                התאם את המערכת להעדפותיך
              </p>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <dl>
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    מצב תצוגה
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2 flex justify-between items-center">
                    <span>
                      {theme === 'light' ? 'מצב בהיר' : 'מצב כהה'}
                    </span>
                    <button
                      onClick={toggleTheme}
                      className="rounded-md p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      {theme === 'light' ? (
                        <MoonIcon className="h-5 w-5" />
                      ) : (
                        <SunIcon className="h-5 w-5" />
                      )}
                    </button>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          
          {/* כפתורי פעולות */}
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 sm:space-x-reverse mb-6">
            <button
              onClick={handleLogout}
              className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
            >
              <ArrowRightOnRectangleIcon className="ml-1.5 -mr-1 h-5 w-5 text-gray-500 dark:text-gray-400" />
              התנתק
            </button>
          </div>
          
          {/* הודעות שגיאה / הצלחה */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <InformationCircleIcon className="h-5 w-5 text-red-400 dark:text-red-500" />
                </div>
                <div className="mr-3">
                  <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-green-400 dark:text-green-500" />
                </div>
                <div className="mr-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">{success}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </ThemeContext.Consumer>
  );
};

export default Profile; 