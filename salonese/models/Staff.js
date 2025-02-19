const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
    },
    businessId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "BusinessOwner", 
        required: true 
    }, // Reference to the BusinessOwner model
    password: { 
        type: String, 
        required: true 
    } // Password field for authentication
}, { timestamps: true });

// Hash the password before saving
staffSchema.pre("save", async function (next) {
    if (this.isNew || this.isModified("password")) {
        // Hash the password if it is being set or modified
        this.password = await bcrypt.hash(this.password, 10);
    }

    next();
});

module.exports = mongoose.model("Staff", staffSchema);
