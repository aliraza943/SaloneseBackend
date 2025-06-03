const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Business' },
  userEmail: { type: String, required: true },
  appointments: [
    {
      serviceId: mongoose.Schema.Types.ObjectId,
      serviceName: String,
      staffId: mongoose.Schema.Types.ObjectId,
      staffName: String,
      start: Date,
      end: Date
    }
  ],
  subtotal: Number,
  taxes: {
    HST: Number,
    PST: Number,
    GST: Number
  },
  total: Number,
  itemized: [
    {
      serviceName: String,
      basePrice: Number,
      taxBreakdown: {
        HST: {
          percentage: Number,
          amount: Number
        },
        PST: {
          percentage: Number,
          amount: Number
        },
        GST: {
          percentage: Number,
          amount: Number
        }
      },
      total: Number
    }
  ],
  paid: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// TTL index to auto-delete unpaid bills after 30 minutes
billSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 1800,
    partialFilterExpression: { paid: false }
  }
);

module.exports = mongoose.model('Bill', billSchema);
