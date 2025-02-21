const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff'); // Import your Staff model
const Token = require('../models/Tokens'); // Import your Token model

const AppointmentEditMiddleware = async (req, res, next) => {
  
  try {
    
    // Extract the token from the Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Token not found' });
    }

    // Decode and verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user data to the request object

    // Check if the token exists and is valid in the database
    const tokenRecord = await Token.findOne({ token: token, userId: decoded.id, valid: true });
    if (!tokenRecord) {
      return res.status(401).json({ message: 'Unauthorized! Token has been invalidated or is not recognized.' });
    }

    const { staffId } = req.body;

    // If the user has the "manage_appointments" permission, ensure they provide a valid staffId
    if (decoded.permissions.includes("manage_appointments")) {
      if (!staffId) {
        return res.status(400).json({ message: "Staff ID is required!" });
      }

      // Find the staff member in the database
      const staff = await Staff.findById(staffId);
      if (!staff) {
        return res.status(404).json({ message: "Staff member not found!" });
      }

console.log("HIII")
      if (staff.businessId.toString() !== decoded.businessId.toString()) {
        console.log("This caused the error 2")
        return res.status(403).json({ message: "You can only add appointments for your business!" });
      }

      return next(); // Everything checks out, move to the next middleware or route handler
    }

console.log("1 is undefined",staffId)
console.log("2 is undefined",decoded.id)
console.log(staffId._id)
    // If the user does NOT have "manage_appointments", ensure they can only book an appointment for themselves
    if (staffId !== decoded.id ) {
      console.log("This caused the error 1")
      return res.status(403).json({ message: "You are only allowed to add appointments for yourself!" });
    }

    next(); // Proceed to the next middleware or route handler
  } catch (err) {
    console.error("Middleware error:", err);
    return res.status(400).json({ message: 'Invalid token' });
  }
};

module.exports = AppointmentEditMiddleware;
