const mongoose = require('mongoose');

const ProductSoldSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  billId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BillComplete', // links to the bill that included this sale
    required: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clientelle'
  },
  name: { type: String, required: true }, // snapshot of product name at time of sale
  price: { type: Number, required: true }, // price at the time of sale
  quantity: { type: Number, required: true },
  total: { type: Number, required: true }, // price * quantity
  description: { type: String },
  clientName:{type:String},

  // optional tracking
  soldAt: { type: Date, default: Date.now },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' }, // who sold it
  paymentMethod: { type: String }, // cash, card, etc.
});

module.exports = mongoose.model('ProductSold', ProductSoldSchema);
