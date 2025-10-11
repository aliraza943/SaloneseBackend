// routes/reportAnalysis.js
const express = require('express');
const router = express.Router();
const Bill = require('../models/BillComplete');
const mongoose = require('mongoose');
const authMiddleware=require('../middleware/markAsCompleteMiddleware')
const Product = require('../models/ProductModal');
const ProductsSold = require('../models/productsSold');
const ArchiveStaff=require('../models/ArchiveStaff');
const Staff=require('../models/Staff');
const Service = require('../models/Service');
const Clientelle = require('../models/Cleintele');
router.get('/', authMiddleware, async (req, res) => {
  const { startDate, endDate, staffId } = req.query;
  const businessId = req.user?.businessId;

  console.log('Incoming GET /api/report-analysis request:');
  console.log('startDate:', startDate);
  console.log('endDate:', endDate);
  console.log('staffId:', staffId);
  console.log('businessId from token:', businessId);

  if (!startDate || !endDate) {
    console.log('❌ Missing startDate or endDate');
    return res.status(400).json({ error: 'startDate and endDate are required' });
  }

  if (!businessId) {
    console.log('❌ Unauthorized - Missing businessId');
    return res.status(401).json({ error: 'Unauthorized: Missing businessId' });
  }

  try {
    // Build query
   const query = {
  businessId,
  'appointments.start': {
    $gte: new Date(startDate),
    $lte: new Date(endDate),
  },
};


    if (staffId) {
      query['appointments.staffId'] = staffId;
    }

    console.log('MongoDB query:', JSON.stringify(query, null, 2));

    const bills = await Bill.find(query);
    console.log(`Found ${bills.length} bills`);

    const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const paidCount = bills.filter((b) => b.status === 'paid').length;
    const unpaidCount = bills.filter((b) => b.status === 'unpaid').length;
    const allProducts = bills.flatMap((bill) => bill.products || []);

    // Filter appointments per staffId if provided
    const filteredBills = staffId
      ? bills
          .map((bill) => {
            const filteredAppointments = (bill.appointments || []).filter(
              (app) => app.staffId === staffId
            );
            return {
              ...bill.toObject(),
              appointments: filteredAppointments,
            };
          })
          .filter((bill) => bill.appointments.length > 0)
      : bills;

    console.log(`Filtered bills after staffId: ${filteredBills.length}`);

    const staffMap = new Map();
    filteredBills.forEach((bill) => {
      (bill.appointments || []).forEach((app) => {
        if (app.staffId && app.staffName) {
          staffMap.set(app.staffId, app.staffName);
        }
      });
    });

    const uniqueStaff = Array.from(staffMap, ([staffId, staffName]) => ({
      staffId,
      staffName,
    }));

    console.log('Unique staff involved:', uniqueStaff);

    res.json({
      success: true,
      totalBills: filteredBills.length,
      totalRevenue,
      paidBills: paidCount,
      unpaidBills: unpaidCount,
      from: startDate,
      to: endDate,
      products: allProducts,
      staff: uniqueStaff,
      bills: filteredBills,
    });
  } catch (err) {
    console.error('❌ Internal server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/products', authMiddleware, async (req, res) => {
  try {
    const { fromDate, toDate, productIds, includeInventory } = req.body;
    const businessId = req.user?.businessId;

    // ---- Basic validation ----
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }
    if (!businessId) {
      return res.status(401).json({ error: "Unauthorized: Missing businessId" });
    }
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: "At least one productId is required" });
    }

    const validObjectIds = productIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validObjectIds.length !== productIds.length) {
      return res.status(400).json({ error: "Invalid productIds provided" });
    }

    // ---- Fetch products ----
    const products = await Product.find({ 
      _id: { $in: validObjectIds },
      businessId
    });

    if (products.length !== productIds.length) {
      return res.status(403).json({ error: "Some products are invalid or not part of your business" });
    }

    console.log("✅ Valid products for this business:", products.map(p => p.name));

    // ---- For each product, fetch ProductsSold & calculate averages ----
    const results = [];
    for (const product of products) {
      const currentStock = product.stock;

      // ---- Average cost per unit ----
      let totalUnits = 0, totalCost = 0;
      product.batches.forEach(batch => {
        totalUnits += batch.quantity;
        totalCost += (batch.quantity * batch.costPrice);
      });
      const avgCostPerUnit = totalUnits > 0 ? Number((totalCost / totalUnits).toFixed(3)) : 0;

      // ---- First-in cost ----
      let firstInCost = 0;
      if (product.batches.length > 0) {
        const firstBatch = product.batches
          .sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded))[0];
        firstInCost = Number(firstBatch.costPrice.toFixed(3));
      }

      // ---- Average selling price ----
      const soldDocs = await ProductsSold.find({
        productId: product._id,
        businessId,
        soldAt: { $gte: new Date(fromDate), $lte: new Date(toDate) }
      });

      let soldUnits = 0, soldRevenue = 0;
      soldDocs.forEach(s => {
        soldUnits += s.quantity;
        soldRevenue += (s.quantity * s.price);
      });
      const avgSellingPrice = soldUnits > 0 ? Number((soldRevenue / soldUnits).toFixed(3)) : 0;

      // ---- Base result ----
      const resultObj = {
        name: product.name,
        currentInventory: currentStock,
        listedPrice: Number(product.price.toFixed(3)),
        avgSellingPrice,
        avgCostPerUnit,
        firstInCost
      };

      // ---- Inventory details (only if requested) ----
      if (includeInventory) {
        resultObj.inventoryDetails = {
          productName: product.name,
          batches: product.batches
            .filter(b => b.quantity > 0)
            .map(b => ({
              batchId: b.batchId,
              quantity: b.quantity,
              costPrice: Number(b.costPrice.toFixed(3)),
              dateAdded: b.dateAdded
            }))
        };
      }

      results.push(resultObj);

      console.log("📊 Product Analysis:", resultObj);
    }

    return res.json({
      success: true,
      message: "Products analyzed successfully",
      analyzed: results
    });

  } catch (err) {
    console.error("❌ Error in /products route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


router.patch('/assign-business-id', async (req, res) => {
  const { businessId } = req.body;

  if (!businessId || !mongoose.Types.ObjectId.isValid(businessId)) {
    return res.status(400).json({ error: 'Valid businessId is required in the request body' });
  }

  try {
    const result = await Bill.updateMany(
      { businessId: { $exists: false } }, // Only where businessId is missing
      { $set: { businessId: new mongoose.Types.ObjectId(businessId) } }
    );

    res.json({
      success: true,
      matched: result.matchedCount || result.n,
      modified: result.modifiedCount || result.nModified,
      message: 'Business IDs assigned to bills without one'
    });
  } catch (err) {
    console.error('Error assigning businessId to bills:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post("/staff", authMiddleware, async (req, res) => {
  try {
    const { activeOnly } = req.body;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(401).json({ error: "Unauthorized: Missing businessId" });
    }

    // --- Fetch active staff (exclude password) ---
    let activeStaff = await Staff.find({ businessId })
      .select("-password")
      .lean();

    // ✅ Populate services manually
    for (let staff of activeStaff) {
      if (
        staff.role === "provider" &&
        Array.isArray(staff.services) &&
        staff.services.length > 0
      ) {
        const services = await Service.find({
          _id: { $in: staff.services },
          businessId,
        }).select("name");

        staff.services = services.map((s) => s.name);
      }
    }

    if (activeOnly) {
      return res.json({
        success: true,
        staff: activeStaff,
      });
    }

    // --- Fetch archived staff (exclude password) ---
    let archivedStaff = await ArchiveStaff.find({ businessId })
      .select("-password")
      .lean();

    for (let staff of archivedStaff) {
      if (
        staff.role === "provider" &&
        Array.isArray(staff.services) &&
        staff.services.length > 0
      ) {
        const services = await Service.find({
          _id: { $in: staff.services },
          businessId,
        }).select("name");

        staff.services = services.map((s) => s.name);
      }
    }

    return res.json({
      success: true,
      activeStaff,
      archivedStaff,
    });
  } catch (err) {
    console.error("❌ Error in /staff route:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post('/clientele', authMiddleware, async (req, res) => {
  try {
    const { clientIds = [], fromDate, toDate, staffIds = [] } = req.body;
    const businessId = req.user?.businessId;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'fromDate and toDate are required' });
    }
    if (!businessId) {
      return res.status(401).json({ error: 'Unauthorized: Missing businessId' });
    }

    // Normalize dates
    let start = new Date(fromDate);
    let end = new Date(toDate);
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: 'Invalid fromDate or toDate format' });
    }
    if (start > end) [start, end] = [end, start];

    start = new Date(start.setHours(0, 0, 0, 0));
    end = new Date(end.setHours(23, 59, 59, 999));

    // Prepare query
    const query = {
      businessId,
      'appointments.start': { $gte: start, $lte: end },
    };

    // Validate clientIds, but do NOT filter them in query directly
    let validClientIds = [];
    if (Array.isArray(clientIds) && clientIds.length > 0) {
      const invalid = clientIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
      if (invalid.length > 0) {
        return res.status(400).json({ error: 'Invalid clientIds', invalid });
      }
      validClientIds = clientIds.map(id => String(id)); // We'll use this for filtering in memory
    }

    console.log('📋 MongoDB query:', JSON.stringify(query));

    const bills = await Bill.find(query).lean();
    console.log(`📦 Retrieved ${bills.length} bills`);

    // Collect unique clientIds from appointments
    const clientSet = new Set();
    bills.forEach(bill => {
      (bill.appointments || []).forEach(app => {
        if (app.clientId) clientSet.add(String(app.clientId));
      });
    });

    const clientIdsToProcess =
      validClientIds.length > 0
        ? validClientIds
        : Array.from(clientSet);

    console.log(`👥 Clients to process: ${clientIdsToProcess.length}`);

    const validStaffIds = (Array.isArray(staffIds) ? staffIds : [])
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => String(id));

    const clientsDetailed = [];

    const parseBool = (v) => {
      if (v === true || v === 'true' || v === 1 || v === '1') return true;
      if (v === false || v === 'false' || v === 0 || v === '0') return false;
      return Boolean(v);
    };

    for (const cid of clientIdsToProcess) {
      if (!mongoose.Types.ObjectId.isValid(cid)) continue;

      const clientDoc = await Clientelle.findById(cid).lean();
      if (!clientDoc) continue;

      const dataForBusiness = (clientDoc.data || []).find(
        d => String(d.businessId) === String(businessId)
      );
      if (!dataForBusiness) continue;

      // Find the most recent appointment for this client in the filtered bills
      let mostRecentAppt = null;
      for (const bill of bills) {
        (bill.appointments || []).forEach(app => {
          if (String(app.clientId) === String(cid)) {
            const startDate = app.start ? new Date(app.start) : null;
            if (startDate && (!mostRecentAppt || startDate > new Date(mostRecentAppt.start))) {
              mostRecentAppt = { ...app };
            }
          }
        });
      }

      if (!mostRecentAppt) {
        console.log(`ℹ️ Skipping client ${cid} - no appointment found`);
        continue;
      }

      // Filter by selected staffIds if provided
      if (validStaffIds.length > 0) {
        if (!validStaffIds.includes(String(mostRecentAppt.staffId))) {
          console.log(`ℹ️ Skipping client ${cid} - staffId does not match filter`);
          continue;
        }
      }

      let providerName = null;
      if (mostRecentAppt.staffId) {
        try {
          const staffDoc = await Staff.findById(mostRecentAppt.staffId)
            .select('name')
            .lean();
          providerName = staffDoc?.name || null;
        } catch (e) {
          console.error(`❌ Error fetching staff for ${mostRecentAppt.staffId}:`, e);
        }
      }

      const enriched = {
        clientId: String(cid),
        email: clientDoc.email || undefined,
        username: dataForBusiness.username || undefined,
        phone: dataForBusiness.phone || undefined,
        ...(dataForBusiness.address1 ||
          dataForBusiness.address2 ||
          dataForBusiness.city ||
          dataForBusiness.province ||
          dataForBusiness.postalCode
          ? {
            address: {
              ...(dataForBusiness.address1 ? { address1: dataForBusiness.address1 } : {}),
              ...(dataForBusiness.address2 ? { address2: dataForBusiness.address2 } : {}),
              ...(dataForBusiness.city ? { city: dataForBusiness.city } : {}),
              ...(dataForBusiness.province ? { province: dataForBusiness.province } : {}),
              ...(dataForBusiness.postalCode ? { postalCode: dataForBusiness.postalCode } : {}),
            },
          }
          : {}),
        ...(mostRecentAppt.start
          ? { mostRecentAppointment: { date: new Date(mostRecentAppt.start).toISOString() } }
          : {}),
        ...(providerName ? { mostRecentProvider: { name: providerName } } : {}),
        emailNotification: parseBool(dataForBusiness.emailNotification),
        messageNotification: parseBool(dataForBusiness.messageNotification),
      };

      clientsDetailed.push(enriched);
      console.log(`✅ Processed client ${cid}`);
    }

    console.log(`📤 Returning ${clientsDetailed.length} clients`);
    return res.json({ clientsDetailed });

  } catch (err) {
    console.error('❌ Error in /clientele route:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;


