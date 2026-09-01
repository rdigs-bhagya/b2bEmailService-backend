const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const bcrypt = require("bcryptjs");

const ddb = new DynamoDBClient({ region: "us-east-1" });

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const SGEMAIL_TABLE = process.env.SGEMAIL_TABLE || "";
const USERS_TABLE = process.env.USERS_TABLE || "b2b_users";
const FROM_EMAIL = process.env.SENDER_EMAIL || "raul@b2bnetworkservices.com";
const WEBSITES = {
  SELECTHUB_EXECUTIVE_GUIDE: {
    link: "https://pmo.selecthub.com/rdigs-erp-software-executive-pricing-guide/",
    subject: "Compare ERP Costs & Avoid Hidden Fees",
    title: "Executive Pricing Guide ERP Software - 2026"
  },
  SELECTHUB_CRM_GUIDE: {
    link: "https://www.b2bnetworkservices.com/wp-content/uploads/2026/07/From-Detection-to-Prevention.pdf",
    subject: "From Detection to Prevention: Why the future of Brand Protection starts before infringement happens",
    title: "From Detection to Prevention"
  }
};
const DEFAULT_WEBSITE_KEY = "SELECTHUB_EXECUTIVE_GUIDE";

const configureSendGrid = () => {
  if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
  }
};

configureSendGrid();

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Fetch user from DynamoDB
    const result = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { email: normalizedEmail }
      })
    );

    const user = result.Item;

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate a simple token (in production, use JWT)
    const expectedToken = process.env.API_AUTH_TOKEN || process.env.LOGIN_TOKEN || "rdigs-dashboard-token";

    return res.status(200).json({
      message: "Login successful",
      token: expectedToken,
      user: {
        email: user.email,
        name: user.name || "User",
      },
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

const signupUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await ddb.send(
      new GetCommand({
        TableName: USERS_TABLE,
        Key: { email: normalizedEmail }
      })
    );

    if (existingUser.Item) {
      return res.status(409).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user
    await ddb.send(
      new PutCommand({
        TableName: USERS_TABLE,
        Item: {
          email: normalizedEmail,
          passwordHash,
          createdAt: new Date().toISOString()
        }
      })
    );

    return res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({ message: "Signup failed" });
  }
};

const getEmailHtml = (recipientName, website) => `
<div style="font-family: Arial, sans-serif; color:#333; line-height:1.6;">
  <p>Hi ${recipientName || "Dear"},</p>

  <p>
    Thank you again for your time earlier. As promised, here’s the guide we discussed: 👉 <a href="${website.link}" target="_blank"><strong>${website.title}</strong></a>
  </p>

  <p>
    A colleague from Corsearch will be in touch shortly to follow up. In the meantime, please feel free to reach out if you have any questions.
  </p>

  <p>
    Regards,<br/>
    Raul Miller
  </p>

  <hr style="margin:30px 0;" />

  <p style="font-size:12px; color:#777;">
   <strong>Opt-Out Notice:</strong><br/> If you no longer wish to receive communications from us, you may opt out at any time by replying <strong>STOP</strong> or <strong><a href="https://www.b2bnetworkservices.com/wp-content/uploads/2025/12/B2B-Network-Services-Unsubscribe.html" target="_blank" style="color:inherit; text-decoration:none;">UNSUBSCRIBE</a></strong>, and no further messages will be sent.
  </p>

</div>
`;

const sendEmailSendGrid = async (req, res) => {
  try {
    if (!SENDGRID_API_KEY) {
      return res.status(500).json({ message: "SendGrid API key is not configured" });
    }

    if (!SGEMAIL_TABLE) {
      return res.status(500).json({ message: "Email table is not configured" });
    }

    const { toEmail, name, websiteKey } = req.body;
    const recipientName = name?.trim();

    const selectedKey = websiteKey && WEBSITES[websiteKey] ? websiteKey : DEFAULT_WEBSITE_KEY;
    const website = WEBSITES[selectedKey];

    if (!toEmail || !toEmail.includes("@")) {
      return res.status(400).json({ message: "Invalid email" });
    }

    const msg = {
      to: toEmail,
      from: { email: FROM_EMAIL, name: "Raul Miller" },
      subject: website.subject,
      html: getEmailHtml(recipientName, website),
    };

    await sgMail.send(msg);

    await ddb.send(
      new PutCommand({
        TableName: SGEMAIL_TABLE,
        Item: {
          emailId: crypto.randomUUID(),
          provider: "SENDGRID",
          fromEmail: FROM_EMAIL,
          toEmail,
          subject: website.subject,
          websiteKey: selectedKey,
          websiteLink: website.link,
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

const normalizeEmailStatus = (status) => {
  const normalizedStatus = (status || "").toString().toLowerCase();

  if (["sent", "delivered", "success", "completed"].includes(normalizedStatus)) {
    return "sent";
  }

  if (["pending", "queued", "processing", "in_progress"].includes(normalizedStatus)) {
    return "pending";
  }

  return "failed";
};

const getDashboardEmailSummary = async (req, res) => {
  const defaultStats = {
    total: 0,
    sent: 0,
    pending: 0,
    failed: 0,
  };

  try {
    if (!SENDGRID_API_KEY) {
      return res.status(200).json({
        data: {
          stats: defaultStats,
          emails: [],
        },
      });
    }

    const response = await fetch("https://api.sendgrid.com/v3/messages?limit=100", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const payload = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: "Failed to fetch SendGrid messages",
        error: payload,
      });
    }

    const items = Array.isArray(payload?.messages) ? payload.messages : [];

    const filteredItems = items.filter((item) => {
      const fromEmail = (item?.from_email || item?.from?.email || "").toLowerCase();
      return fromEmail === FROM_EMAIL.toLowerCase();
    });

    const normalizedEmails = filteredItems
      .map((item) => ({
        id: item?.msg_id || item?.id || `${item?.to_email || "email"}-${Date.now()}`,
        to: item?.to_email || item?.to || "",
        subject: item?.subject || EMAIL_SUBJECT,
        body: item?.websiteLink || item?.subject || "",
        status: normalizeEmailStatus(item?.status),
        sentAt: item?.last_event_time || new Date().toISOString(),
      }))
      .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    const stats = {
      total: normalizedEmails.length,
      sent: normalizedEmails.filter((email) => email.status === "sent").length,
      pending: normalizedEmails.filter((email) => email.status === "pending").length,
      failed: normalizedEmails.filter((email) => email.status === "failed").length,
    };

    return res.status(200).json({
      data: {
        stats,
        emails: normalizedEmails.slice(0, 5),
      },
    });
  } catch (error) {
    console.error("Dashboard Email Error:", error);

    return res.status(200).json({
      data: {
        stats: defaultStats,
        emails: [],
      },
    });
  }
};

const getSendGridEmails = async (req, res) => {
  try {
    const limit = req.query.limit || 10;

    if (!SENDGRID_API_KEY) {
      return res.status(500).json({ message: "SendGrid API key is not configured" });
    }

    const response = await fetch(
      `https://api.sendgrid.com/v3/messages?limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
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

    return res.status(200).json(data.messages || data);
  } catch (error) {
    console.error("SendGrid Error:", error);

    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = { sendEmailSendGrid, getSendGridEmails, getDashboardEmailSummary, loginUser, signupUser };