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


// helper: decrementBatches (place this above router.post)
async function decrementBatches(productId, reqQty) {
  const product = await Product.findById(productId).lean();
  if (!product) throw new Error(`Product ${productId} not found`);

  let remaining = Number(reqQty || 0);
  const updatedBatches = [...(product.batches || [])].sort(
    (a, b) => new Date(a.addedAt) - new Date(b.addedAt)
  );

  const consumed = []; // { batchId, qty }

  for (const batch of updatedBatches) {
    if (remaining <= 0) break;
    const available = Number(batch.quantity || 0);
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    remaining -= take;

    consumed.push({
      batchId: batch._id, // keep existing id as-is
      qty: take,
    });

    batch.quantity = available - take;
  }

  if (remaining > 0) {
    throw new Error(`Insufficient stock for product ${productId}, missing ${remaining}`);
  }

  const newStock = updatedBatches.reduce((s, b) => s + (Number(b.quantity || 0)), 0);

  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        batches: updatedBatches,
        stock: newStock,
      },
    }
  );

  return consumed; // array of { batchId, qty }
}

// ---------------------------------------------------------

router.post("/createRecords", checkoutMiddleware, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (!businessId) {
      return res.status(400).json({ message: "Business ID missing from token." });
    }

    const { clientId, appointments = [], clientName, products = [], notes, paymentMethod } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: "clientId is required in request body." });
    }
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: "Invalid clientId format." });
    }

    if (
      (!Array.isArray(appointments) || appointments.length === 0) &&
      (!Array.isArray(products) || products.length === 0)
    ) {
      return res.status(400).json({ message: "No appointments or products provided." });
    }

    // --- build appointment docs ---
    let appointmentDocs = [];
    if (Array.isArray(appointments) && appointments.length > 0) {
      appointmentDocs = appointments.map((a) => {
        let staffIdVal = a.staffId;
        let staffNameVal = "";
        if (staffIdVal && typeof staffIdVal === "object" && staffIdVal._id) {
          staffNameVal = staffIdVal.name || "";
          staffIdVal = staffIdVal._id;
        }

        const taxesArr = Array.isArray(a.taxesApplied) ? a.taxesApplied : [];
        const totalTax = taxesArr.reduce((sum, t) => {
          const amt = t && typeof t.amount !== "undefined" ? Number(t.amount) : 0;
          return sum + (isNaN(amt) ? 0 : amt);
        }, 0);

        const serviceCharges = Number(a.serviceCharges ?? a.totalBill ?? 0);
        const totalBill =
          typeof a.totalBill !== "undefined" && a.totalBill !== null
            ? Number(a.totalBill)
            : serviceCharges + totalTax;

        return {
          businessId,
          clientId,
          clientName: a.clientName || clientName || "Unknown Client",
          staffId: staffIdVal || req.user._id,
          staffName: staffNameVal || a.staffId.name || "",
          serviceId: a.serviceId || undefined,
          serviceName: a.serviceName || "Untitled Service",
          serviceCharges,
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

    // --- insert appointments ---
    let createdAppointments = [];
    if (appointmentDocs.length > 0) {
      createdAppointments = await Appointment.insertMany(appointmentDocs, { ordered: true });
    }

    // --- embedded data for bill ---
    const embeddedAppointments = (createdAppointments || []).map((a, idx) => {
      const plain = typeof a.toObject === "function" ? a.toObject() : a;
      const staffNameFromReq =
        appointments[idx]?.staffId?.name || appointments[idx]?.staffName || "";

      return {
        ...plain,
        staffName: staffNameFromReq,
        serviceCharges: Number(plain.serviceCharges || 0),
        totalTax: Number(plain.totalTax || 0),
        totalBill: Number(plain.totalBill || 0),
        quantity: Number(plain.quantity || 1),
      };
    });

    const embeddedProducts = (Array.isArray(products) ? products : []).map((p) => ({
      name: p.name || p.title || "Product",
      price: Number(p.price ?? p.unitPrice ?? 0),
      quantity: Number(p.quantity ?? 1),
      description: p.description || "",
      clientName: clientName || embeddedAppointments[0]?.clientName || "Unknown Client",
    }));

    const appointmentTotal = embeddedAppointments.reduce(
      (acc, ap) => acc + (Number(ap.totalBill || 0) * Number(ap.quantity || 1)),
      0
    );
    const productsTotal = embeddedProducts.reduce(
      (acc, pr) => acc + (Number(pr.price || 0) * Number(pr.quantity || 0)),
      0
    );
    const totalAmount = Number((appointmentTotal + productsTotal).toFixed(2));

    const billPayload = {
      businessId,
      clientId,
      clientName: clientName || embeddedAppointments[0]?.clientName,
      appointments: embeddedAppointments,
      products: embeddedProducts,
      totalAmount,
      status: "unpaid",
      createdAt: new Date(),
      notes: notes || "",
      paymentMethod: paymentMethod || undefined,
    };

    const createdBill = await BillComplete.create(billPayload);

    const appointmentIds = createdAppointments.map((a) => a._id);
    if (appointmentIds.length > 0) {
      await Appointment.updateMany(
        { _id: { $in: appointmentIds } },
        { $set: { billId: createdBill._id } }
      );
    }

    const updatedAppointments =
      appointmentIds.length > 0
        ? await Appointment.find({ _id: { $in: appointmentIds } })
        : [];

    // --- PRODUCT VALIDATION + decrement batches ---
    let createdProductsSold = [];
    if (Array.isArray(products) && products.length > 0) {
      const productRequests = products.map((p, idx) => ({
        idx,
        productId: p.productId,
        qty: Number(p.quantity ?? 1),
        raw: p,
      }));

      const invalidIdEntries = productRequests.filter(
        (pr) => !pr.productId || !mongoose.Types.ObjectId.isValid(pr.productId)
      );
      if (invalidIdEntries.length > 0) {
        await Appointment.deleteMany({ _id: { $in: appointmentIds } }).catch(() => {});
        await BillComplete.findByIdAndDelete(createdBill._id).catch(() => {});
        return res.status(400).json({
          success: false,
          message: "One or more products are missing a valid productId.",
          invalidProductIndexes: invalidIdEntries.map((e) => e.idx),
        });
      }

      const productIds = productRequests.map((p) => p.productId);
      const foundProducts = await Product.find({ _id: { $in: productIds }, businessId }).lean();
      const foundById = foundProducts.reduce((m, fp) => {
        m[fp._id.toString()] = fp;
        return m;
      }, {});

      const missing = [];
      const insufficient = [];
      for (const pr of productRequests) {
        const f = foundById[pr.productId.toString()];
        if (!f) {
          missing.push(pr.idx);
        } else if (typeof f.stock === "number" && f.stock < pr.qty) {
          insufficient.push({
            index: pr.idx,
            productId: pr.productId,
            available: f.stock,
            requested: pr.qty,
          });
        }
      }

      if (missing.length > 0 || insufficient.length > 0) {
        await Appointment.deleteMany({ _id: { $in: appointmentIds } }).catch(() => {});
        await BillComplete.findByIdAndDelete(createdBill._id).catch(() => {});
        return res.status(400).json({
          success: false,
          message: "Product validation failed (missing or insufficient stock).",
          missingProductIndexes: missing,
          insufficientStock: insufficient,
        });
      }

      // --- Build ProductSold docs and decrement batches ---
      const productSoldDocs = [];
      for (const p of products) {
        const staffIdVal =
          p.staffId && p.staffId._id ? p.staffId._id : p.staffId || req.user._id;
        const price = Number(p.price ?? p.unitPrice ?? 0);
        const qty = Number(p.quantity ?? 1);
        const total = Number((price * qty).toFixed(2));

        // ✅ decrement batches & record which were consumed
        const consumedBatches = await decrementBatches(p.productId, qty);

        productSoldDocs.push({
          productId: p.productId,
          businessId,
          billId: createdBill._id,
          clientId,
          clientName: clientName || embeddedAppointments[0]?.clientName || "Unknown Client",
          name: p.name || p.title || "Product",
          price,
          quantity: qty,
          total,
          description: p.description || "",
          soldAt: p.soldAt ? new Date(p.soldAt) : new Date(),
          staffId: staffIdVal,
          paymentMethod: p.paymentMethod || paymentMethod,
          consumedBatches, // ✅ store batch usage
        });
      }

      createdProductsSold = await ProductSold.insertMany(productSoldDocs, { ordered: true });
    }

    // --- SUCCESS ---
    return res.status(201).json({
      success: true,
      message: "Appointments, bill, and productSold records created successfully.",
      bill: createdBill,
      appointments: updatedAppointments,
      productsSold: createdProductsSold,
    });
  } catch (err) {
    console.error("Error creating appointments / bill / products:", err);
    if (err && err.message && err.message.includes("Insufficient stock")) {
      return res.status(400).json({ success: false, message: err.message });
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
    let appointmentQuery = { businessId, status: "booked" }; // only booked

    if (req.query.staffId) {
      appointmentQuery.staffId = req.query.staffId;
    }

    // ---------------- ProductSold Query (unchanged) ----------------
    let productQuery = { businessId };
    if (req.query.staffId) {
      productQuery.staffId = req.query.staffId;
    }

    // ---------------- Date Filter: Last month till end of today ----------------
    const now = new Date();

    // Start of last month (1st day, 00:00:00)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);

    // End of today (23:59:59.999)
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    appointmentQuery.start = { $gte: startOfLastMonth, $lte: endOfToday };
    productQuery.soldAt = { $gte: startOfLastMonth, $lte: endOfToday };

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
