const express = require("express");
const router = express.Router();
const Clientelle = require("../models/Cleintele");
const ClienteleMiddleware = require("../middleware/clienteleMiddleware");
const multer = require("multer");
const path = require("path");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save files in the "uploads" directory
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
  },
});

const upload = multer({ storage });
router.post("/upload/:clientId", upload.single("image"), async (req, res) => {
  console.log("HMMMMM")
  try {
    const { clientId } = req.params;
    const client = await Clientelle.findById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const imageUrl = `/uploads/${req.file.filename}`;
    console.log(imageUrl)
    client.images.push(imageUrl);
    await client.save();

    // Return a JSON response instead of sending 204
    res.status(200).json({ message: "Image uploaded successfully", imageUrl });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ message: "Error uploading image", error: error.message });
  }
});



// Create a new clientele
router.post("/add", ClienteleMiddleware, async (req, res) => {
    try {
      // Destructure all expected fields from the request body
      let { 
        name, 
        email, 
        phone, 
        address1, 
        address2, 
        city, 
        province, 
        dateOfBirth, 
        familyDetails, 
        ageRange, 
        occupation, 
        postalCode, 
        hobbies, 
        hairColor, 
        referredBy,
    
        providerId  // might be passed but will be overridden if provider
      } = req.body;
      
      console.log(req.body);
  
      // Ensure that if a provider is adding the client, they assign their own providerId
      if (req.user.role === "provider") {
        providerId = req.user.id;
      }
  
      // Ensure businessId comes from the token
      const businessId = req.user.businessId;
  
      console.log(
        name, email, phone, address1, address2, city, province, 
        dateOfBirth, familyDetails, ageRange, occupation, postalCode, 
        hobbies, hairColor, referredBy, businessId, providerId
      );
  
      // Validate required fields (adjust validation as needed)
      if (!name || !email || !businessId || !providerId) {
        return res.status(400).json({ message: "All required fields must be filled." });
      }
  
      // Create new client with all provided data, saving address1 and address2 separately
      const newClient = new Clientelle({
        username: name,
        email,
        phone,
        address1,
        address2,
        city,
        province,
        dateOfBirth,
        familyDetails,
        ageRange,
        occupation,
        postalCode,
        hobbies,
        hairColor,
        referredBy,
        businessId,
        providerId,
        province,
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

        if (req.user.role === "provider") {
            query.providerId = req.user.id; // If provider, filter by providerId
        }

        const clients = await Clientelle.find(query);
        res.status(200).json(clients);
    } catch (error) {
        res.status(500).json({ message: "Error retrieving clients", error: error.message });
    }
});

// Get a single client by ID
router.get("/providerClient/:id", ClienteleMiddleware, async (req, res) => {
  console.log("UMMMM")
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
router.get("/getImages/:clientId", ClienteleMiddleware, async (req, res) => {
  try {
    const client = await Clientelle.findById(req.params.clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }
    // Return the images array (or an empty array if none exist)
    res.status(200).json({ images: client.images || [] });
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ message: "Error fetching images", error: error.message });
  }
});

// Delete a client
router.delete("/:id",ClienteleMiddleware, async (req, res) => {
    try {
        const deletedClient = await Clientelle.findByIdAndDelete(req.params.id);
        if (!deletedClient) return res.status(404).json({ message: "Client not found" });

        res.status(200).json({ message: "Client deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting client", error: error.message });
    }
});
router.use("/uploads", express.static(path.join(__dirname, "../uploads")));

module.exports = router;
