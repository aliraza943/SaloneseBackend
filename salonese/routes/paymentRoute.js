// routes/payments.js
const express = require('express');
const router = express.Router();
const { Client, Environment, ApiError } = require('square');
const crypto = require('crypto');
require('dotenv').config();
const authenticateUser = require('../middleware/authenticateUser');
const Bill = require('../models/BillModel');
const Appointment=require('../models/Appointments')
const Clientelle=require('../models/Cleintele')// Assuming you have a Bill model defined
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox,
});
const paymentsApi = squareClient.paymentsApi;


router.post('/payAppoint', authenticateUser, async (req, res) => {
  const { cardNonce, billId } = req.body;
  const userEmail = req.user.email;

  try {
    const bill = await Bill.findOne({ _id: billId, userEmail });
    console.log("Bill found:", bill);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found for this user.' });
    }
    if (bill.paid) {
      return res.status(400).json({ message: 'This bill is already paid.' });
    }

    const amount = bill.total;
    if (!amount || isNaN(amount)) {
      return res.status(400).json({ message: 'Invalid bill total amount.' });
    }

    // ---------------------------
    // Step 1: Handle Clientelle
    // ---------------------------
    let client = await Clientelle.findOne({ email: userEmail });

    if (client) {
      const businessIdExists = client.businessId.some(id => id.equals(bill.businessId));
      if (!businessIdExists) {
        client.businessId.push(bill.businessId);
        await client.save();
      }
    } else {
      client = new Clientelle({
        username: req.user.name || userEmail,
        email: userEmail,
        businessId: [bill.businessId],
      });
      await client.save();
    }

    const clientelleId = client._id;

    // ---------------------------
    // Step 2: Process Square Payment
    // ---------------------------
    const response = await paymentsApi.createPayment({
      sourceId: cardNonce,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: Math.round(Number(amount) * 100),
        currency: 'CAD',
      },
      locationId: "LQGE8KMBCQJHG",
    });

    const safePayment = JSON.parse(
      JSON.stringify(response.result.payment, (_k, val) =>
        typeof val === 'bigint' ? val.toString() : val
      )
    );

    // ---------------------------
    // Step 3: Mark bill as paid
    // ---------------------------
    bill.paid = true;
    await bill.save();

    // ---------------------------
    // Step 4: Create Appointments
    // ---------------------------
    const itemizedMap = {};
    if (Array.isArray(bill.itemized)) {
      bill.itemized.forEach(item => {
        itemizedMap[item.serviceName] = item;
      });
    }

    const appointmentsToInsert = bill.appointments
      .filter(a => a.serviceId && a.start && a.end)
      .map(a => {
        const item = itemizedMap[a.serviceName] || {};
        const serviceCharges = Number(item.basePrice || 0);

        const taxesApplied = [];
        if (item.taxBreakdown && typeof item.taxBreakdown === 'object') {
          for (const [type, value] of Object.entries(item.taxBreakdown)) {
            if (type === 'total') continue;
            if (
              value &&
              typeof value === 'object' &&
              typeof value.percentage === 'number' &&
              typeof value.amount === 'number'
            ) {
              taxesApplied.push({
                taxType: type,
                percentage: value.percentage,
                amount: value.amount
              });
            }
          }
        }

        const totalTax = taxesApplied.reduce((sum, t) => sum + t.amount, 0);
        const totalBill = +(serviceCharges + totalTax).toFixed(2);

        return {
          staffId: a.staffId,
          serviceId: a.serviceId,
          businessId: bill.businessId,
          clientId:  clientelleId,
         
          clientName: userEmail,
          title: a.serviceName,
          serviceName: a.serviceName,
          serviceType: "default",
          description: `Appointment for ${a.serviceName}`,
          serviceCharges,
          start: new Date(a.start),
          end: new Date(a.end),
          taxesApplied,
          totalTax,
          totalBill,
          status: "booked",
        };
      });

    if (appointmentsToInsert.length) {
      await Appointment.insertMany(appointmentsToInsert);
    }

    return res.status(200).json({
      message: 'Payment processed and appointments saved successfully!',
      payment: safePayment,
      clientelleId,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = error.result.errors.map(e => ({
        category: e.category,
        code: e.code,
        detail: e.detail,
      }));
      return res.status(400).json({ message: 'Square API error', errors });
    }

    console.error('Payment error:', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});



router.get('/bill/:id', authenticateUser, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Match JWT email with the bill's userEmail field
    if (bill.userEmail !== req.user.email) {
      return res.status(403).json({ message: 'Unauthorized: Email mismatch' });
    }

    res.json({ bill });
  } catch (err) {
    console.error('Error retrieving bill:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});



module.exports = router;
