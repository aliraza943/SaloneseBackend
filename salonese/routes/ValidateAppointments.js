const dayjs = require('dayjs');
const isSameOrAfter = require('dayjs/plugin/isSameOrAfter');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const BusinessOwner = require('../models/BuisenessOwners');
const Staff = require("../models/Staff");
const Appointment = require('../models/Appointments');
const Service = require('../models/Service');
const Bill = require('../models/BillModel');
const taxData = require('../models/taxData');

async function validateAppointments(appointments) {
  const errors = [];

  for (const appt of appointments) {
    const staff = await Staff.findById(appt.staffId);
    const service = await Service.findById(appt.serviceId);

    if (!staff) {
      errors.push(`Staff with ID ${appt.staffId} not found.`);
      continue;
    }

    if (!service) {
      errors.push(`Service with ID ${appt.serviceId} not found.`);
      continue;
    }

    // Ensure the staff is allowed to perform this service (optional check)
    if (staff.services && !staff.services.includes(service._id)) {
      errors.push(`${staff.name} is not assigned to service ${service.name}.`);
      continue;
    }

    const start = dayjs(appt.start);
    const end = start.add(service.duration, 'minute'); // trusted duration
    const dayOfWeek = start.format('dddd');
    const workingRanges = staff.workingHours?.[dayOfWeek];

    if (!Array.isArray(workingRanges) || workingRanges.length === 0) {
      errors.push(`${staff.name} is not working on ${dayOfWeek}.`);
      continue;
    }

    const inWorkingHours = workingRanges.some(range => {
      const [startStr, endStr] = range.split(' - ');
      const workStart = dayjs(`${start.format('YYYY-MM-DD')} ${startStr}`, 'YYYY-MM-DD h:mm A');
      const workEnd = dayjs(`${start.format('YYYY-MM-DD')} ${endStr}`, 'YYYY-MM-DD h:mm A');
      return start.isSameOrAfter(workStart) && end.isSameOrBefore(workEnd);
    });

    if (!inWorkingHours) {
      errors.push(`Time is outside working hours for ${staff.name} on ${dayOfWeek}.`);
      continue;
    }

    const conflict = await Appointment.findOne({
      staffId: appt.staffId,
      start: { $lt: end.toDate() },
      end: { $gt: start.toDate() },
    });

    if (conflict) {
      errors.push(`Conflict for ${staff.name} with existing booking from ${conflict.start} to ${conflict.end}.`);
    }
  }

  return errors;
}

async function calculateBill(appointments) {
  let subtotal = 0;
  const taxTotals = { HST: 0, PST: 0, GST: 0 };
  const itemized = [];
  const detailedAppointments = [];

  let businessId = null;
  let taxRates = {};

  for (const appt of appointments) {
    const service = await Service.findById(appt.serviceId);
    const staff = await Staff.findById(appt.staffId);

    if (!service || !staff) throw new Error('Missing service or staff info.');

    if (!businessId) {
      businessId = service.businessId;
      const owner = await BusinessOwner.findOne({ businessId });
      if (!owner) throw new Error(`BusinessOwner with businessId ${businessId} not found.`);
      const province = owner.province;
      taxRates = taxData[province] || {};
    }

    const start = dayjs(appt.start);
    const end = start.add(service.duration, 'minute');

    const price = service.price;
    subtotal += price;

    const taxBreakdown = {};
    for (const type in taxRates) {
      const rate = taxRates[type];
      const taxAmount = +(price * rate).toFixed(2);
      taxBreakdown[type] = {
        percentage: +(rate * 100).toFixed(2),
        amount: taxAmount
      };
      taxTotals[type] += taxAmount;
    }

    const total = +(price + Object.values(taxBreakdown).reduce((sum, obj) => sum + obj.amount, 0)).toFixed(2);

    itemized.push({
      serviceName: service.name,
      basePrice: price,
      taxBreakdown,
      total
    });

    detailedAppointments.push({
      serviceId: service._id,
      serviceName: service.name,
      staffId: staff._id,
      staffName: staff.name,
      start: start.toDate(),
      end: end.toDate()
    });
  }

  const total = +(subtotal + Object.values(taxTotals).reduce((a, b) => a + b, 0)).toFixed(2);

  return {
    businessId,
    appointments: detailedAppointments,
    subtotal: +subtotal.toFixed(2),
    taxes: {
      HST: +taxTotals.HST.toFixed(2),
      PST: +taxTotals.PST.toFixed(2),
      GST: +taxTotals.GST.toFixed(2)
    },
    total,
    itemized
  };
}


async function createBill(appointments, userEmail) {
  const errors = await validateAppointments(appointments);
  if (errors.length > 0) return { errors };

  const billData = await calculateBill(appointments);

  const bill = new Bill({
    userEmail,
    businessId: billData.businessId,
    appointments: billData.appointments,
    subtotal: billData.subtotal,
    taxes: billData.taxes,
    total: billData.total,
    itemized: billData.itemized
  });

  await bill.save();
  return { bill };
}

module.exports = {
  validateAppointments,
  calculateBill,
  createBill
};
