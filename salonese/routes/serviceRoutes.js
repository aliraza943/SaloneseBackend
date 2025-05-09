const express = require("express");
const Service = require("../models/Service");
const mongoose = require("mongoose");
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const taxData = require("../models/taxData");
const BusinessOwner= require("../models/BuisenessOwners")// Import tax data


router.post("/add", authMiddleware(["manage_services"]), async (req, res) => {
    try {
      const { name, duration, price, description, taxes ,category} = req.body;
  
      if (!name || !duration || !price) {
        return res.status(400).json({ message: "All fields are required!" });
      }
  
      // Retrieve the business owner to get the province
      const businessOwner = await BusinessOwner.findOne({ _id: req.user.businessId });
      if (!businessOwner) {
        return res.status(404).json({ message: "Business owner not found!" });
      }
  
      // Use the business owner's province as the allowed region
      const allowedRegion = businessOwner.province;
      const allowedTaxes = taxData[allowedRegion];
  
      if (!allowedTaxes) {
        return res.status(400).json({
          message: `No tax data found for region: ${allowedRegion}. `,
        });
      }
  
      const allowedTaxKeys = Object.keys(allowedTaxes);
  
      // Check if at least one provided tax is allowed
      const hasAllowedTax = taxes.some((tax) => allowedTaxKeys.includes(tax));
      if (!hasAllowedTax) {
        return res.status(400).json({
          message: "None of the provided taxes are allowed. ",
        });
      }
  
      const newService = new Service({
        name,
        duration,
        price,
        description,
        businessId: req.user.businessId,
        taxes,
        category
      });
  
      await newService.save();
      res.status(201).json({ message: "Service added successfully!", newService });
    } catch (error) {
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  });
  
  
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
            businessId: req.user.businessId 
        });

        if (!service) {
            return res.status(404).json({ message: "Service not found or access denied!" });
        }

        // Hardcode the region for now (e.g., "QC")
        const allowedRegion = "QC";
        const allowedTaxes = taxData[allowedRegion];

        if (!allowedTaxes) {
            return res.status(400).json({ 
                message: `No tax data found for region: ${allowedRegion}. ` 
            });
        }

        const allowedTaxKeys = Object.keys(allowedTaxes);

        // Validate that the service's taxes is an array and contains at least one allowed tax
        if (!Array.isArray(service.taxes) || service.taxes.length === 0) {
            return res.status(400).json({ 
                message: "Service taxes are not defined properly. " 
            });
        }

        const hasAllowedTax = service.taxes.some(tax => allowedTaxKeys.includes(tax));
        if (!hasAllowedTax) {
            return res.status(400).json({ 
                message: "None of the provided taxes are allowed. " 
            });
        }

        res.json(service);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});



// Update Service
router.put("/:id", authMiddleware(["manage_services"]), async (req, res) => {
    try {
      const { name, duration, price, description, taxes } = req.body;
  
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: "Invalid Service ID format!" });
      }
  
      // Find the service and ensure it belongs to the authenticated user's business
      let service = await Service.findOne({
        _id: req.params.id,
        businessId: req.user.businessId,
      });
  
      if (!service) {
        return res.status(404).json({ message: "Service not found or access denied!" });
      }
  
      // Retrieve the business owner to get the province
      const businessOwner = await BusinessOwner.findOne({ _id: req.user.businessId });
      if (!businessOwner) {
        return res.status(404).json({ message: "Business owner not found!" });
      }
  
      // Use the business owner's province as the allowed region
      const allowedRegion = businessOwner.province;
      const allowedTaxes = taxData[allowedRegion];
  
      if (!allowedTaxes) {
        return res.status(400).json({
          message: `No tax data found for region: ${allowedRegion}. This does not work bruh`,
        });
      }
  
      const allowedTaxKeys = Object.keys(allowedTaxes);
  
      // If taxes are provided in the update, validate them
      if (taxes) {
        if (!Array.isArray(taxes) || taxes.length === 0) {
          return res.status(400).json({
            message: "Taxes must be provided as a non-empty array. This does not work bruh",
          });
        }
  
        // Check if at least one provided tax is allowed
        const hasAllowedTax = taxes.some((tax) => allowedTaxKeys.includes(tax));
        if (!hasAllowedTax) {
          return res.status(400).json({
            message: "None of the provided taxes are allowed. This does not work bruh",
          });
        }
        service.taxes = taxes;
      }
  
      // Update the rest of the fields if provided
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

router.get("/serviceTypes/serviceDetails",authMiddleware([]),  async (req, res) => {
    console.log("This was called 2");

    try {
        // Ensure businessId is available in req.user
        if (!req.user.businessId) {
            console.log("this was the case")
            return res.status(400).json({ message: "Business ID is required!" });
        }

        // Fetch services belonging to the authenticated business
        const services = await Service.find({ businessId: req.user.businessId });

        res.json(services);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
});


module.exports = router;
