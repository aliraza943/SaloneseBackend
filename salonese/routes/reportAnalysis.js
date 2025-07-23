// routes/reportAnalysis.js
const express = require('express');
const router = express.Router();
const Bill = require('../models/BillComplete');
const mongoose = require('mongoose');
const authMiddleware=require('../middleware/markAsCompleteMiddleware')

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

module.exports = router;


