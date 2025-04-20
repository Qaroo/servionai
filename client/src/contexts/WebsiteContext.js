import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

// יצירת Context חדש
const WebsiteContext = createContext();

// Hook לשימוש בקונטקסט
export const useWebsite = () => useContext(WebsiteContext);

// ספק הקונטקסט
export const WebsiteProvider = ({ children }) => {
  const { currentUser, getToken } = useAuth();
  const [websiteData, setWebsiteData] = useState({
    url: '',
    lastSyncDate: null,
    syncStatus: 'idle', // idle, syncing, success, error
    syncProgress: 0
  });
  const [websiteContent, setWebsiteContent] = useState({
    products: [],
    services: [],
    faq: [],
    aboutInfo: {}
  });
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

  // קבלת נתוני האתר
  const fetchWebsiteData = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.get(`/api/website/config`, config);

      if (response.data && response.data.success) {
        setWebsiteData(response.data.websiteData);
      }
    } catch (err) {
      console.error('Error fetching website data:', err);
      setError('שגיאה בטעינת נתוני האתר');
    } finally {
      setLoading(false);
    }
  };

  // עדכון כתובת האתר
  const updateWebsiteUrl = async (newUrl) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.put(`/api/website/config`, {
        url: newUrl
      }, config);

      if (response.data && response.data.success) {
        setWebsiteData(prev => ({
          ...prev,
          url: newUrl
        }));
        return true;
      }
    } catch (err) {
      console.error('Error updating website URL:', err);
      setError('שגיאה בעדכון כתובת האתר');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // התחלת תהליך סנכרון
  const startSync = async () => {
    try {
      setLoading(true);
      setError(null);
      setWebsiteData(prev => ({
        ...prev,
        syncStatus: 'syncing',
        syncProgress: 0
      }));

      const config = await getAuthConfig();
      const response = await axios.post(`/api/website/sync`, {}, config);

      if (response.data && response.data.success) {
        // אנחנו מתחילים לעקוב אחרי התקדמות הסנכרון
        trackSyncProgress();
        return true;
      }
    } catch (err) {
      console.error('Error starting website sync:', err);
      setError('שגיאה בהתחלת סנכרון האתר');
      setWebsiteData(prev => ({
        ...prev,
        syncStatus: 'error'
      }));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // מעקב אחרי התקדמות הסנכרון
  const trackSyncProgress = async () => {
    const checkProgress = async () => {
      try {
        const config = await getAuthConfig();
        const response = await axios.get(`/api/website/sync-status`, config);

        if (response.data) {
          const { status, progress } = response.data;
          
          setWebsiteData(prev => ({
            ...prev,
            syncStatus: status,
            syncProgress: progress,
            lastSyncDate: status === 'success' ? new Date() : prev.lastSyncDate
          }));

          // אם הסנכרון עדיין פעיל, נמשיך לבדוק
          if (status === 'syncing') {
            setTimeout(checkProgress, 2000);
          } else if (status === 'success') {
            // טעינת הנתונים מחדש
            fetchWebsiteContent();
          }
        }
      } catch (err) {
        console.error('Error tracking sync progress:', err);
        setWebsiteData(prev => ({
          ...prev,
          syncStatus: 'error'
        }));
      }
    };

    // התחלת הבדיקה הראשונה
    setTimeout(checkProgress, 1000);
  };

  // קבלת תוכן מהאתר (מוצרים, שירותים וכו')
  const fetchWebsiteContent = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.get(`/api/website/content`, config);

      if (response.data && response.data.success) {
        setWebsiteContent(response.data.content);
      }
    } catch (err) {
      console.error('Error fetching website content:', err);
      setError('שגיאה בטעינת תוכן האתר');
    } finally {
      setLoading(false);
    }
  };

  // עדכון ידני של מוצר או שירות
  const updateContentItem = async (itemType, itemId, updatedData) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.put(`/api/website/${itemType}/${itemId}`, updatedData, config);

      if (response.data && response.data.success) {
        // עדכון המידע בקונטקסט
        setWebsiteContent(prevContent => {
          const updatedItems = prevContent[itemType].map(item => 
            item.id === itemId ? { ...item, ...updatedData } : item
          );
          
          return {
            ...prevContent,
            [itemType]: updatedItems
          };
        });
        
        return true;
      }
    } catch (err) {
      console.error(`Error updating ${itemType}:`, err);
      setError(`שגיאה בעדכון ה${itemType === 'products' ? 'מוצר' : 'שירות'}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // טעינת נתוני האתר בהתחלה
  useEffect(() => {
    if (currentUser) {
      fetchWebsiteData();
      fetchWebsiteContent();
    }
  }, [currentUser]);

  const value = {
    websiteData,
    websiteContent,
    loading,
    error,
    updateWebsiteUrl,
    startSync,
    fetchWebsiteContent,
    updateContentItem
  };

  return (
    <WebsiteContext.Provider value={value}>
      {children}
    </WebsiteContext.Provider>
  );
};

export default WebsiteContext; 