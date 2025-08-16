const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0 // ensures product starts with 0 stock unless set otherwise
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
