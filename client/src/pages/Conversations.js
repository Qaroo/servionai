import React, { useEffect, useState, useRef } from 'react';
import { useWhatsApp } from '../contexts/WhatsAppContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  ArrowPathIcon,
  PhoneIcon,
  ArchiveBoxIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const Conversations = () => {
  const {
    conversations,
    selectedChat,
    setSelectedChat,
    messages,
    sendMessage,
    connectionStatus,
    checkConnectionStatus,
    loading: whatsappLoading,
    error: whatsappError
  } = useWhatsApp();

  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useRealConversations, setUseRealConversations] = useState(
    localStorage.getItem('useRealConversations') === 'true'
  );
  const [realConversations, setRealConversations] = useState([]);
  const [isLoadingRealConversations, setIsLoadingRealConversations] = useState(false);
  const messagesEndRef = useRef(null);

  // בדיקת סטטוס החיבור כאשר הדף נטען
  useEffect(() => {
    const checkStatus = async () => {
      try {
        await checkConnectionStatus();
      } catch (error) {
        console.error('Error checking WhatsApp status:', error);
      }
    };

    checkStatus();
  }, [checkConnectionStatus]);

  // טעינת שיחות אמיתיות אם נבחרה האופציה
  useEffect(() => {
    const loadRealConversations = async () => {
      if (useRealConversations) {
        try {
          setIsLoadingRealConversations(true);
          const response = await axios.get(`${API_URL}/whatsapp/conversations?useReal=true`);
          
          if (response.data && response.data.success) {
            setRealConversations(response.data.conversations);
            
            // אם יש שיחות אמיתיות ואין שיחה נבחרת, בחר את הראשונה
            if (response.data.conversations.length > 0 && !selectedChat) {
              setSelectedChat(response.data.conversations[0].id);
            }
          }
        } catch (error) {
          console.error('Error loading real conversations:', error);
          setError('אירעה שגיאה בטעינת השיחות האמיתיות. אנא נסה שוב.');
          // במקרה של שגיאה, חזור לשיחות לדוגמה
          setUseRealConversations(false);
          localStorage.setItem('useRealConversations', 'false');
        } finally {
          setIsLoadingRealConversations(false);
        }
      }
    };

    loadRealConversations();
  }, [useRealConversations, selectedChat, setSelectedChat]);

  // שמירת ההעדפה בלוקל סטורג'
  useEffect(() => {
    localStorage.setItem('useRealConversations', useRealConversations.toString());
  }, [useRealConversations]);

  // גלילה לסוף ההודעות כאשר מתקבלות הודעות חדשות
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // בחירת השיחה הראשונה כשיחה פעילה כאשר השיחות נטענות
  useEffect(() => {
    // אם משתמשים בשיחות אמיתיות, נטפל בזה בהשפעה אחרת
    if (useRealConversations) return;
    
    if (conversations && conversations.length > 0 && !selectedChat) {
      setSelectedChat(conversations[0].id);
    }
  }, [conversations, selectedChat, setSelectedChat, useRealConversations]);

  // שליחת הודעה
  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim() || !selectedChat) return;

    try {
      setLoading(true);
      setError('');
      await sendMessage(selectedChat, messageText);
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('אירעה שגיאה בשליחת ההודעה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // רענון סטטוס החיבור
  const handleRefreshStatus = async () => {
    try {
      setLoading(true);
      await checkConnectionStatus();
    } catch (error) {
      console.error('Error refreshing status:', error);
    } finally {
      setLoading(false);
    }
  };

  // בחירת שיחה
  const handleSelectChat = (chatId) => {
    setSelectedChat(chatId);
    setError('');
  };

  // החלפה בין שיחות לדוגמה לשיחות אמיתיות
  const toggleConversationMode = () => {
    setUseRealConversations(!useRealConversations);
  };

  // פורמוט תאריך אחרון
  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'אתמול';
    } else if (diffDays < 7) {
      const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
      return days[date.getDay()];
    } else {
      return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    }
  };

  // השיחות שיוצגו
  const displayedConversations = useRealConversations ? realConversations : conversations;

  // אם בטעינה, הצג ספינר
  if ((whatsappLoading && conversations.length === 0) || (useRealConversations && isLoadingRealConversations)) {
    return <LoadingSpinner message="טוען שיחות..." />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">שיחות WhatsApp</h1>
        <div className="flex items-center">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              connectionStatus === 'connected'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            } mr-1.5`}></span>
            {connectionStatus === 'connected' ? 'מחובר' : 'מנותק'}
          </span>
          <button
            onClick={handleRefreshStatus}
            disabled={loading}
            className="ml-2 p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* כפתור מעבר בין מצבים */}
      <div className="mb-4 flex justify-end">
        <div className="flex items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">שיחות לדוגמה</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={useRealConversations}
              onChange={toggleConversationMode}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
          </label>
          <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">שיחות אמיתיות</span>
        </div>
      </div>

      {/* הודעת אזהרה אם לא מחובר */}
      {connectionStatus !== 'connected' && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <InformationCircleIcon className="h-5 w-5 text-red-400 dark:text-red-500" />
            </div>
            <div className="mr-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">WhatsApp לא מחובר</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                <p>
                  אינך מחובר כרגע ל-WhatsApp. שיחות לא יתעדכנו בזמן אמת והסוכן לא יוכל לענות ללקוחות באופן אוטומטי.
                </p>
                <p className="mt-1">
                  <a href="/whatsapp" className="font-medium underline hover:text-red-900 dark:hover:text-red-200">
                    לחץ כאן כדי להתחבר
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {displayedConversations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900">
            <ChatBubbleLeftRightIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">אין שיחות עדיין</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {useRealConversations 
              ? 'לא נמצאו שיחות אמיתיות. ודא שהתחברת לWhatsApp וקיבלת הודעות.'
              : connectionStatus === 'connected'
                ? 'כאשר לקוחות ישלחו לך הודעות ב-WhatsApp, הן יופיעו כאן.'
                : 'חבר את WhatsApp כדי לראות את השיחות שלך כאן.'}
          </p>
          {connectionStatus !== 'connected' && (
            <div className="mt-5">
              <a
                href="/whatsapp"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
              >
                <PhoneIcon className="ml-1.5 -mr-1 h-5 w-5" />
                חבר את WhatsApp
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden h-[calc(100vh-12rem)]">
          <div className="flex h-full">
            {/* רשימת שיחות */}
            <div className="w-1/3 border-l border-gray-200 dark:border-gray-700 h-full overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                  שיחות אחרונות ({displayedConversations.length})
                </h2>
              </div>
              <div className="overflow-y-auto flex-1">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {displayedConversations.map((chat) => (
                    <li key={chat.id} className="relative">
                      <button
                        onClick={() => handleSelectChat(chat.id)}
                        className={`w-full px-4 py-3 focus:outline-none ${
                          selectedChat === chat.id
                            ? 'bg-primary-50 dark:bg-primary-900/20 border-r-4 border-primary-500'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                              <UserCircleIcon className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                            </div>
                          </div>
                          <div className="mr-3 flex-1 text-right">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatLastMessageTime(chat.lastMessageTime)}
                              </span>
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {chat.name || chat.phoneNumber || 'איש קשר'}
                              </p>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate text-right">
                              {chat.lastMessage || 'אין הודעות עדיין'}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* אזור התכתבות */}
            <div className="w-2/3 flex flex-col h-full">
              {selectedChat ? (
                <>
                  {/* כותרת השיחה */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <UserCircleIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      </div>
                      <div className="mr-3">
                        <h2 className="text-md font-medium text-gray-900 dark:text-white">
                          {displayedConversations.find(c => c.id === selectedChat)?.name || 
                           displayedConversations.find(c => c.id === selectedChat)?.phoneNumber || 
                           'איש קשר'}
                        </h2>
                      </div>
                    </div>
                    <button
                      className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none"
                      title="ארכיון שיחה"
                    >
                      <ArchiveBoxIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {/* אזור הודעות */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
                    {messages.length > 0 ? (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.fromMe ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`rounded-lg px-4 py-2 max-w-sm shadow-sm ${
                              msg.fromMe
                                ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 rounded-tr-none'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-none'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1 text-left">
                              {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString('he-IL') : ''}
                              {msg.isAI && <span className="mr-1.5 text-primary-500 dark:text-primary-400">AI</span>}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 dark:text-gray-400">
                          אין הודעות בשיחה זו עדיין.
                        </p>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* טופס שליחת הודעה */}
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                    <form onSubmit={handleSendMessage} className="flex">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="הקלד הודעה..."
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        disabled={connectionStatus !== 'connected' || loading}
                      />
                      <button
                        type="submit"
                        disabled={connectionStatus !== 'connected' || loading || !messageText.trim()}
                        className="mr-2 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none disabled:opacity-50"
                      >
                        <PaperAirplaneIcon className="h-4 w-4 ml-1.5 transform rotate-90" />
                        שלח
                      </button>
                    </form>

                    {/* שגיאה */}
                    {error && (
                      <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-center p-6">
                  <div>
                    <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">
                      בחר שיחה
                    </h3>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                      בחר שיחה מהרשימה משמאל כדי לצפות בהודעות
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Conversations; 