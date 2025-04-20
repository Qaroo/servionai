import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { ThemeContext } from '../utils/ThemeContext';

const Login = () => {
  const { loginWithGoogle, error: authError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      await loginWithGoogle();
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      setError('אירעה שגיאה בהתחברות. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeContext.Consumer>
      {({ theme, toggleTheme }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
          <div className="absolute top-4 left-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
          </div>
          
          <div className="max-w-md w-full space-y-8">
            <div>
              <h1 className="text-center text-4xl font-extrabold text-primary-600 dark:text-primary-400">
                ServionAI
              </h1>
              <h2 className="mt-6 text-center text-2xl font-bold text-gray-800 dark:text-gray-200">
                ברוכים הבאים למערכת ServionAI
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                הסוכן האישי שלך לניהול WhatsApp
              </p>
            </div>
            
            <div className="mt-8 space-y-6">
              {loading ? (
                <LoadingSpinner message="מתחבר..." />
              ) : (
                <div>
                  <button
                    onClick={handleGoogleLogin}
                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                      <svg className="h-5 w-5 text-primary-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                        <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
                      </svg>
                    </span>
                    התחבר עם Google
                  </button>
                  
                  {(error || authError) && (
                    <div className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
                      {error || authError}
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-6">
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                  למערכת ServionAI לניהול WhatsApp לעסקים.
                  <br />
                  באמצעות AI מתקדם, הסוכן שלך ילמד את העסק שלך ויענה ללקוחות באופן אוטומטי.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </ThemeContext.Consumer>
  );
};

export default Login; 