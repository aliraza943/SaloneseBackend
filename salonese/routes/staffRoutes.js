const express = require("express");
const Staff = require("../models/Staff");
const mongoose = require("mongoose");
const router = express.Router();


router.post("/add", async (req, res) => {
    try {
        const { name, email, phone, role, workingHours, permissions } = req.body;

      
        if (!name || !email || !phone || !role) {
            return res.status(400).json({ message: "All fields are required!" });
        }

       
        const newStaff = new Staff({
            name,
            email,
            phone,
            role,
            workingHours: role === "barber" ? workingHours : null,
            permissions: role === "frontdesk" ? permissions : [],
        });

        await newStaff.save();
        res.status(201).json({ message: "Staff added successfully!", newStaff });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});


router.get("/", async (req, res) => {
    try {
        const staff = await Staff.find();
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});


router.get("/:id", async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});


router.put("/:id", async (req, res) => {
    console.log("THIS ROUTE HIT")
    try {
        const { name, email, phone, role, workingHours, permissions } = req.body;

        
        let staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        // Update fields
        staff.name = name || staff.name;
        staff.email = email || staff.email;
        staff.phone = phone || staff.phone;
        staff.role = role || staff.role;
        staff.workingHours = role === "barber" ? workingHours : null;
        staff.permissions = role === "frontdesk" ? permissions : [];

        await staff.save();
        res.json({ message: "Staff updated successfully!", staff });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});




router.delete("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid Staff ID format!" });
        }

        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        await Staff.findByIdAndDelete(req.params.id);
        res.json({ message: "Staff member deleted successfully!" });

    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
})
router.put("/update-schedule/:id", async (req, res) => {
    try {
        const { schedule } = req.body;
        console.log("Received schedule:", schedule);

        if (!schedule) {
            return res.status(400).json({ message: "Schedule data is required!" });
        }

        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        // Ensure the staff member is a barber before updating working hours
        if (staff.role !== "barber") {
            return res.status(403).json({ message: "Only barbers can have working hours!" });
        }

        // Update working hours
        staff.workingHours = schedule;
        await staff.save();

        res.json({ message: "Schedule updated successfully!", staff });
    } catch (error) {
        console.error("Schedule Update Error:", error);

        // Log more detailed error if it's a validation error or some other specific error
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: "Validation error", error: error.message });
        }

        // Return a generic server error for any other errors
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});
router.get("/schedule/:id", async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        // Ensure the staff member is a barber before returning working hours
        if (staff.role !== "barber") {
            return res.status(403).json({ message: "Only barbers have working hours!" });
        }

        res.json({ schedule: staff.workingHours });
    } catch (error) {
        console.error("Fetch Schedule Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});



module.exports = router;
