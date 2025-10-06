const mongoose = require("mongoose");

const ClientelleSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    businessId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Business",
        required: true,
      },
    ],

    data: [
      {
        businessId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Business",
          required: true,
        },
        username: {
          type: String,
          required: true,
          trim: true,
        },
        phone: String,
        address1: String,
        address2: String,
        city: String,
        province: String,
        dateOfBirth: Date,
        familyDetails: String,
        ageRange: String,
        occupation: String,
        postalCode: String,
        hobbies: {
          type: String,
          trim: true,
        },
        hairColor: {
          type: String,
          trim: true,
        },
        referredBy: {
          type: String,
          trim: true,
        },
        additionalDetails: {
          type: String,
          trim: true,
        },
        images: [
          {
            url: { type: String, required: true },
            description: { type: String, trim: true },
            date: { type: Date, default: Date.now },
          },
        ],
        notes: [
          {
            title: { type: String, required: true, trim: true },
            date: { type: Date, default: Date.now },
            description: { type: String, required: true, trim: true },
          },
        ],
                emailNotification: {
          type: Boolean,
          default: false,
        },
        messageNotification: {
          type: Boolean,
          default: false,
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Clientelle", ClientelleSchema);
