# ServionAI - סוכן AI לניהול WhatsApp לעסקים

<div dir="rtl">

## 🧩 מה זה ServionAI?

מערכת SaaS שמאפשרת לבעל עסק להפעיל סוכן AI שחובר לחשבון WhatsApp. הלקוח סורק ברקוד ומחבר את החשבון שלו, מאמן את הסוכן דרך צ'אט בעברית, והמערכת לומדת את אופי העסק שלו דרך שאלות ודיאלוג. המערכת תשמור את המידע ותאפשר לסוכן לענות אוטומטית על כל הודעה שמתקבלת בווטסאפ.

## 🚀 יכולות עיקריות

- **חיבור WhatsApp**: התחברות פשוטה באמצעות QR קוד
- **אימון AI**: צ'אט אינטואיטיבי לאימון הסוכן לפי צרכי העסק
- **מענה אוטומטי**: הסוכן עונה ללקוחות בצורה אוטומטית
- **ניהול שיחות**: צפייה וניהול כל השיחות במקום אחד
- **ממשק בעברית**: תמיכה מלאה בעברית ו-RTL

## 💻 טכנולוגיות

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore
- **Authentication**: Firebase Google Login
- **AI**: OpenAI API
- **WhatsApp**: whatsapp-web.js

## 📂 מבנה הפרויקט

הפרויקט בנוי משני חלקים עיקריים:

```
servionai/
├── client/       # React app (Hebrew, RTL)
│   ├── src/
│   │   ├── components/    # קומפוננטות React
│   │   ├── contexts/      # Context API עבור מצב המערכת
│   │   ├── pages/         # דפי האפליקציה השונים
│   │   ├── services/      # שירותים (Firebase, OpenAI)
│   │   ├── utils/         # פונקציות עזר
│   │   └── styles/        # סגנונות CSS
│   ├── firebase.js        # קונפיגורציית Firebase
│   └── ...
├── server/       # Node.js + whatsapp-web.js
│   ├── routes/           # נתיבי API
│   ├── services/         # שירותים (WhatsApp, OpenAI, Firebase)
│   ├── middleware/       # Middleware של Express
│   └── index.js          # נקודת כניסה של השרת
├── .env
└── README.md
```

</div>

## 🔧 Installation & Setup

### Prerequisites
- Node.js (v14+)
- npm or yarn
- Firebase account with Firestore enabled
- OpenAI API key
- WhatsApp account (for connecting to the agent)

### Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/servionai.git
cd servionai
```

2. Setup client
```bash
# Install client dependencies
cd client
npm install

# Create .env file
cp .env.example .env
# Edit .env with your Firebase config
```

3. Setup server
```bash
# Install server dependencies
cd ../server
npm install

# Create .env file
cp .env.example .env
# Edit .env with your OpenAI API key and Firebase service account
```

4. Start the development servers
```bash
# Start the client (in client directory)
npm start

# Start the server (in server directory)
npm run dev
```

5. Open the application
Open your browser and go to `http://localhost:3000`

## 🛠️ Setup Firebase

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Google Authentication
3. Create a Firestore database
4. Get your Firebase config and add it to the client
5. Generate a service account key and add it to the server .env file

## 📱 Contact

For questions or support, please contact support@servionai.com 