const mongoose = require("mongoose");

const staffSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ["barber", "frontdesk"], required: true },
    workingHours: {
        type: Object,
        default: {
            Monday: null,
            Tuesday: null,
            Wednesday: null,
            Thursday: null,
            Friday: null,
            Saturday: null,
            Sunday: null
        },
        required: function () { return this.role === "barber"; }
    },
    permissions: {
        type: [String],
        default: [],
        required: function () { return this.role === "frontdesk"; }
    }
});

module.exports = mongoose.model("Staff", staffSchema);
