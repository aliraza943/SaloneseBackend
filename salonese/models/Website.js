const mongoose = require('mongoose');

const websiteSchema = new mongoose.Schema({
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    ref: 'User'
  },

  // 🔹 Site name (new)
  siteName: {
    type: String,
    default: ''
  },

  // 🔹 Public URL (new)
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  // 🔹 Social Links (new)
  socialLinks: {
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    twitter: { type: String, default: '' }
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
    }
  ],

  overlayTexts: [String],

  textSection: {
    heading: { type: String, default: '' },
    text: { type: String, default: '' },
    mapCoords: { type: String, default: '' },
    mapLabel: { type: String, default: '' },
    image: { type: String, default: null },
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Website', websiteSchema);
