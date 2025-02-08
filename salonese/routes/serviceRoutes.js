const express = require("express");
const Service = require("../models/Service");
const mongoose = require("mongoose");
const router = express.Router();


// Create Service
router.post("/add", async (req, res) => {
    try {
        const { name, duration, price, description } = req.body;

        if (!name || !duration || !price) {
            return res.status(400).json({ message: "All fields are required!" });
        }

        const newService = new Service({ name, duration, price, description });
        await newService.save();
        res.status(201).json({ message: "Service added successfully!", newService });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// Get All Services
router.get("/", async (req, res) => {
    try {
        const services = await Service.find();
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// Get Single Service by ID
router.get("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid Service ID format!" });
        }

        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ message: "Service not found!" });
        }

        res.json(service);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

// Update Service
router.put("/:id", async (req, res) => {
    try {
        const { name, duration, price, description } = req.body;

        let service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ message: "Service not found!" });
        }

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
router.delete("/:id", async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid Service ID format!" });
        }

        const service = await Service.findById(req.params.id);
        if (!service) {
            return res.status(404).json({ message: "Service not found!" });
        }

        await Service.findByIdAndDelete(req.params.id);
        res.json({ message: "Service deleted successfully!" });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});

module.exports = router;
