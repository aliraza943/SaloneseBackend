const mongoose = require('mongoose');

const ProductSoldSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  billId: { type: mongoose.Schema.Types.ObjectId, ref: 'BillComplete', required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clientelle' },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true }, // total sold across batches
  total: { type: Number, required: true },
  description: { type: String },
  clientName: { type: String },

  // Track batch breakdown
  batchesUsed: [
    {
      batchId: { type: mongoose.Schema.Types.ObjectId, required: true },
      qty: { type: Number, required: true }
    }
  ],

  soldAt: { type: Date, default: Date.now },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  paymentMethod: { type: String }
});


module.exports = mongoose.model('ProductSold', ProductSoldSchema);
