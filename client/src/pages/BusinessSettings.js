import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../utils/api';

const BusinessSettings = () => {
  const { currentUser } = useAuth();
  const [businessInfo, setBusinessInfo] = useState({
    name: '',
    description: '',
    industry: '',
    services: '',
    hours: '',
    contact: '',
    address: '',
    additionalInfo: '',
    website: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Fetch business info on component mount
  useEffect(() => {
    const fetchBusinessInfo = async () => {
      setIsLoading(true);
      try {
        const token = await currentUser.getIdToken();
        const response = await axios.get(`${API_BASE_URL}/business/info`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data) {
          setBusinessInfo(response.data);
        }
      } catch (error) {
        console.error('Error fetching business info:', error);
        toast.error('שגיאה בטעינת פרטי העסק');
      } finally {
        setIsLoading(false);
      }
    };

    if (currentUser) {
      fetchBusinessInfo();
    }
  }, [currentUser]);

  // Check if all required fields are filled
  const isFormValid = () => {
    return (
      businessInfo.name.trim() !== '' &&
      businessInfo.description.trim() !== '' &&
      businessInfo.industry.trim() !== '' &&
      businessInfo.services.trim() !== ''
    );
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBusinessInfo(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save business info
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const token = await currentUser.getIdToken();
      await axios.post(`${API_BASE_URL}/business/info`, businessInfo, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      toast.success('פרטי העסק נשמרו בהצלחה');
    } catch (error) {
      console.error('Error saving business info:', error);
      toast.error('שגיאה בשמירת פרטי העסק');
    } finally {
      setIsSaving(false);
    }
  };

  // Train AI agent with business info
  const handleTrainAgent = async () => {
    setIsSaving(true);
    try {
      const token = await currentUser.getIdToken();
      await axios.post(`${API_BASE_URL}/ai/train`, businessInfo, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      toast.success('האימון התחיל בהצלחה. זה עשוי לקחת מספר דקות');
      // Check status automatically after training starts
      setTimeout(checkTrainingStatus, 2000);
    } catch (error) {
      console.error('Error training agent:', error);
      toast.error('שגיאה באימון הסוכן');
    } finally {
      setIsSaving(false);
    }
  };

  // Check training status
  const checkTrainingStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await axios.get(`${API_BASE_URL}/ai/training-status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setTrainingStatus(response.data);
      toast.success('סטטוס האימון התקבל בהצלחה');
    } catch (error) {
      console.error('Error checking training status:', error);
      toast.error('שגיאה בבדיקת סטטוס האימון');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 animate-fadeIn">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          פרטי העסק שלך
        </h1>
        
        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              שם העסק <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={businessInfo.name}
              onChange={handleInputChange}
              className="input-field"
              placeholder="הזן את שם העסק"
              required
            />
          </div>
          
          <div>
            <label htmlFor="industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תחום עיסוק <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="industry"
              name="industry"
              value={businessInfo.industry}
              onChange={handleInputChange}
              className="input-field"
              placeholder="לדוגמה: אדריכלות, עיצוב פנים, מסעדנות"
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              תיאור העסק <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              value={businessInfo.description}
              onChange={handleInputChange}
              rows="4"
              className="input-field"
              placeholder="תאר את העסק שלך, ההיסטוריה שלו, החזון והערכים"
              required
            />
          </div>
          
          <div>
            <label htmlFor="services" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              שירותים <span className="text-red-500">*</span>
            </label>
            <textarea
              id="services"
              name="services"
              value={businessInfo.services}
              onChange={handleInputChange}
              rows="4"
              className="input-field"
              placeholder="פרט את השירותים שהעסק שלך מציע, תמחור, ומידע רלוונטי עליהם"
              required
            />
          </div>
          
          <div>
            <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              שעות פעילות
            </label>
            <input
              type="text"
              id="hours"
              name="hours"
              value={businessInfo.hours}
              onChange={handleInputChange}
              className="input-field"
              placeholder="לדוגמה: א'-ה' 9:00-18:00, ו' 9:00-14:00"
            />
          </div>
          
          <div>
            <label htmlFor="contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              פרטי קשר
            </label>
            <input
              type="text"
              id="contact"
              name="contact"
              value={businessInfo.contact}
              onChange={handleInputChange}
              className="input-field"
              placeholder="טלפון, אימייל, רשתות חברתיות"
            />
          </div>
          
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              כתובת
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={businessInfo.address}
              onChange={handleInputChange}
              className="input-field"
              placeholder="הכנס את כתובת העסק"
            />
          </div>
          
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              אתר אינטרנט
            </label>
            <input
              type="url"
              id="website"
              name="website"
              value={businessInfo.website}
              onChange={handleInputChange}
              className="input-field"
              placeholder="https://www.example.com"
            />
          </div>
          
          <div>
            <label htmlFor="additionalInfo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              מידע נוסף
            </label>
            <textarea
              id="additionalInfo"
              name="additionalInfo"
              value={businessInfo.additionalInfo}
              onChange={handleInputChange}
              rows="4"
              className="input-field"
              placeholder="כל מידע נוסף שתרצה שהסוכן ידע על העסק שלך"
            />
          </div>
        </div>
        
        {/* Save button */}
        <div className="mt-6">
          <button
            className="btn-primary w-full"
            onClick={handleSave}
            disabled={isSaving || isLoading || !isFormValid()}
          >
            {isSaving ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                שומר...
              </div>
            ) : (
              'שמור פרטי עסק'
            )}
          </button>
        </div>

        {/* Train agent and check status buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-8 gap-4">
          <button
            className="btn-primary w-full sm:w-auto"
            onClick={handleTrainAgent}
            disabled={isSaving || isLoading || !isFormValid()}
          >
            {isSaving ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                מאמן את הסוכן...
              </div>
            ) : (
              'אמן את הסוכן שלי'
            )}
          </button>
          
          <button
            className="btn-secondary w-full sm:w-auto"
            onClick={checkTrainingStatus}
            disabled={isCheckingStatus}
          >
            {isCheckingStatus ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                בודק סטטוס...
              </div>
            ) : (
              'בדוק סטטוס אימון'
            )}
          </button>
        </div>

        {/* Training status display */}
        {trainingStatus && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-medium mb-2">סטטוס האימון</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center">
                <span className="font-medium ml-2">מצב:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  trainingStatus.status === 'trained' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' :
                  trainingStatus.status === 'training' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                  'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'
                }`}>
                  {trainingStatus.status === 'trained' ? 'מאומן' :
                   trainingStatus.status === 'training' ? 'באימון' : 
                   trainingStatus.status === 'untrained' ? 'לא מאומן' : 'שגיאה'}
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-medium ml-2">מידע עסקי קיים:</span>
                <span className={trainingStatus.businessInfoExists ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {trainingStatus.businessInfoExists ? 'כן' : 'לא'}
                </span>
              </div>
              {trainingStatus.businessInfo && (
                <>
                  <div className="flex items-center">
                    <span className="font-medium ml-2">שם עסק:</span>
                    <span>{trainingStatus.businessInfo.name || 'לא הוגדר'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium ml-2">תחום:</span>
                    <span>{trainingStatus.businessInfo.industry || 'לא הוגדר'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium ml-2">תיאור:</span>
                    <span>{trainingStatus.businessInfo.hasDescription ? 'קיים' : 'חסר'}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium ml-2">שירותים:</span>
                    <span>{trainingStatus.businessInfo.hasServices ? 'קיימים' : 'חסרים'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessSettings; 