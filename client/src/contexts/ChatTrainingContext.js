import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

// יצירת Context חדש
const ChatTrainingContext = createContext();

// Hook לשימוש בקונטקסט
export const useChatTraining = () => useContext(ChatTrainingContext);

// ספק הקונטקסט
export const ChatTrainingProvider = ({ children }) => {
  const { currentUser, getToken } = useAuth();
  const [trainingConversations, setTrainingConversations] = useState([]);
  const [activeTraining, setActiveTraining] = useState(null);
  const [trainingHistory, setTrainingHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // הגדרת הקונפיגורציה לבקשות
  const getAuthConfig = async () => {
    const token = await getToken();
    return {
      headers: {
        Authorization: token
      }
    };
  };

  // קבלת שיחות האימון
  const fetchTrainingConversations = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.get(`/api/ai/training-chat-conversations`, config);

      if (response.data && response.data.success) {
        setTrainingConversations(response.data.conversations);
      }
    } catch (err) {
      console.error('Error fetching training conversations:', err);
      setError('שגיאה בטעינת שיחות האימון');
    } finally {
      setLoading(false);
    }
  };

  // התחלת אימון חדש
  const startNewTraining = async (topic = null) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.post(`/api/ai/start-chat-training`, 
        { topic }, 
        config
      );

      if (response.data && response.data.success) {
        const newTraining = response.data.training;
        setActiveTraining(newTraining);
        
        // הוספת האימון החדש לרשימת האימונים
        setTrainingConversations(prev => [newTraining, ...prev]);
        
        return newTraining;
      }
    } catch (err) {
      console.error('Error starting new training:', err);
      setError('שגיאה בהתחלת אימון חדש');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // המשך אימון קיים
  const continueTraining = async (trainingId) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.get(`/api/ai/training-chat-conversations/${trainingId}`, config);

      if (response.data && response.data.success) {
        setActiveTraining(response.data.training);
        return response.data.training;
      }
    } catch (err) {
      console.error('Error continuing training:', err);
      setError('שגיאה בטעינת האימון');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // שליחת הודעה באימון
  const sendTrainingMessage = async (trainingId, messageContent, role = 'user') => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.post(`/api/ai/training-chat-message`, {
        trainingId,
        content: messageContent,
        role
      }, config);

      if (response.data && response.data.success) {
        const updatedTraining = response.data.training;
        
        // עדכון האימון הפעיל
        setActiveTraining(updatedTraining);
        
        // עדכון האימון ברשימת האימונים
        setTrainingConversations(prev => 
          prev.map(training => training.id === trainingId ? updatedTraining : training)
        );
        
        return response.data.message;
      }
    } catch (err) {
      console.error('Error sending training message:', err);
      setError('שגיאה בשליחת הודעת אימון');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // סיום אימון
  const finishTraining = async (trainingId, summary = '') => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.post(`/api/ai/finish-chat-training`, {
        trainingId,
        summary
      }, config);

      if (response.data && response.data.success) {
        const finishedTraining = response.data.training;
        
        // אם זה האימון הפעיל, איפוס
        if (activeTraining && activeTraining.id === trainingId) {
          setActiveTraining(null);
        }
        
        // עדכון האימון ברשימת האימונים
        setTrainingConversations(prev => 
          prev.map(training => training.id === trainingId ? finishedTraining : training)
        );
        
        // טעינת היסטוריית האימונים מחדש
        fetchTrainingHistory();
        
        return finishedTraining;
      }
    } catch (err) {
      console.error('Error finishing training:', err);
      setError('שגיאה בסיום האימון');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // קבלת היסטוריית האימונים
  const fetchTrainingHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.get(`/api/ai/training-chat-history`, config);

      if (response.data && response.data.success) {
        setTrainingHistory(response.data.history);
      }
    } catch (err) {
      console.error('Error fetching training history:', err);
      setError('שגיאה בטעינת היסטוריית האימון');
    } finally {
      setLoading(false);
    }
  };

  // קבלת שאלה אימון מה-AI
  const getTrainingQuestion = async (trainingId, topic = null) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.post(`/api/ai/get-training-question`, {
        trainingId,
        topic
      }, config);

      if (response.data && response.data.success) {
        return response.data.question;
      }
    } catch (err) {
      console.error('Error getting training question:', err);
      setError('שגיאה בקבלת שאלת אימון');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // טעינת נתוני האימונים בהתחלה
  useEffect(() => {
    if (currentUser) {
      fetchTrainingConversations();
      fetchTrainingHistory();
    }
  }, [currentUser]);

  const value = {
    trainingConversations,
    activeTraining,
    trainingHistory,
    loading,
    error,
    fetchTrainingConversations,
    startNewTraining,
    continueTraining,
    sendTrainingMessage,
    finishTraining,
    getTrainingQuestion
  };

  return (
    <ChatTrainingContext.Provider value={value}>
      {children}
    </ChatTrainingContext.Provider>
  );
};

export default ChatTrainingContext; 