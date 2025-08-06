const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const connectDB = require("./config/db");

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
// ✅ Create HTTP server and wrap app
const http = require("http");
const server = http.createServer(app);

// ✅ Setup Socket.IO
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "*", // adjust in production
    methods: ["GET", "POST"]
  }
});

// ✅ Store user sockets
const userSockets = new Map();

// ✅ Socket.IO authentication
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token provided"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// ✅ Handle connections
io.on("connection", (socket) => {
  const userId = socket.userId;
  console.log(`🔌 User connected: ${userId}`);
  userSockets.set(userId, socket);

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${userId}`);
    userSockets.delete(userId);
  });
});

// ✅ Function to emit notification
const sendNotificationToUser = (userId, notification) => {
  const socket = userSockets.get(userId);
  if (socket) {
    socket.emit("notification", notification);
    console.log(`📢 Sent notification to user ${userId}`);
  } else {
    console.log(`⚠️ User ${userId} not connected`);
  }
};

// ✅ Export the notification function
module.exports = {
  app,
  server,
  io,
  sendNotificationToUser
};

// ✅ Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
