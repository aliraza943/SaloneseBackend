const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    duration: { type: Number, required: true }, // Duration in minutes
    price: { type: Number, required: true },
    description: { type: String },
    businessId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "BusinessOwner", 
        required: true 
    },
    taxes: {
        type: [{
            type: String,
            enum: ['GST', 'HST', 'PST']
        }],
        default: ['GST', 'HST', 'PST']
    }
}, { timestamps: true });

module.exports = mongoose.model("Service", ServiceSchema);
