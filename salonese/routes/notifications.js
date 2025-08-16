const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/NotificationsMiddleware");
const Appointment = require("../models/Appointments");
const Staff = require("../models/Staff");
const Website = require("../models/Website");
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const match = {
      businessId,
      staffId,
      seen: true,
    };

    console.log("Fetching notification history with filter:", match);

    const notifications = await Notification.find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(notifications);
  } catch (err) {
    console.error("Error fetching notification history:", err);
    res.status(500).json({ message: "Server error" });
  }
});


router.post("/send", authenticateToken, async (req, res) => {
  try {
    const { message, updateHeader } = req.body;
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(400).json({ message: "businessId is required" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    // 1️⃣ Find all staff in this business
    const staffs = await Staff.find({ businessId }).select("_id");

    if (!staffs.length) {
      return res.status(404).json({ message: "No staff found for this business" });
    }

    // 2️⃣ Create notifications
    const notifications = staffs.map((staff) => ({
      staffId: staff._id,
      businessId,
      type: "broadcast",
      method: "Admin Message",
      message: message.trim(),
    }));

    // 3️⃣ Save all notifications
    const savedNotifications = await Notification.insertMany(notifications);

    // 4️⃣ If updateHeader is true, also push message to Website.messages
    let updatedWebsite = null;
    if (updateHeader === true || updateHeader === "true") {
      updatedWebsite = await Website.findOneAndUpdate(
        { businessId },
        { $push: { messages: { text: message.trim(), sentAt: new Date() } } },
        { new: true }
      );
    }

    res.status(201).json({
      message: `Notification sent to ${savedNotifications.length} staff members`,
      notifications: savedNotifications,
      website: updatedWebsite,
    });

  } catch (err) {
    console.error("Error sending notification:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/messages", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(400).json({ message: "businessId is required" });
    }

    const website = await Website.findOne({ businessId }).select("messages");
    if (!website) {
      return res.status(404).json({ message: "Website not found" });
    }

    res.json(website.messages || []);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 2️⃣ Delete a specific message by _id
router.delete("/messages/:id", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const messageId = req.params.id;

    if (!businessId || !messageId) {
      return res.status(400).json({ message: "businessId and messageId are required" });
    }

    const updatedWebsite = await Website.findOneAndUpdate(
      { businessId },
      { $pull: { messages: { _id: messageId } } },
      { new: true }
    );

    if (!updatedWebsite) {
      return res.status(404).json({ message: "Website not found" });
    }

    res.json({
      message: "Message deleted successfully",
      messages: updatedWebsite.messages,
    });
  } catch (err) {
    console.error("Error deleting message:", err);
    res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
