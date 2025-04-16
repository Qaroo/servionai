const express = require('express');
const router = express.Router();
const phoneController = require('../controllers/phoneController');

// קבלת כל מספרי הטלפון של משתמש
router.get('/phones/:userId', phoneController.getUserPhones);

// קבלת פרטי מספר טלפון ספציפי
router.get('/phone/:phoneId', phoneController.getPhoneDetails);

// הוספת מספר טלפון חדש
router.post('/register-phone', phoneController.registerPhone);

// עדכון פרטי מספר טלפון
router.put('/update-phone/:phoneId', phoneController.updatePhone);

// מחיקת מספר טלפון
router.delete('/delete-phone/:phoneId', phoneController.deletePhone);

module.exports = router; 