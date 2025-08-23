const mongoose = require("mongoose");

const AppointmentHistorySchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    required: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "changedByModel"
  },
  changedByModel: {
    type: String,
    required: true,
    enum: ["Staff", "BusinessOwner", "Client"] // 👈 includes Client too, if needed
  },
  action: {
    type: String,
    enum: ["created", "updated", "cancelled", "completed", "billed"],
    required: true
  },
  note: {
    type: String,
    trim: true
  },
  changes: {
    type: Map,
    of: new mongoose.Schema(
      {
        old: { type: mongoose.Schema.Types.Mixed },
        new: { type: mongoose.Schema.Types.Mixed }
      },
      { _id: false }
    )
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("AppointmentHistory", AppointmentHistorySchema);
