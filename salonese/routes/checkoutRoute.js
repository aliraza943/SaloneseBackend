const express = require("express");
const router = express.Router();
const checkoutMiddleware = require("../middleware/checkout");
const Appointment = require("../models/Appointments");
const businessOwner = require("../models/BuisenessOwners");
const taxData = require("../models/taxData"); 
const Staff = require("../models/Staff");
const Services= require("../models/Service")
const BillComplete = require("../models/BillComplete");
const mongoose = require("mongoose");
const ProductSold = require("../models/productsSold");
const Product = require("../models/ProductModal");
router.get("/business/taxes", checkoutMiddleware,async (req, res) => {
  try {
    const businessId = req.user.businessId;
  

    if (!businessId) {
      return res.status(400).json({ message: "Business ID is required." });
    }

    // Find BusinessOwner where _id matches businessId
    const BusinessOwner = await businessOwner.findOne({ _id: businessId });

    if (!BusinessOwner) {
      return res.status(404).json({ message: "Business owner not found." });
    }

    const provinceCode = BusinessOwner.province; // Example: "ON"
    const applicableTaxes = taxData[provinceCode] || {};

    res.json({
      businessId,
      province: provinceCode,
      taxes: applicableTaxes
    });

  } catch (error) {
    console.error("Error fetching business taxes:", error);
    res.status(500).json({ message: "Server error while fetching taxes." });
  }
});

router.get("/client/:clientId/appointments", async (req, res) => {
  try {
    const { clientId } = req.params;

    console.log("Client ID received:", clientId);

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid client ID." });
    }

    // Convert string to ObjectId
    const clientObjectId = new mongoose.Types.ObjectId(clientId);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch appointments for the client
    const query = { clientId: clientObjectId };

    const total = await Appointment.countDocuments(query);

    const appointments = await Appointment.find(query)
      .sort({ start: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "staffId",
        select: "name email workingHours services"
      });

    console.log("Fetched appointments:", appointments.length);

    return res.json({
      page,
      limit,
      total,
      data: appointments
    });
  } catch (error) {
    console.error("Error fetching appointments for client:", error);
    return res.status(500).json({ message: "Server error while fetching client appointments." });
  }
});



router.post("/createRecords", checkoutMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(400).json({ message: "Business ID missing from token." });
    }
    

    const { clientId, appointments = [], clientName, products = [], notes, paymentMethod } = req.body;
    console.log("appointments", appointments);
    console.log("products", products);

    if (!clientId) {
      return res.status(400).json({ message: "clientId is required in request body." });
    }
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid clientId format." });
    }

    // must have at least appointments or products
    if ((!Array.isArray(appointments) || appointments.length === 0) &&
        (!Array.isArray(products) || products.length === 0)) {
      return res.status(400).json({ message: "No appointments or products provided." });
    }

    // --- Build Appointment docs if any ---
   // --- Build Appointment docs if any ---
