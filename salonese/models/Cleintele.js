const mongoose = require("mongoose");

const ClientelleSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: false,
    },
    address1: {
      type: String,
      required: false,
    },
    address2: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
    },
    province: {
      type: String,
      required: false,
    },
    dateOfBirth: {
      type: Date,
      required: false,
    },
    familyDetails: {
      type: String,
      required: false,
    },
    ageRange: {
      type: String,
      required: false,
    },
    occupation: {
      type: String,
      required: false,
    },
    postalCode: {
      type: String,
      required: false,
    },
    hobbies: {
      type: String,
      required: false,
      trim: true,
    },
    hairColor: {
      type: String,
      required: false,
      trim: true,
    },
    referredBy: {
      type: String,
      required: false,
      trim: true,
    },
    additionalDetails: {
      type: String,
      required: false,
      trim: true,
    },
    images: [
      {
        url: { type: String, required: true }, // Image URL
        description: { type: String, required: false, trim: true }, // Optional description
        date: { type: Date, default: Date.now }, // Date of upload
      },
    ],
   businessId: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Business",
        required: true,
      },
    ],


    notes: [
      {
        title: { type: String, required: true, trim: true },
        date: { type: Date, default: Date.now },
        description: { type: String, required: true, trim: true },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Clientelle", ClientelleSchema);
