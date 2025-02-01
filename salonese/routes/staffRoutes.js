const express = require("express");
const Staff = require("../models/Staff");
const mongoose = require("mongoose");
const router = express.Router();

// Create Staff Member
router.post("/add", async (req, res) => {
    try {
        const { name, email, phone, role, workingHours, permissions } = req.body;

        // Validation
        if (!name || !email || !phone || !role) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        // Create staff
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

// Get All Staff Members
router.get("/", async (req, res) => {
    try {
        const staff = await Staff.find();
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});

// Get Single Staff Member by ID
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

// Update Staff Member
router.put("/:id", async (req, res) => {
    try {
        const { name, email, phone, role, workingHours, permissions } = req.body;

        // Find the staff member by ID
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

// Delete Staff Member


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
});


module.exports = router;