let appointmentDocs = [];
if (Array.isArray(appointments) && appointments.length > 0) {
  appointmentDocs = appointments.map((a) => {
    let staffIdVal = a.staffId;
    let staffNameVal = "";  // ✅ capture staffName
    if (staffIdVal && typeof staffIdVal === "object" && staffIdVal._id) {
      staffNameVal = staffIdVal.name || ""; // ✅ take name if provided
      staffIdVal = staffIdVal._id;          // ✅ replace with ObjectId
    }

    const taxesArr = Array.isArray(a.taxesApplied) ? a.taxesApplied : [];
    const totalTax = taxesArr.reduce((sum, t) => {
      const amt = t && (typeof t.amount !== "undefined") ? Number(t.amount) : 0;
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);

    const serviceCharges = Number(a.serviceCharges ?? a.totalBill ?? 0);
    const totalBill = (typeof a.totalBill !== "undefined" && a.totalBill !== null)
      ? Number(a.totalBill)
      : serviceCharges + totalTax;

    return {
      businessId,
      clientId,
      clientName: a.clientName || clientName || "Unknown Client",

      staffId: staffIdVal || req.user._id,
      staffName: staffNameVal || a.staffId.name || "",   // ✅ store staffName
      serviceId: a.serviceId || undefined,
      serviceName: a.serviceName || "Untitled Service",

      serviceCharges: serviceCharges,
      serviceType: a.serviceType || a.serviceName || "general",

      title: a.title || a.serviceName || "Untitled Appointment",
      description: a.description || a.serviceName || "No description provided",

      start: a.start ? new Date(a.start) : undefined,
      end: a.end ? new Date(a.end) : undefined,

      taxesApplied: taxesArr,
      totalTax: Number(totalTax.toFixed(2)),
      totalBill: Number(totalBill.toFixed(2)),

      quantity: a.quantity || 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });
}


    // --- Insert appointments if any ---
    let createdAppointments = [];
    if (appointmentDocs.length > 0) {
      createdAppointments = await Appointment.insertMany(appointmentDocs, { ordered: true });
    }

    // Convert created appointment docs to plain objects for embedding into bill
// Convert created appointment docs to plain objects for embedding into bill
const embeddedAppointments = (createdAppointments || []).map((a, idx) => {
  const plain = typeof a.toObject === "function" ? a.toObject() : a;

  // pull staffName from the original request object at the same index
  const staffNameFromReq =
    appointments[idx]?.staffId?.name || appointments[idx]?.staffName || "";

  return {
    _id: plain._id,
    staffId: plain.staffId,
    staffName: staffNameFromReq,   // ✅ inject only in bill
    clientId: plain.clientId,
    businessId: plain.businessId,
    title: plain.title,
    serviceType: plain.serviceType,
    serviceId: plain.serviceId,
    serviceName: plain.serviceName,
    clientName: plain.clientName,
    description: plain.description,
    serviceCharges: Number(plain.serviceCharges || 0),
    start: plain.start,
    end: plain.end,
    taxesApplied: Array.isArray(plain.taxesApplied) ? plain.taxesApplied : [],
    totalTax: Number(plain.totalTax || 0),
    totalBill: Number(plain.totalBill || 0),
    note: plain.note || "",
    quantity: Number(plain.quantity || 1),
    autoGenerated: plain.autoGenerated || false,
  };
});


    // --- Normalize products for bill embedding ---
// --- Normalize products for bill embedding ---
const embeddedProducts = (Array.isArray(products) ? products : []).map((p) => ({
  name: p.name || p.title || "Product",
  price: Number(p.price ?? p.unitPrice ?? 0),
  quantity: Number(p.quantity ?? 1),
  description: p.description || "",
  clientName: clientName || embeddedAppointments[0]?.clientName || "Unknown Client", // ✅ add clientName
}));


    // --- Compute totals ---
    const appointmentTotal = embeddedAppointments.reduce(
      (acc, ap) => acc + (Number(ap.totalBill || 0) * Number(ap.quantity || 1)),
      0
    );
    const productsTotal = embeddedProducts.reduce(
      (acc, pr) => acc + (Number(pr.price || 0) * Number(pr.quantity || 0)),
      0
    );
    const totalAmount = Number((appointmentTotal + productsTotal).toFixed(2));

    // --- Create bill payload ---
    const billPayload = {
      businessId,
      clientId,
      clientName: clientName || embeddedAppointments[0]?.clientName || undefined,
      appointments: embeddedAppointments,
      products: embeddedProducts,
      totalAmount,
      status: "unpaid",
      createdAt: new Date(),
      notes: notes || "",
      paymentMethod: paymentMethod || undefined,
    };

    // --- Create Bill document ---
    const createdBill = await BillComplete.create(billPayload);

    // --- Update appointments: set billId on appointment records ---
    const appointmentIds = createdAppointments.map((a) => a._id);
    if (appointmentIds.length > 0) {
      await Appointment.updateMany(
        { _id: { $in: appointmentIds } },
        { $set: { billId: createdBill._id } }
      );
    }

    // re-fetch updated appointments
    const updatedAppointments = appointmentIds.length > 0
      ? await Appointment.find({ _id: { $in: appointmentIds } })
      : [];

    // --- PRODUCT VALIDATION & STOCK CHECK ---
    let createdProductsSold = [];
    if (Array.isArray(products) && products.length > 0) {
      const productRequests = products.map((p, idx) => ({
        idx,
        productId: p.productId,
        qty: Number(p.quantity ?? 1),
        raw: p,
      }));

      // Validate productId format
      const invalidIdEntries = productRequests.filter(pr => !pr.productId || !mongoose.Types.ObjectId.isValid(pr.productId));
      if (invalidIdEntries.length > 0) {
        if (appointmentIds.length > 0) await Appointment.deleteMany({ _id: { $in: appointmentIds } }).catch(()=>{});
        await BillComplete.findByIdAndDelete(createdBill._id).catch(()=>{});
        return res.status(400).json({
          success: false,
          message: "One or more products are missing a valid productId.",
          invalidProductIndexes: invalidIdEntries.map(e => e.idx),
        });
      }

      const productIds = productRequests.map((p) => p.productId);
      const foundProducts = await Product.find({ _id: { $in: productIds }, businessId }).lean();
      const foundById = foundProducts.reduce((m, fp) => { m[fp._id.toString()] = fp; return m; }, {});

      const missing = [];
      const insufficient = [];
      for (const pr of productRequests) {
        const f = foundById[pr.productId.toString()];
        if (!f) {
          missing.push(pr.idx);
        } else if (typeof f.stock === "number" && f.stock < pr.qty) {
          insufficient.push({ index: pr.idx, productId: pr.productId, available: f.stock, requested: pr.qty });
        }
      }

      if (missing.length > 0 || insufficient.length > 0) {
        if (appointmentIds.length > 0) await Appointment.deleteMany({ _id: { $in: appointmentIds } }).catch(()=>{});
        await BillComplete.findByIdAndDelete(createdBill._id).catch(()=>{});
        return res.status(400).json({
          success: false,
          message: "Product validation failed (missing or insufficient stock).",
          missingProductIndexes: missing,
          insufficientStock: insufficient,
        });
      }

      // --- Build ProductSold docs ---
 const productSoldDocs = products.map((p) => {
  const staffIdVal = (p.staffId && p.staffId._id) ? p.staffId._id : (p.staffId || req.user._id);
  const price = Number(p.price ?? p.unitPrice ?? 0);
  const qty = Number(p.quantity ?? 1);
  const total = Number((price * qty).toFixed(2));

  return {
    productId: p.productId,
    businessId,
    billId: createdBill._id,
    clientId,
    clientName: clientName || embeddedAppointments[0]?.clientName || "Unknown Client", // ✅ add clientName
    name: p.name || p.title || "Product",
    price,
    quantity: qty,
    total,
    description: p.description || "",
    soldAt: p.soldAt ? new Date(p.soldAt) : new Date(),
    staffId: staffIdVal,
    paymentMethod: p.paymentMethod || paymentMethod || undefined,
  };
});
      createdProductsSold = await ProductSold.insertMany(productSoldDocs, { ordered: true });

      // reduce stock
      const bulkOps = createdProductsSold.map((ps) => ({
        updateOne: {
          filter: { _id: ps.productId, businessId },
          update: { $inc: { stock: -Number(ps.quantity || 0) } },
        },
      }));
      if (bulkOps.length > 0) await Product.bulkWrite(bulkOps);
    }

    // SUCCESS
    return res.status(201).json({
      success: true,
      message: "Appointments, bill and productSold records created successfully.",
      bill: createdBill,
      appointments: updatedAppointments,
      productsSold: createdProductsSold,
    });
  } catch (err) {
    console.error("Error creating appointments / bill / products:", err);

    try {
      if (typeof createdBill !== "undefined" && createdBill && createdBill._id) {
        await BillComplete.findByIdAndDelete(createdBill._id).catch(()=>{});
      }
    } catch (cleanupErr) {
      console.error("Cleanup failed:", cleanupErr);
    }

    if (err && err.name === "ValidationError") {
      const details = {};
      for (const key in err.errors) {
        details[key] = err.errors[key].message;
      }
      return res.status(400).json({ success: false, message: "Validation error", details });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating records.",
      error: err.message,
    });
  }
});





