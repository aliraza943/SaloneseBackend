const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const BusinessOwner = require('../models/BuisenessOwners');
const authMiddleware = require('../middleware/authMiddleware');
const Staff = require('../models/Staff');
const Token = require('../models/Tokens');
const router = express.Router();


// Register a Business Owner
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, permissions } = req.body;
        
        let owner = await BusinessOwner.findOne({ email });
        if (owner) {
            return res.status(400).json({ message: 'Business owner already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        owner = new BusinessOwner({
            name,
            email,
            password: hashedPassword,
            permissions
        });

        await owner.save();

        res.status(201).json({ message: 'Business owner registered successfully' });
    } catch (error) {
        console.error('Error in /register:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Login a Business Owner
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        let user = await BusinessOwner.findOne({ email });
        let role = 'admin'; // Default role for business owners

        if (!user) {
            // If not found in BusinessOwner, check in Staff collection
            user = await Staff.findOne({ email });
            role = user.role;
            
        }

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create a token with relevant user details
        const token = jwt.sign(
            { 
                id: user._id, 
                role, 
                permissions: user.permissions, 
                businessId: user.businessId 
            },
            process.env.JWT_SECRET,
            { expiresIn: '5h' }
        );
        await Token.create({ token, userId: user._id });

        // Remove password before sending response
        const { password: _, ...userData } = user.toObject();

        res.json({ token, user: userData });
    } catch (error) {
        console.error('Error in /login:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});




// Protected route example
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const owner = await BusinessOwner.findById(req.user.id).select('-password');
        res.json(owner);
    } catch (error) {
        console.error('Error in /profile:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create Dummy Business Owners
router.post('/dummy', async (req, res) => {
    try {
        const dummyOwners = [
            {
                name: 'John Doe',
                email: 'john@example.com',
                password: await bcrypt.hash('password123', 10),
                permissions: ['manage_users', 'view_reports', 'edit_settings']
            },
            {
                name: 'Jane Smith',
                email: 'jane@example.com',
                password: await bcrypt.hash('password123', 10),
                permissions: ['manage_users', 'view_reports']
            }
        ];

        await BusinessOwner.insertMany(dummyOwners);

        res.status(201).json({ message: 'Dummy business owners created successfully' });
    } catch (error) {
        console.error('Error in /dummy:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
