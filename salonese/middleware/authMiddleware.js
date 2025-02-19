const jwt = require('jsonwebtoken');

const authMiddleware = (requiredPermissions = []) => (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);

        // Extract user details
        req.user = {
            id: decoded.id,
            role: decoded.role,
            permissions: decoded.permissions || [],
            businessId:decoded.businessId
        };
        console.log(req.user)

        // Check required permissions if any are provided
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
