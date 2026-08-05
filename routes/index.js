const express = require('express');
// const { sendEmail, getEmails } = require('../controllers/sendEmail');
// NEW (sendgrid)
const {
  sendEmailSendGrid,
  getSendGridEmails,
} = require("../controllers/sendEmailSendGrid");

const router = express.Router();
 
// router.post('/sendEmail', sendEmail);
// router.get('/getEmails', getEmails); 

// SendGrid routes (NEW)
router.post("/sendEmailSendGrid", sendEmailSendGrid);
router.get("/getSendGridEmails", getSendGridEmails);

module.exports = router;