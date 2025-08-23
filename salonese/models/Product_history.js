const mongoose = require('mongoose');

const ProductHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'changedByModel'
  },
  changedByModel: {
    type: String,
    required: true,
    enum: ['Staff', 'BusinessOwner']
  },
  action: {
    type: String,
    enum: ['created', 'updated', 'deleted', 'restocked', 'price_changed'],
    required: true
  },
  note: {
    type: String,
    trim: true
  },
  // 🔥 New field to track changed fields
  changes: {
    type: Map, // Flexible for dynamic keys
    of: new mongoose.Schema(
      {
        old: { type: mongoose.Schema.Types.Mixed },
        new: { type: mongoose.Schema.Types.Mixed }
      },
      { _id: false }
    )
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ProductHistory', ProductHistorySchema);
