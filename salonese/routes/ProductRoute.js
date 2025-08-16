const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/ProductModal');
const manageProductsMiddleware = require("../middleware/manageProductsMiddleware"); // Ensure correct model import

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
      const { name, price, description,stock } = req.body;
      const businessId = req.user.businessId;
  
      if (!mongoose.Types.ObjectId.isValid(businessId)) {
        return res.status(400).json({ error: 'Invalid businessId' });
      }
  
      const product = new Product({ name, price, description, businessId,stock });
      await product.save();
      res.status(201).json(product);
    } catch (error) {
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
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
      }
  
      // Find and update the product only if it belongs to the authenticated user's business
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: req.params.id, businessId: req.user.businessId },
        req.body,
        { new: true, runValidators: true }
      ).select('-__v');
  
      if (!updatedProduct) {
        return res.status(404).json({ error: 'Product not found or you are not authorized to update this product' });
      }
  
      res.json(updatedProduct);
    } catch (error) {
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
  
      res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  

module.exports = router;
