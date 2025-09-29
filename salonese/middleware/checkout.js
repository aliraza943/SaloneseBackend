const jwt = require("jsonwebtoken");
const Token = require("../models/Tokens"); // Adjust the path as needed

const checkoutMiddleware = async (req, res, next) => {
  try {
 
    // Extract token from the Authorization header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ message: "Unauthorized! Token is required." });
    }

    // Verify token and attach the decoded payload (which should include the user's role)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Validate token record from the database
    const tokenRecord = await Token.findOne({
    token: token,
      userId: decoded.id,
      valid: true
    });
    if (!tokenRecord) {
      return res
        .status(401)
        .json({
          message: "Unauthorized! Token is invalid or has been revoked."
        });
    }

    // Check if the user's role is either admin or provider
    if (decoded.role === "admin" || decoded.role === "frontdesk") {
      return next(); // User is allowed, proceed to the next middleware or route handler
    } else {
      return res
        .status(403)
        .json({ message: "Forbidden! Insufficient permissions." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = checkoutMiddleware;
