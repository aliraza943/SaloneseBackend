const mongoose = require("mongoose");

const StaffHistorySchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
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
    enum: ["Staff", "BusinessOwner"] // who made the change
  },
  changes: {
    type: Object, // key → { old, new }
    required: true
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("StaffHistory", StaffHistorySchema);
