const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

// אתחול לקוח WhatsApp
router.post('/initialize', whatsappController.initializeClient);

// בדיקת סטטוס
router.get('/status/:userId', whatsappController.getStatus);

// שליחת הודעה
router.post('/send', whatsappController.sendMessage);

// התנתקות מהלקוח
router.post('/logout', whatsappController.logoutClient);

// ווב הוק לקבלת הודעות
router.post('/webhook', whatsappController.handleWebhook);

module.exports = router; 