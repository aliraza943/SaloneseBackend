// models/ScheduledNotification.js
const mongoose = require("mongoose");

const ScheduledNotificationSchema = new mongoose.Schema({
  clientId: mongoose.Schema.Types.ObjectId,
  toNumber: String,
  toEmail: String,
  messageBody: String,
  businessName: String,
  sendTime: Date,
  type: { type: String, enum: ["sms", "email", "both"], default: "both" },
  sent: { type: Boolean, default: false },
});

module.exports = mongoose.model("ScheduledNotification", ScheduledNotificationSchema);
