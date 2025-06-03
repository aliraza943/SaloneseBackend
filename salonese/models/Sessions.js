const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sub: { type: String, required: true }, // User ID
  email: { type: String, required: true },
  session_id: { type: String, required: true },
  role: { type: String },
  iss: { type: String },
  aud: { type: String },
  exp: { type: Number }, // still keeping original exp for reference
  iat: { type: Number },
  app_metadata: { type: Object },
  user_metadata: { type: Object },
  amr: { type: Array },
  aal: { type: String },
  is_anonymous: { type: Boolean },

  // TTL field
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
