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

    // Allow providers, admins, or users with "manage_clientele" permission
    if (decoded.role !== 'provider' && decoded.role !== 'admin' && !decoded.permissions?.includes("manage_clientele")) {
      return res.status(403).json({ message: "Access denied! You don't have permission to manage appointments." });
    }

    // Staff ID handling:
    // - Admins: authorized but we DON'T default staffId to admin's id (admin should pass staffId when needed)
    // - Non-provider (e.g., frontdesk) users: default staffId to their own id
    // - Providers with manage_clientele: require staffId in body
    if (decoded.role === 'admin') {
      // Admins: do not override/auto-set req.body.staffId
    } else if (decoded.role !== 'provider') {
      req.body.staffId = decoded.id;
    } else if (decoded.permissions?.includes("manage_clientele")) {
      // For providers with manage_clientele, require staffId in the request body.
      if (!req.body.staffId) {
        return res.status(400).json({ message: "Staff ID is required!" });
      }
    }

    console.log("Staff ID in request body:", req.body.staffId);
    if (req.body.staffId) {
      const staff = await Staff.findById(req.body.staffId);
      if (!staff) {
        console.log("THIS TRIGGEERED");
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
