const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/ProductModal');
const manageProductsMiddleware = require("../middleware/manageProductsMiddleware"); // Ensure correct model import
const ProductHistory = require('../models/Product_history');

const router = express.Router();

// Dummy Products Array
// Generate dummy products with random stock counts
const dummyProducts = [
  {
    name: 'Wireless Headphones',
    price: 59.99,
    description: 'Noise-canceling wireless headphones with high-quality sound.',
    businessId: '67b0a6b21a67ef3d1eaa5741',
  },
  {
    name: 'Gaming Mouse',
    price: 29.99,
    description: 'Ergonomic gaming mouse with customizable RGB lighting.',
    businessId: '67b0a6b21a67ef3d1eaa5741',
  },
  {
    name: 'Mechanical Keyboard',
    price: 79.99,
    description: 'Mechanical keyboard with blue switches and LED backlighting.',
    businessId: '67b0a6b21a67ef3d1eaa5741',
  },
  {
    name: 'Smartwatch',
    price: 99.99,
    description: 'Water-resistant smartwatch with fitness tracking and notifications.',
    businessId: '67b0a6b21a67ef3d1eaa5741',
  },
  {
    name: 'Portable Charger',
    price: 19.99,
    description: 'Fast-charging 10000mAh power bank for mobile devices.',
    businessId: '67b0a6b21a67ef3d1eaa5741',
  },
].map(product => ({
  ...product,
  stocks: Math.floor(Math.random() * 191) + 10, // random int between 10–200
}));

// Seed Dummy Products Route
router.post('/seed', async (req, res) => {
  try {
    await Product.insertMany(dummyProducts);
    res.status(201).json({ message: 'Dummy products added successfully!', products: dummyProducts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a product
router.post('/', manageProductsMiddleware, async (req, res) => {
  try {
    const { name, price, description, stock } = req.body;
    const businessId = req.user.businessId;

    if (!mongoose.Types.ObjectId.isValid(businessId)) {
      return res.status(400).json({ error: 'Invalid businessId' });
    }

    // 1️⃣ Create the product
    const product = new Product({ name, price, description, businessId, stock });
    await product.save();

    // 2️⃣ Create a history entry
    const historyEntry = {
      productId: product._id,
      changedBy: req.user.id,
      changedByModel: req.user.role === 'admin' ? 'BusinessOwner' : 'Staff',
      action: 'created',
      note: `Product created by ${req.user.role}`,
      changes: {
        name: { old: null, new: name },
        price: { old: null, new: price },
        description: { old: null, new: description },
        stock: { old: null, new: stock }
      }
    };

    await ProductHistory.create(historyEntry);

    res.status(201).json(product);
  } catch (error) {
    console.error("🔥 Error in POST / ->", error);
    res.status(400).json({ error: error.message });
  }
});

  

// Get all products
router.get('/', manageProductsMiddleware, async (req, res) => {
    try {
      const products = await Product.find({ businessId: req.user.businessId }).select('-__v');
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

// Get a product by ID
router.get('/:id',manageProductsMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await Product.findById(req.params.id).select('-__v');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a product
router.put('/:id', manageProductsMiddleware, async (req, res) => {
  try {
    console.log("---- Incoming Product Update ----");
    console.log("Params:", req.params);
    console.log("Body:", req.body);
    console.log("User from middleware:", req.user);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("❌ Invalid product ID:", req.params.id);
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const query = { _id: req.params.id, businessId: req.user.businessId };
    console.log("Query for update:", query);

    // 1️⃣ Fetch the existing product before updating
    const existingProduct = await Product.findOne(query).lean();
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found or unauthorized' });
    }

    // 2️⃣ Find changed fields
    const changes = {};
    for (const key in req.body) {
      if (req.body[key] !== undefined && req.body[key] !== existingProduct[key]) {
        changes[key] = {
          old: existingProduct[key],
          new: req.body[key]
        };
      }
    }

    console.log("Detected changes:", changes);

    // 3️⃣ Update the product
    const updatedProduct = await Product.findOneAndUpdate(
      query,
      req.body,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updatedProduct) {
      console.log("❌ Product not found after update attempt");
      return res.status(404).json({ error: 'Product not found or you are not authorized to update this product' });
    }

    // 4️⃣ Save history with changed fields
    const historyEntry = {
      productId: updatedProduct._id,
      changedBy: req.user.id,
      changedByModel: req.user.role === 'admin' ? 'BusinessOwner' : 'Staff',
      action: 'updated',
      note: `Product updated by ${req.user.role}`,
      changes // 🔥 this includes changed fields with old/new values
    };
    console.log("History entry to be created:", historyEntry);

    await ProductHistory.create(historyEntry);

    console.log("✅ Update successful, returning updated product");
    res.json(updatedProduct);

  } catch (error) {
    console.error("🔥 Error in PUT /:id ->", error);
    res.status(400).json({ error: error.message });
  }
});

  

router.delete('/:id', manageProductsMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const deletedProduct = await Product.findOneAndDelete({
      _id: req.params.id,
      businessId: req.user.businessId
    });

    if (!deletedProduct) {
      return res.status(404).json({ error: 'Product not found or you are not authorized to delete this product' });
    }

    // Log history
    await ProductHistory.create({
      productId: deletedProduct._id,
      changedBy: req.user.id,
      changedByModel: req.user.role === 'businessOwner' ? 'BusinessOwner' : 'Staff',
      action: 'deleted',
      note: `Product deleted by ${req.user.role}`
    });

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
