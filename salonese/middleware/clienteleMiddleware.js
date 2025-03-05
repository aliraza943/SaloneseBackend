const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const Token = require('../models/Tokens');

const ClienteleMiddleware = async (req, res, next) => {
  try {
    // Extract token from the Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Token not found' });
    }

    // Decode and verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user data to request

    // Check if the token is valid in the database
    console.log(decoded);
    const tokenRecord = await Token.findOne({ token: token, userId: decoded.id, valid: true });
    if (!tokenRecord) {
      return res.status(401).json({ message: 'Unauthorized! Token has been invalidated or is not recognized.' });
    }

    // Allow only barbers or users with "manage_clientele" permission
    if (decoded.role !== 'barber' && !decoded.permissions.includes("manage_clientele")) {
      return res.status(403).json({ message: "Access denied! You don't have permission to manage appointments." });
    }

    // For frontdesk (or non-barber) users, default staffId to their own id
    if (decoded.role !== 'barber') {
      req.body.staffId = decoded.id;
    } else if (decoded.permissions.includes("manage_clientele")) {
      // For barbers with manage_clientele, require staffId in the request body.
      if (!req.body.staffId) {
        return res.status(400).json({ message: "Staff ID is required!" });
      }
    }

    // If staffId is provided, validate the staff record and ensure it belongs to the same business.
    if (req.body.staffId) {
      const staff = await Staff.findById(req.body.staffId);
      if (!staff) {
        return res.status(404).json({ message: "Staff member not found!" });
      }
      if (staff.businessId.toString() !== decoded.businessId.toString()) {
        return res.status(403).json({ message: "You can only add appointments for your business!" });
      }
    }

    next(); // User is authorized, proceed
  } catch (err) {
    console.error("Middleware error:", err);
    return res.status(400).json({ message: 'Invalid token' });
  }
};

module.exports = ClienteleMiddleware;
