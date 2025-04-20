import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * קומפוננטה שמגנה על נתיבים לא מורשים
 * אם המשתמש לא מחובר, הוא יועבר לדף ההתחברות
 */
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  
  return currentUser ? children : <Navigate to="/login" />;
};

export default PrivateRoute; 