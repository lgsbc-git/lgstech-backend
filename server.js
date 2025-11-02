import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ===============================
// ✅ Fix for Railway: Use Persistent Storage
// ===============================
const DATA_DIR = "/data";
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");

// Create /data directory if missing
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Ensure file exists
if (!fs.existsSync(SUBSCRIBERS_FILE)) {
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify({ subscribers: [] }, null, 2));
}

// ===============================
// ✅ Nodemailer Outlook Transporter
// ===============================
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MY_EMAIL,
    pass: process.env.MY_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// ===============================
// ✅ Root Route
// ===============================
app.get("/", (req, res) => {
  res.send("✅ LGSTech backend is running on Railway!");
});

// ===============================
// ✅ CONTACT FORM MESSAGE
// ===============================
app.post("/send", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message)
    return res.status(400).json({ error: "All fields are required" });

  try {
    await transporter.sendMail({
      from: `"LGSTech Contact" <${process.env.MY_EMAIL}>`,
      to: "harun@ddptech.com.au",
      replyTo: email,
      subject: `New Contact Message from ${name}`,
      html: `
          <h3>You have a new message!</h3>
          <p><b>Name:</b> ${name}</p>
          <p><b>Email:</b> ${email}</p>
          <p><b>Message:</b><br>${message.replace(/\n/g, "<br>")}</p>
      `
    });

    res.status(200).json({ success: "Message sent successfully!" });

  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send message." });
  }
});

// ===============================
// ✅ SUBSCRIBE
// ===============================
app.post("/subscribe", (req, res) => {
  try {
    let email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Invalid email" });

    const subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf8"));

    if (subscribers.subscribers.includes(email)) {
      return res.status(400).json({ error: "Email already subscribed" });
    }

    subscribers.subscribers.push(email);
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));

    res.status(200).json({ success: "Thank you for subscribing!" });

  } catch (error) {
    console.error("Subscription Error:", error);
    res.status(500).json({ error: "Subscription failed" });
  }
});

// ===============================
// ✅ UNSUBSCRIBE
// ===============================
app.post("/unsubscribe", (req, res) => {
  try {
    let email = req.body.email?.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "Invalid email" });

    const subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, "utf8"));
    subscribers.subscribers = subscribers.subscribers.filter(e => e !== email);

    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));

    res.status(200).json({ success: "Unsubscribed successfully!" });

  } catch (error) {
    console.error("Unsubscribe Error:", error);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

// ===============================
// ✅ Start Server
// ===============================
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
