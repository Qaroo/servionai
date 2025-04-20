import { createContext } from 'react';

// ערך ברירת המחדל של הקונטקסט
export const ThemeContext = createContext({
  theme: 'light', // 'light' או 'dark'
  toggleTheme: () => {}, // פונקציה להחלפת ערך הנושא
}); 