const jwt = require("jsonwebtoken");
const Token = require("../models/Tokens"); // Your active sessions/token storage

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "Access Denied: No token provided." });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // attach user payload to request

        // Ensure token exists in DB and is valid
        const tokenRecord = await Token.findOne({ token, userId: decoded.id, valid: true });
        if (!tokenRecord) {
            return res.status(401).json({ message: "Invalid or expired token." });
        }

        next();
    } catch (err) {
        console.error("Token verification failed:", err);
        return res.status(403).json({ message: "Token is invalid or expired." });
    }
};

module.exports = verifyToken;
