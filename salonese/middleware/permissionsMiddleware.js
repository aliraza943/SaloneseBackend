const jwt = require("jsonwebtoken");
const Staff = require("../models/Staff");
const Token = require("../models/Tokens"); // Import the Token model

const verifyTokenAndPermissions = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1]; // Extract token
        if (!token) {
            return res.status(401).json({ message: "Unauthorized! Token is required." });
        }

        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 

        
        const tokenRecord = await Token.findOne({ token: token, userId: decoded.id, valid: true });
        if (!tokenRecord) {
            return res.status(401).json({ message: "Unauthorized! Token is invalid or has been revoked." });
        }

        const { role, permissions, businessId, id } = decoded;
        const staff = await Staff.findById(req.params.id);
        console.log("THIS WAS THE FETCHED ID", req.params.id);
        console.log("THIS IS DECODED", decoded);

        if (!staff) {
            console.log("This was the response sent 1");
            return res.status(404).json({ message: "Staff member not found!" });
        }

        
        if (role === "barber" && staff._id.toString() !== id) {
            console.log("This was the response sent 2");
            return res.status(403).json({ message: "You can only modify your own schedule!" });
        }

        
        if (role !== "barber" && (!permissions.includes("modify_working_hours") || staff.businessId.toString() !== businessId)) {
            console.log("This was the response sent 3");
            return res.status(403).json({ message: "You don't have permission to modify this schedule!" });
        }

        req.staff = staff; 
        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error);

        if (error.name === "JsonWebTokenError") {
            console.log("This was the response sent 4");
            return res.status(401).json({ message: "Invalid or expired token!" });
        }

        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

module.exports = verifyTokenAndPermissions;
