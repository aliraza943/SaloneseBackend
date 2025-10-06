// routes/notify.js
const express = require("express");
const router = express.Router();
const twilio = require("twilio");

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Twilio "from" number (your 416 number)
const FROM_NUMBER = "+15342009086";

// Hardcoded destination (replace with your own PK number, must be verified on trial)
const TO_NUMBER = "+14167071357"; // change this to your real PK mobile

router.post("/sendTestSMS", async (req, res) => {
  try {
    const message = await client.messages.create({
      body: "This is a test message again ",
      from: FROM_NUMBER,
      to: TO_NUMBER,
    });

    res.json({
      success: true,
      sid: message.sid,
      status: message.status,
    });
  } catch (error) {
    console.error("Twilio Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
