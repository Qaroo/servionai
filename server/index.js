const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const whatsappRoutes = require('./routes/whatsappRoutes');
const { initializeFirebase } = require('./config/firebase');

// אתחול פיירבייס
initializeFirebase();

const app = express();
const PORT = process.env.PORT || 3001;

// מידלוורים
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// קבצים סטטיים - שרת קודם את תיקיית public בתוך server
app.use(express.static(path.join(__dirname, 'public')));

// קבצים סטטיים - שרת את תיקיית build של React
app.use(express.static(path.join(__dirname, '../build')));

// נתיבים לAPI
app.use('/api/whatsapp', whatsappRoutes);

// נתיב API ברירת מחדל
app.get('/api', (req, res) => {
  res.json({ message: 'WhatsApp SaaS API Server' });
});

// כל הנתיבים האחרים מובילים ל-index.html של React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build/index.html'));
});

// טיפול בשגיאות
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'אירעה שגיאה בשרת' 
  });
});

// הפעלת השרת
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// הוספת בדיקה תקופתית של החיבורים
setInterval(async () => {
  // כאן ניתן להוסיף לוגיקה שתבדוק את החיבורים הפעילים ותנסה לחבר מחדש כאלה שנותקו
  console.log('Checking WhatsApp connections status...');
}, 300000); // בדיקה כל 5 דקות 