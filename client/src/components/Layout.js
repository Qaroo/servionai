import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ThemeContext } from '../utils/ThemeContext';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  AcademicCapIcon,
  UserCircleIcon,
  MoonIcon,
  SunIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  BeakerIcon,
  GlobeAltIcon,
  ChatBubbleLeftEllipsisIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/outline';

/**
 * קומפוננטת תבנית ראשית לאפליקציה
 * כוללת סייד-בר, תפריט עליון ואיזור תוכן
 */
const Layout = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };
  
  // נתיבי הניווט בתפריט
  const navItems = [
    { name: 'דשבורד', path: '/', icon: HomeIcon },
    { name: 'חיבור WhatsApp', path: '/whatsapp', icon: PhoneIcon },
    { name: 'אימון הסוכן', path: '/train', icon: AcademicCapIcon },
    { name: 'אימון עם שיחות', path: '/train-with-conversations', icon: BeakerIcon },
    { name: 'אימון צ׳אט', path: '/chat-training', icon: ChatBubbleLeftEllipsisIcon },
    { name: 'שיחה עם נעמה', path: '/naama-talk', icon: SpeakerWaveIcon },
    { name: 'שיחות', path: '/conversations', icon: ChatBubbleLeftRightIcon },
    { name: 'אתר העסק', path: '/website-settings', icon: GlobeAltIcon },
    { name: 'פרופיל', path: '/profile', icon: UserCircleIcon },
  ];
  
  return (
    <ThemeContext.Consumer>
      {({ theme, toggleTheme }) => (
        <div className="flex h-screen overflow-hidden">
          {/* סייד-בר למובייל */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75" 
                   onClick={() => setSidebarOpen(false)}></div>
              <div className="fixed inset-y-0 right-0 flex max-w-full pl-16">
                <div className="relative w-screen max-w-xs">
                  <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-gray-800 py-5 shadow-xl">
                    <div className="px-4 pb-6 flex items-center justify-between">
                      <h2 className="text-lg font-semibold">ServionAI</h2>
                      <button 
                        className="rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                        onClick={() => setSidebarOpen(false)}>
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>
                    {renderNavItems(navItems, location.pathname)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* סייד-בר קבוע למסכים גדולים */}
          <div className="hidden lg:flex lg:flex-shrink-0">
            <div className="flex w-64 flex-col">
              <div className="flex h-0 flex-1 flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                  <div className="flex items-center flex-shrink-0 px-4">
                    <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400">ServionAI</h1>
                  </div>
                  <nav className="mt-5 flex-1 px-2 space-y-1">
                    {renderNavItems(navItems, location.pathname)}
                  </nav>
                </div>

                {/* פרופיל ותפריט תחתון */}
                <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center">
                    <img 
                      src={currentUser.photoURL || 'https://via.placeholder.com/40'} 
                      alt={currentUser.displayName || 'User'} 
                      className="h-9 w-9 rounded-full"
                    />
                    <div className="mr-3">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {currentUser.displayName || 'משתמש'}
                      </p>
                      <button
                        onClick={handleLogout}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 flex items-center mt-1"
                      >
                        <ArrowRightOnRectangleIcon className="h-3 w-3 ml-1" />
                        התנתק
                      </button>
                    </div>

                    {/* כפתור החלפת ערכת נושא */}
                    <button
                      onClick={toggleTheme}
                      className="ml-auto p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {theme === 'light' ? (
                        <MoonIcon className="h-5 w-5" />
                      ) : (
                        <SunIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* אזור תוכן ראשי */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* כותרת עליונה */}
            <div className="relative z-10 flex-shrink-0 flex h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 lg:border-none">
              <button
                className="px-4 border-l border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="sr-only">פתח תפריט</span>
                <Bars3Icon className="h-6 w-6" />
              </button>
              
              <div className="flex-1 px-4 flex justify-between">
                <div className="flex-1 flex items-center">
                  <h1 className="text-xl font-bold text-primary-600 dark:text-primary-400 lg:hidden">
                    ServionAI
                  </h1>
                </div>
                <div className="ml-4 flex items-center lg:hidden">
                  <button
                    onClick={toggleTheme}
                    className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {theme === 'light' ? (
                      <MoonIcon className="h-5 w-5" />
                    ) : (
                      <SunIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* תוכן הדף */}
            <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 lg:p-8">
              <Outlet />
            </main>
          </div>
        </div>
      )}
    </ThemeContext.Consumer>
  );
};

// פונקציה עזר לרינדור של פריטי הניווט
function renderNavItems(items, currentPath) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive = currentPath === item.path;
        const Icon = item.icon;
        
        return (
          <Link
            key={item.name}
            to={item.path}
            className={`
              group flex items-center px-3 py-2 text-sm font-medium rounded-md
              ${isActive 
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-200' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}
            `}
          >
            <Icon 
              className={`
                ml-3 h-5 w-5 flex-shrink-0
                ${isActive 
                  ? 'text-primary-600 dark:text-primary-300' 
                  : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'}
              `}
            />
            {item.name}
          </Link>
        );
      })}
    </div>
  );
}

export default Layout; 