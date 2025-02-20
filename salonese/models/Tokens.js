const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
    token: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessOwner' || 'Staff', required: true },
    valid: { type: Boolean, default: true }, 
    createdAt: { type: Date, default: Date.now, expires: '5h' } 
});

module.exports = mongoose.model('Token', TokenSchema);
