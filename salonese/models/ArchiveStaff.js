// models/ArchivedStaff.js
const mongoose = require("mongoose");

const ArchivedStaffSchema = new mongoose.Schema({
  originalStaffId: { type: mongoose.Schema.Types.ObjectId, ref: "Staff", required: true },

  // Mirror of Staff fields
  name: { type: String },
  email: { type: String },
  phone: { type: String },
  role: { type: String },
  workingHours: { type: Object, default: {} },
  permissions: { type: [String], default: [] },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessOwner" },
  password: { type: String }, // keep hashed password, optional
  image: { type: String },
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],

  // archive meta
  deletedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("ArchivedStaff", ArchivedStaffSchema);
