const express = require("express");
const Service = require("../models/Service");
const mongoose = require("mongoose");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');


// Create Service
router.post("/add", authMiddleware(["manage_services"]), async (req, res) => {
    try {
        const { name, duration, price, description } = req.body;

        if (!name || !duration || !price) {
            return res.status(400).json({ message: "All fields are required!" });
        }
        console.log("testing the businessId",req.user.businessId)

        const newService = new Service({ name, duration, price, description,businessId:req.user.businessId });
        await newService.save();
        res.status(201).json({ message: "Service added successfully!", newService });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// Get All Services
router.get("/", authMiddleware(["manage_services"]), async (req, res) => {
    console.log("This was called");

    try {
        // Ensure businessId is available in req.user
        if (!req.user.businessId) {
            return res.status(400).json({ message: "Business ID is required!" });
        }

        // Fetch services belonging to the authenticated business
        const services = await Service.find({ businessId: req.user.businessId });

        res.json(services);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});



// Get Single Service by ID
router.get("/:id", authMiddleware(["manage_services"]), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid Service ID format!" });
        }

        // Find the service and ensure it belongs to the authenticated user's business
        const service = await Service.findOne({ 
            _id: req.params.id, 
            businessId: req.user.businessId // Ensure businessId matches
        });

        if (!service) {
            return res.status(404).json({ message: "Service not found or access denied!" });
        }

        res.json(service);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


// Update Service
router.put("/:id", authMiddleware(["manage_services"]), async (req, res) => {
    try {
        const { name, duration, price, description } = req.body;

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid Service ID format!" });
        }

        // Find the service and ensure it belongs to the authenticated user's business
        let service = await Service.findOne({ 
            _id: req.params.id, 
            businessId: req.user.businessId // Ensure businessId matches
        });

        if (!service) {
            return res.status(404).json({ message: "Service not found or access denied!" });
        }

        // Update service fields if provided
        service.name = name || service.name;
        service.duration = duration || service.duration;
        service.price = price || service.price;
        service.description = description || service.description;

        await service.save();
        res.json({ message: "Service updated successfully!", service });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


// Delete Service
router.delete("/:id", authMiddleware(["manage_services"]), async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid Service ID format!" });
        }

        // Find the service and ensure it belongs to the authenticated user's business
        const service = await Service.findOne({ 
            _id: req.params.id, 
            businessId: req.user.businessId // Ensure businessId matches
        });

        if (!service) {
            return res.status(404).json({ message: "Service not found or access denied!" });
        }

        await Service.findByIdAndDelete(req.params.id);
        res.json({ message: "Service deleted successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


module.exports = router;
