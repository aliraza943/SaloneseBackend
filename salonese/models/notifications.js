// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clientelle', required: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  clientName: { type: String },
  serviceName: { type: String },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
  start: { type: Date },
  end: { type: Date },
  type: { type: String, default: 'appointment-booked' },
  seen: { type: Boolean, default: false },
  method: { type: String, default: 'manual' }, // 👈 NEW FIELD ADDED HERE
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);
