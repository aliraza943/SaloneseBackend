const express = require("express");
const Staff = require("../models/Staff");
const Appointments = require("../models/Appointments");
const mongoose = require("mongoose");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const verifyTokenAndPermissions = require("../middleware/permissionsMiddleware");
const AppointmentMiddleware=require("../middleware/appointmentMiddleware")
const AppointmentEditMiddleware = require("../middleware/appointmentEditMiddleware")
const Token = require("../models/Tokens")



router.post("/add", authMiddleware(["manage_staff"]), async (req, res) => {
    try {
        const { name, email, phone, role, workingHours, permissions } = req.body;

        if (!name || !email || !phone || !role) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        // Only an admin can add a front desk staff
        if (role === "frontdesk" && req.user.role !== "admin") {
            return res.status(403).json({ message: "Only an admin can add a front desk staff." });
        }

        const newStaff = new Staff({
            name,
            email,
            phone,
            role,
            workingHours: role === "barber" ? workingHours : null,
            permissions: role === "frontdesk" ? permissions : [],
            password: "password123",
            businessId: req.user.businessId
        });

        await newStaff.save();
        res.status(201).json({ message: "Staff added successfully!", newStaff });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});



router.get("/", authMiddleware(["manage_staff"]),async (req, res) => {
    try {
        const staff = await Staff.find({ businessId: req.user.businessId });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});


router.get("/:id", authMiddleware(["manage_staff"]), async (req, res) => {
    try {
        const staff = await Staff.findById(req.params.id);
        
        // Check if the staff exists and if the businessId matches the user's businessId
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        if (staff.businessId.toString() !== req.user.businessId.toString()) {
            return res.status(403).json({ message: "Unauthorized to access this staff member's details." });
        }

        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});



router.put("/:id", authMiddleware(["manage_staff"]), async (req, res) => {
    console.log("THIS ROUTE HIT");
    try {
        const { name, email, phone, role, workingHours, permissions } = req.body;

        // Find the staff member by ID
        let staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        // Check if the businessId matches
        if (staff.businessId.toString() !== req.user.businessId.toString()) {
            return res.status(403).json({ message: "Unauthorized to update this staff member." });
        }

        // Store original role and permissions for comparison later
        const originalRole = staff.role;
        const originalPermissions = staff.permissions;

        // Update fields allowed for everyone
        staff.name = name || staff.name;
        staff.email = email || staff.email;
        staff.phone = phone || staff.phone;
        if (workingHours) {
            staff.workingHours = workingHours;
        }

        // Only allow role and permissions changes if the req.user is admin
        if (req.user.role === "admin") {
            if (role) {
                staff.role = role;
                // Only update permissions based on role. For frontdesk, use the provided permissions; otherwise, clear them.
                staff.permissions = role === "frontdesk" ? permissions : [];
            }
        } else {
            // Non-admin users are not allowed to change role or permissions.
            if (role || permissions) {
                return res.status(403).json({ message: "Only admin users can change role or permissions." });
            }
        }

        // Save the updated staff member
        await staff.save();

        // If the role or permissions have changed, invalidate tokens for this staff member
        if ((role && role !== originalRole) || 
            (permissions && JSON.stringify(permissions) !== JSON.stringify(originalPermissions))) {
            await Token.updateMany({ userId: req.params.id, valid: true }, { $set: { valid: false }});
            console.log(`Permissions changed: Tokens invalidated for staff member ${req.params.id}`);
        }

        res.json({ message: "Staff updated successfully!", staff });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});





router.delete("/:id", authMiddleware(["manage_staff"]), async (req, res) => {
    try {
        // Validate that the staff ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid Staff ID format!" });
        }

        // Find the staff member by ID
        const staff = await Staff.findById(req.params.id);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        // Check if the staff's businessId matches the requester's businessId
        if (staff.businessId.toString() !== req.user.businessId.toString()) {
            return res.status(403).json({ message: "Unauthorized to delete this staff member." });
        }

        // Additional check: if the staff being deleted is 'front desk', only an admin can delete them
        if (staff.role === "front desk" && req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can delete front desk staff." });
        }

        // Delete the staff member
        await Staff.findByIdAndDelete(req.params.id);

        // Invalidate tokens for this user by marking them as not valid
        await Token.updateMany({ userId: req.params.id, valid: true }, { $set: { valid: false }});

        res.json({ message: "Staff member deleted and tokens invalidated successfully!" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


// router.put("/update-schedule/:id", async (req, res) => {
//     try {
//         const { schedule } = req.body;
//         console.log("Received schedule:", schedule);

//         if (!schedule) {
//             return res.status(400).json({ message: "Schedule data is required!" });
//         }

//         const staff = await Staff.findById(req.params.id);
//         if (!staff) {
//             return res.status(404).json({ message: "Staff member not found!" });
//         }

//         // Ensure the staff member is a barber before updating working hours
//         if (staff.role !== "barber") {
//             return res.status(403).json({ message: "Only barbers can have working hours!" });
//         }

//         // Update working hours
//         staff.workingHours = schedule;
//         await staff.save();

//         res.json({ message: "Schedule updated successfully!", staff });
//     } catch (error) {
//         console.error("Schedule Update Error:", error);

//         // Log more detailed error if it's a validation error or some other specific error
//         if (error.name === 'ValidationError') {
//             return res.status(400).json({ message: "Validation error", error: error.message });
//         }

//         // Return a generic server error for any other errors
//         res.status(500).json({ message: "Server Error", error: error.message });
//     }
// });
router.put("/update-schedule/:id", verifyTokenAndPermissions, async (req, res) => {
    try {
        const { schedule } = req.body;
        if (!schedule) {
            return res.status(400).json({ message: "Schedule data is required!" });
        }

        // Use `req.staff` from the middleware
        req.staff.workingHours = schedule;
        await req.staff.save();

        res.json({ message: "Schedule updated successfully!", staff: req.staff });
    } catch (error) {
        console.error("Schedule Update Error:", error);
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


router.post("/appointments/add", AppointmentEditMiddleware, async (req, res) => {
    console.log("THIS WAS HIT")
    try {
        const { staffId, title, start, serviceType, charges, clientName, end } = req.body;

        // If the user is a barber, ensure they can only create appointments for themselves
        if (req.user.role === "barber" && staffId !== req.user.id) {
            return res.status(403).json({ message: "You can only create appointments for yourself!" });
        }

        if (!staffId || !start || !end || !title) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        if (!mongoose.Types.ObjectId.isValid(staffId)) {
            return res.status(400).json({ message: "Invalid Staff ID format!" });
        }

        const staff = await Staff.findById(staffId);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        const newAppointment = new Appointments({
            staffId,
            title,
            start,
            end,
            clientName,
            serviceType,
            serviceCharges: charges
        });

        await newAppointment.save();

        res.status(201).json({ message: "Appointment added successfully!", newAppointment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error });
    }
});
// ✅ Get All Appointments
router.get("/appointments", async (req, res) => {
    try {
        const appointments = await Appointment.find().populate("staffId", "name");
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});

// ✅ Get Appointments by Staff ID
router.get("/appointments/:staffId", async (req, res) => {
    try {
        const { staffId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(staffId)) {
            return res.status(400).json({ message: "Invalid Staff ID format!" });
        }

        const appointments = await Appointments.find({ staffId }).populate("staffId", "name");
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});
router.delete("/appointments/delete", AppointmentMiddleware, async (req, res) => {
    const { staffId, start, end } = req.body;
  
    try {
      await Appointments.deleteOne({ staffId, start, end });
      res.status(200).json({ message: "Appointment deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Error deleting appointment" });
    }
  });

  router.put("/appointments/:id",AppointmentMiddleware, async (req, res) => {
   

    try {
        const { id } = req.params;
        const { title, clientName, serviceType, serviceCharges, start, end, staffId } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid appointment ID format!" });
        }

        if (!staffId || !mongoose.Types.ObjectId.isValid(staffId._id)) {
            return res.status(400).json({ message: "Invalid staff ID format!" });
        }

        // Ensure start and end time are not the same
        if (start === end) {
            return res.status(400).json({ message: "Start time and end time cannot be the same!" });
        }

        // Find the staff member and get working hours
        const staff = await Staff.findById(staffId);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        // Ensure the staff is a barber and has working hours
        if (staff.role !== "barber" || !staff.workingHours) {
            return res.status(400).json({ message: "This staff member cannot have appointments!" });
        }

        const workingHours = staff.workingHours;

        // Convert start and end times to a Date object
        const startTime = new Date(start);
        const endTime = new Date(end);

        // Get the weekday name (e.g., "Monday")
        const weekday = startTime.toLocaleString("en-US", { weekday: "long" });

        // Check if the staff has working hours on this day
        if (!workingHours[weekday] || workingHours[weekday].length === 0) {
            return res.status(400).json({ message: `Staff does not work on ${weekday}` });
        }

        // Convert working hours to time ranges
        const availableSlots = workingHours[weekday].map(slot => {
            const [startStr, endStr] = slot.split(" - ");
            return {
                start: new Date(startTime.toDateString() + " " + startStr),
                end: new Date(startTime.toDateString() + " " + endStr),
            };
        });

        // Check if the appointment falls within any available slot
        const isWithinWorkingHours = availableSlots.some(slot =>
            startTime >= slot.start && endTime <= slot.end
        );

        if (!isWithinWorkingHours) {
            return res.status(400).json({
                message: `Appointment must be within working hours: ${workingHours[weekday].join(", ")}`,
            });
        }

        // Check for conflicting appointments
        const conflictingAppointment = await Appointments.findOne({
            staffId,
            _id: { $ne: id },
            $or: [
                { start: { $lt: end }, end: { $gt: start } }, // Overlaps with requested time
            ],
        });

        if (conflictingAppointment) {
            return res.status(400).json({
                message: `This staff already has an appointment from ${conflictingAppointment.start} to ${conflictingAppointment.end}.`,
            });
        }

        // Update appointment fields
        const appointment = await Appointments.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found!" });
        }

        appointment.title = title || appointment.title;
        appointment.clientName = clientName || appointment.clientName;
        appointment.serviceType = serviceType || appointment.serviceType;
        appointment.serviceCharges = serviceCharges || appointment.serviceCharges;
        appointment.start = startTime;
        appointment.end = endTime;

        // Save the updated appointment
        await appointment.save();

        res.json({ message: "Appointment updated successfully!", appointment });
    } catch (error) {
        console.error("Appointment Update Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});






module.exports = router;
