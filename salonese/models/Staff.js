const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ["barber", "frontdesk"], required: true },
    workingHours: { type: String },  // Only for Barbers
    permissions: { type: [String] }, // Only for Front Desk
});

module.exports = mongoose.model("Staff", staffSchema);
