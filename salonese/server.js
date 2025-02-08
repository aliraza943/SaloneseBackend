const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");
const staffRoutes = require("./routes/staffRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const workingHoursRoutes = require("./routes/workinghoursRoutes")
dotenv.config();
connectDB();
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/api/staff", staffRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/workhours",workingHoursRoutes)

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
