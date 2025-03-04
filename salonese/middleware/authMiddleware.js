const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Token = require('../models/Tokens'); // adjust the path as necessary

const authMiddleware = (requiredPermissions = []) => async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ message: 'Access denied. No token provided.' });
        }
        
        // Extract the token string from the header
        const tokenStr = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(tokenStr, process.env.JWT_SECRET);
        console.log(decoded)
        
        // Validate that the decoded user ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
            console.log("this caused the errpr")
            return res.status(400).json({ message: 'Invalid user ID format.' });
        }
        
        // Populate the user object
        req.user = {
            id: decoded.id,
            role: decoded.role,
            permissions: decoded.permissions || [],
            businessId: decoded.businessId
        };
        
        // Check the Token model to ensure the token is still valid in the database
        const tokenRecord = await Token.findOne({ token: tokenStr, userId: req.user.id, valid: true });
        if (!tokenRecord) {
            
            return res.status(401).json({ message: 'Token has been invalidated or is not recognized.' });
        }
        
        // Check required permissions if provided
        if (requiredPermissions.length > 0) {
            const hasPermission = requiredPermissions.every(permission =>
                req.user.permissions.includes(permission)
            );
            if (!hasPermission) {
                return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
            }
        }
        
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = authMiddleware;
