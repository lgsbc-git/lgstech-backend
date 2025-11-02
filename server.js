import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ===============================
// ✅ Middleware
// ===============================
app.use(cors());
app.use(bodyParser.json());

// ===============================
// ✅ Common Outlook Transporter (Nodemailer)
// ===============================
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MY_EMAIL,
    pass: process.env.MY_PASSWORD,
  },
});

// ===============================
// ✅ Root Route (for testing)
// ===============================
app.get("/", (req, res) => {
  res.send(" LGSTech backend is running successfully!");
});

// ===============================
// ✅ CONTACT FORM MESSAGE
// ===============================
app.post("/send", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const mailOptions = {
      from: `"LGSTech Contact" <${process.env.MY_EMAIL}>`,
      to: "harun@ddptech.com.au",
      replyTo: email,
      subject: `New Contact Message from ${name}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f7fa; padding: 30px;">
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
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: "Message sent successfully!" });

  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send message. Try again later." });
  }
});

// ===============================
// ✅ SUBSCRIBE
// ===============================
app.post("/subscribe", async (req, res) => {
  try {
    let email = req.body.email?.trim().toLowerCase();

    if (!email || typeof email !== "string")
      return res.status(400).json({ error: "A valid email is required" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ error: "Please provide a valid email format" });

    // ✅ Read existing subscribers
    let subscribers = { subscribers: [] };
    if (fs.existsSync("subscribers.json")) {
      const fileData = fs.readFileSync("subscribers.json", "utf8");
      subscribers = JSON.parse(fileData);
    }

    // ✅ Prevent duplicates
    if (subscribers.subscribers.includes(email))
      return res.status(400).json({ error: "Email already subscribed" });

    // ✅ Add new subscriber
    subscribers.subscribers.push(email);
    fs.writeFileSync("subscribers.json", JSON.stringify(subscribers, null, 2));

    // ✅ Send Thank You Email
    const thankYouMail = {
      from: `"LGSTech.ai" <${process.env.MY_EMAIL}>`,
      to: email,
      subject: " Thanks for subscribing to LGSTech!",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f5f7fa; padding: 30px;">
          <div style="max-width: 600px; margin:auto; background:#fff; border-radius:10px; box-shadow:0 2px 6px rgba(0,0,0,0.1); padding:25px;">
            <h2 style="color:#004aad;">Hi there,</h2>
            <p>Thank you for subscribing to <b>LGSTech</b>!</p>
            <p>You’ll now receive updates about our latest products and announcements.</p>
            <br>
            <a href="${process.env.CLIENT_URL}/unsubscribe?email=${encodeURIComponent(email)}">
              Unsubscribe
            </a>
            <br><br>
            <p style="font-size:13px; color:#777;">- The LGSTech Team</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(thankYouMail);
    res.status(200).json({ success: "Thank you for subscribing!" });
  } catch (error) {
    console.error(" Error handling subscription:", error);
    res.status(500).json({ error: "Failed to subscribe. Try again later." });
  }
});

// ===============================
// ✅ UNSUBSCRIBE
// ===============================
app.post("/unsubscribe", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "A valid email is required" });
  }

  try {
    if (!fs.existsSync("subscribers.json")) {
      return res.status(200).json({ success: "You have been unsubscribed successfully." });
    }

    const fileData = fs.readFileSync("subscribers.json");
    let subscribers = JSON.parse(fileData);

    const index = subscribers.subscribers.indexOf(email);
    if (index !== -1) {
      subscribers.subscribers.splice(index, 1);
      fs.writeFileSync("subscribers.json", JSON.stringify(subscribers, null, 2));
    }

    res.status(200).json({ success: "You have been unsubscribed successfully." });

  } catch (error) {
    console.error("Error unsubscribing:", error);
    res.status(500).json({ error: "Failed to unsubscribe. Try again later." });
  }
});

// ===============================
// ✅ Start Server
// ===============================
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
