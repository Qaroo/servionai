import OpenAI from 'openai';

// במקום לאחסן את המפתח בקוד, נשתמש בשרת שלנו כמתווך
// לא צריך מפתח API בצד הלקוח - כל הבקשות ל-OpenAI יעברו דרך השרת
const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001/api'
  : '/api';

/**
 * פונקציה לשליחת שאלה ל-AI דרך השרת
 * @param {string} prompt - השאלה שנשלחת ל-AI
 * @param {Array} context - היסטוריית השיחה (אופציונלי)
 * @returns {Promise<string>} - התשובה מה-AI
 */
export const getAIResponse = async (prompt, context = []) => {
  try {
    // שליחת הבקשה לשרת שלנו במקום ישירות ל-OpenAI
    const response = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        context
      }),
    });

    if (!response.ok) {
      throw new Error(`Error from server: ${response.status}`);
    }

    const data = await response.json();
    
    // החזרת התשובה מהשרת
    return data.response;
  } catch (error) {
    console.error('AI API error:', error);
    throw new Error('אירעה שגיאה בתקשורת עם מערכת ה-AI. אנא נסה שוב מאוחר יותר.');
  }
};

/**
 * פונקציה לאימון הבוט לפי פרטי העסק - גם דרך השרת
 * @param {Object} businessInfo - אובייקט המכיל פרטים על העסק
 * @returns {Promise<string>} - אישור מה-AI
 */
export const trainAgent = async (businessInfo) => {
  try {
    // שליחת בקשת האימון לשרת שלנו
    const response = await fetch(`${API_URL}/ai/train`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ businessInfo }),
    });

    if (!response.ok) {
      throw new Error(`Error from server: ${response.status}`);
    }

    const data = await response.json();
    return data.message || 'האימון הושלם בהצלחה';
  } catch (error) {
    console.error('AI training error:', error);
    throw new Error('אירעה שגיאה באימון הסוכן. אנא נסה שוב מאוחר יותר.');
  }
};

export default OpenAI; 