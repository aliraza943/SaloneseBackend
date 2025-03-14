const express = require("express");
const Staff = require("../models/Staff");
const Services= require("../models/Service")
const Appointments = require("../models/Appointments");
const mongoose = require("mongoose");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const verifyTokenAndPermissions = require("../middleware/permissionsMiddleware");
const AppointmentMiddleware=require("../middleware/appointmentMiddleware")
const AppointmentEditMiddleware = require("../middleware/appointmentEditMiddleware")
const Token = require("../models/Tokens")
const taxData = require("../models/taxData"); 
const BusinessOwner= require("../models/BuisenessOwners")// Import tax data




router.post("/add", authMiddleware(["manage_staff"]), async (req, res) => {
    try {
        const { name, email, phone, role, workingHours, permissions,services } = req.body;

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
            workingHours: role === "provider" ? workingHours : null,
            permissions: role === "frontdesk" ? permissions : [],
            password: "password123",
            businessId: req.user.businessId,
            services: role ==="provider"? services :[]
        });

        await newStaff.save();
        res.status(201).json({ message: "Staff added successfully!", newStaff });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});


router.get("/", authMiddleware(["manage_staff"]), async (req, res) => {
    try {
      // Exclude the password field from the results using .select("-password")
      const staff = await Staff.find({ businessId: req.user.businessId }).select("-password");
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
    console.log("THIS ROUTE HIT 41");
    try {
      const { name, email, phone, role, workingHours, permissions, services } = req.body;
      console.log("Masla sara rooti da ", services);
  
      // Find the staff member by ID
      let staff = await Staff.findById(req.params.id);
      if (!staff) {
        return res.status(404).json({ message: "Staff member not found!" });
      }
  
      // Use .equals() to compare ObjectId with string
      if (!staff.businessId.equals(req.user.businessId)) {
        return res.status(403).json({ message: "Unauthorized to update this staff member." });
      }
  
      // Store original role and permissions for comparison later
      const originalRole = staff.role;
      const originalPermissions = staff.permissions;
  
      // Update fields allowed for everyone
      staff.name = name || staff.name;
      staff.email = email || staff.email;
      staff.phone = phone || staff.phone;
      staff.services = services || staff.services;
      if (workingHours) {
        staff.workingHours = workingHours;
      }
  
      if (req.user.role === "admin") {
        if (role) {
          staff.role = role;
          // If the new role is "frontdesk", update permissions using the provided data; 
          // otherwise, clear permissions.
          staff.permissions = role === "frontdesk" ? permissions : [];
        }
      } else {
        // For non-admin users (such as frontdesk), ignore any provided role or permissions.
        console.log("Non-admin user attempted to update role/permissions, ignoring changes.");
        // Leave the staff.role unchanged and force permissions to be empty.
        staff.permissions = [];
      }
  
      // Save the updated staff member
      await staff.save();
  
      // If the role or permissions have changed, invalidate tokens for this staff member
      if (
        (role && role !== originalRole) ||
        (permissions && JSON.stringify(permissions) !== JSON.stringify(originalPermissions))
      ) {
        await Token.updateMany({ userId: req.params.id, valid: true }, { $set: { valid: false } });
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

//         // Ensure the staff member is a provider before updating working hours
//         if (staff.role !== "provider") {
//             return res.status(403).json({ message: "Only providers can have working hours!" });
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

        // Ensure the staff member is a provider before returning working hours
        if (staff.role !== "provider") {
            return res.status(403).json({ message: "Only providers have working hours!" });
        }

        res.json({ schedule: staff.workingHours });
    } catch (error) {
        console.error("Fetch Schedule Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

router.post("/appointments/add", AppointmentEditMiddleware, async (req, res) => {
    console.log("THIS WAS HIT");
    try {
        const { staffId, title, start, serviceType, charges, clientName, end, clientId, serviceId } = req.body;
        console.log("THIS THE SERVICE ID ", serviceId);

        // If the user is a provider, ensure they can only create appointments for themselves
        if (req.user.role === "provider" && staffId !== req.user.id) {
            return res.status(403).json({ message: "You can only create appointments for yourself!" });
        }

        if (!staffId || !start || !end || !title || !serviceId) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        if (!mongoose.Types.ObjectId.isValid(staffId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({ message: "Invalid ID format!" });
        }

        // Fetch service details
        const service = await Services.findById(serviceId);
        if (!service) {
            return res.status(404).json({ message: "Service not found!" });
        }

        const price = service.price; // Service price
        console.log("SERVICE PRICE:", price);

        const staff = await Staff.findById(staffId);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        // Fetch the business owner's province
        const businessOwner = await BusinessOwner.findOne({ businessId: req.user.businessId });
        if (!businessOwner) {
            return res.status(404).json({ message: "Business owner not found!" });
        }

        if (!businessOwner.province) {
            return res.status(400).json({ message: "No province found for this business owner!" });
        }

        const province = businessOwner.province;
        console.log("BUSINESS PROVINCE:", province);

        // Fetch applicable taxes based on the province
        const taxes = taxData[province] || {};
        console.log("APPLICABLE TAXES FOR", province, ":", taxes);

        // Calculate tax details
        let totalTax = 0;
        let taxesApplied = [];

        for (const type in taxes) {
            const taxRate = taxes[type];
            const taxAmount = taxRate * price;

            taxesApplied.push({
                taxType: type,
                percentage: taxRate,
                amount: taxAmount
            });

            console.log(`${type}: ${taxRate * 100}% -> $${taxAmount.toFixed(2)}`);
            totalTax += taxAmount;
        }

        console.log("TOTAL TAX:", totalTax.toFixed(2));

        // Calculate the final bill (service charge + tax)
        const totalBill = price + totalTax;
        console.log("TOTAL BILL:", totalBill.toFixed(2));

        const newAppointment = new Appointments({
            staffId,
            title,
            start,
            end,
            clientName,
            serviceType,
            serviceCharges: price,
            clientId,
            businessId: req.user.businessId,
            serviceId,
            taxesApplied: taxesApplied,
            totalTax: totalTax,
            totalBill: totalBill,
            serviceName:service.name
        });

        await newAppointment.save();

        res.status(201).json({ 
            message: "Appointment added successfully!", 
            newAppointment 
        });

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

router.put("/update-status/updatenow", async (req, res) => {
    try {
      const result = await Appointments.updateMany({}, { status: "booked" });
      res.json({ success: true, message: "All appointments updated to 'booked'", result });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error updating appointments", error });
    }
  });
  

// ✅ Get Appointments by Staff ID
router.get("/appointments/:staffId", async (req, res) => {
    try {
        const { staffId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(staffId)) {
            return res.status(400).json({ message: "Invalid Staff ID format!" });
        }

        const appointments = await Appointments.find({ staffId, status: "booked" }).populate("staffId", "name");

        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error });
    }
});


router.delete("/appointments/delete", AppointmentMiddleware, async (req, res) => {
    const { staffId, start, end } = req.body;
    console.log("MIDDLEWARE PASSED")
  
    try {
        const result = await Appointments.updateOne(
            { staffId, start, end },
            { $set: { status: "cancelled" } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "No matching appointment found" });
        }

        res.status(200).json({ message: "Appointment status changed to 'cancelled'" });
    } catch (error) {
        res.status(500).json({ error: "Error cancelling appointment" });
    }
});

router.put("/appointments/:id", AppointmentMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        var { title, clientName, serviceType, serviceCharges, start, end, staffId, clientId, serviceId } = req.body;
        console.log(staffId)

        console.log("This is the client ID:", staffId);
        if (staffId && typeof staffId === "object" && staffId._id) {
            staffId = staffId._id;
          }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid appointment ID format!" });
        }

        if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
            return res.status(400).json({ message: "Invalid staff ID format!" });
        }

        if (start === end) {
            return res.status(400).json({ message: "Start time and end time cannot be the same!" });
        }

        // Find the appointment
        const appointment = await Appointments.findById(id);
        if (!appointment) {
            return res.status(404).json({ message: "Appointment not found!" });
        }

        // Find the staff member
        const staff = await Staff.findById(staffId);
        if (!staff) {
            return res.status(404).json({ message: "Staff member not found!" });
        }

        if (staff.role !== "provider" || !staff.workingHours) {
            return res.status(400).json({ message: "This staff member cannot have appointments!" });
        }

        const workingHours = staff.workingHours;
        const startTime = new Date(start);
        const endTime = new Date(end);
        const weekday = startTime.toLocaleString("en-US", { weekday: "long" });

        if (!workingHours[weekday] || workingHours[weekday].length === 0) {
            return res.status(400).json({ message: `Staff does not work on ${weekday}` });
        }

        const availableSlots = workingHours[weekday].map(slot => {
            const [startStr, endStr] = slot.split(" - ");
            return {
                start: new Date(startTime.toDateString() + " " + startStr),
                end: new Date(startTime.toDateString() + " " + endStr),
            };
        });

        const isWithinWorkingHours = availableSlots.some(slot =>
            startTime >= slot.start && endTime <= slot.end
        );

        if (!isWithinWorkingHours) {
            return res.status(400).json({
                message: `Appointment must be within working hours: ${workingHours[weekday].join(", ")}`
            });
        }

        const conflictingAppointment = await Appointments.findOne({
            staffId,
            _id: { $ne: id },
            $or: [
                { start: { $lt: end }, end: { $gt: start } }
            ]
        });

        if (conflictingAppointment) {
            return res.status(400).json({
                message: `This staff already has an appointment from ${conflictingAppointment.start} to ${conflictingAppointment.end}.`
            });
        }

        // Fetch service details
        const service = await Services.findById(serviceId || appointment.serviceId);
        if (!service) {
            return res.status(404).json({ message: "Service not found!" });
        }

        const price = serviceCharges || service.price;
        console.log("SERVICE PRICE:", price);

        // Fetch the business owner's province using req.user.businessId
        const businessOwner = await BusinessOwner.findOne({ businessId: req.user.businessId });
        if (!businessOwner) {
            return res.status(404).json({ message: "Business owner not found!" });
        }
        if (!businessOwner.province) {
            return res.status(400).json({ message: "No province found for this business owner!" });
        }
        const province = businessOwner.province;
        console.log("BUSINESS PROVINCE:", province);

        // Get applicable taxes for the province
        const taxes = taxData[province] || {};
        console.log("APPLICABLE TAXES:", taxes);

        // Calculate tax details
        let totalTax = 0;
        let taxesApplied = [];

        for (const type in taxes) {
            const taxRate = taxes[type];
            const taxAmount = taxRate * price;

            taxesApplied.push({
                taxType: type,
                percentage: taxRate,
                amount: taxAmount
            });

            console.log(`${type}: ${taxRate * 100}% -> $${taxAmount.toFixed(2)}`);
            totalTax += taxAmount;
        }

        console.log("TOTAL TAX:", totalTax.toFixed(2));

        // Calculate total bill (price + tax)
        const totalBill = price + totalTax;
        console.log("TOTAL BILL:", totalBill.toFixed(2));

        // Update appointment fields
        appointment.title = title || appointment.title;
        appointment.clientName = clientName || appointment.clientName;
        appointment.serviceType = serviceType || appointment.serviceType;
        appointment.serviceCharges = price;
        appointment.start = startTime;
        appointment.end = endTime;
        appointment.clientId = clientId || appointment.clientId;
        appointment.serviceId = serviceId || appointment.serviceId;
        appointment.taxesApplied = taxesApplied;
        appointment.totalTax = totalTax;
        appointment.totalBill = totalBill;
        appointment.serviceName=service.name

        // Save the updated appointment
        await appointment.save();

        res.json({ message: "Appointment updated successfully!", appointment });

    } catch (error) {
        console.error("Appointment Update Error:", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});




router.post('/appointments/markAsComplete/:id',async (req, res) => {
    console.log("UKE TE MIRO")
    try {
        const { id } = req.params;
        const appointment = await Appointments.findByIdAndUpdate(
            id,
            { status: 'completed' },
            { new: true } // Return the updated document
        );

        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json({ message: 'Appointment status updated to completed', appointment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});



module.exports = router;
