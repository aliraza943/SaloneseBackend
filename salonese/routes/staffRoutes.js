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
const multer = require("multer");
const BillComplete = require("../models/BillComplete");
const authenticateToken = require('../middleware/markAsCompleteMiddleware');
const Notification = require("../models/notifications"); // Import Notification model
const Product = require("../models/ProductModal");
const AppointmentHistory = require("../models/AppointmentsHistory");
const StaffHistory = require("../models/StaffHistory");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads/"); // Save to "uploads" folder (make sure it exists!)
    },
    filename: function (req, file, cb) {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });
  const upload = multer({ storage });


 router.post(
  "/add",
  authMiddleware(["manage_staff"]),
  upload.single("image"), // Handles file upload
  async (req, res) => {
    try {
      const { name, email, phone, role, workingHours } = req.body;
      const permissions = JSON.parse(req.body.permissions || "[]");
      const services = JSON.parse(req.body.services || "[]");

      if (!name || !email || !phone || !role) {
        return res.status(400).json({ message: "All fields are required!" });
      }

      // Only admin can add a frontdesk staff
      if (role === "frontdesk" && req.user.role !== "admin") {
        return res
          .status(403)
          .json({ message: "Only an admin can add a front desk staff." });
      }

      // Handle uploaded image
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

      const newStaff = new Staff({
        name,
        email,
        phone,
        role,
        workingHours: role === "provider" ? workingHours : null,
        permissions: role === "frontdesk" ? permissions : [],
        password: "password123", // default password (should be forced to reset later)
        businessId: req.user.businessId,
        services: role === "provider" ? services : [],
        image: imageUrl,
      });

      await newStaff.save();

      // --- Log staff creation in StaffHistory ---
      await StaffHistory.create({
        staffId: newStaff._id,
        changedBy: req.user.id,
        changedByModel: req.user.role === "admin" ? "BusinessOwner" : "Staff",
        changes: {
          created: newStaff.toObject(), // save full initial state
        },
      });

      res.status(201).json({
        message: "Staff added successfully!",
        newStaff,
      });
    } catch (error) {
      console.error("Error adding staff:", error);
      res.status(500).json({ message: "Server Error", error });
    }
  }
);
  


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




router.put(
  "/:id",
  authMiddleware(["manage_staff"]),
  upload.single("image"),
  async (req, res) => {
    console.log("THIS ROUTE HIT 41");
    try {
      let {
        name,
        email,
        phone,
        role,
        workingHours,
        permissions,
        services,
      } = req.body;

      // Parse JSON strings if needed
      try {
        if (typeof permissions === "string") permissions = JSON.parse(permissions);
        if (typeof services === "string") services = JSON.parse(services);
      } catch (err) {
        return res.status(400).json({ message: "Invalid JSON in permissions/services" });
      }

      const staff = await Staff.findById(req.params.id);
      if (!staff) {
        return res.status(404).json({ message: "Staff member not found!" });
      }

      if (!staff.businessId.equals(req.user.businessId)) {
        return res.status(403).json({ message: "Unauthorized to update this staff member." });
      }

      const originalData = staff.toObject(); // snapshot before update
      const originalRole = staff.role;
      const originalPermissions = staff.permissions;

      // Basic field updates
      staff.name = name || staff.name;
      staff.email = email || staff.email;
      staff.phone = phone || staff.phone;
      staff.services = services || staff.services;

      if (workingHours) {
        staff.workingHours = workingHours;
      }

      // Handle image upload
      if (req.file) {
        const imageUrl = `/uploads/${req.file.filename}`;
        staff.image = imageUrl;
      }

      // Admin role logic
      if (req.user.role === "admin") {
        if (role) {
          staff.role = role;
          staff.permissions = role === "frontdesk" ? permissions : [];
        }
      } else {
        if (role === "frontdesk") {
          return res.status(403).json({ message: "Frontdesk cannot assign 'frontdesk' role." });
        }
        if (permissions && permissions.length > 0) {
          return res.status(403).json({ message: "Frontdesk cannot assign permissions." });
        }
        staff.permissions = [];
      }

      await staff.save();

      // --- 🔥 Track changes for history ---
      const updatedData = staff.toObject();
      const changes = {};
      for (const key of Object.keys(updatedData)) {
        if (
          JSON.stringify(updatedData[key]) !== JSON.stringify(originalData[key])
        ) {
          changes[key] = {
            from: originalData[key],
            to: updatedData[key],
          };
        }
      }

      if (Object.keys(changes).length > 0) {
        await StaffHistory.create({
          staffId: staff._id,
          changedBy: req.user.id,
          changedByModel: req.user.role === "admin" ? "BusinessOwner" : "Staff",
          changes,
        });
      }

      // Invalidate tokens if role/permissions changed
      if (
        req.user.role === "admin" &&
        (
          (role && role !== originalRole) ||
          (permissions && JSON.stringify(permissions) !== JSON.stringify(originalPermissions))
        )
      ) {
        await Token.updateMany(
          { userId: req.params.id, valid: true },
          { $set: { valid: false } }
        );
        console.log(`Tokens invalidated for staff ${req.params.id}`);
      }

      // Construct image URL
      const imageUrl = staff.image ? `/uploads/${staff.image}` : null;

      // Send clean response
      res.json({
        message: "Staff updated successfully!",
        staff: {
          _id: staff._id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          permissions: staff.permissions,
          services: staff.services,
          workingHours: staff.workingHours,
          image: imageUrl,
          businessId: staff.businessId,
        },
      });
    } catch (error) {
      console.error("Server error during staff update:", error);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);




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

    // --- 🔥 Log deletion in history BEFORE deleting ---
    await StaffHistory.create({
      staffId: staff._id,
      changedBy: req.user.id,
      changedByModel: req.user.role === "admin" ? "BusinessOwner" : "Staff",
      changes: {
        deleted: {
          from: {
            name: staff.name,
            email: staff.email,
            phone: staff.phone,
            role: staff.role,
            permissions: staff.permissions,
            services: staff.services,
            workingHours: staff.workingHours,
            businessId: staff.businessId,
          },
          to: null,
        },
      },
    });

    // Delete the staff member
    await Staff.findByIdAndDelete(req.params.id);

    // Invalidate tokens for this user by marking them as not valid
    await Token.updateMany({ userId: req.params.id, valid: true }, { $set: { valid: false } });

    res.json({ message: "Staff member deleted, history logged, and tokens invalidated successfully!" });
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
        const { staffId, title, start, serviceType, charges, clientName, end, clientId, serviceId,description } = req.body;
        console.log("THIS THE desE ID ", description);

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
            serviceName:service.name,
            description
        });

        await newAppointment.save();
        await AppointmentHistory.create({
            appointmentId: newAppointment._id,
            changedBy: req.user.id,
            changedByModel: req.user.role === "admin" ? "BusinessOwner" : "Staff",
            action: "created",
            note: `Appointment created by ${req.user.role}`,
            changes: {
                staffId: { old: null, new: staffId },
                clientId: { old: null, new: clientId },
                clientName: { old: null, new: clientName },
                serviceId: { old: null, new: serviceId },
                serviceName: { old: null, new: service.name },
                serviceType: { old: null, new: serviceType },
                start: { old: null, new: start },
                end: { old: null, new: end },
                status: { old: null, new: "booked" },
                serviceCharges: { old: null, new: price },
                totalTax: { old: null, new: totalTax },
                totalBill: { old: null, new: totalBill },
                description: { old: null, new: description }
            }
        });

     

