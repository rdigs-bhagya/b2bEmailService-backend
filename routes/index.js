const express = require('express');
const {
  sendEmailSendGrid,
  getSendGridEmails,
  getDashboardEmailSummary,
  loginUser,
  signupUser,
} = require("../controllers/sendEmailSendGrid");

const router = express.Router();

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const expectedToken = process.env.API_AUTH_TOKEN || "";

  if (!expectedToken) {
    return next();
  }

  if (authHeader.startsWith("Bearer ") && authHeader.slice(7) === expectedToken) {
    return next();
  }

  return res.status(401).json({ message: "Unauthorized" });
};

router.post("/login", loginUser);
router.post("/signup", signupUser);
router.post("/sendEmailSendGrid", requireAuth, sendEmailSendGrid);
router.get("/getSendGridEmails", requireAuth, getSendGridEmails);
router.get("/getDashboardEmailSummary", requireAuth, getDashboardEmailSummary);

module.exports = router;