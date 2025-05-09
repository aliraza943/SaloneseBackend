const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const staffSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    role: { type: String, enum: ["provider", "frontdesk"], required: true },
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
        required: function () { return this.role === "provider"; }
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
    },
    password: { 
        type: String, 
        required: true 
    },
    // New field for image (not required)
    image: {
        type: String, // URL or filename
        default: null
    },
    // Field for providers: an array of ServiceAA IDs
    services: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "Service",
        default: [],
        required: function () { return this.role === "provider"; }
    }
}, { timestamps: true });

// Hash the password before saving
staffSchema.pre("save", async function (next) {
    if (this.isNew || this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

module.exports = mongoose.model("Staff", staffSchema);
