const express = require("express");
const router = express.Router();
const Clientelle = require("../models/Cleintele");
const ClienteleMiddleware = require("../middleware/clienteleMiddleware");

// Create a new clientele
router.post("/add", ClienteleMiddleware, async (req, res) => {
    try {
        let { name, email, password, phone, address, businessId, providerId } = req.body;

        // Ensure a barber assigns their own providerId
        if (req.user.role === "barber") {
            providerId = req.user.id;
        }

        // Ensure businessId comes from the token
        businessId = req.user.businessId;
        console.log(name, email, password, phone, address, businessId, providerId )

        // Validate required fields
        if (!name || !email  || !businessId || !providerId) {
            return res.status(400).json({ message: "All required fields must be filled." });
        }

        // Create new client
        const newClient = new Clientelle({
            username:name,
            email,
            // You should hash this before saving
            phone,
            address,
            businessId,
            providerId,
        });

        await newClient.save();
        res.status(201).json({ message: "Client added successfully", client: newClient });

    } catch (error) {
        console.error("Error adding client:", error);
        res.status(500).json({ message: "Error adding client", error: error.message });
    }
});

// Get all clientele
router.get("/", ClienteleMiddleware, async (req, res) => {
    try {
        let query = { businessId: req.user.businessId }; // Always filter by businessId

        if (req.user.role === "barber") {
            query.providerId = req.user.id; // If barber, filter by providerId
        }

        const clients = await Clientelle.find(query);
        res.status(200).json(clients);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving clients", error: error.message });
    }
});

// Get a single client by ID
router.get("/providerClient/:id", ClienteleMiddleware, async (req, res) => {
    try {
        const clients = await Clientelle.find({
            providerId: req.params.id,
            businessId: req.user.businessId,
        });

        if (clients.length === 0) {
            return res.status(404).json({ message: "No clients found for this provider" });
        }

        res.status(200).json(clients);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving clients", error: error.message });
    }
});



// Update a client
router.put("/:id", async (req, res) => {
    try {
        const updatedClient = await Clientelle.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedClient) return res.status(404).json({ message: "Client not found" });

        res.status(200).json({ message: "Client updated successfully", client: updatedClient });
    } catch (error) {
        res.status(500).json({ message: "Error updating client", error: error.message });
    }
});

// Delete a client
router.delete("/:id", async (req, res) => {
    try {
        const deletedClient = await Clientelle.findByIdAndDelete(req.params.id);
        if (!deletedClient) return res.status(404).json({ message: "Client not found" });

        res.status(200).json({ message: "Client deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting client", error: error.message });
    }
});

module.exports = router;
