import React, { useState, useEffect } from 'react';
import { useWebsite } from '../contexts/WebsiteContext';
import { 
  GlobeAltIcon, 
  ArrowPathIcon, 
  CheckIcon, 
  XMarkIcon,
  PencilIcon,
  LinkIcon,
  DocumentTextIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

const WebsiteSettings = () => {
  const {
    websiteData,
    websiteContent,
    loading,
    error,
    updateWebsiteUrl,
    startSync,
    syncProgress,
    isSyncing,
    fetchWebsiteContent,
    updateContentItem
  } = useWebsite();

  const [url, setUrl] = useState('');
  const [showContentList, setShowContentList] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editedContent, setEditedContent] = useState('');
  const [selectedContentType, setSelectedContentType] = useState('products');

  // עדכון ה-URL המקומי כשנטען מידע מהשרת
  useEffect(() => {
    if (websiteData?.url) {
      setUrl(websiteData.url);
    }
  }, [websiteData]);

  // שמירת כתובת האתר
  const handleSaveUrl = async () => {
    try {
      await updateWebsiteUrl(url);
    } catch (err) {
      console.error('Failed to save website URL:', err);
    }
  };

  // התחלת סנכרון עם האתר
  const handleStartSync = async () => {
    try {
      await startSync();
    } catch (err) {
      console.error('Failed to start sync:', err);
    }
  };

  // עריכת פריט תוכן
  const handleEditItem = (item) => {
    setEditingItem(item);
    setEditedContent(item.content);
  };

  // שמירת עריכת פריט
  const handleSaveEdit = async () => {
    try {
      await updateContentItem(editingItem.id, editedContent);
      setEditingItem(null);
      setEditedContent('');
    } catch (err) {
      console.error('Failed to update content item:', err);
    }
  };

  // סינון התוכן לפי סוג
  const filteredContent = websiteContent?.filter(item => item.type === selectedContentType) || [];

  // הצגת רשימת תוכן האתר
  const renderContentItems = () => {
    if (!filteredContent || filteredContent.length === 0) {
      return (
        <div className="text-center p-4 text-gray-500">
          לא נמצא תוכן מסוג {selectedContentType}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredContent.map((item) => (
          <div
            key={item.id}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-medium text-lg">{item.title || item.name || 'ללא כותרת'}</h3>
                {item.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {item.description}
                  </p>
                )}
                {item.price && (
                  <p className="text-sm font-medium text-primary-600 dark:text-primary-400 mt-1">
                    {typeof item.price === 'number' ? `₪${item.price.toFixed(2)}` : item.price}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleEditItem(item)}
                className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <PencilIcon className="h-5 w-5" />
              </button>
            </div>
            {item.imageUrl && (
              <div className="mt-2 mb-3">
                <img
                  src={item.imageUrl}
                  alt={item.title || item.name}
                  className="h-40 w-auto object-cover rounded-md"
                />
              </div>
            )}
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {item.content.substring(0, 150)}
              {item.content.length > 150 ? '...' : ''}
            </div>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-primary-600 dark:text-primary-400 text-sm mt-2"
              >
                <LinkIcon className="h-4 w-4 ml-1" />
                צפה באתר
              </a>
            )}
          </div>
        ))}
      </div>
    );
  };

  // הצגת סטטוס סנכרון
  const renderSyncStatus = () => {
    if (isSyncing) {
      return (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
          <div className="flex items-center mb-2">
            <ArrowPathIcon className="h-5 w-5 text-blue-500 dark:text-blue-400 ml-2 animate-spin" />
            <span className="font-medium">מסנכרן נתונים מהאתר...</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${syncProgress || 0}%` }}
            ></div>
          </div>
          <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
            הסנכרון עלול להימשך מספר דקות, בהתאם לגודל האתר
          </p>
        </div>
      );
    }

    if (websiteData?.lastSync) {
      return (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900 rounded-lg">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 text-green-500 dark:text-green-400 ml-2" />
            <span>
              סנכרון אחרון: {new Date(websiteData.lastSync).toLocaleString()}
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  // סוגי תוכן אפשריים
  const contentTypes = [
    { id: 'products', name: 'מוצרים', icon: <DocumentTextIcon className="h-5 w-5" /> },
    { id: 'services', name: 'שירותים', icon: <DocumentTextIcon className="h-5 w-5" /> },
    { id: 'pages', name: 'עמודים', icon: <DocumentTextIcon className="h-5 w-5" /> },
    { id: 'posts', name: 'פוסטים', icon: <DocumentTextIcon className="h-5 w-5" /> },
  ];

  return (
    <div className="container mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-5xl mx-auto">
        <div className="flex items-center mb-6">
          <GlobeAltIcon className="h-7 w-7 text-primary-600 dark:text-primary-400 ml-2" />
          <h1 className="text-2xl font-bold">הגדרות אתר העסק</h1>
        </div>

        {/* הגדרת כתובת האתר */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">כתובת אתר העסק</h2>
          <div className="flex flex-wrap md:flex-nowrap">
            <div className="flex-1 mb-3 md:mb-0 md:ml-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.yourbusiness.com"
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <button
              onClick={handleSaveUrl}
              disabled={loading || !url}
              className={`px-4 py-3 rounded-lg font-medium ${
                !url
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              שמור כתובת
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            שימו לב: הכתובת צריכה להיות מלאה וכוללת פרוטוקול (http:// או https://)
          </p>
        </div>

        {/* סנכרון תוכן */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">סנכרון תוכן האתר</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            לחץ על הכפתור למטה כדי לסנכרן את כל המידע מאתר העסק. המערכת תייבא מוצרים, שירותים, עמודים ופוסטים מהאתר.
          </p>
          
          <button
            onClick={handleStartSync}
            disabled={loading || isSyncing || !websiteData?.url}
            className={`px-4 py-3 rounded-lg font-medium flex items-center ${
              loading || isSyncing || !websiteData?.url
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            {isSyncing ? (
              <ArrowPathIcon className="h-5 w-5 ml-2 animate-spin" />
            ) : (
              <ArrowPathIcon className="h-5 w-5 ml-2" />
            )}
            {isSyncing ? 'מסנכרן...' : 'התחל סנכרון'}
          </button>

          {renderSyncStatus()}
        </div>

        {/* ניהול תוכן */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">תוכן מהאתר</h2>
            <button
              onClick={() => setShowContentList(!showContentList)}
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
            >
              {showContentList ? (
                <>
                  <span>הסתר</span>
                  <ChevronDownIcon className="h-5 w-5 mr-1" />
                </>
              ) : (
                <>
                  <span>הצג</span>
                  <ChevronRightIcon className="h-5 w-5 mr-1" />
                </>
              )}
            </button>
          </div>

          {showContentList && (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {contentTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedContentType(type.id)}
                    className={`px-4 py-2 rounded-lg flex items-center ${
                      selectedContentType === type.id
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {type.icon}
                    <span className="mr-2">{type.name}</span>
                  </button>
                ))}
              </div>

              {renderContentItems()}
            </>
          )}
        </div>
      </div>

      {/* חלון עריכת פריט */}
      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                עריכת {editingItem.title || editingItem.name || 'פריט'}
              </h2>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white mb-4"
              rows={10}
            />

            <div className="flex justify-end">
              <button
                onClick={() => setEditingItem(null)}
                className="mr-2 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ביטול
              </button>
              <button
                onClick={handleSaveEdit}
                className="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-md flex items-center"
              >
                <CheckIcon className="h-5 w-5 ml-1" />
                שמור שינויים
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

export default WebsiteSettings; 