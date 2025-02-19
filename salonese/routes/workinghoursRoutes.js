const express = require('express');
const Schedule = require('../models/WorkingHours');
const authMiddleware = require('../middleware/authMiddleware'); // Using require to import the Schedule model

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


module.exports = router; // Export the router using module.exports
