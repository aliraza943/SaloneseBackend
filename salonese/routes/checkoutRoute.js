const express = require("express");
const router = express.Router();
const checkoutMiddleware = require("../middleware/checkout");
const Appointment = require("../models/Appointments");
const businessOwner = require("../models/BuisenessOwners");
const taxData = require("../models/taxData"); 
const Staff = require("../models/Staff");
const Services= require("../models/Service")
const BillComplete = require("../models/BillComplete");

router.get("/business/taxes", checkoutMiddleware,async (req, res) => {
  try {
    const businessId = req.user.businessId;
  

    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required." });
    }

    // Find BusinessOwner where _id matches businessId
    const BusinessOwner = await businessOwner.findOne({ _id: businessId });

    if (!BusinessOwner) {
      return res.status(404).json({ message: "Business owner not found." });
    }

    const provinceCode = BusinessOwner.province; // Example: "ON"
    const applicableTaxes = taxData[provinceCode] || {};

    res.json({
      businessId,
      province: provinceCode,
      taxes: applicableTaxes
    });

  } catch (error) {
    console.error("Error fetching business taxes:", error);
    res.status(500).json({ message: "Server error while fetching taxes." });
  }
});

router.get("/client/:clientId/appointments", async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ message: "Client ID is required." });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query to fetch appointments for the given clientId
    const query = { clientId };

    // Count the total documents that match the query
    const total = await Appointment.countDocuments(query);

    // Fetch the appointments with pagination and sorting
    const appointments = await Appointment.find(query)
      .sort({ start: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "staffId",
        select: "name email workingHours services"
      });

    res.json({
      page,
      limit,
      total,
      data: appointments
    });
  } catch (error) {
    console.error("Error fetching appointments for client:", error);
    res.status(500).json({ message: "Server error while fetching client appointments." });
  }
});

router.get("/data", checkoutMiddleware, async (req, res) => {
  try {
    const requestTimeHeader = req.headers["x-request-time"];
    const requestTime = requestTimeHeader ? new Date(requestTimeHeader) : new Date();

    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(400).json({
        message: "Bad Request: Business ID missing from token."
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = { businessId };

    if (req.query.staffId) {
      query.staffId = req.query.staffId;
    }

    // Process the date query parameter
    if (req.query.date) {
      const dateStr = req.query.date;
      // If the date string is in "YYYY-MM" format, filter for the entire month
      if (dateStr.length === 7) {
        const [year, month] = dateStr.split("-").map(Number);
        const startOfMonth = new Date(year, month - 1, 1);
        // Setting day=0 returns the last day of the previous month, so we use month instead.
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
        query.start = { $gte: startOfMonth, $lte: endOfMonth };
      } else {
        // Otherwise, assume it's a full date and filter for that day
        const dateParam = new Date(dateStr);
        if (!isNaN(dateParam)) {
          const startOfDay = new Date(dateParam);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(dateParam);
          endOfDay.setHours(23, 59, 59, 999);
          query.start = { $gte: startOfDay, $lte: endOfDay };
        }
      }
    }

    const total = await Appointment.countDocuments(query);

    const appointments = await Appointment.find(query)
      .sort({ start: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "staffId",
        select: "name email workingHours services"
      });

    res.json({
      requestedAt: requestTime,
      page,
      limit,
      total,
      data: appointments
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({
      message: "Server error while fetching appointments."
    });
  }
});

router.post("/check-appointment-conflict", checkoutMiddleware, async (req, res) => {
  try {
    const { staffId, start, end } = req.body;
    const businessId = req.user.businessId;

    if (!staffId || !start || !end) {
      return res.status(400).json({ message: "Missing required fields: staffId, start, end." });
    }

    // Convert to Date objects
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid start or end date format." });
    }

    // 1️⃣ Check for conflicting appointment
    const overlappingAppointment = await Appointment.findOne({
      staffId,
      businessId,
      status: { $in: ["booked", "completed"] },
      $or: [
        { start: { $lt: endDate }, end: { $gt: startDate } }, // overlap
      ],
    });

    // 2️⃣ Load Business owner → province → taxes
    const BusinessOwner = await businessOwner.findOne({ _id: businessId });
    if (!BusinessOwner) {
      return res.status(404).json({ message: "Business owner not found." });
    }

    const provinceCode = BusinessOwner.province;
    const applicableTaxes = taxData[provinceCode] || {};

    // 3️⃣ Final response
    res.json({
      conflict: !!overlappingAppointment,
      appointment: overlappingAppointment || null,
      taxes: applicableTaxes,
    });

  } catch (err) {
    console.error("❌ Error checking appointment conflict:", err);
    res.status(500).json({ message: "Server error while checking conflict." });
  }
});
router.post("/getBill", async (req, res) => {
  try {
    const { clientId, businessId, date } = req.body;

    if (!clientId || !businessId || !date) {
      return res.status(400).json({ message: "clientId, businessId, and date are required." });
    }

    // Prepare date range for the day
    const dateParam = new Date(date);
    if (isNaN(dateParam)) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    const startOfDay = new Date(dateParam);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dateParam);
    endOfDay.setHours(23, 59, 59, 999);

    // Query
    const query = {
      clientId,
      businessId,
      start: { $gte: startOfDay, $lte: endOfDay },
    };

    const appointments = await Appointment.find(query).populate({
      path: "staffId",
      select: "name email",
    });

    console.log("▶️ Appointments found:", appointments);

    // ✅ Respond with appointments
    res.status(200).json({
      success: true,
      total: appointments.length,
      appointments: appointments,
    });
  } catch (error) {
    console.error("❌ Error searching client appointments by date:", error);
    res.status(500).json({ message: "Server error while searching appointments." });
  }
});

router.get("/staff/list-with-services", checkoutMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(400).json({ message: "Business ID missing from token." });
    }

    // Find providers for this business
    const staffList = await Staff.find({ 
        businessId, 
        role: "provider" 
      })
      .select("name email phone role services")
      .populate({
        path: "services",
        model: Services,
        select: "name description duration price"
      })
      .lean();

    res.json({
      success: true,
      total: staffList.length,
      staff: staffList
    });

  } catch (error) {
    console.error("Error fetching staff with services:", error);
    res.status(500).json({ message: "Server error while fetching staff with services." });
  }
});
router.get("/getFullBill/:billId", async (req, res) => {
  try {
    const { billId } = req.params;

    if (!billId) {
      return res.status(400).json({ message: "Bill ID is required." });
    }

    const bill = await BillComplete.findById(billId);

    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    // Clean appointments (remove mongoose internals)
    const plainAppointments = (bill.appointments || []).map(appt => appt.toObject());

    res.json({
      success: true,
      _id: bill._id,
      clientId: bill.clientId,
      businessId: bill.businessId,
      status: bill.status,
      totalAmount: bill.totalAmount,
      products: bill.products,   // already plain array
      appointments: plainAppointments,
      createdAt: bill.createdAt
    });

  } catch (err) {
    console.error("Error fetching full bill:", err);
    res.status(500).json({ message: "Server error while fetching full bill." });
  }
});


module.exports = router;
