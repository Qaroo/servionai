import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  query, 
  onSnapshot,
  orderBy,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { getAIResponse, trainAgent } from '../services/openai';

// יצירת קונטקסט ל-AI
const AIContext = createContext();

// הוק לשימוש בקונטקסט
export const useAI = () => useContext(AIContext);

// ספק הקונטקסט
export const AIProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [trainingState, setTrainingState] = useState('idle'); // idle, training, trained
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // פונקציה ליצירת שיחת אימון חדשה
  const createTrainingConversation = async (title) => {
    try {
      if (!currentUser) return;
      
      setLoading(true);
      setError('');
      
      // יצירת שיחה חדשה
      const conversationRef = await addDoc(collection(db, 'users', currentUser.uid, 'trainings'), {
        title: title || 'שיחת אימון חדשה',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active'
      });
      
      // בחירת השיחה החדשה
      setSelectedConversation(conversationRef.id);
      
      return conversationRef.id;
    } catch (error) {
      console.error('Error creating training conversation:', error);
      setError('אירעה שגיאה ביצירת שיחת אימון חדשה. אנא נסה שוב.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // פונקציה לשליחת הודעה לשיחת אימון
  const sendMessage = async (content) => {
    try {
      if (!currentUser || !selectedConversation) return;
      
      setLoading(true);
      setError('');
      
      // שמירת הודעת המשתמש
      const userMessageRef = await addDoc(
        collection(db, 'users', currentUser.uid, 'trainings', selectedConversation, 'messages'),
        {
          content,
          sender: 'user',
          timestamp: serverTimestamp()
        }
      );
      
      // עדכון זמן העדכון האחרון של השיחה
      await updateDoc(
        doc(db, 'users', currentUser.uid, 'trainings', selectedConversation),
        { updatedAt: serverTimestamp() }
      );
      
      // קבלת תשובה מ-AI
      const messagesSnapshot = await collection(
        db, 'users', currentUser.uid, 'trainings', selectedConversation, 'messages'
      );
      
      // קבלת היסטוריית ההודעות לשימוש כקונטקסט
      const messagesData = messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      
      const aiResponse = await getAIResponse(content, messagesData);
      
      // שמירת תשובת ה-AI
      const aiMessageRef = await addDoc(
        collection(db, 'users', currentUser.uid, 'trainings', selectedConversation, 'messages'),
        {
          content: aiResponse,
          sender: 'ai',
          timestamp: serverTimestamp()
        }
      );
      
      return aiResponse;
    } catch (error) {
      console.error('Error sending message:', error);
      setError('אירעה שגיאה בשליחת ההודעה. אנא נסה שוב.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // פונקציה לאימון הסוכן עם פרטי העסק
  const trainBusinessAgent = async (info) => {
    try {
      if (!currentUser) return;
      
      setLoading(true);
      setError('');
      setTrainingState('training');
      
      // שמירת פרטי העסק
      await setDoc(doc(db, 'users', currentUser.uid, 'business', 'info'), {
        ...info,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // אימון הסוכן באמצעות OpenAI
      const response = await trainAgent(info);
      
      // שמירת תוצאות האימון
      await setDoc(doc(db, 'users', currentUser.uid, 'business', 'training'), {
        status: 'trained',
        lastTraining: serverTimestamp(),
        response: response
      }, { merge: true });
      
      setBusinessInfo(info);
      setTrainingState('trained');
      
      return response;
    } catch (error) {
      console.error('Error training agent:', error);
      setError('אירעה שגיאה באימון הסוכן. אנא נסה שוב.');
      setTrainingState('idle');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // פונקציה לטעינת פרטי העסק
  const loadBusinessInfo = async () => {
    try {
      if (!currentUser) return;
      
      setLoading(true);
      
      // טעינת פרטי העסק
      const businessDoc = await getDoc(doc(db, 'users', currentUser.uid, 'business', 'info'));
      
      if (businessDoc.exists()) {
        setBusinessInfo(businessDoc.data());
      }
      
      // טעינת סטטוס האימון
      const trainingDoc = await getDoc(doc(db, 'users', currentUser.uid, 'business', 'training'));
      
      if (trainingDoc.exists() && trainingDoc.data().status === 'trained') {
        setTrainingState('trained');
      } else {
        setTrainingState('idle');
      }
    } catch (error) {
      console.error('Error loading business info:', error);
      setError('אירעה שגיאה בטעינת פרטי העסק. אנא רענן את הדף.');
    } finally {
      setLoading(false);
    }
  };

  // טעינת שיחות אימון מ-Firestore
  const loadTrainingConversations = () => {
    if (!currentUser) return;

    const conversationsRef = collection(db, 'users', currentUser.uid, 'trainings');
    const q = query(conversationsRef, orderBy('updatedAt', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const conversationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConversations(conversationsData);
    }, (error) => {
      console.error('Error loading training conversations:', error);
      setError('אירעה שגיאה בטעינת שיחות האימון. אנא רענן את הדף.');
    });
  };

  // טעינת הודעות של שיחת אימון מסוימת
  const loadMessages = (conversationId) => {
    if (!currentUser || !conversationId) return;

    const messagesRef = collection(db, 'users', currentUser.uid, 'trainings', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    return onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(messagesData);
    }, (error) => {
      console.error('Error loading messages:', error);
      setError('אירעה שגיאה בטעינת הודעות. אנא רענן את הדף.');
    });
  };

  // טעינת נתונים כאשר המשתמש משתנה
  useEffect(() => {
    if (currentUser) {
      loadBusinessInfo();
      
      // הרשמה להאזנה לשיחות אימון
      const unsubscribeConversations = loadTrainingConversations();
      
      return () => {
        if (unsubscribeConversations) unsubscribeConversations();
      };
    }
  }, [currentUser]);

  // טעינת הודעות כאשר נבחרת שיחת אימון
  useEffect(() => {
    if (selectedConversation) {
      const unsubscribeMessages = loadMessages(selectedConversation);
      
      return () => {
        if (unsubscribeMessages) unsubscribeMessages();
      };
    } else {
      setMessages([]);
    }
  }, [selectedConversation]);

  // ערך הקונטקסט
  const value = {
    trainingState,
    conversations,
    selectedConversation,
    setSelectedConversation,
    messages,
    businessInfo,
    loading,
    error,
    createTrainingConversation,
    sendMessage,
    trainBusinessAgent,
    loadBusinessInfo
  };

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
}; 