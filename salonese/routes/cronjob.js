// cron/scheduler.js
const cron = require("node-cron");
const moment = require("moment");
const twilio = require("twilio");
const sgMail = require("@sendgrid/mail");
const ScheduledNotification = require("../models/ScheduleNotificationSchema");

// 🔹 Configure SendGrid & Twilio using your .env names
sgMail.setApiKey(process.env.SendGrid_KEY);
const client = twilio(process.env.TWILIO_SID, process.env.AUTH_TOKEN);


cron.schedule("* * * * *", async () => {
  console.log("⏰ Running scheduled notification check...");
  const now = moment().toDate();

  const pending = await ScheduledNotification.find({
    sendTime: { $lte: now },
    sent: false,
  });

  for (const n of pending) {
    try {
    
      if (["sms", "both"].includes(n.type) && n.toNumber) {
        await client.messages.create({
          body: n.messageBody,
          messagingServiceSid: process.env.Messaging_twillo_SID,
          to: n.toNumber,
        });
        console.log("✅ SMS sent to:", n.toNumber);
      }

      // --- Send Email via SendGrid ---
      if (["email", "both"].includes(n.type) && n.toEmail) {
        await sgMail.send({
          to: n.toEmail,
          from: process.env.SENDGRID_FROM_EMAIL,
          subject: `Appointment Reminder at ${n.businessName}`,
          text: n.messageBody,
        });
        console.log("✅ Email sent to:", n.toEmail);
      }

      // --- Mark notification as sent ---
      n.sent = true;
      await n.save();
    } catch (err) {
      console.error("❌ Failed to send notification:", err.message);
    }
  }
});