router.get("/data", checkoutMiddleware, async (req, res) => {
  try {
    const requestTimeHeader = req.headers["x-request-time"];
    const requestTime = requestTimeHeader ? new Date(requestTimeHeader) : new Date();

    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(400).json({
        message: "Bad Request: Business ID missing from token."
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ---------------- Appointment Query ----------------
    let appointmentQuery = { businessId };

    if (req.query.staffId) {
      appointmentQuery.staffId = req.query.staffId;
    }

    // ---------------- ProductSold Query ----------------
    let productQuery = { businessId };
    if (req.query.staffId) {
      productQuery.staffId = req.query.staffId;
    }

    // ---------------- Date Filter ----------------
    if (req.query.date) {
      const dateStr = req.query.date;

      if (dateStr.length === 7) {
        // YYYY-MM → filter whole month
        const [year, month] = dateStr.split("-").map(Number);
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

        appointmentQuery.start = { $gte: startOfMonth, $lte: endOfMonth };
        productQuery.soldAt = { $gte: startOfMonth, $lte: endOfMonth };
      } else {
        // full date → filter that day
        const dateParam = new Date(dateStr);
        if (!isNaN(dateParam)) {
          const startOfDay = new Date(dateParam);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(dateParam);
          endOfDay.setHours(23, 59, 59, 999);

          appointmentQuery.start = { $gte: startOfDay, $lte: endOfDay };
          productQuery.soldAt = { $gte: startOfDay, $lte: endOfDay };
        }
      }
    }

    // ---------------- Fetch both ----------------
    const [totalAppointments, appointments, totalProducts, productsSold] = await Promise.all([
      Appointment.countDocuments(appointmentQuery),
      Appointment.find(appointmentQuery)
        .sort({ start: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: "staffId",
          select: "name email workingHours services"
        }),
      ProductSold.countDocuments(productQuery),
      ProductSold.find(productQuery)
        .sort({ soldAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          { path: "staffId", select: "name email" },
          { path: "productId", select: "name price" },
          { path: "clientId", select: "name email" }
        ])
    ]);

    res.json({
      requestedAt: requestTime,
      page,
      limit,
      appointments: {
        total: totalAppointments,
        data: appointments
      },
      products: {
        total: totalProducts,
        data: productsSold
      }
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({
      message: "Server error while fetching data."
    });
  }
});


router.post("/check-appointment-conflict", checkoutMiddleware, async (req, res) => {
  try {
    const { staffId, start, end } = req.body;
    const businessId = req.user.businessId;

    if (!staffId || !start || !end) {
      return res.status(400).json({ message: "Missing required fields: staffId, start, end." });
    }

    // Convert to Date objects
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid start or end date format." });
    }

    // 1️⃣ Check for conflicting appointment
    const overlappingAppointment = await Appointment.findOne({
      staffId,
      businessId,
      status: { $in: ["booked", "completed"] },
      $or: [
        { start: { $lt: endDate }, end: { $gt: startDate } }, // overlap
      ],
    });

    // 2️⃣ Load Business owner → province → taxes
    const BusinessOwner = await businessOwner.findOne({ _id: businessId });
    if (!BusinessOwner) {
      return res.status(404).json({ message: "Business owner not found." });
    }

    const provinceCode = BusinessOwner.province;
    const applicableTaxes = taxData[provinceCode] || {};

    // 3️⃣ Final response
    res.json({
      conflict: !!overlappingAppointment,
      appointment: overlappingAppointment || null,
      taxes: applicableTaxes,
    });

  } catch (err) {
    console.error("❌ Error checking appointment conflict:", err);
    res.status(500).json({ message: "Server error while checking conflict." });
  }
});

router.post("/getBill", async (req, res) => {
  try {
    const { clientId, businessId, date } = req.body;

    if (!clientId || !businessId || !date) {
      return res.status(400).json({ message: "clientId, businessId, and date are required." });
    }

    // Prepare date range for the day
    const dateParam = new Date(date);
    if (isNaN(dateParam)) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    const startOfDay = new Date(dateParam);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(dateParam);
    endOfDay.setHours(23, 59, 59, 999);

    // Query
 const query = {
  clientId,
  businessId,
  start: { $gte: startOfDay, $lte: endOfDay },
  status: { $ne: "cancelled" },   // 👈 exclude cancelled appointments
};


    const appointments = await Appointment.find(query).populate({
      path: "staffId",
      select: "name email",
    });

    console.log("▶️ Appointments found:", appointments);

    // ✅ Respond with appointments
    res.status(200).json({
      success: true,
      total: appointments.length,
      appointments: appointments,
    });
  } catch (error) {
    console.error("❌ Error searching client appointments by date:", error);
    res.status(500).json({ message: "Server error while searching appointments." });
  }
});

router.get("/staff/list-with-services", checkoutMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;

    if (!businessId) {
      return res.status(400).json({ message: "Business ID missing from token." });
    }

    // Find providers for this business
    const staffList = await Staff.find({ 
        businessId, 
        role: "provider" 
      })
      .select("name email phone role services")
      .populate({
        path: "services",
        model: Services,
        select: "name description duration price"
      })
      .lean();

    res.json({
      success: true,
      total: staffList.length,
      staff: staffList
    });

  } catch (error) {
    console.error("Error fetching staff with services:", error);
    res.status(500).json({ message: "Server error while fetching staff with services." });
  }
});
router.get("/getFullBill/:billId", async (req, res) => {
  try {
    const { billId } = req.params;

    if (!billId) {
      return res.status(400).json({ message: "Bill ID is required." });
    }

    const bill = await BillComplete.findById(billId);

    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    // Clean appointments (remove mongoose internals)
    const plainAppointments = (bill.appointments || []).map(appt => appt.toObject());

    res.json({
      success: true,
      _id: bill._id,
      clientId: bill.clientId,
      businessId: bill.businessId,
      status: bill.status,
      totalAmount: bill.totalAmount,
      products: bill.products,   // already plain array
      appointments: plainAppointments,
      createdAt: bill.createdAt
    });

  } catch (err) {
    console.error("Error fetching full bill:", err);
    res.status(500).json({ message: "Server error while fetching full bill." });
  }
});


module.exports = router;
