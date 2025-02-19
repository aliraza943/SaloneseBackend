const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff'); // Import your Staff model

const AppointmentMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Token not found' });
    }

    // Decode JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);
    req.user = decoded; // Attach user data to request object

    const { staffId } = req.body;

    // If user has "manage_appointments" permission, check businessId
    if (decoded.permissions.includes("manage_appointments")) {
      if (!staffId) {
        return res.status(400).json({ message: "Staff ID is required!" });
      }

      // Find the staff member in the database
      const staff = await Staff.findById(staffId);
      if (!staff) {
        return res.status(404).json({ message: "Staff member not found!" });
      }

      // Check if the staff's businessId matches the user's businessId
      if (staff.businessId.toString() !== decoded.businessId.toString()) {
        return res.status(403).json({ message: "You can only add appointments for your business!" });
      }

      return next(); // Allow the request if everything matches
    }

    // If user does NOT have manage_appointments, ensure they can only book for themselves
    if (staffId !== decoded.id) {
      return res.status(403).json({ message: "You are only allowed to add appointments for yourself!" });
    }

    next(); // Proceed to the next middleware or route handler

  } catch (err) {
    console.error("Middleware error:", err);
    return res.status(400).json({ message: 'Invalid token' });
  }
};

module.exports = AppointmentMiddleware;
