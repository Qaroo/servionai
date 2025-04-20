import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

// יצירת קונטקסט לאותנטיקציה
const AuthContext = createContext();

// הוק לשימוש בקונטקסט
export const useAuth = () => useContext(AuthContext);

// ספק הקונטקסט
export const AuthProvider = ({ children }) => {
  // סטייט לשמירת המשתמש הנוכחי
  const [currentUser, setCurrentUser] = useState(null);
  // סטייט לשמירת סטטוס טעינה
  const [loading, setLoading] = useState(true);
  // סטייט לשמירת הודעות שגיאה
  const [error, setError] = useState('');

  // פונקציה להתחברות באמצעות Google
  const loginWithGoogle = async () => {
    try {
      setError('');
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // בדיקה האם המשתמש כבר קיים במערכת
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      // אם המשתמש לא קיים, נוסיף אותו למסד הנתונים
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          settings: {
            language: 'he',
            theme: 'light',
          }
        });
      } else {
        // עדכון מועד התחברות אחרון
        await setDoc(userDocRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
      }
      
      return user;
    } catch (error) {
      console.error('Google login error:', error);
      setError('אירעה שגיאה בהתחברות עם Google. אנא נסה שוב.');
      throw error;
    }
  };

  // פונקציה להתנתקות
  const logout = async () => {
    try {
      setError('');
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      setError('אירעה שגיאה בהתנתקות. אנא נסה שוב.');
      throw error;
    }
  };

  // פונקציה לקבלת טוקן אימות
  const getToken = async () => {
    try {
      if (currentUser) {
        if (currentUser.getIdToken) {
          // במצב ייצור - קבל טוקן אמיתי
          return await currentUser.getIdToken();
        } else {
          // במצב פיתוח - החזר טוקן דמה
          console.log('Development mode: returning mock token');
          return `dev-token-${currentUser.uid || 'test-user'}`;
        }
      }
      
      // אם אין משתמש מחובר, החזר טוקן פיתוח
      console.log('No authenticated user, returning development token');
      return 'dev-token-test-user';
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw error;
    }
  };

  // אפקט לטיפול בשינויים במצב האותנטיקציה
  useEffect(() => {
    // הרשמה לאירועי שינוי מצב אותנטיקציה
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    // ניקוי ההרשמה בעת פירוק הקומפוננטה
    return unsubscribe;
  }, []);

  // ערך הקונטקסט
  const value = {
    currentUser,
    loginWithGoogle,
    logout,
    getToken,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 