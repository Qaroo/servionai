import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import axios from 'axios';

// דפים
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WhatsAppConnect from './pages/WhatsAppConnect';
import TrainAgent from './pages/TrainAgent';
import Conversations from './pages/Conversations';
import Profile from './pages/Profile';
import AITrainingWithConversations from './pages/AITrainingWithConversations';
import ChatTraining from './pages/ChatTraining';
import WebsiteSettings from './pages/WebsiteSettings';
import NaamaTalk from './pages/NaamaTalk';

// קומפוננטות
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';
import PrivateRoute from './components/PrivateRoute';

// שירותים
import { ThemeContext } from './utils/ThemeContext';
import { WebsiteProvider } from './contexts/WebsiteContext';
import { AIProvider } from './contexts/AIContext';

// קומפוננטה פשוטה להגדרת העסק
const BusinessSetup = () => {
  const { currentUser, getToken } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    description: '',
    services: '',
    contact: '',
    address: '',
    hours: 'א-ה 9:00-18:00'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const saveBusinessInfo = async () => {
    try {
      setLoading(true);
      setError('');

      if (!formData.name.trim() || !formData.industry.trim()) {
        setError('יש למלא לפחות את שם העסק ותחום העיסוק');
        return;
      }

      // שליחת נתוני העסק לשרת
      const token = await getToken();
      // הגדרת ה-API URL לפי סביבת ההרצה
      const API_BASE_URL = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:5001/api' 
        : '/api';
        
      const response = await fetch(`${API_BASE_URL}/ai/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ businessInfo: formData })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'אירעה שגיאה בשמירת נתוני העסק');
      }

      setSuccess(true);

      // מעבר לדף נעמה לאחר 3 שניות כדי לתת לשרת מספיק זמן לשמור את המידע
      setTimeout(() => {
        // שימוש בניווט מבוסס דפדפן כדי לרענן את הדף
        window.location.href = '/naama-talk';
      }, 3000);
    } catch (err) {
      console.error('Error saving business info:', err);
      setError(err.message || 'אירעה שגיאה בשמירת נתוני העסק');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-lg shadow-2xl overflow-hidden">
        <div className="p-6">
          <h1 className="text-3xl font-bold text-white mb-6">הגדרת פרטי העסק</h1>
          
          <p className="text-gray-200 mb-6">
            כדי להתחיל להשתמש בנעמה, יש להגדיר תחילה את פרטי העסק שלך.
            המידע הזה ישמש כדי לאמן את הבוט שיתן שירות ללקוחות שלך.
          </p>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
              הנתונים נשמרו בהצלחה! מעביר אותך לצ'אט עם נעמה...
            </div>
          )}
          
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); saveBusinessInfo(); }}>
            <div>
              <label className="block text-gray-200 mb-2">שם העסק *</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
                placeholder="הכנס את שם העסק"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-200 mb-2">תחום העיסוק *</label>
              <input 
                type="text" 
                name="industry"
                value={formData.industry}
                onChange={handleInputChange}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
                placeholder="למשל: הייטק, אופנה, מזון, וכו'"
                required
              />
            </div>
            
            <div>
              <label className="block text-gray-200 mb-2">תיאור העסק</label>
              <textarea 
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
                placeholder="תאר את העסק שלך בקצרה"
                rows="4"
              ></textarea>
            </div>
            
            <div>
              <label className="block text-gray-200 mb-2">השירותים שהעסק מציע</label>
              <input
                type="text"
                name="services"
                value={formData.services}
                onChange={handleInputChange}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
                placeholder="רשימת השירותים שהעסק מציע (מופרדים בפסיקים)"
              />
            </div>
            
            <div>
              <label className="block text-gray-200 mb-2">פרטי קשר</label>
              <input 
                type="text"
                name="contact"
                value={formData.contact}
                onChange={handleInputChange}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
                placeholder="טלפון, אימייל"
              />
            </div>
            
            <div>
              <label className="block text-gray-200 mb-2">כתובת</label>
              <input 
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
                placeholder="כתובת העסק"
              />
            </div>
            
            <div>
              <label className="block text-gray-200 mb-2">שעות פעילות</label>
              <input 
                type="text"
                name="hours"
                value={formData.hours}
                onChange={handleInputChange}
                className="w-full p-3 rounded bg-gray-800 text-white border border-gray-700 focus:border-purple-500 focus:outline-none"
                placeholder="שעות פעילות העסק"
              />
            </div>
            
            <div className="flex justify-end">
              <button 
                type="submit"
                disabled={loading}
                className={`px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg shadow hover:from-purple-700 hover:to-pink-600 transition-all ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {loading ? 'שומר...' : 'שמור והמשך לנעמה'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

function App() {
  const { currentUser, loading } = useAuth();
  const [theme, setTheme] = useState(() => {
    // קריאת מצב הנושא מה-localStorage או שימוש בנושא ברירת מחדל 'בהיר'
    return localStorage.getItem('theme') || 'light';
  });

  // עדכון ה-HTML עם ערך הנושא הנוכחי
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // החלפת הנושא בין כהה לבהיר
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className="App min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Routes>
          <Route path="/login" element={
            currentUser ? <Navigate to="/" /> : <Login />
          } />
          
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="whatsapp" element={<WhatsAppConnect />} />
            <Route path="train" element={<TrainAgent />} />
            <Route path="conversations" element={<Conversations />} />
            <Route path="profile" element={<Profile />} />
            <Route path="train-with-conversations" element={<AITrainingWithConversations />} />
            <Route path="chat-training" element={<ChatTraining />} />
            <Route path="website-settings" element={
              <WebsiteProvider>
                <WebsiteSettings />
              </WebsiteProvider>
            } />
            <Route path="naama-talk" element={
              <WebsiteProvider>
                <AIProvider>
                  <NaamaTalk />
                </AIProvider>
              </WebsiteProvider>
            } />
            <Route path="business-setup" element={<BusinessSetup />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </ThemeContext.Provider>
  );
}

export default App; 