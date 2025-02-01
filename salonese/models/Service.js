const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    duration: { type: Number, required: true }, // Duration in minutes
    price: { type: Number, required: true },
    description: { type: String },
});

module.exports = mongoose.model("Service", ServiceSchema);
