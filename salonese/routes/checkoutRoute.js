const express = require("express");
const router = express.Router();
const checkoutMiddleware = require("../middleware/checkout");
const Appointment = require("../models/Appointments"); // Adjust the path as needed

// GET /data route protected by checkoutMiddleware
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



module.exports = router;


