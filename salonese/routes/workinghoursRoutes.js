const express = require('express');
const Schedule = require('../models/WorkingHours');
const authMiddleware = require('../middleware/authMiddleware');
const BusinessOwner=require('../models/BuisenessOwners') // Using require to import the Schedule model

const router = express.Router();



router.get("/get-schedule", authMiddleware([]),async (req, res) => {
    try {
        const schedule = await Schedule.findOne({businessId:req.user.businessId}); // Fetch the first schedule document

        if (!schedule) {
            return res.status(404).json({ error: "Schedule not found" });
        }

        res.status(200).json(schedule); // Send the fetched schedule
    } catch (error) {
        res.status(500).json({ error: "Error fetching schedule" });
    }
});
router.put("/update-schedule", authMiddleware(["manage_businessHours"]), async (req, res) => {
    try {
        const { schedule } = req.body;
        console.log("THIS IS THE RECIEVED SCHEDULE",schedule,Date.now());

        let existingSchedule = await Schedule.findOne({ businessId: req.user.businessId });

        if (!existingSchedule) {
            // If no existing schedule, create a new one
            existingSchedule = new Schedule({
                businessId: req.user.businessId,
                schedule,
            });

            await existingSchedule.save();
            return res.status(201).json({ message: "Schedule created successfully", schedule: existingSchedule });
        }

        // Update existing schedule
        existingSchedule.schedule = schedule;
        await existingSchedule.save();

        res.status(200).json({ message: "Schedule updated successfully", schedule: existingSchedule });

    } catch (error) {
        console.error("Error updating schedule:", error);
        res.status(500).json({ error: "Error updating schedule" });
    }
});
router.get("/exceptions", authMiddleware([]), async (req, res) => {
    try {
        const schedule = await Schedule.findOne({ businessId: req.user.businessId }, "exceptionDates");

        if (!schedule) {
            return res.status(404).json({ error: "No schedule found" });
        }

        res.status(200).json(schedule.exceptionDates || []);
    } catch (error) {
        console.error("Error fetching exceptions:", error);
        res.status(500).json({ error: "Error fetching exceptions" });
    }
});

router.post("/exceptions", authMiddleware(["manage_businessHours"]), async (req, res) => {
    try {
        const { date, timeSlots } = req.body;

        if (!date) {
            return res.status(400).json({ error: "Date is required" });
        }

        // Find schedule
        let schedule = await Schedule.findOne({ businessId: req.user.businessId });

        if (!schedule) {
            return res.status(400).json({ error: "Cannot add exception — schedule does not exist yet" });
        }

        // If exceptions array doesn't exist, initialize it
        if (!Array.isArray(schedule.exceptionDates)) {
            schedule.exceptionDates = [];
        }

        schedule.exceptionDates.push({ date, timeSlots: timeSlots || [] });
        await schedule.save();

        res.status(201).json({
            message: "Exception added successfully",
            exceptionDates: schedule.exceptionDates
        });

    } catch (error) {
        console.error("Error adding exception:", error);
        res.status(500).json({ error: "Error adding exception" });
    }
});



router.delete("/exceptions/:id", authMiddleware(["manage_businessHours"]), async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({ businessId: req.user.businessId });

        if (!schedule) {
            return res.status(404).json({ error: "No schedule found" });
        }

        schedule.exceptionDates = schedule.exceptionDates.filter(e => e._id.toString() !== id);
        await schedule.save();

        res.status(200).json({ message: "Exception deleted successfully", exceptionDates: schedule.exceptionDates });
    } catch (error) {
        console.error("Error deleting exception:", error);
        res.status(500).json({ error: "Error deleting exception" });
    }
});
router.delete("/exceptions/:id", authMiddleware(["manage_businessHours"]), async (req, res) => {
    try {
        const { id } = req.params;

        const schedule = await Schedule.findOne({ businessId: req.user.businessId });

        if (!schedule) {
            return res.status(404).json({ error: "No schedule found" });
        }

        schedule.exceptionDates = schedule.exceptionDates.filter(e => e._id.toString() !== id);
        await schedule.save();

        res.status(200).json({ message: "Exception deleted successfully", exceptionDates: schedule.exceptionDates });
    } catch (error) {
        console.error("Error deleting exception:", error);
        res.status(500).json({ error: "Error deleting exception" });
    }
});
router.get("/notification-settings", authMiddleware([]), async (req, res) => {
    try {
        let owner = await BusinessOwner.findOne({ _id: req.user._id });

        if (!owner) {
            return res.status(404).json({ error: "Business owner not found" });
        }

        // If no notification settings → create default ones
        if (!owner.notificationSettings || !owner.notificationSettings.type) {
            owner.notificationSettings = {
                type: "same-day",
                minutesBefore: 30,
                time: "18:00"
            };
            await owner.save();
        }

        res.status(200).json(owner.notificationSettings);
    } catch (error) {
        console.error("Error fetching notification settings:", error);
        res.status(500).json({ error: "Error fetching notification settings" });
    }
});

// Update notification settings
router.put("/notification-settings", authMiddleware(["manage_clientele"]), async (req, res) => {
    try {
        const { type, minutesBefore, time } = req.body;

        // Fetch owner by businessId
        let owner = await BusinessOwner.findOne({ businessId: req.user.businessId });

        if (!owner) {
            return res.status(404).json({ error: "Business owner not found" });
        }

        // Update settings
        owner.notificationSettings = {
            type: type || "same-day",
            minutesBefore: type === "same-day" ? minutesBefore ?? 30 : undefined,
            time: type === "previous-day" ? time ?? "18:00" : undefined
        };

        await owner.save();

        res.status(200).json({ message: "Notification settings updated successfully", notificationSettings: owner.notificationSettings });
    } catch (error) {
        console.error("Error updating notification settings:", error);
        res.status(500).json({ error: "Error updating notification settings" });
    }
});

router.get("/get-notification-settings", authMiddleware([]), async (req, res) => {
    try {
        // Fetch the business owner by businessId
        let owner = await BusinessOwner.findOne({ businessId: req.user.businessId });

        if (!owner) {
            return res.status(404).json({ error: "Business owner not found" });
        }

        // If no notification settings exist, create defaults
        if (!owner.notificationSettings || !owner.notificationSettings.type) {
            owner.notificationSettings = {
                type: "same-day",
                minutesBefore: 30,
                time: "18:00"
            };
            await owner.save();
        }

        res.status(200).json({
            message: "Notification settings fetched successfully",
            notificationSettings: owner.notificationSettings
        });
    } catch (error) {
        console.error("Error fetching notification settings:", error);
        res.status(500).json({ error: "Error fetching notification settings" });
    }
});

module.exports = router; // Export the router using module.exports