// 🔔 If booked by provider → notify provider himself
if (req.user.role === "provider") {
    const notifications = [];

    // Notify provider themselves
    notifications.push({
        staffId: req.user.id,
        businessId: req.user.businessId,
        method: "Provider Booking",
        type: "appointment-booked",
        appointmentId: newAppointment._id,
        clientId,
        clientName,
        serviceName: service.name,
        serviceId,
        start,
        end,
        seen: false,
        createdAt: new Date()
    });

    // Notify all frontdesks in the business
    const frontdesks = await Staff.find({
        businessId: req.user.businessId,
        role: "frontdesk"
    });

    frontdesks.forEach(fd => {
        notifications.push({
            staffId: fd._id,
            businessId: req.user.businessId,
            method: "Provider Booking",
            type: "appointment-booked",
            appointmentId: newAppointment._id,
            clientId,
            clientName,
            serviceName: service.name,
            serviceId,
            start,
            end,
            seen: false,
            createdAt: new Date()
        });
    });

    // Notify the business owner (staffId = businessId)
    notifications.push({
        staffId: req.user.businessId, // Assign businessId as staffId for business owner
        businessId: req.user.businessId,
        method: "Provider Booking",
        type: "appointment-booked",
        appointmentId: newAppointment._id,
        clientId,
        clientName,
        serviceName: service.name,
        serviceId,
        start,
        end,
        seen: false,
        createdAt: new Date()
    });

    await Notification.insertMany(notifications);
    console.log(`Provider → Notifications sent to self, ${frontdesks.length} frontdesks, and business owner.`);
}


