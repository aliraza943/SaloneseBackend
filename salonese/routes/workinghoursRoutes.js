const express = require('express');
const Schedule = require('../models/WorkingHours'); // Using require to import the Schedule model

const router = express.Router();

// Save or update schedule
router.post("/save-schedule", async (req, res) => {
    try {
        const { schedule } = req.body; // Schedule should be an object like { Monday: ['9:00 AM - 5:00 PM'], ... }

        // Delete old schedule (optional)
        await Schedule.deleteMany();

        // Insert new schedule as a single object
        const formattedSchedule = new Schedule({
            schedule: schedule,
        });

        await formattedSchedule.save();

        res.status(200).json({ message: "Schedule saved successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error saving schedule" });
    }
});
router.get("/get-schedule", async (req, res) => {
    try {
        const schedule = await Schedule.findOne(); // Fetch the first schedule document

        if (!schedule) {
            return res.status(404).json({ error: "Schedule not found" });
        }

        res.status(200).json(schedule); // Send the fetched schedule
    } catch (error) {
        res.status(500).json({ error: "Error fetching schedule" });
    }
});
router.put("/update-schedule", async (req, res) => {
    try {
        const { schedule } = req.body;
        console.log(schedule)

        let existingSchedule = await Schedule.findOne();
        if (!existingSchedule) {
            return res.status(404).json({ error: "No schedule found to update" });
        }

        existingSchedule.schedule = schedule;
        await existingSchedule.save();

        res.status(200).json({ message: "Schedule updated successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error updating schedule" });
    }
})

module.exports = router; // Export the router using module.exports
