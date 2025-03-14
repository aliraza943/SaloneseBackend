const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const staffRoutes = require("./routes/staffRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const workingHoursRoutes = require("./routes/workinghoursRoutes")
const BusinessOwnerRoute = require("./routes/auth")
const clienteleRoute = require("./routes/clienteleRoute")
const checkoutRoute=require("./routes/checkoutRoute")

dotenv.config();
connectDB();
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/api/staff", staffRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/workhours",workingHoursRoutes)
app.use("/api/auth",BusinessOwnerRoute)
app.use("/api/clientelle",clienteleRoute)
app.use("/api/checkout",checkoutRoute)
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
