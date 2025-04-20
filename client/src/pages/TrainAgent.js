import React, { useState, useEffect } from 'react';
import { useAI } from '../contexts/AIContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { 
  ChatBubbleLeftIcon, 
  PaperAirplaneIcon, 
  PlusIcon, 
  AcademicCapIcon,
  CheckCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

const TrainAgent = () => {
  const { 
    trainingState, 
    conversations, 
    selectedConversation, 
    setSelectedConversation,
    messages, 
    createTrainingConversation, 
    sendMessage,
    trainBusinessAgent,
    businessInfo, 
    loading: aiLoading, 
    error: aiError 
  } = useAI();
  
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    services: '',
    hours: '',
    contact: '',
    additionalInfo: ''
  });
  
  const [tab, setTab] = useState('business'); // business, chat
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [message, setMessage] = useState('');
  
  // טעינת מידע קיים על העסק אם יש
  useEffect(() => {
    if (businessInfo) {
      setFormData({
        name: businessInfo.name || '',
        industry: businessInfo.industry || '',
        services: businessInfo.services || '',
        hours: businessInfo.hours || '',
        contact: businessInfo.contact || '',
        additionalInfo: businessInfo.additionalInfo || ''
      });
    }
  }, [businessInfo]);
  
  // כאשר אין שיחת אימון נבחרת, נבחר את האחרונה
  useEffect(() => {
    if (conversations && conversations.length > 0 && !selectedConversation) {
      setSelectedConversation(conversations[0].id);
    }
  }, [conversations, selectedConversation, setSelectedConversation]);
  
  // טיפול בשינויים בטופס
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));
  };
  
  // שליחת מידע העסק לאימון
  const handleBusinessSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // בדיקה שכל השדות החובה מלאים
      if (!formData.name || !formData.industry || !formData.services) {
        throw new Error('יש למלא את כל שדות החובה (*)');
      }
      
      // שליחה לאימון
      await trainBusinessAgent(formData);
      
      setSuccess('הסוכן אומן בהצלחה עם פרטי העסק שלך!');
      
      // מעבר לטאב הצ'אט
      setTab('chat');
    } catch (error) {
      console.error('Error training agent:', error);
      setError(error.message || 'אירעה שגיאה באימון הסוכן. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };
  
  // יצירת שיחת אימון חדשה
  const handleNewConversation = async () => {
    try {
      setLoading(true);
      setError('');
      
      const title = `שיחת אימון ${new Date().toLocaleString('he-IL')}`;
      await createTrainingConversation(title);
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError('אירעה שגיאה ביצירת שיחה חדשה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };
  
  // שליחת הודעה בצ'אט
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    try {
      setLoading(true);
      setError('');
      
      // אם אין שיחה נבחרת, יוצרים חדשה
      if (!selectedConversation) {
        const title = `שיחת אימון ${new Date().toLocaleString('he-IL')}`;
        await createTrainingConversation(title);
      }
      
      await sendMessage(message);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('אירעה שגיאה בשליחת ההודעה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };
  
  if (aiLoading) {
    return <LoadingSpinner message="טוען..." />;
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">אימון סוכן ה-AI</h1>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          אמן את הסוכן שלך כדי שיוכל לענות בצורה מותאמת אישית ללקוחות שלך ב-WhatsApp
        </p>
      </div>
      
      {/* לשוניות */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px">
          <button
            onClick={() => setTab('business')}
            className={`py-3 px-5 text-sm font-medium ${
              tab === 'business'
                ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:border-b-2 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            פרטי העסק
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`py-3 px-5 text-sm font-medium ${
              tab === 'chat'
                ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:border-b-2 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            אימון באמצעות צ'אט
          </button>
        </nav>
      </div>
      
      {/* תוכן הלשוניות */}
      <div className="py-6">
        {/* טופס פרטי העסק */}
        {tab === 'business' && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="max-w-lg mx-auto">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-5 flex items-center">
                  <AcademicCapIcon className="h-5 w-5 ml-2 text-primary-600" />
                  פרטי העסק שלך
                </h2>
                
                {/* הודעת הסבר */}
                <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <InformationCircleIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="mr-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        הסוכן ילמד את פרטי העסק שלך ויוכל לספק מידע ללקוחות שלך. מלא את הפרטים בצורה מדויקת ומקיפה ככל האפשר.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* מצב האימון */}
                {trainingState === 'trained' && (
                  <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <CheckCircleIcon className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="mr-3">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                          הסוכן כבר אומן בהצלחה!
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                          הסוכן שלך כבר אומן עם פרטי העסק שלך. אתה יכול לעדכן את הפרטים בכל עת.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* טופס */}
                <form onSubmit={handleBusinessSubmit}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        שם העסק *
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        תחום העסק / תעשייה *
                      </label>
                      <input
                        type="text"
                        id="industry"
                        name="industry"
                        value={formData.industry}
                        onChange={handleInputChange}
                        required
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="לדוגמה: מסעדה, חנות בגדים, משרד עו״ד"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="services" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        מוצרים ושירותים *
                      </label>
                      <textarea
                        id="services"
                        name="services"
                        value={formData.services}
                        onChange={handleInputChange}
                        required
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="פרט את המוצרים והשירותים שהעסק שלך מציע"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        שעות פעילות
                      </label>
                      <input
                        type="text"
                        id="hours"
                        name="hours"
                        value={formData.hours}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="לדוגמה: א-ה 9:00-18:00, ו 9:00-14:00, שבת סגור"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        פרטי קשר
                      </label>
                      <input
                        type="text"
                        id="contact"
                        name="contact"
                        value={formData.contact}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="טלפון, אימייל, כתובת, אתר"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="additionalInfo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        מידע נוסף
                      </label>
                      <textarea
                        id="additionalInfo"
                        name="additionalInfo"
                        value={formData.additionalInfo}
                        onChange={handleInputChange}
                        rows={4}
                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                        placeholder="מידע נוסף על העסק שלך, מדיניות ביטולים, מדיניות משלוחים, וכדומה"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-5">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          מאמן את הסוכן...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <AcademicCapIcon className="ml-1.5 -mr-1 h-5 w-5" />
                          {trainingState === 'trained' ? 'עדכן את אימון הסוכן' : 'אמן את הסוכן עכשיו'}
                        </span>
                      )}
                    </button>
                  </div>
                </form>
                
                {/* הודעות שגיאה / הצלחה */}
                {error && (
                  <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="mr-3">
                        <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {success && (
                  <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <CheckCircleIcon className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="mr-3">
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">{success}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* אימון באמצעות צ'אט */}
        {tab === 'chat' && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden h-[600px] flex flex-col">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                  <ChatBubbleLeftIcon className="h-5 w-5 ml-2 text-primary-600" />
                  צ'אט עם הסוכן
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  נהל שיחה עם הסוכן כדי לאמן אותו על תרחישים שונים
                </p>
              </div>
              <button
                onClick={handleNewConversation}
                disabled={loading}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
              >
                <PlusIcon className="ml-1 h-4 w-4 text-gray-500 dark:text-gray-400" />
                שיחה חדשה
              </button>
            </div>
            
            <div className="p-4 flex flex-1 overflow-hidden">
              {/* רשימת שיחות */}
              <div className="w-1/4 ml-4 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {conversations && conversations.length > 0 ? (
                    conversations.map((conv) => (
                      <li key={conv.id}>
                        <button
                          onClick={() => setSelectedConversation(conv.id)}
                          className={`w-full text-right px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                            selectedConversation === conv.id ? 'bg-primary-50 dark:bg-primary-900/20 border-r-2 border-primary-500' : ''
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {conv.title || 'שיחה ללא כותרת'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {conv.updatedAt ? new Date(conv.updatedAt.toDate()).toLocaleString('he-IL') : 'אין תאריך'}
                          </p>
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      אין שיחות עדיין. צור שיחה חדשה כדי להתחיל.
                    </li>
                  )}
                </ul>
              </div>
              
              {/* אזור צ'אט */}
              <div className="flex-1 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 rounded-md">
                {selectedConversation ? (
                  <>
                    {/* הודעות */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages && messages.length > 0 ? (
                        messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`rounded-lg px-4 py-2 max-w-md ${
                                msg.sender === 'user'
                                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 rounded-tr-none'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-tl-none'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1 text-left">
                                {msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString('he-IL') : ''}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            אין הודעות עדיין. שלח הודעה כדי להתחיל את האימון.
                          </p>
                        </div>
                      )}
                      
                      {/* אינדיקטור טעינה */}
                      {loading && (
                        <div className="flex justify-start">
                          <div className="rounded-lg px-4 py-2 bg-gray-100 dark:bg-gray-700">
                            <div className="flex space-x-1 space-x-reverse">
                              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-75"></div>
                              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-150"></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* טופס שליחת הודעה */}
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                      <form onSubmit={handleSendMessage} className="flex space-x-2 space-x-reverse">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="הקלד שאלה או תרחיש..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={loading || !message.trim()}
                          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          <PaperAirplaneIcon className="h-4 w-4 transform rotate-90" />
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ChatBubbleLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">אין שיחה נבחרת</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        בחר שיחה קיימת מהרשימה או צור שיחה חדשה
                      </p>
                      <div className="mt-4">
                        <button
                          onClick={handleNewConversation}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none"
                        >
                          <PlusIcon className="ml-1 -mr-1 h-5 w-5" />
                          צור שיחה חדשה
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrainAgent; 