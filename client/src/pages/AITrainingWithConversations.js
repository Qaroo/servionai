import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import axios from 'axios';
import { 
  BeakerIcon, 
  CheckCircleIcon, 
  ChatBubbleBottomCenterTextIcon, 
  ArrowPathIcon,
  FunnelIcon,
  CalendarIcon,
  CheckIcon,
  PhoneIcon,
  ArrowDownTrayIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const AITrainingWithConversations = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [previewConversation, setPreviewConversation] = useState(null);
  const [previewMessages, setPreviewMessages] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);
  
  // משתני סטטוס חדשים לייבוא
  const [importStatus, setImportStatus] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isActiveImport, setIsActiveImport] = useState(false);
  const [importStatusTimer, setImportStatusTimer] = useState(null);
  
  // פילטרים
  const [filterTime, setFilterTime] = useState('all'); // 'today', 'week', 'month', 'all'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest'
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // רפרנס לפונקציית loadConversations שנגדיר בהמשך
  const loadConversationsRef = useRef(null);
  
  // פונקציה להוספת מזהה משתמש או טוקן לבקשה
  const getAuthConfig = async () => {
    if (!currentUser) {
      return {
        headers: { 
          'Content-Type': 'application/json'
        }
      };
    }
    
    const token = await currentUser.getIdToken();
    return {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
  };

  // פונקציה לבדיקת סטטוס הייבוא
  const checkImportStatus = useCallback(async () => {
    try {
      if (!isActiveImport) return;
      
      const authConfig = await getAuthConfig();
      const response = await axios.get(`${API_URL}/whatsapp/import-status`, authConfig);
      
      if (response.data.success && response.data.importInfo) {
        const info = response.data.importInfo;
        setImportStatus(info);
        
        // חישוב התקדמות
        if (info.totalCount > 0) {
          const progress = Math.round((info.processedCount / info.totalCount) * 100);
          setImportProgress(progress);
        }
        
        // בדיקה אם הסתיים
        if (info.status === 'completed' || info.status === 'error' || info.status === 'cancelled') {
          setIsActiveImport(false);
          setImportLoading(false);
          
          // הצגת הודעה מתאימה
          if (info.status === 'completed') {
            setSuccessMessage(`יובאו ${info.processedCount || 0} שיחות בהצלחה מוואטסאפ`);
          } else if (info.status === 'cancelled') {
            setSuccessMessage(`תהליך הייבוא נעצר. יובאו ${info.processedCount || 0} שיחות מתוך ${info.totalCount}`);
          } else if (info.status === 'error') {
            setError(`שגיאה בייבוא: ${info.error || 'שגיאה לא ידועה'}`);
          }
          
          // טעינה מחדש של השיחות - כעת משתמש ברפרנס
          if (loadConversationsRef.current) {
            loadConversationsRef.current();
          }
          
          // ניקוי הטיימר
          if (importStatusTimer) {
            clearInterval(importStatusTimer);
            setImportStatusTimer(null);
          }
        }
      }
    } catch (error) {
      console.error('Error checking import status:', error);
    }
  }, [isActiveImport, importStatusTimer, getAuthConfig]);
  
  // בדיקת סטטוס תקופתית
  useEffect(() => {
    if (isActiveImport && !importStatusTimer) {
      // בדיקה ראשונית מיד
      checkImportStatus();
      
      // הגדרת בדיקות תקופתיות
      const timer = setInterval(checkImportStatus, 2000); // כל 2 שניות
      setImportStatusTimer(timer);
      
      return () => {
        clearInterval(timer);
      };
    }
    
    return () => {
      if (importStatusTimer) {
        clearInterval(importStatusTimer);
      }
    };
  }, [isActiveImport, importStatusTimer, checkImportStatus]);
  
  // פונקציה לביטול ייבוא פעיל
  const cancelImport = async () => {
    try {
      const authConfig = await getAuthConfig();
      const response = await axios.post(`${API_URL}/whatsapp/cancel-import`, {}, authConfig);
      
      if (response.data.success) {
        console.log('Import cancellation requested');
        // המשך בדיקת הסטטוס יעדכן את ה-UI
      } else {
        setError(response.data?.message || 'שגיאה בביטול הייבוא');
      }
    } catch (error) {
      console.error('Error cancelling import:', error);
      setError(error.response?.data?.message || 'שגיאה בביטול הייבוא');
    }
  };

  // פונקציה מעודכנת לייבוא שיחות מוואטסאפ
  const importConversationsFromWhatsApp = async () => {
    try {
      setImportLoading(true);
      setError('');
      setSuccessMessage('');
      setImportProgress(0);
      
      const authConfig = await getAuthConfig();
      
      // בדיקת זמן ה-cooldown במקום לשלוח בקשת סטטוס חדשה
      const cooldownUntil = parseInt(window.localStorage.getItem('whatsapp_cooldown') || '0');
      if (Date.now() < cooldownUntil) {
        const remainingTime = Math.ceil((cooldownUntil - Date.now()) / 1000);
        setError(`השרת עמוס, אנא המתן ${remainingTime} שניות ונסה שוב`);
        setImportLoading(false);
        return;
      }
      
      // קריאה ישירה ל-API לייבוא שיחות, עם פרמטר לשימוש בנתונים אמיתיים
      const response = await axios.post(`${API_URL}/whatsapp/import-conversations`, {
        useRealData: true,
        userId: currentUser.uid
      }, authConfig);
      
      // סימון כייבוא פעיל ותחילת בדיקת סטטוס
      setIsActiveImport(true);
      
      // אם התגובה מציינת שזהו מודל דמה, נציג את התוצאות מיד
      if (response.data && response.data.isMock === true) {
        setImportLoading(false);
        setIsActiveImport(false);
        setSuccessMessage(`יובאו ${response.data.conversationsCount || 0} שיחות לדוגמה בהצלחה (מצב פיתוח)`);
        
        // טעינה מחדש של השיחות
        loadConversations();
      }
    } catch (error) {
      console.error('Error importing conversations from WhatsApp:', error);
      setError(error.response?.data?.message || 'אירעה שגיאה בייבוא שיחות. נא לוודא שחשבון הוואטסאפ מחובר.');
      setImportLoading(false);
      setIsActiveImport(false);
    }
  };

  // פונקציה לפילטור שיחות
  const filterConversations = () => {
    let filtered = [...conversations];
    
    // פילטור לפי זמן
    if (filterTime !== 'all') {
      const now = new Date();
      let compareDate = new Date();
      
      switch (filterTime) {
        case 'today':
          compareDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          compareDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          compareDate.setMonth(now.getMonth() - 1);
          break;
        default:
          break;
      }
      
      filtered = filtered.filter(conv => {
        return conv.lastMessageTime >= compareDate;
      });
    }
    
    // פילטור לפי טקסט חיפוש
    if (searchText.trim()) {
      const search = searchText.trim().toLowerCase();
      filtered = filtered.filter(conv => {
        return (
          (conv.name && conv.name.toLowerCase().includes(search)) ||
          (conv.phoneNumber && conv.phoneNumber.toLowerCase().includes(search)) ||
          (conv.lastMessage && conv.lastMessage.toLowerCase().includes(search))
        );
      });
    }
    
    // מיון השיחות
    filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return b.lastMessageTime - a.lastMessageTime;
      } else {
        return a.lastMessageTime - b.lastMessageTime;
      }
    });
    
    setFilteredConversations(filtered);
  };

  useEffect(() => {
    filterConversations();
  }, [conversations, filterTime, sortBy, searchText]);

  const loadConversations = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    
    try {
      // טען את פרטי העסק
      try {
        const businessRef = collection(db, 'users', currentUser.uid, 'business');
        const businessInfoDoc = await getDocs(query(businessRef));
        
        if (!businessInfoDoc.empty) {
          setBusinessInfo(businessInfoDoc.docs[0].data());
        }
      } catch (error) {
        console.error('Error loading business info:', error);
      }
      
      console.log('Loading training conversations from API...');
      
      // נטען שיחות מפורטות מהנתיב החדש שיצרנו
      try {
        const authConfig = await getAuthConfig();
        const response = await axios.get(`${API_URL}/ai/training-conversations`, authConfig);
        
        if (response.data.success && response.data.conversations && response.data.conversations.length > 0) {
          // המרת תאריכים למבנה Date
          const conversationsData = response.data.conversations.map(conv => ({
            ...conv,
            lastMessageTime: conv.lastMessageTime ? new Date(conv.lastMessageTime) : new Date(),
            messages: conv.messages ? conv.messages.map(msg => ({
              ...msg,
              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
            })) : []
          }));
          
          console.log(`Loaded ${conversationsData.length} detailed conversations from API`);
          setConversations(conversationsData);
          setFilteredConversations(conversationsData);
          
          // אם יש שיחות, נציג את הראשונה כתצוגה מקדימה
          if (conversationsData.length > 0) {
            handlePreviewConversation(conversationsData[0]);
          }
          
          return; // מסיים אם הצלחנו לטעון את השיחות המפורטות
        }
      } catch (apiError) {
        console.error('Error loading training conversations from API:', apiError);
      }
      
      // גיבוי: נסיון לטעון שיחות רגילות מ-Firestore
      console.log('Attempting to load conversations from Firestore...');
      try {
        const conversationsRef = collection(db, 'users', currentUser.uid, 'conversations');
        const q = query(conversationsRef, orderBy('lastMessageTime', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        
        const conversationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // המר תאריכים מ-Firestore timestamp לאובייקט Date
          lastMessageTime: doc.data().lastMessageTime?.toDate() || new Date()
        }));
        
        console.log(`Loaded ${conversationsData.length} basic conversations from Firestore`);
        
        if (conversationsData.length > 0) {
          setConversations(conversationsData);
          setFilteredConversations(conversationsData);
          return;
        }
      } catch (firestoreError) {
        console.error('Error loading conversations from Firestore:', firestoreError);
      }
      
      // גיבוי שני: בדיקה אם יש שיחות רגילות דרך ה-API
      console.log('Fallback: Loading basic conversations from API');
      try {
        const authConfig = await getAuthConfig();
        const response = await axios.get(`${API_URL}/whatsapp/conversations`, authConfig);
        if (response.data.success && response.data.conversations) {
          const conversationsData = response.data.conversations.map(conv => ({
            ...conv,
            lastMessageTime: conv.lastMessageTime ? new Date(conv.lastMessageTime) : new Date()
          }));
          
          console.log(`Loaded ${conversationsData.length} basic conversations from API`);
          setConversations(conversationsData);
          setFilteredConversations(conversationsData);
        } else {
          console.error('API returned no conversations', response.data);
          setError('לא נמצאו שיחות. יתכן שאין לך עדיין שיחות וואטסאפ או שיש בעיה בחיבור.');
          setConversations([]);
          setFilteredConversations([]);
        }
      } catch (apiError) {
        console.error('Error loading basic conversations from API:', apiError);
        setError('אירעה שגיאה בטעינת השיחות. נא לוודא שיש לך חיבור אינטרנט ונסה שוב.');
        setConversations([]);
        setFilteredConversations([]);
      }
    } catch (error) {
      console.error('Error in loadConversations:', error);
      setError('אירעה שגיאה בטעינת השיחות. נא לנסות שוב מאוחר יותר.');
      setConversations([]);
      setFilteredConversations([]);
    } finally {
      setLoading(false);
    }
  };

  // שמירת הפונקציה ברפרנס
  loadConversationsRef.current = loadConversations;

  useEffect(() => {
    loadConversations();
  }, [currentUser]);

  const handleSelectConversation = (conversationId) => {
    setSelectedConversations(prev => {
      if (prev.includes(conversationId)) {
        return prev.filter(id => id !== conversationId);
      } else {
        return [...prev, conversationId];
      }
    });
  };

  const handlePreviewConversation = async (conversation) => {
    if (!conversation) return;
    
    try {
      setPreviewConversation(conversation);
      
      // אם כבר יש הודעות משיחה שנטענה מהנתיב החדש, נשתמש בהן
      if (conversation.messages && conversation.messages.length > 0) {
        console.log(`Using ${conversation.messages.length} pre-loaded messages for preview`);
        setPreviewMessages(conversation.messages);
        return;
      }
      
      // אחרת, נטען את ההודעות באופן נפרד
      setPreviewMessages([]);
      
      // טען את ההודעות של השיחה
      const messagesRef = collection(db, 'users', currentUser.uid, 'conversations', conversation.id, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      
      setPreviewMessages(messagesData);
    } catch (error) {
      console.error('Error loading conversation messages:', error);
      setError('אירעה שגיאה בטעינת ההודעות. אנא נסה שוב מאוחר יותר.');
    }
  };

  const handleTrainWithConversations = async () => {
    if (selectedConversations.length === 0) {
      setError('יש לבחור לפחות שיחה אחת לאימון');
      return;
    }
    
    try {
      setTrainingLoading(true);
      setError('');
      setSuccessMessage('');
      
      const authConfig = await getAuthConfig();
      
      const response = await axios.post(
        `${API_URL}/ai/train-with-conversations`, 
        { conversationIds: selectedConversations },
        authConfig
      );
      
      console.log('Training response:', response.data);
      
      if (response.data.success) {
        setSuccessMessage(`האימון הושלם בהצלחה עם ${response.data.conversationCount} שיחות`);
        // נקה את הבחירה
        setSelectedConversations([]);
      } else {
        setError(response.data.message || 'אירעה שגיאה באימון');
      }
    } catch (error) {
      console.error('Error training AI with conversations:', error);
      setError(
        error.response?.data?.message || 
        'אירעה שגיאה באימון. אנא ודא שיש לך חיבור אינטרנט ונסה שוב.'
      );
    } finally {
      setTrainingLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // בחירה מהירה של כל השיחות לפי פרמטר
  const selectConversationsByTime = (timeFrame) => {
    const now = new Date();
    let compareDate = new Date();
    
    switch (timeFrame) {
      case 'today':
        compareDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        compareDate.setDate(now.getDate() - 7);
        break;
      default:
        break;
    }
    
    const idsToSelect = conversations
      .filter(conv => conv.lastMessageTime >= compareDate)
      .map(conv => conv.id);
    
    setSelectedConversations(idsToSelect);
  };

  if (loading) {
    return <LoadingSpinner message="טוען שיחות..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden mb-6">
        <div className="bg-primary-100 dark:bg-primary-900 px-6 py-4 border-b border-primary-200 dark:border-primary-700">
          <h1 className="text-2xl font-bold text-primary-800 dark:text-primary-100 flex items-center">
            <BeakerIcon className="h-6 w-6 ml-2" />
            אימון ה-AI באמצעות שיחות וואטסאפ
          </h1>
          <p className="text-sm text-primary-600 dark:text-primary-300 mt-1">
            בחר שיחות מוצלחות מהוואטסאפ שלך כדי ללמד את ה-AI כיצד לענות ללקוחות בסגנון שלך
          </p>
        </div>

        <div className="p-6">
          {businessInfo ? (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />
                </div>
                <div className="mr-3">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    פרטי העסק מוגדרים: {businessInfo.name} - {businessInfo.industry}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-md p-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                טרם הגדרת את פרטי העסק שלך. 
                <button 
                  onClick={() => navigate('/train')} 
                  className="mr-2 text-primary-600 dark:text-primary-400 underline"
                >
                  הגדר פרטי עסק
                </button>
                לפני אימון ה-AI.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-md p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-md p-4">
              <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
            </div>
          )}

          <div className="mb-6">
            <div className="flex flex-wrap items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                שיחות וואטסאפ שלך
              </h2>
              
              <div className="flex space-x-2 rtl:space-x-reverse mt-2 sm:mt-0">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <FunnelIcon className="-mr-1 ml-1 h-4 w-4" />
                  פילטרים
                </button>
                
                {!importLoading && !isActiveImport ? (
                  <button
                    onClick={importConversationsFromWhatsApp}
                    disabled={importLoading || isActiveImport}
                    className="inline-flex items-center px-3 py-1.5 border border-indigo-500 dark:border-indigo-600 rounded-md text-sm font-medium text-white bg-indigo-500 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowDownTrayIcon className="-mr-1 ml-1 h-4 w-4" />
                    ייבא שיחות מוואטסאפ
                  </button>
                ) : (
                  <>
                    <button
                      onClick={cancelImport}
                      className="inline-flex items-center px-3 py-1.5 border border-red-500 dark:border-red-600 rounded-md text-sm font-medium text-white bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700"
                    >
                      <XMarkIcon className="-mr-1 ml-1 h-4 w-4" />
                      הפסק ייבוא
                    </button>
                    
                    <div className="inline-flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md">
                      <ArrowPathIcon className="animate-spin -mr-1 ml-1 h-4 w-4 text-indigo-500" />
                      <span className="text-sm">
                        {importStatus ? 
                          `מייבא ${importStatus.processedCount || 0}/${importStatus.totalCount || '?'} (${importProgress}%)` :
                          'מייבא שיחות...'
                        }
                      </span>
                    </div>
                  </>
                )}
                
                <button
                  onClick={() => selectConversationsByTime('today')}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <CalendarIcon className="-mr-1 ml-1 h-4 w-4" />
                  בחר מהיום
                </button>
                
                <button
                  onClick={() => selectConversationsByTime('week')}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <CalendarIcon className="-mr-1 ml-1 h-4 w-4" />
                  בחר משבוע אחרון
                </button>
              </div>
            </div>
            
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <PhoneIcon className="h-5 w-5 text-blue-400 dark:text-blue-500" />
                </div>
                <div className="mr-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                    ייבוא שיחות מוואטסאפ
                  </p>
                  <div className="mt-1 text-sm text-blue-700 dark:text-blue-400">
                    <p>
                      לחיצה על "ייבא שיחות מוואטסאפ" תשאב את השיחות הפעילות מחשבון הוואטסאפ המחובר.
                      וודא כי הנך מחובר לוואטסאפ דרך <a href="/whatsapp" className="underline">עמוד החיבור</a> לפני ביצוע הייבוא.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {showFilters && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* חיפוש טקסט */}
                  <div>
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      חיפוש
                    </label>
                    <input
                      type="text"
                      id="search"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="חיפוש לפי שם או הודעה..."
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  
                  {/* סינון לפי זמן */}
                  <div>
                    <label htmlFor="timeFilter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      סינון לפי זמן
                    </label>
                    <select
                      id="timeFilter"
                      value={filterTime}
                      onChange={(e) => setFilterTime(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="all">כל השיחות</option>
                      <option value="today">היום</option>
                      <option value="week">שבוע אחרון</option>
                      <option value="month">חודש אחרון</option>
                    </select>
                  </div>
                  
                  {/* מיון */}
                  <div>
                    <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      מיון לפי
                    </label>
                    <select
                      id="sortBy"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="newest">החדש ביותר קודם</option>
                      <option value="oldest">הישן ביותר קודם</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/30 rounded-md p-4 flex-1">
                <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-2">איך זה עובד?</h3>
                <p className="text-xs text-indigo-700 dark:text-indigo-400">
                  1. בחר שיחות בהן טיפלת היטב בלקוחות<br />
                  2. ה-AI ילמד מהשיחות האלה את סגנון התגובות שלך<br />
                  3. כך תיווצר מערכת מענה אוטומטי שמחקה את הסגנון האישי שלך
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-md p-4 flex-1">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">טיפים לבחירת שיחות</h3>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  • בחר שיחות מגוונות שמכסות נושאים שונים<br />
                  • התמקד בשיחות שבהן התשובות שלך מפורטות ומקצועיות<br />
                  • שיחות שהסתיימו בהצלחה (לקוחות מרוצים) הן הטובות ביותר
                </p>
              </div>
            </div>
            
            <div className="flex justify-between mb-6">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedConversations.length === 0 ? (
                  <span>לא נבחרו שיחות</span>
                ) : (
                  <span>נבחרו <span className="font-semibold">{selectedConversations.length}</span> שיחות</span>
                )}
              </div>
              
              <button
                onClick={handleTrainWithConversations}
                disabled={selectedConversations.length === 0 || trainingLoading}
                className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white 
                  ${(selectedConversations.length === 0 || trainingLoading) 
                    ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
                  }`}
              >
                {trainingLoading ? (
                  <>
                    <ArrowPathIcon className="animate-spin -mr-1 ml-2 h-5 w-5 text-white" />
                    מאמן...
                  </>
                ) : (
                  <>
                    <BeakerIcon className="-mr-1 ml-2 h-5 w-5" />
                    אמן AI עם {selectedConversations.length} שיחות נבחרות
                  </>
                )}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner message="טוען שיחות וואטסאפ..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    שיחות וואטסאפ ({filteredConversations.length})
                  </h3>
                  
                  {selectedConversations.length > 0 && (
                    <button
                      onClick={() => setSelectedConversations([])}
                      className="text-xs text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
                    >
                      נקה בחירה
                    </button>
                  )}
                </div>
                
                <div className="overflow-auto max-h-[600px]">
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredConversations.length === 0 ? (
                      <li className="px-4 py-10 text-sm text-center text-gray-500 dark:text-gray-400">
                        לא נמצאו שיחות. התחל לקבל הודעות בוואטסאפ או ודא שחשבון הוואטסאפ שלך מחובר למערכת.
                      </li>
                    ) : (
                      filteredConversations.map(conversation => (
                        <li 
                          key={conversation.id} 
                          className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors
                            ${previewConversation?.id === conversation.id ? 'bg-gray-100 dark:bg-gray-800' : ''}
                            ${selectedConversations.includes(conversation.id) ? 'border-r-4 border-primary-500' : ''}
                          `}
                        >
                          <div className="flex items-center">
                            <div className="flex items-center justify-center ml-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                checked={selectedConversations.includes(conversation.id)}
                                onChange={() => handleSelectConversation(conversation.id)}
                              />
                            </div>
                            <div 
                              onClick={() => handlePreviewConversation(conversation)}
                              className="flex-1"
                            >
                              <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {conversation.name || conversation.phoneNumber}
                                </p>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatDate(conversation.lastMessageTime).split(' ')[0]}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {conversation.lastMessage?.substring(0, 60)}...
                              </p>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatDate(conversation.lastMessageTime).split(' ')[1]}
                                </span>
                                {conversation.messages && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {conversation.messages.length} הודעות
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>

              <div className="md:col-span-2 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden flex flex-col">
                <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    <ChatBubbleBottomCenterTextIcon className="h-4 w-4 ml-1" />
                    {previewConversation ? (
                      <>תצוגת שיחה: {previewConversation.name || previewConversation.phoneNumber}</>
                    ) : (
                      <>בחר שיחה לתצוגה</>
                    )}
                  </h3>
                  {previewConversation && (
                    <button
                      onClick={() => handleSelectConversation(previewConversation.id)}
                      className={`text-xs py-1 px-2 rounded transition-colors ${
                        selectedConversations.includes(previewConversation.id)
                          ? 'bg-primary-500 text-white hover:bg-primary-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {selectedConversations.includes(previewConversation.id) ? 'הוסר מהבחירה' : 'הוסף לבחירה'}
                    </button>
                  )}
                </div>
                
                <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900 min-h-[500px]">
                  {!previewConversation ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <ChatBubbleBottomCenterTextIcon className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                      <p className="text-gray-500 dark:text-gray-400 text-center">
                        בחר שיחה מהרשימה כדי לראות את תוכן השיחה
                      </p>
                    </div>
                  ) : previewMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <LoadingSpinner size="small" message="טוען הודעות..." />
                    </div>
                  ) : (
                    <div className="space-y-3 w-full max-w-3xl mx-auto">
                      <div className="text-center mb-6">
                        <span className="inline-block px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                          {formatDate(previewMessages[0]?.timestamp).split(' ')[0]}
                        </span>
                      </div>
                      
                      {previewMessages.map((message, idx) => {
                        // בדיקה האם זה יום חדש
                        const showDateSeparator = idx > 0 && 
                          new Date(message.timestamp).toDateString() !== 
                          new Date(previewMessages[idx-1].timestamp).toDateString();
                        
                        return (
                          <React.Fragment key={message.id || idx}>
                            {showDateSeparator && (
                              <div className="text-center my-4">
                                <span className="inline-block px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                                  {formatDate(message.timestamp).split(' ')[0]}
                                </span>
                              </div>
                            )}
                            
                            <div
                              className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 shadow-sm ${
                                  message.fromMe
                                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-100 rounded-tr-none'
                                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none'
                                }`}
                              >
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex justify-between gap-2">
                                  <span>{message.fromMe ? 'אתה' : previewConversation.name || previewConversation.phoneNumber}</span>
                                  <span className="opacity-75">
                                    {formatDate(message.timestamp).split(' ')[1]}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {previewConversation && previewMessages.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {previewMessages.length} הודעות בשיחה זו
                      </span>
                      <button
                        onClick={() => handleSelectConversation(previewConversation.id)}
                        className={`text-xs py-1.5 px-3 rounded-md transition-colors ${
                          selectedConversations.includes(previewConversation.id)
                            ? 'bg-primary-500 text-white hover:bg-primary-600'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {selectedConversations.includes(previewConversation.id) ? 'הסר מהבחירה' : 'הוסף לבחירה'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {importStatus && importStatus.status === 'importing' && (
        <div className="mt-4 mb-4 bg-gray-50 dark:bg-gray-800 rounded-md p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              מתקדם בייבוא השיחות...
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {importStatus.processedCount} מתוך {importStatus.totalCount}
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-indigo-500 dark:bg-indigo-600 h-2 rounded-full" 
              style={{ width: `${importProgress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {importStatus.currentChatId && (
              <span>כרגע מעבד: {importStatus.currentChatId.split('@')[0]}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AITrainingWithConversations; 