// 🔔 If booked by frontdesk → notify provider + all frontdesks
if (req.user.role === "frontdesk") {
    const frontdesks = await Staff.find({
        businessId: req.user.businessId,
        role: "frontdesk"
    });

    const notifications = [];

    // Notify provider (staffId used in the appointment)
    notifications.push({
        staffId,
        businessId: req.user.businessId,
        method: "Frontdesk Booking",
        type: "appointment-booked",
        appointmentId: newAppointment._id,
        clientId,
        clientName,
        serviceName: service.name,
        serviceId,
        start,
        end,
        seen: false,
        createdAt: new Date()
    });

    // Notify all frontdesks
    frontdesks.forEach(fd => {
        notifications.push({
            staffId: fd._id,
            businessId: req.user.businessId,
            method: "Frontdesk Booking",
            type: "appointment-booked",
            appointmentId: newAppointment._id,
            clientId,
            clientName,
            serviceName: service.name,
            serviceId,
            start,
            end,
            seen: false,
            createdAt: new Date()
        });
    });

    // Notify the business owner (staffId = businessId)
    notifications.push({
        staffId: req.user.businessId,
        businessId: req.user.businessId,
        method: "Frontdesk Booking",
        type: "appointment-booked",
        appointmentId: newAppointment._id,
        clientId,
        clientName,
        serviceName: service.name,
        serviceId,
        start,
        end,
        seen: false,
        createdAt: new Date()
    });

    await Notification.insertMany(notifications);
    console.log(`Frontdesk → Notifications sent to provider, ${frontdesks.length} frontdesks, and business owner.`);
}
if (req.user.role === "admin") {
    const notifications = [];

    // Notify provider (staffId used in the appointment)
    notifications.push({
        staffId,
        businessId: req.user.businessId,
        method: "Admin Booking",
        type: "appointment-booked",
        appointmentId: newAppointment._id,
        clientId,
        clientName,
        serviceName: service.name,
        serviceId,
        start,
        end,
        seen: false,
        createdAt: new Date()
    });

    // Notify all frontdesks in the business
    const frontdesks = await Staff.find({
        businessId: req.user.businessId,
        role: "frontdesk"
    });

    frontdesks.forEach(fd => {
        notifications.push({
            staffId: fd._id,
            businessId: req.user.businessId,
            method: "Admin Booking",
            type: "appointment-booked",
            appointmentId: newAppointment._id,
            clientId,
            clientName,
            serviceName: service.name,
            serviceId,
            start,
            end,
            seen: false,
            createdAt: new Date()
        });
    });

    // Notify the admin themselves
    notifications.push({
        staffId: req.user.id,
        businessId: req.user.businessId,
        method: "Admin Booking",
        type: "appointment-booked",
        appointmentId: newAppointment._id,
        clientId,
        clientName,
        serviceName: service.name,
        serviceId,
        start,
        end,
        seen: false,
        createdAt: new Date()
    });

    await Notification.insertMany(notifications);
    console.log(`Admin → Notifications sent to provider, ${frontdesks.length} frontdesks, and the admin.`);
}



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
    console.log("MIDDLEWARE PASSED");

    try {
        // Find the appointment first so we can capture previous state for history
        const appointment = await Appointments.findOne({ staffId, start, end });
        if (!appointment) {
            return res.status(404).json({ message: "No matching appointment found" });
        }

        // Save old state for history
        const oldValues = appointment.toObject();

        // Mark as cancelled and save
        appointment.status = "cancelled";
        await appointment.save();

        // Create history entry for cancellation
        try {
            // map req.user.role to changedByModel enum in AppointmentHistory
            const role = (req.user && req.user.role) ? req.user.role : "staff";
            let changedByModel = "Staff";
            if (role === "businessOwner" || role === "owner") changedByModel = "BusinessOwner";
            else if (role === "client") changedByModel = "Client";
            else changedByModel = "Staff";

            const changes = {
                status: {
                    old: oldValues.status || null,
                    new: "cancelled"
                }
            };

            await AppointmentHistory.create({
                appointmentId: appointment._id,
                changedBy: req.user.id,
                changedByModel,
                action: "cancelled",
                changes,
                note: "Appointment cancelled via API"
            });
        } catch (histErr) {
            console.error("Failed to write appointment history:", histErr);
            // don't fail the whole request if history write fails; continue to notify
        }

        // Build notifications (same pattern as before)
        const service = await Services.findById(appointment.serviceId);
        const clientName = appointment.clientName;

        const frontdesks = await Staff.find({
            businessId: req.user.businessId,
            role: "frontdesk"
        });

        const notifications = [];

        // Shared notification data
        const baseNotification = {
            businessId: req.user.businessId,
            method: "",
            type: "appointment-cancelled",
            appointmentId: appointment._id,
            clientId: appointment.clientId,
            clientName,
            serviceName: service?.name,
            serviceId: appointment.serviceId,
            start,
            end,
            seen: false,
            createdAt: new Date()
        };

        // Provider cancels
        if (req.user.role === "provider") {
            baseNotification.method = "Provider Cancel";

            // Notify provider
            notifications.push({
                ...baseNotification,
                staffId: req.user.id
            });

            // Notify frontdesks
            frontdesks.forEach(fd => {
                notifications.push({
                    ...baseNotification,
                    staffId: fd._id
                });
            });

            // Notify business owner
            notifications.push({
                ...baseNotification,
                staffId: req.user.businessId
            });

            console.log(`Provider → Notified self, ${frontdesks.length} frontdesks, and business owner.`);
        }

        // Frontdesk cancels
        if (req.user.role === "frontdesk") {
            baseNotification.method = "Frontdesk Cancel";

            // Notify provider
            notifications.push({
                ...baseNotification,
                staffId
            });

            // Notify frontdesks
            frontdesks.forEach(fd => {
                notifications.push({
                    ...baseNotification,
                    staffId: fd._id
                });
            });

            // Notify business owner
            notifications.push({
                ...baseNotification,
                staffId: req.user.businessId
            });

            console.log(`Frontdesk → Notified provider, ${frontdesks.length} frontdesks, and business owner.`);
        }

        // Admin cancels
        if (req.user.role === "admin") {
            baseNotification.method = "Admin Cancel";

            // Notify provider
            notifications.push({
                ...baseNotification,
                staffId
            });

            // Notify frontdesks
            frontdesks.forEach(fd => {
                notifications.push({
                    ...baseNotification,
                    staffId: fd._1
                });
            });

            // Notify admin themselves
            notifications.push({
                ...baseNotification,
                staffId: req.user.id
            });

            // Notify business owner
            notifications.push({
                ...baseNotification,
                staffId: req.user.businessId
            });

            console.log(`Admin → Notified provider, ${frontdesks.length} frontdesks, self, and business owner.`);
        }

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
        }

        res.status(200).json({ message: "Appointment status changed to 'cancelled'", appointment });

    } catch (error) {
        console.error("Error cancelling appointment:", error);
        res.status(500).json({ error: "Error cancelling appointment" });
    }
});



