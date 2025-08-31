const express = require("express");
const fs = require("fs");
require("dotenv").config();

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    console.log("➡️ Incoming request body:", req.body);

    const { filename, prompt } = req.body;
    if (!filename || !prompt) {
      return res.status(400).json({ message: "Both filename and prompt are required" });
    }

    // 🗂️ Build absolute path from filename
    const filePath = `uploads/${filename}`;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "Image file not found on server" });
    }

    const apiKey = process.env.LIGHTX_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "Missing LightX API Key" });
    }

    // 1️⃣ Step 1: Request presigned upload URL
    const stats = fs.statSync(filePath);
    console.log("📏 File size:", stats.size);

    const uploadResp = await fetch(
      "https://api.lightxeditor.com/external/api/v2/uploadImageUrl",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          uploadType: "imageUrl",
          size: stats.size,
          contentType: "image/jpeg",
        }),
      }
    );

    const uploadData = await uploadResp.json();
    console.log("📡 Upload URL response:", uploadData);

    if (!uploadResp.ok || !uploadData.body) {
      throw new Error("Failed to get upload URL: " + JSON.stringify(uploadData));
    }

    const { uploadImage, imageUrl } = uploadData.body;

    // 2️⃣ Step 2: Upload actual image to S3 presigned URL
    const fileBuffer = fs.readFileSync(filePath);
    const putResp = await fetch(uploadImage, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: fileBuffer,
    });

    console.log("📤 Upload to S3 status:", putResp.status);
    if (!putResp.ok) {
      const errText = await putResp.text();
      throw new Error("Failed to upload image to LightX storage: " + errText);
    }

    // 3️⃣ Step 3: Request hairstyle generation
    const genResp = await fetch(
      "https://api.lightxeditor.com/external/api/v1/hairstyle",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          imageUrl, // hosted LightX URL
          textPrompt: prompt,
        }),
      }
    );

    const genData = await genResp.json();
    console.log("✂️ Hairstyle generation response:", genData);

    if (!genResp.ok || !genData.body?.orderId) {
      throw new Error("Failed to start hairstyle generation: " + JSON.stringify(genData));
    }

    const { orderId } = genData.body;

    // 4️⃣ Poll status until done
    let outputUrl = null;
    for (let i = 0; i < 5; i++) {
      console.log(`⏳ Checking order status (attempt ${i + 1})...`);
      await new Promise((r) => setTimeout(r, 3000));

      const statusResp = await fetch(
        "https://api.lightxeditor.com/external/api/v1/order-status",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ orderId }),
        }
      );

      const statusData = await statusResp.json();
      console.log("📊 Order status:", statusData);

      if (statusData.body?.status === "active") {
        outputUrl = statusData.body.output;
        break;
      } else if (statusData.body?.status === "failed") {
        throw new Error("Hairstyle generation failed");
      }
    }

    if (!outputUrl) {
      return res.status(500).json({ message: "Timeout: Hairstyle not generated" });
    }

    // ✅ Return result
    res.json({ success: true, resultImage: outputUrl });
  } catch (err) {
    console.error("❌ AI Hairstyle Error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
