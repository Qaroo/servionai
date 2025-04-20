import OpenAI from 'openai';

// OpenAI API key - בסביבת ייצור נשמור זאת בשרת, לא בצד לקוח
const OPENAI_API_KEY = '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';

// יצירת מופע של OpenAI API
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // שים לב: בסביבת ייצור המפתח יהיה בשרת בלבד
});

/**
 * פונקציה לשליחת שאלה ל-OpenAI וקבלת תשובה
 * @param {string} prompt - השאלה שנשלחת ל-AI
 * @param {Array} context - היסטוריית השיחה (אופציונלי)
 * @returns {Promise<string>} - התשובה מה-AI
 */
export const getAIResponse = async (prompt, context = []) => {
  try {
    // מבנה ההיסטוריה שנשלחת ל-OpenAI
    const messages = [
      { role: 'system', content: 'אתה סוכן וירטואלי של עסק ישראלי. אתה עונה בעברית בלבד ומסייע ללקוחות בצורה מקצועית ואדיבה.' },
      ...context,
      { role: 'user', content: prompt }
    ];

    // שליחת הבקשה ל-OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    // החזרת התשובה
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('אירעה שגיאה בתקשורת עם מערכת ה-AI. אנא נסה שוב מאוחר יותר.');
  }
};

/**
 * פונקציה לאימון הבוט לפי פרטי העסק
 * @param {Object} businessInfo - אובייקט המכיל פרטים על העסק
 * @returns {Promise<string>} - אישור מה-AI
 */
export const trainAgent = async (businessInfo) => {
  try {
    const prompt = `
      אני רוצה שתלמד את המידע הבא על העסק שלי:
      
      שם העסק: ${businessInfo.name}
      תחום עיסוק: ${businessInfo.industry}
      מוצרים/שירותים: ${businessInfo.services}
      שעות פעילות: ${businessInfo.hours}
      פרטי קשר: ${businessInfo.contact}
      מידע נוסף: ${businessInfo.additionalInfo}
      
      אני רוצה שתשמש כנציג שירות לקוחות וירטואלי שעונה ללקוחות בווטסאפ. 
      כשלקוחות פונים, ענה בצורה מקצועית, אדיבה ומותאמת לעסק שלי.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'אתה מערכת AI שלומדת לייצג עסקים בשיחות עם לקוחות.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI training error:', error);
    throw new Error('אירעה שגיאה באימון הסוכן. אנא נסה שוב מאוחר יותר.');
  }
};

export default openai; 