// File: appointments_put_with_logs.js
// NOTE: If you haven't already, add `const util = require('util');` near the top of the file where you import other modules.

router.put("/appointments/:id", AppointmentMiddleware, async (req, res) => {
    // helpful inspector for deep objects
    const util = require('util');
    const inspect = (obj) => util.inspect(obj, { depth: null, colors: false });

    try {
        console.log('\n===== ENTER PUT /appointments/:id =====');
        console.log('req.user:', inspect(req.user));
        console.log('req.params:', inspect(req.params));
        console.log('req.body:', inspect(req.body));

        const { id } = req.params;
        let { title, clientName, serviceType, serviceCharges, start, end, staffId, clientId, serviceId, description } = req.body;

        console.log('raw staffId from payload:', inspect(staffId));

        // normalize staffId if object
        if (staffId && typeof staffId === "object" && staffId._id) {
            staffId = staffId._id;
            console.log('normalized staffId from object to string/id:', staffId);
        }

        // basic validation
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log('Validation failed: invalid appointment id format', id);
            return res.status(400).json({ message: "Invalid appointment ID format!" });
        }

        if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
            console.log('Validation failed: invalid staffId', staffId);
            return res.status(400).json({ message: "Invalid staff ID format!" });
        }

        if (!start || !end) {
            console.log('Validation failed: missing start or end', { start, end });
            return res.status(400).json({ message: "Start and end times are required!" });
        }
        if (start === end) {
            console.log('Validation failed: start === end', start);
            return res.status(400).json({ message: "Start time and end time cannot be the same!" });
        }

        // find appointment
        console.log('Looking up appointment by id:', id);
        const appointment = await Appointments.findById(id);
        console.log('Found appointment:', appointment ? inspect(appointment.toObject()) : appointment);
        if (!appointment) {
            console.log('Appointment not found for id:', id);
            return res.status(404).json({ message: "Appointment not found!" });
        }

        // Save old values for history comparison
        const oldValues = appointment.toObject();
        console.log('Old appointment values saved for history comparison');

        // find staff
        console.log('Looking up staff by id:', staffId);
        const staff = await Staff.findById(staffId);
        console.log('Found staff:', staff ? inspect(staff.toObject()) : staff);
        if (!staff) {
            console.log('Staff member not found for id:', staffId);
            return res.status(404).json({ message: "Staff member not found!" });
        }

        if (staff.role !== "provider" || !staff.workingHours) {
            console.log('Staff role or workingHours invalid', { role: staff.role, workingHours: staff.workingHours });
            return res.status(400).json({ message: "This staff member cannot have appointments!" });
        }

        // working hours check
        const workingHours = staff.workingHours;
        const startTime = new Date(start);
        const endTime = new Date(end);
        console.log('Parsed startTime and endTime:', { startTime: startTime.toISOString(), endTime: endTime.toISOString() });

        const weekday = startTime.toLocaleString("en-US", { weekday: "long" });
        console.log('Computed weekday from startTime:', weekday);

        if (!workingHours[weekday] || workingHours[weekday].length === 0) {
            console.log(`Staff does not work on ${weekday}. workingHours for that day:`, inspect(workingHours[weekday]));
            return res.status(400).json({ message: `Staff does not work on ${weekday}` });
        }

        const availableSlots = workingHours[weekday].map(slot => {
            const [startStr, endStr] = slot.split(" - ");
            const slotStart = new Date(startTime.toDateString() + " " + startStr);
            const slotEnd = new Date(startTime.toDateString() + " " + endStr);
            return {
                start: slotStart,
                end: slotEnd,
                raw: slot
            };
        });

        console.log('Available slots for the weekday:', availableSlots.map(s => ({ raw: s.raw, start: s.start.toISOString(), end: s.end.toISOString() })));

        const isWithinWorkingHours = availableSlots.some(slot =>
            startTime >= slot.start && endTime <= slot.end
        );

        console.log('Is requested appointment within working hours?', isWithinWorkingHours);

        if (!isWithinWorkingHours) {
            console.log('Requested time not within working hours. requested:', { start: startTime.toISOString(), end: endTime.toISOString() });
            return res.status(400).json({
                message: `Appointment must be within working hours: ${workingHours[weekday].join(", ")}`
            });
        }

        // check for conflicting booked appointments (use Date objects)
        console.log('Checking for conflicting appointments for staffId, excluding id:', staffId, id);
        const conflictingAppointment = await Appointments.findOne({
            staffId,
            _id: { $ne: id },
            status: "booked",
            $or: [
                { start: { $lt: endTime }, end: { $gt: startTime } }
            ]
        });

        console.log('Conflicting appointment result:', conflictingAppointment ? inspect(conflictingAppointment.toObject()) : conflictingAppointment);

        if (conflictingAppointment) {
            console.log('Conflict detected with appointment:', conflictingAppointment._id);
            return res.status(400).json({
                message: `This staff already has an appointment from ${conflictingAppointment.start} to ${conflictingAppointment.end}.`
            });
        }

        // Fetch service details (use provided serviceId or old appointment service)
        console.log('Fetching service details using serviceId:', serviceId || appointment.serviceId);
        const service = await Services.findById(serviceId || appointment.serviceId);
        console.log('Found service:', service ? inspect(service.toObject()) : service);
        if (!service) {
            console.log('Service not found for id:', serviceId || appointment.serviceId);
            return res.status(404).json({ message: "Service not found!" });
        }

        const price = serviceCharges || service.price;
        console.log('Price selected for appointment:', price);

        // Fetch business owner to get province
        console.log('Fetching BusinessOwner for businessId:', req.user.businessId);
        const businessOwner = await BusinessOwner.findOne({ businessId: req.user.businessId });
        console.log('Found businessOwner:', businessOwner ? inspect(businessOwner.toObject()) : businessOwner);
        if (!businessOwner) {
            console.log('Business owner not found for businessId:', req.user.businessId);
            return res.status(404).json({ message: "Business owner not found!" });
        }
        if (!businessOwner.province) {
            console.log('Business owner has no province set:', inspect(businessOwner));
            return res.status(400).json({ message: "No province found for this business owner!" });
        }
        const province = businessOwner.province;
        console.log('Business province:', province);

        // Get applicable taxes
        const taxes = taxData[province] || {};
        console.log('Tax rates for province:', taxes);

        // Calculate taxes
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
            totalTax += taxAmount;
            console.log(`Applied tax ${type}: rate=${taxRate}, amount=${taxAmount}`);
        }

        const totalBill = price + totalTax;
        console.log('Tax summary:', { taxesApplied, totalTax, totalBill });

        // Update appointment fields (include staffId assignment)
        appointment.title = title || appointment.title;
        appointment.clientName = clientName || appointment.clientName;
        appointment.serviceType = serviceType || appointment.serviceType;
        appointment.serviceCharges = price;
        appointment.start = startTime;
        appointment.end = endTime;
        appointment.clientId = clientId || appointment.clientId;
        appointment.serviceId = serviceId || appointment.serviceId;
        appointment.staffId = staffId; // ensure staffId is updated
        appointment.taxesApplied = taxesApplied;
        appointment.totalTax = totalTax;
        appointment.totalBill = totalBill;
        appointment.serviceName = service.name;
        appointment.description = description || appointment.description;

        console.log('Appointment object before save:', inspect(appointment.toObject()));

        // Save the updated appointment
        await appointment.save();
        console.log('Appointment saved to DB successfully with id:', appointment._id);

        // Build history "changes" comparing tracked fields (converting ObjectIds & Dates sensibly)
        const newValues = appointment.toObject();

        const trackedFields = [
            "title", "clientName", "serviceType", "serviceCharges", "start", "end",
            "clientId", "serviceId", "staffId", "taxesApplied", "totalTax", "totalBill",
            "serviceName", "description", "status"
        ];

        const changes = {};
        const normalize = (val) => {
            if (val === undefined) return null;
            if (val === null) return null;
            if (val instanceof Date) return val.toISOString();
            if (typeof val === "object" && val._id) return String(val._id);
            if (typeof val === "object" && val.toString && val.constructor && val.constructor.name === "Object") return val;
            return val;
        };

        for (const key of trackedFields) {
            const oldVal = oldValues[key] !== undefined ? oldValues[key] : null;
            const newVal = newValues[key] !== undefined ? newValues[key] : null;

            let a = oldVal, b = newVal;

            // Normalize ObjectIds and Dates for comparison
            if (a instanceof mongoose.Types.ObjectId) a = String(a);
            if (b instanceof mongoose.Types.ObjectId) b = String(b);
            if (a instanceof Date) a = a.toISOString();
            if (b instanceof Date) b = b.toISOString();

            // For nested objects/arrays (taxesApplied), stringify for safe comparison
            const aStr = (typeof a === "object" && a !== null) ? JSON.stringify(a) : String(a);
            const bStr = (typeof b === "object" && b !== null) ? JSON.stringify(b) : String(b);

            if (aStr !== bStr) {
                changes[key] = {
                    old: normalize(oldVal),
                    new: normalize(newVal)
                };
            }
        }

        console.log('Computed changes for history:', inspect(changes));

        // Only create AppointmentHistory if there are changes
        if (Object.keys(changes).length > 0) {
            // map req.user.role to changedByModel enum in AppointmentHistory
            // Adjust role names to match your auth system if different
            const role = (req.user && req.user.role) ? req.user.role : "staff";
            let changedByModel = "Staff";
            if (role === "businessOwner" || role === "owner") changedByModel = "BusinessOwner";
            else if (role === "client") changedByModel = "Client";
            else changedByModel = "Staff";

            console.log('Creating AppointmentHistory entry:', { appointmentId: appointment._id, changedBy: req.user.id, changedByModel, changes });

            await AppointmentHistory.create({
                appointmentId: appointment._id,
                changedBy: req.user.id,
                changedByModel,
                action: "updated",
                changes,
                note: "Appointment updated via API"
            });

            console.log('AppointmentHistory created');
        } else {
            console.log('No meaningful changes detected, skipping AppointmentHistory creation');
        }

        // Notifications (unchanged logic, fetched frontdesks)
        console.log('Finding frontdesks for businessId:', req.user.businessId);
        const frontdesks = await Staff.find({
            businessId: req.user.businessId,
            role: "frontdesk"
        });
        console.log('Frontdesks found:', inspect(frontdesks));

        const notifications = [];
        const baseNotification = {
            businessId: req.user.businessId,
            type: "appointment-updated",
            appointmentId: appointment._id,
            clientId: appointment.clientId,
            clientName: appointment.clientName,
            serviceName: appointment.serviceName,
            serviceId: appointment.serviceId,
            start: appointment.start,
            end: appointment.end,
            seen: false,
            createdAt: new Date()
        };

        console.log('Building notifications based on req.user.role:', req.user.role);

        if (req.user.role === "provider") {
            baseNotification.method = "Provider Update";
            notifications.push({ ...baseNotification, staffId: req.user.id });
            frontdesks.forEach(fd => notifications.push({ ...baseNotification, staffId: fd._id }));
            notifications.push({ ...baseNotification, staffId: req.user.businessId });
        }

        if (req.user.role === "frontdesk") {
            baseNotification.method = "Frontdesk Update";
            notifications.push({ ...baseNotification, staffId: appointment.staffId });
            frontdesks.forEach(fd => notifications.push({ ...baseNotification, staffId: fd._id }));
            notifications.push({ ...baseNotification, staffId: req.user.businessId });
        }

        if (req.user.role === "admin") {
            baseNotification.method = "Admin Update";
            notifications.push({ ...baseNotification, staffId: appointment.staffId });
            frontdesks.forEach(fd => notifications.push({ ...baseNotification, staffId: fd._id }));
            notifications.push({ ...baseNotification, staffId: req.user.id });
            notifications.push({ ...baseNotification, staffId: req.user.businessId });
        }

        console.log('Final notifications array length:', notifications.length);
        console.log('Sample notifications (first 5):', inspect(notifications.slice(0, 5)));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);
            console.log(`${req.user.role} updated appointment. Notifications sent.`);
        }

        console.log('===== EXIT PUT /appointments/:id SUCCESS =====\n');
        return res.json({ message: "Appointment updated successfully!", appointment });

    } catch (error) {
        console.error('Appointment Update Error (caught):', error.stack || error);
        return res.status(500).json({ message: "Server Error", error: error.message });
    }
});






