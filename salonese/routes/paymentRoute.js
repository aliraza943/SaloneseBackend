// routes/payments.js
const express = require('express');
const router = express.Router();
const { Client, Environment, ApiError } = require('square');
const crypto = require('crypto');
require('dotenv').config();
const authenticateUser = require('../middleware/authenticateUser');
const Bill = require('../models/BillModel');
const Appointment=require('../models/Appointments')
const Clientelle=require('../models/Cleintele')
const multer = require('multer');
const path = require('path');
const Notification = require('../models/notifications');
const Staff = require("../models/Staff");
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox,
});
const paymentsApi = squareClient.paymentsApi;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads')); // "uploads/" folder
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

router.post(
  '/payAppoint',
  authenticateUser,
  upload.single('image'),
  async (req, res) => {
    const { cardNonce, billId, note } = req.body;
    const userEmail = req.user.email;

    try {
      // 1) Load and validate bill
      const bill = await Bill.findOne({ _id: billId, userEmail });
      if (!bill) {
        return res.status(404).json({ message: 'Bill not found for this user.' });
      }
      if (bill.paid) {
        return res.status(400).json({ message: 'This bill is already paid.' });
      }

      // 2) Upsert Clientelle
      let client = await Clientelle.findOne({ email: userEmail });
      if (client) {
        if (!client.businessId.some(id => id.equals(bill.businessId))) {
          client.businessId.push(bill.businessId);
          await client.save();
        }
      } else {
        client = await Clientelle.create({
          username: req.user.name || userEmail,
          email: userEmail,
          businessId: [bill.businessId],
        });
      }
      const clientelleId = client._id;

      // 3) Process Square payment
      const paymentResponse = await paymentsApi.createPayment({
        sourceId: cardNonce,
        idempotencyKey: crypto.randomUUID(),
        amountMoney: {
          amount: Math.round(Number(bill.total) * 100),
          currency: 'CAD',
        },
        locationId: process.env.SQUARE_LOCATION_ID,
      });

      const safePayment = JSON.parse(
        JSON.stringify(
          paymentResponse.result.payment,
          (_, v) => (typeof v === 'bigint' ? v.toString() : v)
        )
      );

      // 4) Mark bill as paid
      bill.paid = true;
      await bill.save();

      // 5) Create appointments
      const itemMap = {};
      (bill.itemized || []).forEach(i => {
        itemMap[i.serviceName] = i;
      });

      const appointmentsToInsert = (bill.appointments || [])
        .filter(a => a.serviceId && a.start && a.end)
        .map(a => {
          const item = itemMap[a.serviceName] || {};
          const serviceCharges = Number(item.basePrice || 0);

          const taxesApplied = [];
          if (item.taxBreakdown && typeof item.taxBreakdown === 'object') {
            for (const [type, val] of Object.entries(item.taxBreakdown)) {
              if (type !== 'total' && val.amount != null) {
                taxesApplied.push({
                  taxType: type,
                  percentage: val.percentage,
                  amount: val.amount,
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
            clientId: clientelleId,
            clientName: userEmail,
            title: a.serviceName,
            serviceName: a.serviceName,
            serviceType: a.serviceName,
            description: `Appointment for ${a.serviceName}`,
            serviceCharges,
            taxesApplied,
            totalTax,
            totalBill,
            start: new Date(a.start),
            end: new Date(a.end),
            status: 'booked',
            note,
            noteImageFilename: req.file?.filename,
          };
        });

      let insertedAppointments = [];
if (appointmentsToInsert.length) {
  insertedAppointments = await Appointment.insertMany(appointmentsToInsert);

  // 6) Create notifications
  const notifications = [];

  // 6a) Notify assigned staff
  insertedAppointments.forEach(appt => {
    notifications.push({
      businessId: appt.businessId,
      appointmentId: appt._id,
      clientId: appt.clientId,
      staffId: appt.staffId,
      clientName: appt.clientName,
      serviceName: appt.serviceName,
      serviceId: appt.serviceId,
      start: appt.start,
      end: appt.end,
      type: 'appointment-booked',
      seen: false,
      method: 'online-portal',
    });
  });

  // 6b) Notify all frontdesk staff in the business
  const frontdeskStaff = await Staff.find(
    { businessId: bill.businessId, role: 'frontdesk' },
    '_id'
  );

  frontdeskStaff.forEach(staff => {
    insertedAppointments.forEach(appt => {
      notifications.push({
        businessId: appt.businessId,
        appointmentId: appt._id,
        clientId: appt.clientId,
        staffId: staff._id,
        clientName: appt.clientName,
        serviceName: appt.serviceName,
        serviceId: appt.serviceId,
        start: appt.start,
        end: appt.end,
        type: 'appointment-booked',
        seen: false,
        method: 'online-portal',
      });
    });
  });

  // 6c) Notify business as a whole (general notification)
  insertedAppointments.forEach(appt => {
    notifications.push({
      businessId: appt.businessId,
      appointmentId: appt._id,
      clientId: appt.clientId,
      staffId: appt.businessId, // Set staffId to businessId
      clientName: appt.clientName,
      serviceName: appt.serviceName,
      serviceId: appt.serviceId,
      start: appt.start,
      end: appt.end,
      type: 'appointment-booked',
      seen: false,
      method: 'online-portal',
    });
  });

  await Notification.insertMany(notifications);
}

      // 7) Send response
      return res.status(200).json({
        message: 'Payment processed and appointments saved successfully!',
        payment: safePayment,
        clientelleId,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        return res.status(400).json({
          message: 'Square API error',
          errors: err.result.errors,
        });
      }
      console.error('Payment error:', err);
      return res.status(500).json({
        message: 'Internal server error',
        error: err.message,
      });
    }
  }
);


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
