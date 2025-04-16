// הפניה לקובץ index.js בתיקיית server
console.log('Loading server directly...');
// נסה למצוא את הקובץ באופן דינמי
const path = require('path');
const fs = require('fs');

// בדוק אם קובץ index.js קיים בתיקיית server
const serverIndexPath = path.join(__dirname, 'server', 'index.js');
const serverPath = path.join(__dirname, 'index.js');

try {
  if (fs.existsSync(serverIndexPath)) {
    console.log('Found server at server/index.js');
    require('./server/index.js');
  } else if (fs.existsSync(serverPath)) {
    console.log('Found server at ./index.js');
    require('./index.js');
  } else {
    console.log('Server file not found, starting minimal server');
    // הגדר שרת מינימלי אם לא נמצא קובץ האינדקס
    const express = require('express');
    const app = express();
    const PORT = process.env.PORT || 3000;
    
    app.get('/', (req, res) => {
      res.send('Server is running, but server/index.js was not found.');
    });
    
    app.listen(PORT, () => {
      console.log(`Minimal server running on port ${PORT}`);
    });
  }
} catch (error) {
  console.error('Error loading server:', error);
} 