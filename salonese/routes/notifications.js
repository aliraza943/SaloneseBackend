const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/NotificationsMiddleware");
const Appointment = require("../models/Appointments");

const Notification = require("../models/notifications");
router.get("/", authenticateToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    const businessId = req.user.businessId;
    const { seen } = req.query;

    const match = {
      businessId,
      staffId,
    };

    if (seen === "true" || seen === "false") {
      match.seen = seen === "true";
    }

    console.log("Fetching notifications with filter:", match);

    const notifications = await Notification.find(match)
      .sort({ createdAt: -1 })
      .lean();

    console.log("Total notifications found:", notifications.length);

    // Fetch appointment info for notifications that have valid appointmentId
    const results = await Promise.all(
      notifications.map(async (notification) => {
        if (!notification.appointmentId) return notification;

        const appointment = await Appointment.findOne({
          _id: notification.appointmentId,
          status: "booked", // or whatever your booked status is
        }).lean();

        // If appointment exists and is booked, include it
        if (appointment) {
          return {
            ...notification,
            appointmentDetails: appointment,
          };
        }

        return notification; // fallback if no appointment found
      })
    );

    res.json(results);
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.patch("/mark-seen/:id", authenticateToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    const businessId = req.user.businessId;
    const notificationId = req.params.id;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        staffId,
        businessId,
      },
      { seen: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Notification marked as seen", notification });
  } catch (err) {
    console.error("Error marking notification as seen:", err);
    res.status(500).json({ message: "Server error" });
  }
});
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const staffId = req.user.id;
    const businessId = req.user.businessId;
    const { date } = req.query;

    const match = {
      businessId,
      staffId,
      seen: true,
    };

    // If date is provided, filter notifications created on that date
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      match.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    console.log("Fetching notification history with filter:", match);

    const notifications = await Notification.find(match)
      .sort({ createdAt: -1 })
      .lean();

    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notification history:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