router.post("/appointments/markAsComplete", authenticateToken, async (req, res) => {
  console.log("Marking Receipt as Complete (non-transactional)");

  try {
    const { appointments = [], products = [] } = req.body;

    if (!Array.isArray(appointments) || appointments.length === 0) {
      return res.status(400).json({ message: "No appointments provided" });
    }

    // ------------- Prepare appointments -------------
    const newRaw = [];
    const existingIds = [];
    const allAppointmentsForBill = [];

    appointments.forEach((a) => {
      if (mongoose.Types.ObjectId.isValid(a._id)) {
        existingIds.push(a._id);

        allAppointmentsForBill.push({
          _id: a._id,
          staffId: a.staffId?._id || a.staffId,
          staffName: a.staffId?.name || a.staffName || "",
          clientId: a.clientId,
          businessId: a.businessId,
          title: a.title,
          serviceType: a.serviceType,
          serviceId: a.serviceId,
          serviceName: a.serviceName,
          clientName: a.clientName,
          description: a.description,
          serviceCharges: a.serviceCharges,
          start: a.start,
          end: a.end,
          taxesApplied: a.taxesApplied,
          totalTax: a.totalTax,
          totalBill: a.totalBill,
          note: a.note,
          quantity: a.quantity,
          autoGenerated: false,
        });
      } else {
        newRaw.push(a);
      }
    });

    // ------------- Totals -------------
    const totalApptAmt = appointments.reduce(
      (sum, a) => sum + (a.totalBill || 0) * (a.quantity || 1),
      0
    );
    const totalProdAmt = products.reduce(
      (sum, p) => sum + (p.price || 0) * (p.quantity || 0),
      0
    );
    const grandTotal = totalApptAmt + totalProdAmt;

    // ------------- Aggregate quantities per product id -------------
    const qtyByProductId = {};
    for (const p of products) {
      // support different shapes: _id, productId, id
      const prodId = p._id || p.productId || p.id;
      const qty = Number(p.quantity || 0);
      if (!prodId) continue;
      qtyByProductId[prodId] = (qtyByProductId[prodId] || 0) + qty;
    }

    // If there are products involved, validate stocks first
    const prodIds = Object.keys(qtyByProductId);
    if (prodIds.length > 0) {
      // Fetch product docs
      const dbProds = await Product.find({ _id: { $in: prodIds } }).select("_id stock name").lean();

      // Check for missing products
      const notFound = prodIds.filter(
        (id) => !dbProds.find((d) => d._id.toString() === id.toString())
      );
      if (notFound.length > 0) {
        return res.status(400).json({ message: "Some products not found", notFound });
      }

      // Check for insufficient stock
      const insufficient = [];
      for (const d of dbProds) {
        const reqQty = qtyByProductId[d._id.toString()] || 0;
        if ((d.stock || 0) < reqQty) {
          insufficient.push({ productId: d._id, name: d.name || null, available: d.stock || 0, requested: reqQty });
        }
      }
      if (insufficient.length > 0) {
        return res.status(400).json({ message: "Insufficient stock", details: insufficient });
      }
    }

    // ------------- Attempt to decrement stocks (conditional), track successful ones -------------
    const decremented = []; // { productId, qty }
    try {
      for (const [prodId, totalQty] of Object.entries(qtyByProductId)) {
        // attempt conditional decrement
        const updated = await Product.findOneAndUpdate(
          { _id: prodId, stock: { $gte: totalQty } },
          { $inc: { stock: -totalQty } },
          { new: true }
        );

        if (!updated) {
          // failed to decrement (concurrent change likely). gather current stock and throw to rollback.
          const prodDoc = await Product.findById(prodId).select("_id stock name").lean();
          const available = prodDoc ? prodDoc.stock : 0;
          throw new Error(`Insufficient stock for product ${prodId} (available ${available}, requested ${totalQty})`);
        }

        decremented.push({ productId: prodId, qty: totalQty });
      }
    } catch (decrErr) {
      // Best-effort rollback for any decremented items
      for (const u of decremented) {
        try {
          await Product.updateOne({ _id: u.productId }, { $inc: { stock: u.qty } });
        } catch (rbErr) {
          console.error("Rollback failed for product", u.productId, rbErr);
        }
      }
      console.error("Failed to decrement all product stocks:", decrErr);
      return res.status(400).json({ message: "Failed to update product stock", error: decrErr.message });
    }

    // ------------- Create new appointments (no transaction) -------------
    const createdNew = await Promise.all(
      newRaw.map(async (raw) => {
        const {
          staffId,
          clientId,
          businessId,
          title,
          serviceType,
          serviceId,
          serviceName,
          clientName,
          description,
          serviceCharges,
          start,
          end,
          taxesApplied,
          totalTax,
          totalBill,
          note,
          quantity,
        } = raw;

        const staffObj = typeof staffId === "object" ? staffId : {};

        if (
          !businessId ||
          !title ||
          !serviceType ||
          !serviceId ||
          !clientName ||
          !description ||
          !serviceCharges
        ) {
          const fakeId = `auto_${new mongoose.Types.ObjectId().toHexString()}`;
          const fakeAppt = {
            _id: fakeId,
            staffId: staffObj._id || staffId,
            staffName: staffObj.name || "",
            clientId,
            businessId,
            title,
            serviceType,
            serviceId,
            serviceName,
            clientName,
            description,
            serviceCharges,
            start,
            end,
            taxesApplied,
            totalTax,
            totalBill,
            note,
            quantity,
            autoGenerated: true,
          };

          allAppointmentsForBill.push(fakeAppt);
          return null;
        }

        const apptDoc = new Appointments({
          staffId: staffObj._id || staffId,
          clientId,
          businessId,
          title,
          serviceType,
          serviceId,
          serviceName,
          clientName,
          description,
          serviceCharges,
          start,
          end,
          taxesApplied,
          totalTax,
          totalBill,
          note,
          quantity,
          status: "completed",
        });

        const saved = await apptDoc.save();

        allAppointmentsForBill.push({
          _id: saved._id,
          staffId: typeof saved.staffId === "object" ? saved.staffId._id : saved.staffId,
          staffName: typeof saved.staffId === "object" ? saved.staffId.name : "",
          clientId: saved.clientId,
          businessId: saved.businessId,
          title: saved.title,
          serviceType: saved.serviceType,
          serviceId: saved.serviceId,
          serviceName: saved.serviceName,
          clientName: saved.clientName,
          description: saved.description,
          serviceCharges: saved.serviceCharges,
          start: saved.start,
          end: saved.end,
          taxesApplied: saved.taxesApplied,
          totalTax: saved.totalTax,
          totalBill: saved.totalBill,
          note: saved.note,
          quantity: saved.quantity,
          autoGenerated: false,
        });

        return saved;
      })
    );

    const newIds = createdNew.filter(Boolean).map((a) => a._id);

    // ------------- Fetch old states for existing appointments BEFORE we update them -------------
    const existingOldMap = {}; // { id: { status, billId } }
    if (existingIds.length > 0) {
      const existingDocs = await Appointments.find({ _id: { $in: existingIds } }).lean();
      existingDocs.forEach((d) => {
        existingOldMap[String(d._id)] = { status: d.status || null, billId: d.billId || null };
      });
    }

    // ------------- Update existing appointments' status -------------
    if (existingIds.length > 0) {
      await Appointments.updateMany(
        { _id: { $in: existingIds } },
        { $set: { status: "completed" } }
      );
    }

    // ------------- Save bill -------------
    const bill = await new BillComplete({
      appointments: allAppointmentsForBill,
      products,
      totalAmount: grandTotal,
      status: "paid",
      businessId: req.user.businessId,
    }).save();

    // ------------- Backfill billId on real appointments -------------
    const toBackfill = [...existingIds, ...newIds];
    if (toBackfill.length > 0) {
      await Appointments.updateMany(
        { _id: { $in: toBackfill } },
        { $set: { billId: bill._id } }
      );
    }

    // ------------- Create AppointmentHistory entries for completed appointments -------------
    try {
      const historyDocs = [];

      // helper to map role -> changedByModel
      const mapChangedByModel = (role) => {
        if (!role) return "Staff";
        const r = role.toString().toLowerCase();
        if (r === "businessowner" || r === "owner" || r === "business_owner") return "BusinessOwner";
        if (r === "client") return "Client";
        return "Staff"; // provider, frontdesk, admin, default to Staff
      };

      // existing appointments: record old status -> completed and old billId -> new billId
      for (const id of existingIds) {
        const old = existingOldMap[String(id)] || { status: null, billId: null };
        historyDocs.push({
          appointmentId: id,
          changedBy: req.user.id,
          changedByModel: mapChangedByModel(req.user.role),
          action: "completed",
          changes: {
            status: { old: old.status, new: "completed" },
            billId: { old: old.billId || null, new: String(bill._id) }
          },
          note: "Appointment marked as completed via bill"
        });
      }

      // newly created appointments (saved above) - create history entries (old = null)
      for (const saved of createdNew.filter(Boolean)) {
        historyDocs.push({
          appointmentId: saved._id,
          changedBy: req.user.id,
          changedByModel: mapChangedByModel(req.user.role),
          action: "completed",
          changes: {
            status: { old: null, new: "completed" },
            billId: { old: null, new: String(bill._id) }
          },
          note: "New appointment created and marked as completed via bill"
        });
      }

      if (historyDocs.length > 0) {
        // insertMany is fine here; failures will be caught below
        await AppointmentHistory.insertMany(historyDocs);
        console.log(`Inserted ${historyDocs.length} appointment history entries for completion.`);
      }
    } catch (histErr) {
      console.error("Failed to write appointment history entries for completion:", histErr);
      // proceed — history failing shouldn't break the whole flow
    }

    // ------------- Notifications -------------
    const realAppointments = allAppointmentsForBill.filter((a) => !a.autoGenerated);

    const frontdesks = await Staff.find({
      businessId: req.user.businessId,
      role: "frontdesk",
    });

    const notifications = [];

    for (const appt of realAppointments) {
      const baseNotification = {
        businessId: req.user.businessId,
        appointmentId: appt._id,
        clientId: appt.clientId,
        clientName: appt.clientName,
        serviceName: appt.serviceName,
        serviceId: appt.serviceId,
        start: appt.start,
        end: appt.end,
        type: "appointment-completed",
        method: "Marked As Complete",
        seen: false,
        createdAt: new Date(),
      };

      if (appt.staffId) {
        notifications.push({
          ...baseNotification,
          staffId: appt.staffId,
        });
      }

      frontdesks.forEach((fd) => {
        notifications.push({
          ...baseNotification,
          staffId: fd._id,
        });
      });

      notifications.push({
        ...baseNotification,
        staffId: req.user.businessId,
      });

      if (req.user.role === "admin") {
        notifications.push({
          ...baseNotification,
          staffId: req.user.id,
        });
      }
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(`Marked ${realAppointments.length} appointments as completed. Notifications sent.`);
    }

    // ------------- Return success -------------
    return res.json({
      message: "Receipt completed",
      bill,
      createdNewCount: newIds.length,
      updatedExistingCount: existingIds.length,
      autoGeneratedCount: allAppointmentsForBill.filter((a) => a.autoGenerated).length,
    });
  } catch (err) {
    console.error("Error marking receipt complete (non-transactional):", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});







module.exports = router;
