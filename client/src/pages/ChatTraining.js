import React, { useState, useEffect, useRef } from 'react';
import { useChatTraining } from '../contexts/ChatTrainingContext';
import {
  PaperAirplaneIcon,
  ArrowPathIcon,
  AcademicCapIcon,
  CheckIcon,
  ChatBubbleLeftEllipsisIcon,
  LightBulbIcon,
  PencilSquareIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

const ChatTraining = () => {
  const {
    activeTraining,
    trainingConversations,
    trainingHistory,
    loading,
    error,
    startNewTraining,
    continueTraining,
    sendTrainingMessage,
    finishTraining,
    getTrainingQuestion
  } = useChatTraining();

  const [message, setMessage] = useState('');
  const [topic, setTopic] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // גלילה למטה בכל פעם שמתווספת הודעה חדשה
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTraining?.messages]);

  // התחלת אימון חדש
  const handleStartNewTraining = async () => {
    try {
      await startNewTraining(topic.trim() || null);
      setTopic('');
    } catch (err) {
      console.error('Failed to start new training:', err);
    }
  };

  // המשך אימון קיים
  const handleContinueTraining = async (trainingId) => {
    try {
      await continueTraining(trainingId);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to continue training:', err);
    }
  };

  // שליחת הודעה
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || !activeTraining) return;
    
    try {
      await sendTrainingMessage(activeTraining.id, message);
      setMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // קבלת שאלה מה-AI
  const handleGetQuestion = async () => {
    if (!activeTraining) return;
    
    try {
      setLoadingQuestion(true);
      const question = await getTrainingQuestion(activeTraining.id);
      if (question) {
        await sendTrainingMessage(activeTraining.id, question.content, 'assistant');
      }
    } catch (err) {
      console.error('Failed to get training question:', err);
    } finally {
      setLoadingQuestion(false);
    }
  };

  // סיום אימון
  const handleFinishTraining = async () => {
    if (!activeTraining) return;
    
    try {
      await finishTraining(activeTraining.id, summary);
      setShowSummary(false);
      setSummary('');
    } catch (err) {
      console.error('Failed to finish training:', err);
    }
  };

  // הצגת ההודעות בצ'אט
  const renderMessages = () => {
    if (!activeTraining || !activeTraining.messages || activeTraining.messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500 text-center p-4">
          <div>
            <AcademicCapIcon className="h-12 w-12 mx-auto mb-2" />
            <p>אין הודעות עדיין. התחל את האימון בשליחת הודעה או בקשת שאלה מה-AI</p>
          </div>
        </div>
      );
    }

    return activeTraining.messages.map((msg, index) => (
      <div
        key={index}
        className={`mb-4 ${
          msg.role === 'user' ? 'self-end' : 'self-start'
        }`}
      >
        <div
          className={`rounded-lg px-4 py-2 max-w-sm ${
            msg.role === 'user'
              ? 'bg-primary-600 text-white mr-2'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 ml-2'
          }`}
        >
          <p>{msg.content}</p>
        </div>
        <div
          className={`text-xs text-gray-500 mt-1 ${
            msg.role === 'user' ? 'text-left' : 'text-right'
          }`}
        >
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    ));
  };

  // הצגת רשימת האימונים הקודמים
  const renderTrainingHistory = () => {
    if (!trainingConversations || trainingConversations.length === 0) {
      return (
        <div className="text-center p-4 text-gray-500">
          אין שיחות אימון קודמות
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {trainingConversations.map((training) => (
          <div
            key={training.id}
            className={`p-3 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
              activeTraining?.id === training.id
                ? 'bg-primary-50 dark:bg-primary-900 border border-primary-300 dark:border-primary-700'
                : 'bg-white dark:bg-gray-800'
            }`}
            onClick={() => handleContinueTraining(training.id)}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-medium">
                {training.topic || 'אימון ללא נושא'}
              </h3>
              <span className="text-xs text-gray-500">
                {new Date(training.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1 truncate">
              {training.messages && training.messages.length > 0
                ? `${training.messages.length} הודעות`
                : 'אימון חדש'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden max-w-4xl mx-auto">
        <div className="flex flex-col h-[70vh]">
          {/* כותרת */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center">
              <AcademicCapIcon className="h-6 w-6 text-primary-600 dark:text-primary-400 ml-2" />
              <h1 className="text-xl font-bold">אימון AI באמצעות צ'אט</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 ml-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChatBubbleLeftEllipsisIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setShowSummary(true)}
                disabled={!activeTraining}
                className={`p-2 ml-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  !activeTraining ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <CheckIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* תוכן ראשי */}
          <div className="flex flex-1 overflow-hidden">
            {/* רשימת שיחות */}
            {showHistory && (
              <div className="w-1/3 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">שיחות אימון</h2>
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex mb-2">
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="נושא לאימון חדש (אופציונלי)"
                      className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-r-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      onClick={handleStartNewTraining}
                      disabled={loading}
                      className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-l-md"
                    >
                      חדש
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center p-4">
                    <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-500" />
                  </div>
                ) : (
                  renderTrainingHistory()
                )}
              </div>
            )}

            {/* אזור צ'אט */}
            <div className={`${showHistory ? 'w-2/3' : 'w-full'} flex flex-col`}>
              {/* אזור הודעות */}
              <div
                ref={chatContainerRef}
                className="flex-1 p-4 overflow-y-auto flex flex-col"
              >
                {renderMessages()}
                <div ref={messagesEndRef} />
              </div>

              {/* אזור טופס שליחת הודעה */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                {!activeTraining ? (
                  <div className="text-center">
                    <button
                      onClick={() => setShowHistory(true)}
                      className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-md"
                    >
                      התחל אימון חדש
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center">
                    <button
                      type="button"
                      onClick={handleGetQuestion}
                      disabled={loadingQuestion}
                      className="p-2 ml-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {loadingQuestion ? (
                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      ) : (
                        <LightBulbIcon className="h-5 w-5" />
                      )}
                    </button>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="הקלד הודעה לאימון..."
                        className="w-full p-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!message.trim()}
                      className={`p-2 mr-2 rounded-full ${
                        message.trim()
                          ? 'text-primary-600 hover:bg-primary-100 dark:hover:bg-primary-900'
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <PaperAirplaneIcon className="h-6 w-6 transform rotate-90" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* מודל סיכום אימון */}
      {showSummary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">סיום אימון</h2>
              <button
                onClick={() => setShowSummary(false)}
                className="p-1 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-gray-600 dark:text-gray-300">
              הוסף סיכום לאימון זה (אופציונלי)
            </p>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="סיכום האימון..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white mb-4"
              rows={4}
            />
            <div className="flex justify-end">
              <button
                onClick={() => setShowSummary(false)}
                className="mr-2 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ביטול
              </button>
              <button
                onClick={handleFinishTraining}
                className="py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center"
              >
                <CheckIcon className="h-5 w-5 ml-1" />
                סיים אימון
              </button>
            </div>
          </div>
        </div>
      )}

      {/* הודעת שגיאה */}
      {error && (
        <div className="fixed bottom-4 left-4 bg-red-100 border-r-4 border-red-500 text-red-700 px-4 py-3 rounded shadow-md">
          <div className="flex">
            <div className="py-1">
              <svg
                className="h-6 w-6 text-red-500 ml-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold">שגיאה</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatTraining; 