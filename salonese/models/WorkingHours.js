const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema({
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Business", // Assuming you have a Business model
        required: true,
        unique: true
    },
    schedule: {
        type: Object, // Weekly recurring schedule
        default: {
            Monday: null,
            Tuesday: null,
            Wednesday: null,
            Thursday: null,
            Friday: null,
            Saturday: null,
            Sunday: null,
        },
    },
    exceptionDates: {
        type: [
            {
                date: { type: Date, required: true }, // Specific date for the exception
                timeSlots: [
                    {
                        start: { type: String, required: true }, // e.g., "09:00 AM"
                        end: { type: String, required: true }   // e.g., "12:00 PM"
                    }
                ]
            }
        ],
        default: [] // Not required — empty array if none provided
    }
});

module.exports = mongoose.model("Schedule", ScheduleSchema);
