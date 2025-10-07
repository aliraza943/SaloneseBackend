const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const connectDB = require("./config/db");
require("./routes/cronjob"); // Import the cron job scheduler
const staffRoutes = require("./routes/staffRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const workingHoursRoutes = require("./routes/workinghoursRoutes");
const BusinessOwnerRoute = require("./routes/auth");
const clienteleRoute = require("./routes/clienteleRoute");
const checkoutRoute = require("./routes/checkoutRoute");
const ProductRoute = require("./routes/ProductRoute");
const WebsoteRoute = require("./routes/WebsiteRoute");
const PaymentRoute = require("./routes/paymentRoute");
const reportAnalysis = require("./routes/reportAnalysis");
const Notifications = require("./routes/notifications");
const AiImage=require("./routes/AiImage")


const jwt = require("jsonwebtoken"); // ✅ JWT middleware

dotenv.config();
connectDB();


const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use("/api/staff", staffRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/workhours", workingHoursRoutes);
app.use("/api/auth", BusinessOwnerRoute);
app.use("/api/clientelle", clienteleRoute);
app.use("/api/checkout", checkoutRoute);
app.use("/api/products", ProductRoute);
app.use("/api/website", WebsoteRoute);
app.use("/api/payment", PaymentRoute);
app.use("/api/report-analysis", reportAnalysis);
app.use("/api/notifications", Notifications);
app.use("/api/aiHairstyle", AiImage);

// ✅ Create HTTP server and wrap app
const http = require("http");
const server = http.createServer(app);

// ✅ Setup Socket.IO

// ✅ Export the notification function
module.exports = {
  app
};

// ✅ Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
