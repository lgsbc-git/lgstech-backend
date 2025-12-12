
import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import sql from "mssql";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ---------------------
// Nodemailer transporter
// ---------------------
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MY_EMAIL,
    pass: process.env.MY_PASSWORD,
  },
});

// ---------------------
// SQL (mssql) pool setup
// ---------------------
// Option A: build config object from components (recommended)
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER, // e.g. myserver.database.windows.net
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true" || true, // Azure requires encrypt=true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Option B (alternative): single connection string in env: process.env.DB_CONNECTION_STRING

let poolPromise = null;
async function initDbPool() {
  if (!poolPromise) {
    // If using a connection string:
    // poolPromise = sql.connect(process.env.DB_CONNECTION_STRING);
    poolPromise = sql.connect(dbConfig);
    // handle global pool errors
    poolPromise.catch(err => {
      console.error("SQL pool failed to connect:", err);
      poolPromise = null;
    });
  }
  return poolPromise;
}

// ---------------------
// Helpers: DB operations
// ---------------------
async function isEmailSubscribed(email) {
  await initDbPool();
  const pool = await poolPromise;
  const result = await pool.request()
    .input("email", sql.VarChar(255), email)
    .query("SELECT 1 FROM subscribers WHERE email = @email");
  return result.recordset.length > 0;
}

async function addSubscriber(email) {
  await initDbPool();
  const pool = await poolPromise;
  const query = `
    INSERT INTO subscribers (email)
    VALUES (@email);
    SELECT SCOPE_IDENTITY() as id;
  `;
  const result = await pool.request()
    .input("email", sql.VarChar(255), email)
    .query(query);
  return result.recordset && result.recordset[0] && result.recordset[0].id;
}

async function removeSubscriber(email) {
  await initDbPool();
  const pool = await poolPromise;
  const result = await pool.request()
    .input("email", sql.VarChar(255), email)
    .query("DELETE FROM subscribers WHERE email = @email");
  return result.rowsAffected[0] > 0;
}

async function listSubscribers() {
  await initDbPool();
  const pool = await poolPromise;
  const result = await pool.request().query("SELECT email, created_at FROM subscribers ORDER BY created_at DESC");
  return result.recordset;
}

// ---------------------
// Routes (preserve your existing)
app.get("/", (req, res) => {
  res.send("LGSTech backend is running successfully!");
});

// CONTACT route kept as-is (from your original)
app.post("/send", async (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }
  try {
    const mailOptions = {
      from: `"LGSTech Contact" <${process.env.MY_EMAIL}>`,
      to: "support@lgsbc.com.au",
      replyTo: email,
      subject: `New Contact Message from ${name}`,
      html: /* your existing HTML template here (omitted for brevity) */ `<div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; padding: 30px;">
          <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); overflow: hidden;">
            <div style="background-color: #004aad; color: #ffffff; padding: 20px;">
              <h2 style="margin: 0;">New Contact Message</h2>
            </div>
            <div style="padding: 25px;">
              <p style="font-size: 15px; color: #333;">
                You have received a new message through the <b>LGSTech Contact Form</b>.
              </p>
              <table style="width: 100%; margin-top: 15px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px; color: #555; width: 120px;"><b>Name:</b></td>
                  <td style="padding: 8px; color: #111;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; color: #555;"><b>Email:</b></td>
                  <td style="padding: 8px; color: #111;">
                    ${email}
                    <a href="mailto:${email}"
                      style="background-color: #004aad; color: white; text-decoration: none; padding: 6px 12px; border-radius: 5px; font-size: 13px; margin-left: 10px;">
                      REPLY
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px; color: #555; vertical-align: top;"><b>Message:</b></td>
                  <td style="padding: 8px; color: #111;">${message.replace(/\n/g, "<br>")}</td>
                </tr>
              </table>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
              <p style="font-size: 13px; color: #888; text-align: center;">
                This message was sent from the LGSTech website contact form.
              </p>
            </div>
          </div>
        </div>`,
    };
    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: "Message sent successfully!" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send message. Try again later." });
  }
});

// SUBSCRIBE: uses DB now
app.post("/subscribe", async (req, res) => {
  try {
    let email = req.body.email?.trim().toLowerCase();

    if (!email || typeof email !== "string")
      return res.status(400).json({ error: "A valid email is required" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ error: "Please provide a valid email format" });

    // Check duplicate
    const exists = await isEmailSubscribed(email);
    if (exists) return res.status(400).json({ error: "Email already subscribed" });

    // Insert
    await addSubscriber(email);

    // Send Thank You Email
    const thankYouMail = {
      from: `"LGSTech.ai" <${process.env.MY_EMAIL}>`,
      to: email,
      subject: "Thanks for subscribing to LGSTech!",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f5f7fa; padding: 30px;">
          <div style="max-width: 600px; margin:auto; background:#fff; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1); padding:25px;">
            <h2 style="color:#004aad;">Hi there,</h2>
            <p>Thank you for subscribing to <b>LGSTech</b>!</p>
            <p>You’ll now receive updates about our latest products and announcements.</p>
            <br>
            <a href="${process.env.CLIENT_URL}/unsubscribe?email=${encodeURIComponent(email)}">Unsubscribe</a>
            <br><br>
            <p style="font-size:13px; color:#777;">- The LGSTech Team</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(thankYouMail);
    res.status(200).json({ success: "Thank you for subscribing!" });
  } catch (error) {
    console.error("Error handling subscription:", error);
    res.status(500).json({ error: "Failed to subscribe. Try again later." });
  }
});

// UNSUBSCRIBE: uses DB
app.post("/unsubscribe", async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "A valid email is required" });
  }
  try {
    await removeSubscriber(email);
    res.status(200).json({ success: "You have been unsubscribed successfully." });
  } catch (error) {
    console.error("Error unsubscribing:", error);
    res.status(500).json({ error: "Failed to unsubscribe. Try again later." });
  }
});

// Admin-only route to list/export subscribers (protect this in production)
// Admin-only route to list/export subscribers (API Key protected)
app.get("/admin/subscribers", async (req, res) => {
  try {
    // Check API key in request headers
    if (req.headers["x-api-key"] !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const rows = await listSubscribers();
    res.json({ subscribers: rows });

  } catch (err) {
    console.error("List subscribers error:", err);
    res.status(500).json({ error: "Failed to fetch subscribers" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
