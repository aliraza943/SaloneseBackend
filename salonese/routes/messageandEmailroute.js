// services/notificationService.js
const twilio = require("twilio");
const sgClient = require("@sendgrid/client");
const Clientelle = require("../models/Cleintele");
const ScheduledNotification = require("../models/ScheduleNotificationSchema");
const dotenv = require("dotenv");
dotenv.config();

const {
  AUTH_TOKEN,
  TWILIO_SID,
  TWILIO_PHONE_NUMBER,
  Messaging_twillo_SID,
  SendGrid_KEY,
  SENDGRID_FROM_EMAIL,
} = process.env;

// Configure SendGrid client
if (SendGrid_KEY) sgClient.setApiKey(SendGrid_KEY);

// Configure Twilio client
const twilioClient = TWILIO_SID && AUTH_TOKEN ? twilio(TWILIO_SID, AUTH_TOKEN) : null;
const MessagingSidTwillo = Messaging_twillo_SID || null;

/**
 * Sends or schedules a client notification (SMS / Email) for an appointment.
 */
async function sendClientNotification(clientId, start, appointment, businessName) {
  console.log("🔔 [sendClientNotification] START");
  console.log("➡️ Inputs:", {
    clientId,
    start,
    appointment: appointment && { _id: appointment._id, businessId: appointment.businessId },
    businessName,
  });

  try {
    const clientDoc = await Clientelle.findById(clientId);
    if (!clientDoc) return console.error("❌ Client not found:", clientId);

    const clientData = clientDoc.data.find(
      (d) => d.businessId.toString() === appointment.businessId.toString()
    );
    if (!clientData)
      return console.error("❌ No client data found for this business:", appointment.businessId);

    // Prepare phone/email
    let toNumber = null;
    if (clientData.messageNotification && clientData.phone?.trim()) {
      const formatted = clientData.phone.trim();
      if (formatted.startsWith("+")) toNumber = formatted;
      else console.error("❌ Invalid phone format:", formatted);
    }

    const toEmail = clientData.emailNotification ? clientDoc.email : null;

    // Determine sendTime
    let sendTime = new Date(start);
    if (appointment.businessNotificationSettings) {
      const { type, minutesBefore, time } = appointment.businessNotificationSettings;
      if (type === "same-day" && minutesBefore) {
        sendTime = new Date(new Date(start).getTime() - minutesBefore * 60 * 1000);
      } else if (type === "previous-day" && time) {
        const [hours, minutes] = time.split(":").map(Number);
        sendTime = new Date(new Date(start).getTime() - 24 * 60 * 60 * 1000);
        sendTime.setHours(hours, minutes, 0, 0);
      }
    }

    const now = new Date();
    const messageBody = `📅 Hi ${clientData.username}, this is a reminder of your appointment on ${new Date(
      start
    ).toLocaleString()} at ${businessName}.`;

    if (sendTime < now) sendTime = now;

    const diffHours = (sendTime - now) / (1000 * 60 * 60);

    // === Immediate scheduling via Twilio / SendGrid if within limits ===
    if (diffHours <= 72) {
      // SMS Notification
      if (toNumber && twilioClient) {
        try {
          const twilioPayload = {
            body: messageBody,
            to: toNumber,
            sendAt: sendTime,
            scheduleType: "fixed",
          };

          // Safe fallback: use Messaging Service SID if available, else from number
          if (MessagingSidTwillo) {
            twilioPayload.messagingServiceSid = MessagingSidTwillo;
          } else if (TWILIO_PHONE_NUMBER) {
            twilioPayload.from = TWILIO_PHONE_NUMBER;
          } else {
            throw new Error("Twilio configuration missing: no Messaging SID or From number.");
          }

          await twilioClient.messages.create(twilioPayload);
          console.log("✅ SMS scheduled via Twilio");
        } catch (smsErr) {
          console.error("❌ Failed to schedule SMS via Twilio:", smsErr.message);
        }
      }

      // Email Notification
      if (toEmail && sgClient) {
        try {
          const request = {
            method: "POST",
            url: "/v3/mail/send",
            body: {
              personalizations: [
                {
                  to: [{ email: toEmail }],
                  subject: `Appointment Reminder at ${businessName}`,
                  ...(sendTime > now
                    ? { send_at: Math.floor(sendTime.getTime() / 1000) }
                    : {}),
                },
              ],
              from: {
                email: SENDGRID_FROM_EMAIL || "no-reply@example.com",
                name: "Salonese",
              },
              content: [{ type: "text/plain", value: messageBody }],
            },
          };
          await sgClient.request(request);
          console.log("✅ Email sent/scheduled via SendGrid");
        } catch (emailErr) {
          console.error("❌ Failed to send email via SendGrid:", emailErr.message);
        }
      }
    }

    // === If beyond SendGrid/Twilio limits -> persist for cron job ===
    if (diffHours > 72 || diffHours > 168) {
      await ScheduledNotification.create({
        clientId,
        toNumber,
        toEmail,
        messageBody,
        businessName,
        sendTime,
        type:
          toNumber && toEmail
            ? "both"
            : toNumber
            ? "sms"
            : toEmail
            ? "email"
            : "none",
      });
      console.log("📅 Notification stored for cron-based delivery at", sendTime);
    }
  } catch (err) {
    console.error("❌ Failed to send notification:", err?.message);
    console.error("❌ Full Error:", err?.response?.body || err);
  }

  console.log("🔔 [sendClientNotification] END");
}

module.exports = { sendClientNotification };
