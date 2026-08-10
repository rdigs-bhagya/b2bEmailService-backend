const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const ddb = new DynamoDBClient({ region: "us-east-1" });

/**
 * ENVIRONMENT CHECKS
 */
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SGEMAIL_TABLE = process.env.SGEMAIL_TABLE;

if (!SENDGRID_API_KEY) {
  throw new Error("Missing required environment variable: SENDGRID_API_KEY");
}

if (!SGEMAIL_TABLE) {
  throw new Error("Missing required environment variable: SGEMAIL_TABLE");
}

/**
 * SENDGRID CONFIG
 */
sgMail.setApiKey(SENDGRID_API_KEY);

/**
 * SENDER EMAIL
 */
const FROM_EMAIL = "raul@b2bnetworkservices.com";

/**
 * WEBSITE LINK
 */
const WEBSITE_LINK = "https://pmo.selecthub.com/rdigs-erp-software-executive-pricing-guide/";
const WEBSITE_KEY = "SELECTHUB_EXECUTIVE_GUIDE";
const EMAIL_SUBJECT = "Compare ERP Costs & Avoid Hidden Fees";

/**
 * EMAIL TEMPLATE
 */
const getEmailHtml = (recipientName) => `
<div style="font-family: Arial, sans-serif; color:#333; line-height:1.6;">
  <p>Hi ${recipientName || "Dear"},</p>

  <p>
    Thank you again for your time earlier. As promised, here's the guide we discussed: 👉 <a href="${WEBSITE_LINK}" target="_blank"><strong>Executive Pricing Guide ERP Software - 2026</strong></a>
  </p>

  <p>
    A colleague from SelectHub will be in touch shortly to follow up. In the meantime, please feel free to reach out if you have any questions.
  </p>

  <p>
    Best regards,<br/>
    Raul
  </p>

  <hr style="margin:30px 0;" />

  <p style="font-size:12px; color:#777;">
   <strong>Opt-Out Notice:</strong><br/> If you no longer wish to receive communications from us, you may opt out at any time by replying <strong>STOP</strong> or <strong><a href="https://www.b2bnetworkservices.com/wp-content/uploads/2025/12/B2B-Network-Services-Unsubscribe.html" target="_blank" style="color:inherit; text-decoration:none;">UNSUBSCRIBE</a></strong>, and no further messages will be sent.
  </p>

</div>
`;

/**
 * SEND EMAIL VIA SENDGRID
 */
const sendEmailSendGrid = async (req, res) => {
  try {
    const { toEmail, name } = req.body;
    const recipientName = name?.trim();

    if (!toEmail || !toEmail.includes("@")) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const msg = {
      to: toEmail,
      from: { email: FROM_EMAIL, name: "Raul Miller" },
      subject: EMAIL_SUBJECT,
      html: getEmailHtml(recipientName),
    };

    await sgMail.send(msg);

    // Save log
    await ddb.send(
      new PutCommand({
        TableName: process.env.SGEMAIL_TABLE,
        Item: {
          emailId: crypto.randomUUID(),
          provider: "SENDGRID",
          fromEmail: FROM_EMAIL,
          toEmail,
          websiteKey: WEBSITE_KEY,
          websiteLink: WEBSITE_LINK,
          status: "SENT",
          sentAt: new Date().toISOString(),
        },
      })
    );

    res.status(200).json({ message: "SendGrid email sent successfully" });
  } catch (error) {
    console.error("SENDGRID ERROR 👉", error.response?.body || error);

    res.status(500).json({
      message: "Failed to send email via SendGrid",
    });
  }
};

/**
 * OPTIONAL: GET ONLY SENDGRID EMAILS
 */
const getSendGridEmails = async (req, res) => {
  try {
    const limit = req.query.limit || 10;

    const response = await fetch(
      `https://api.sendgrid.com/v3/messages?limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: "Failed to fetch SendGrid emails",
        error: data,
      });
    }

    // Return only the messages array if preferred
    return res.status(200).json(data.messages || data);
  } catch (error) {
    console.error("SendGrid Error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { sendEmailSendGrid, getSendGridEmails };