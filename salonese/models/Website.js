const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    ref: 'User',
  },

  siteName: {
    type: String,
    default: '',
  },

  url: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  socialLinks: {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' },
  },

  headerSettings: {
    headerTextColor: { type: String, default: '#000000' },
    headerBgColor: { type: String, default: '#ffffff' },
    fontClass: { type: String, default: 'font-sans' },
  },

  logoFileName: {
    type: String,
  },

  galleryImages: [
    {
      fileName: String,
    },
  ],

  overlayTexts: [String],

  textSection: {
    heading: { type: String, default: '' },
    text: { type: String, default: '' },
    mapCoords: { type: String, default: '' },
    mapLabel: { type: String, default: '' },
    image: { type: String, default: null },
  },

  // ✅ New Field: Team Cards
  cards: {
    type: [
      {
        staffId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Staff',
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        image: {
          type: String, // path or filename
          required: true,
        },
      },
    ],
    validate: [arrayLimit, '{PATH} exceeds the limit of 3'],
    default: [],
  },
}, {
  timestamps: true,
});

// Custom validator to ensure cards array length ≤ 3
function arrayLimit(val) {
  return val.length <= 6;
}

module.exports = mongoose.model('Website', websiteSchema);
