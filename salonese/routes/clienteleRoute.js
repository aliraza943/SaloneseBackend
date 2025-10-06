const express = require("express");
const router = express.Router();
const Clientelle = require("../models/Cleintele");
const ClienteleMiddleware = require("../middleware/clienteleMiddleware");
const multer = require("multer");
const path = require("path");
const ClientellePutMiddleware = require("../middleware/ClientPutMiddleware")
const ClientelleHistory = require("../models/ClientelleHistory");
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
  console.log("---- Uploading Image to Client ----");
  console.log("Request Body:", JSON.stringify(req.body, null, 2));
  console.log("Uploaded file:", req.file ? req.file.filename : "No file");

  try {
    const { clientId } = req.params;
    const { description, date } = req.body;
    const businessId = req.user.businessId?.toString();
    const changedById = req.user._id || req.user.id;

    console.log("User making change:", {
      role: req.user.role,
      changedById,
      businessId,
    });

    if (!req.file) {
      console.log("No file uploaded in request");
      return res.status(400).json({ message: "No file uploaded" });
    }

    const client = await Clientelle.findById(clientId);
    if (!client) {
      console.log("Client not found:", clientId);
      return res.status(404).json({ message: "Client not found" });
    }

    console.log("Found client:", client._id);

    const imageUrl = `/uploads/${req.file.filename}`;
    console.log("Generated image URL:", imageUrl);

    // Find the matching business data entry
    const matchedData = client.data.find(
      (entry) => entry.businessId?.toString() === businessId
    );

    if (!matchedData) {
      console.log("Matching business data not found for client");
      return res.status(404).json({ message: "Matching business data not found for client." });
    }

    console.log("Found business data entry for:", businessId);

    // Map role -> model for history tracking
    let changedByModel;
    if (req.user.role === "businessOwner" || req.user.role === "admin") {
      changedByModel = "BusinessOwner";
    } else if (req.user.role === "frontdesk") {
      changedByModel = "Staff";
    } else {
      changedByModel = "Staff"; // fallback
    }
    console.log("ChangedByModel resolved as:", changedByModel);

    // Ensure images array exists inside that data object
    if (!matchedData.images) matchedData.images = [];

    const currentImagesCount = matchedData.images.length;
    console.log("Current images count:", currentImagesCount);

    // Create the new image object
    const newImage = {
      url: imageUrl,
      description: description || "",
      date: date || new Date()
    };

    console.log("Adding new image:", JSON.stringify(newImage, null, 2));

    // Push the image to that images array
    matchedData.images.push(newImage);

    // Save the client
    console.log("Saving client with new image...");
    await client.save();
    console.log("✅ Client saved successfully.");

    // Create history record for the image upload
    const changes = [{
      field: "images",
      oldValue: `${currentImagesCount} images`,
      newValue: `${matchedData.images.length} images (uploaded: "${req.file.filename}")`,
      imageDetails: {
        action: "uploaded",
        filename: req.file.filename,
        url: imageUrl,
        description: newImage.description,
        date: newImage.date,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    }];

    console.log("Saving history record for image upload:", JSON.stringify(changes, null, 2));
    
    await ClientelleHistory.create({
      clientelleId: client._id,
      changedBy: changedById,
      changedByModel,
      changes,
      changedAt: new Date(),
    });
    
    console.log("✅ History record saved successfully.");

    res.status(200).json({
      message: "Image uploaded successfully",
      image: {
        url: imageUrl,
        description: description || "",
        date: date || new Date()
      }
    });
  } catch (error) {
    console.error("❌ Error uploading image:", error);
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
    const changedById = req.user.id;

    // Map role -> model
    let changedByModel;
    if (req.user.role === "businessOwner" || req.user.role === "admin") {
      changedByModel = "BusinessOwner";
    } else if (req.user.role === "frontdesk") {
      changedByModel = "Staff";
    } else {
      changedByModel = "Staff"; // fallback for any other role
    }

    if (!name || !email || !businessIdFromUser) {
      return res
        .status(400)
        .json({ message: "All required fields must be filled." });
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
      const changes = [];

      const hasBusiness = existingClient.businessId.some((id) =>
        id.equals(businessIdFromUser)
      );
      const hasDataForBusiness = existingClient.data.some((d) =>
        d.businessId.equals(businessIdFromUser)
      );

      if (!hasBusiness) {
        existingClient.businessId.push(businessIdFromUser);
        changes.push({
          field: "businessId",
          oldValue: null,
          newValue: businessIdFromUser,
        });
      }

      if (!hasDataForBusiness) {
        existingClient.data.push(clientDataEntry);
        changes.push({
          field: "data",
          oldValue: null,
          newValue: clientDataEntry,
        });
      }

      await existingClient.save();

      // Log changes if any
      if (changes.length > 0) {
        await ClientelleHistory.create({
          clientelleId: existingClient._id,
          changedBy: changedById,
          changedByModel,
          changes,
        });
      }

      return res.status(200).json({
        message: hasBusiness
          ? "Client already exists with this business."
          : "Client updated with new business association.",
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

    // Log creation in history
    await ClientelleHistory.create({
      clientelleId: newClient._id,
      changedBy: changedById,
      changedByModel,
      changes: [
        {
          field: "create",
          oldValue: null,
          newValue: clientDataEntry,
        },
      ],
    });

    res
      .status(201)
      .json({ message: "Client added successfully", client: newClient });
  } catch (error) {
    console.error("Error adding client:", error);
    res
      .status(500)
      .json({ message: "Error adding client", error: error.message });
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
  console.log("---- Incoming Client Update ----");
  console.log("Request Body:", JSON.stringify(req.body, null, 2));

  try {
    // Find client
    const client = await Clientelle.findById(req.params.id);
    if (!client) {
      console.log("Client not found:", req.params.id);
      return res.status(404).json({ message: "Client not found" });
    }
    console.log("Found client:", client._id);

    // Extract user context
    const businessId = req.user.businessId;
    const changedById = req.user._id || req.user.id;
    console.log("User making change:", {
      role: req.user.role,
      changedById,
      businessId,
    });

    // Map role -> model
    let changedByModel;
    if (req.user.role === "businessOwner" || req.user.role === "admin") {
      changedByModel = "BusinessOwner";
    } else if (req.user.role === "frontdesk") {
      changedByModel = "Staff";
    } else {
      changedByModel = "Staff"; // fallback
    }
    console.log("ChangedByModel resolved as:", changedByModel);

    // Extract data from request body
    let updateData;
    if (req.body.data && Array.isArray(req.body.data) && req.body.data.length > 0) {
      // Data is nested in req.body.data array
      const businessData = req.body.data.find(
        (entry) => entry.businessId.toString() === businessId.toString()
      );
      updateData = businessData || req.body.data[0]; // Use matching business data or first entry
      console.log("Extracting data from nested structure:", JSON.stringify(updateData, null, 2));
    } else {
      // Data is at top level (fallback for different request structures)
      updateData = req.body;
      console.log("Using top-level request body data");
    }

    // Destructure incoming fields from the correct data source (including notification toggles)
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
      emailNotification,
      messageNotification,
    } = updateData;

    console.log("Extracted field values:", {
      username,
      phone,
      address1,
      occupation,
      emailNotification,
      messageNotification,
      // ... log other important fields
    });

    // Check if this client already has a data entry for this business
    let dataEntry = client.data.find(
      (entry) => entry.businessId.toString() === businessId.toString()
    );
    if (dataEntry) {
      console.log("Existing dataEntry found for business:", businessId);
      console.log("Existing dataEntry values:", JSON.stringify(dataEntry, null, 2));
    } else {
      console.log("No dataEntry for this business. Creating new one...");
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
        // default notifications (you recently added these fields)
        emailNotification: false,
        messageNotification: false,
      };
      client.data.push(dataEntry);
      dataEntry = client.data[client.data.length - 1];
      console.log("Created new dataEntry:", JSON.stringify(dataEntry, null, 2));
    }

    const changes = [];

    // Normalizer for consistent comparisons
    const normalize = (val) => {
      if (val instanceof Date) return val.getTime();
      if (typeof val === "string") return val.trim();
      if (val === null || val === undefined) return "";
      if (typeof val === "boolean") return val ? "true" : "false";
      return String(val);
    };

    // Parse boolean-like values robustly
    const parseBool = (v) => {
      if (v === true || v === "true" || v === 1 || v === "1") return true;
      if (v === false || v === "false" || v === 0 || v === "0") return false;
      // fallback: coerce truthy/falsy
      return Boolean(v);
    };

    // Update helper with detailed logging
    const updateField = (field, value) => {
      // Check if the field exists in updateData (not req.body)
      if (Object.prototype.hasOwnProperty.call(updateData, field)) {
        const oldVal = normalize(dataEntry[field]);
        const newVal = normalize(value);

        console.log(
          `Comparing field '${field}': existing='${dataEntry[field]}' | incoming='${value}'`
        );

        if (oldVal !== newVal) {
          console.log(`➡️ Field changed: ${field}`, {
            oldValue: dataEntry[field],
            newValue: value,
          });
          changes.push({
            field,
            oldValue: dataEntry[field],
            newValue: value,
          });
          dataEntry[field] = value;
        } else {
          console.log(`⏸️ No change for field: ${field}`);
        }
      } else {
        console.log(`🔍 Field '${field}' not found in update data`);
      }
    };

    // Apply updates
    updateField("username", username);
    updateField("phone", phone);
    updateField("address1", address1);
    updateField("address2", address2);
    updateField("city", city);
    updateField("province", province);
    updateField("dateOfBirth", dateOfBirth ? new Date(dateOfBirth) : null);
    updateField("familyDetails", familyDetails);
    updateField("ageRange", ageRange);
    updateField("occupation", occupation);
    updateField("postalCode", postalCode);
    updateField("hobbies", hobbies);
    updateField("hairColor", hairColor);
    updateField("referredBy", referredBy);
    updateField("additionalDetails", additionalDetails);

    // Notifications: coerce incoming values to boolean before updating
    if (Object.prototype.hasOwnProperty.call(updateData, "emailNotification")) {
      updateField("emailNotification", parseBool(emailNotification));
    } else {
      console.log("🔍 Field 'emailNotification' not provided in update payload");
    }

    if (Object.prototype.hasOwnProperty.call(updateData, "messageNotification")) {
      updateField("messageNotification", parseBool(messageNotification));
    } else {
      console.log("🔍 Field 'messageNotification' not provided in update payload");
    }

    // Ensure top-level businessId array is updated
    if (!client.businessId.includes(businessId)) {
      console.log("Adding businessId to client record:", businessId);
      client.businessId.push(businessId);
      changes.push({
        field: "businessId",
        oldValue: null,
        newValue: businessId,
      });
    }

    // Save updated client
    console.log("Saving client with updated data...");
    await client.save();
    console.log("✅ Client saved successfully.");

    // Save history if there were actual changes
    if (changes.length > 0) {
      console.log("Saving history record. Changes:", JSON.stringify(changes, null, 2));
      await ClientelleHistory.create({
        clientelleId: client._id,
        changedBy: changedById,
        changedByModel,
        changes,
        changedAt: new Date(),
      });
      console.log("✅ History record saved successfully.");
    } else {
      console.log("⚠️ No changes detected. History not created.");
    }

    res.status(200).json({
      message: "Client data updated (or created) for this business",
      client,
    });
  } catch (error) {
    console.error("❌ Error in client update route:", error);
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
// router.delete("/:id", ClienteleMiddleware, async (req, res) => {
//   try {
//     const deletedClient = await Clientelle.findByIdAndDelete(req.params.id);
//     if (!deletedClient) return res.status(404).json({ message: "Client not found" });

//     res.status(200).json({ message: "Client deleted successfully" });
//   } catch (error) {
//     res.status(500).json({ message: "Error deleting client", error: error.message });
//   }
// });
// Add a note to a client
router.put("/notifications/enable", async (req, res) => {
  try {
    const result = await Clientelle.updateMany(
      {},
      {
        $set: {
          "data.$[].emailNotification": true,
          "data.$[].messageNotification": true
        }
      }
    );

    res.json({
      message: "Notifications enabled for all clients across all businesses",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error enabling notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/addNote/:clientId", ClienteleMiddleware, async (req, res) => {
  console.log("---- Adding Note to Client ----");
  console.log("Request Body:", JSON.stringify(req.body, null, 2));
  
  try {
    const { clientId } = req.params;
    const { title, description } = req.body;
    const businessId = req.user.businessId?.toString();
    const changedById = req.user._id || req.user.id;
    
    console.log("User making change:", {
      role: req.user.role,
      changedById,
      businessId,
    });

    if (!title || !description) {
      return res.status(400).json({ message: "Title and description are required" });
    }

    const client = await Clientelle.findById(clientId);
    if (!client) {
      console.log("Client not found:", clientId);
      return res.status(404).json({ message: "Client not found" });
    }

    console.log("Found client:", client._id);

    const matchedData = client.data?.find(
      (entry) => entry.businessId?.toString() === businessId
    );

    if (!matchedData) {
      console.log("Business-specific data not found for client");
      return res.status(404).json({ message: "Business-specific data not found for client." });
    }

    console.log("Found business data entry for:", businessId);

    // Map role -> model for history tracking
    let changedByModel;
    if (req.user.role === "businessOwner" || req.user.role === "admin") {
      changedByModel = "BusinessOwner";
    } else if (req.user.role === "frontdesk") {
      changedByModel = "Staff";
    } else {
      changedByModel = "Staff"; // fallback
    }
    console.log("ChangedByModel resolved as:", changedByModel);

    // Ensure notes array exists
    if (!matchedData.notes) matchedData.notes = [];

    const currentNotesCount = matchedData.notes.length;
    console.log("Current notes count:", currentNotesCount);

    // Create the new note
    const newNote = {
      title,
      description,
      date: new Date()
    };

    console.log("Adding new note:", JSON.stringify(newNote, null, 2));

    // Add the note
    matchedData.notes.push(newNote);

    // Save the client
    console.log("Saving client with new note...");
    await client.save();
    console.log("✅ Client saved successfully.");

    // Create history record for the note addition
    const changes = [{
      field: "notes",
      oldValue: `${currentNotesCount} notes`,
      newValue: `${matchedData.notes.length} notes (added: "${title}")`,
      noteDetails: {
        action: "added",
        title: newNote.title,
        description: newNote.description,
        date: newNote.date
      }
    }];

    console.log("Saving history record for note addition:", JSON.stringify(changes, null, 2));
    
    await ClientelleHistory.create({
      clientelleId: client._id,
      changedBy: changedById,
      changedByModel,
      changes,
      changedAt: new Date(),
    });
    
    console.log("✅ History record saved successfully.");

    res.status(201).json({
      message: "Note added successfully",
      notes: matchedData.notes
    });
  } catch (error) {
    console.error("❌ Error adding note:", error);
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
