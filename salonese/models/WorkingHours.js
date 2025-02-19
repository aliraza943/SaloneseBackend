const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Business", // Assuming you have a Business model
        required: true,
        unique: true
    },
    schedule: {
        type: Object, // Use Object instead of Map
        default: {
            Monday: null,
            Tuesday: null,
            Wednesday: null,
            Thursday: null,
            Friday: null,
            Saturday: null,
            Sunday: null,
        }, // Initialize the schedule as an object with null values for each day
    },
});

module.exports = mongoose.model("Schedule", ScheduleSchema);
