const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const Token = require('../models/Tokens');

const AppointmentMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Token not found' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log("Decoded token:", decoded);

    const tokenRecord = await Token.findOne({ token, userId: decoded.id, valid: true });
    if (!tokenRecord) {
      return res.status(401).json({ message: 'Unauthorized! Token has been invalidated or is not recognized.' });
    }

    const staffId = req.body?.staffId || decoded.id;

    // If the user is an admin or someone else with management capability
    if (decoded.role !== "provider") {
      if (!staffId) {
        return res.status(400).json({ message: "Staff ID is required!" });
      }

      const staff = await Staff.findById(staffId);
      if (!staff) {
        return res.status(404).json({ message: "Staff member not found!" });
      }

      if (staff.businessId.toString() !== decoded.businessId.toString()) {
        return res.status(403).json({ message: "You can only add appointments for your own business!" });
      }

      return next();
    }

    // If the user is a provider, ensure they can only manage their own appointments
    if (staffId.toString() !== decoded.id.toString()) {
      return res.status(403).json({ message: "You are only allowed to add appointments for yourself!" });
    }

    next();
  } catch (err) {
    console.error("Middleware error:", err);
    return res.status(400).json({ message: 'Invalid token' });
  }
};

module.exports = AppointmentMiddleware;
