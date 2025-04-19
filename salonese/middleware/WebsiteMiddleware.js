const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Token = require('../models/Tokens'); // Adjust the path as necessary

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const tokenStr = authHeader.replace('Bearer ', '');

    // Decode and verify token
    const decoded = jwt.verify(tokenStr, process.env.JWT_SECRET);

    // Validate decoded user ID format
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(400).json({ message: 'Invalid user ID format.' });
    }

    // Ensure businessId exists in the token
    if (!decoded.businessId) {
      return res.status(401).json({ message: 'Missing businessId in token.' });
    }

    // Assign user details to request object
    req.user = {
      id: decoded.id,
      role: decoded.role,
      permissions: decoded.permissions || [],
      businessId: decoded.businessId
    };

    // Check if token is valid and exists in DB
    const tokenRecord = await Token.findOne({
      token: tokenStr,
      userId: req.user.id,
      valid: true
    });

    if (!tokenRecord) {
      return res.status(401).json({ message: 'Token has been invalidated or is not recognized.' });
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = authMiddleware;
