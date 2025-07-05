const express = require("express");
const router = express.Router();
const Clientelle = require("../models/Cleintele");
const ClienteleMiddleware = require("../middleware/clienteleMiddleware");
const multer = require("multer");
const path = require("path");
const ClientellePutMiddleware = require("../middleware/ClientPutMiddleware")
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Save files in the "uploads" directory
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`); // Unique filename
  },
});

const upload = multer({ storage });
router.post("/upload/:clientId", upload.single("image"), ClienteleMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { description, date } = req.body;
    const businessId = req.user.businessId?.toString();

    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const client = await Clientelle.findById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const imageUrl = `/uploads/${req.file.filename}`;

    // Find the matching business data entry
    const matchedData = client.data.find(
      (entry) => entry.businessId?.toString() === businessId
    );

    if (!matchedData) {
      return res.status(404).json({ message: "Matching business data not found for client." });
    }

    // Ensure images array exists inside that data object
    if (!matchedData.images) matchedData.images = [];

    // Push the image to that images array
    matchedData.images.push({
      url: imageUrl,
      description: description || "",
      date: date || new Date()
    });

    await client.save();

    res.status(200).json({
      message: "Image uploaded successfully",
      image: {
        url: imageUrl,
        description: description || "",
        date: date || new Date()
      }
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    res.status(500).json({ message: "Error uploading image", error: error.message });
  }
});



// Create a new clientele
router.post("/add", ClienteleMiddleware, async (req, res) => {
  try {
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
    } = req.body;

    const businessIdFromUser = req.user.businessId;

    if (!name || !email || !businessIdFromUser) {
      return res.status(400).json({ message: "All required fields must be filled." });
    }

    const existingClient = await Clientelle.findOne({ email });

    const clientDataEntry = {
      businessId: businessIdFromUser,
      username: name,
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
    };

    if (existingClient) {
      const hasBusiness = existingClient.businessId.some(id => id.equals(businessIdFromUser));
      const hasDataForBusiness = existingClient.data.some(d => d.businessId.equals(businessIdFromUser));

      if (!hasBusiness) {
        existingClient.businessId.push(businessIdFromUser);
      }

      if (!hasDataForBusiness) {
        existingClient.data.push(clientDataEntry);
      }

      await existingClient.save();
      return res.status(200).json({
        message: hasBusiness ? "Client already exists with this business." : "Client updated with new business association.",
        client: existingClient,
      });
    }

    // New client case
    const newClient = new Clientelle({
      email,
      businessId: [businessIdFromUser],
      data: [clientDataEntry],
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
    const businessId = req.user.businessId;

    // Step 1: Find all clients with matching businessId in their root businessId array
    const clients = await Clientelle.find({ businessId });

    // Step 2: For each client, filter the `data` array to only include entries with matching businessId
    const filteredClients = clients.map(client => {
      const filteredData = client.data.filter(
        entry => entry.businessId.toString() === businessId.toString()
      );

      return {
        ...client.toObject(), // Convert Mongoose document to plain JS object
        data: filteredData,   // Overwrite data with filtered version
      };
    });

    res.status(200).json({
      businessId,
      data: filteredClients,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving clients",
      error: error.message,
    });
  }
});


// Get a single client by ID
router.get("/providerClient/:id", ClienteleMiddleware, async (req, res) => {
  console.log("UMMMM")
  try {
    const clients = await Clientelle.find({
   
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


router.put("/:id", ClienteleMiddleware, async (req, res) => {
  console.log(req.body)
  try {
    const client = await Clientelle.findById(req.params.id);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const businessId = req.user.businessId;

    const {
      username,
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
      additionalDetails,
    } = req.body;

    let dataEntry = client.data.find(
      (entry) => entry.businessId.toString() === businessId.toString()
    );

    // If no entry exists yet, create it
    if (!dataEntry) {
      dataEntry = {
        businessId,
        username: "",
        phone: "",
        address1: "",
        address2: "",
        city: "",
        province: "",
        dateOfBirth: null,
        familyDetails: "",
        ageRange: "",
        occupation: "",
        postalCode: "",
        hobbies: "",
        hairColor: "",
        referredBy: "",
        additionalDetails: "",
      };
      client.data.push(dataEntry);
      dataEntry = client.data[client.data.length - 1];
    }

    // Update values (only if provided)
    if (username) dataEntry.username = username;
    if (phone) dataEntry.phone = phone;
    if (address1) dataEntry.address1 = address1;
    if (address2) dataEntry.address2 = address2;
    if (city) dataEntry.city = city;
    if (province) dataEntry.province = province;
    if (dateOfBirth) dataEntry.dateOfBirth = dateOfBirth;
    if (familyDetails) dataEntry.familyDetails = familyDetails;
    if (ageRange) dataEntry.ageRange = ageRange;
    if (occupation) dataEntry.occupation = occupation;
    if (postalCode) dataEntry.postalCode = postalCode;
    if (hobbies) dataEntry.hobbies = hobbies;
    if (hairColor) dataEntry.hairColor = hairColor;
    if (referredBy) dataEntry.referredBy = referredBy;
    if (additionalDetails) dataEntry.additionalDetails = additionalDetails;

    // Add businessId to top-level list if not already there
    if (!client.businessId.includes(businessId)) {
      client.businessId.push(businessId);
    }

    await client.save();

    res.status(200).json({
      message: "Client data updated (or created) for this business",
      client,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error updating client",
      error: error.message,
    });
  }
});

router.get("/getImages/:clientId", ClienteleMiddleware, async (req, res) => {
  try {
    const client = await Clientelle.findById(req.params.clientId);
    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const userBusinessId = req.user.businessId.toString();

    // Find the matching business-specific data entry
    const matchedData = client.data?.find(
      (entry) => entry.businessId?.toString() === userBusinessId
    );

    const images = matchedData?.images || [];

    res.status(200).json({ images });
  } catch (error) {
    console.error("Error fetching images:", error);
    res.status(500).json({ message: "Error fetching images", error: error.message });
  }
});

// Delete a client
router.delete("/:id", ClienteleMiddleware, async (req, res) => {
  try {
    const deletedClient = await Clientelle.findByIdAndDelete(req.params.id);
    if (!deletedClient) return res.status(404).json({ message: "Client not found" });

    res.status(200).json({ message: "Client deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting client", error: error.message });
  }
});
// Add a note to a client
router.post("/addNote/:clientId", ClienteleMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { title, description } = req.body;
    const businessId = req.user.businessId?.toString();

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required" });
    }

    const client = await Clientelle.findById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const matchedData = client.data?.find(
      (entry) => entry.businessId?.toString() === businessId
    );

    if (!matchedData) {
      return res.status(404).json({ message: "Business-specific data not found for client." });
    }

    // Ensure notes array exists
    if (!matchedData.notes) matchedData.notes = [];

    matchedData.notes.push({
      title,
      description,
      date: new Date()
    });

    await client.save();

    res.status(201).json({
      message: "Note added successfully",
      notes: matchedData.notes
    });
  } catch (error) {
    console.error("Error adding note:", error);
    res.status(500).json({ message: "Error adding note", error: error.message });
  }
});


// Get all notes for a client
router.get("/getNotes/:clientId", ClienteleMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const businessId = req.user.businessId?.toString();

    const client = await Clientelle.findById(clientId);
    if (!client) return res.status(404).json({ message: "Client not found" });

    const matchedData = client.data?.find(
      (entry) => entry.businessId?.toString() === businessId
    );

    const notes = matchedData?.notes || [];

    res.status(200).json({ notes });
  } catch (error) {
    console.error("Error fetching notes:", error);
    res.status(500).json({ message: "Error fetching notes", error: error.message });
  }
});


router.use("/uploads", express.static(path.join(__dirname, "../uploads")));

module.exports = router;
