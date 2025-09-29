const mongoose = require('mongoose');
const { ObjectId } = mongoose.Types;

const BatchSchema = new mongoose.Schema({
  batchId: {
    type: String,
    default: () => new ObjectId().toString(), // auto unique ID
    unique: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    required: true,
    min: 0
  },
  dateAdded: {
    type: Date,
    default: Date.now
  }
});

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: { // selling price
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
  batches: [BatchSchema],
  stock: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

/**
 * Middleware: Before saving, recalc total stock from batches
 */
ProductSchema.pre('save', function (next) {
  if (this.batches && this.batches.length > 0) {
    this.stock = this.batches.reduce((total, b) => total + (b.quantity || 0), 0);
  } else {
    this.stock = 0;
  }
  next();
});

module.exports = mongoose.model('Product', ProductSchema);
