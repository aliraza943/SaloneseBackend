const mongoose = require('mongoose');

const BusinessOwnerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin'],
        default: 'admin'
    },
    permissions: {
        type: [String],
        default: ['manage_users', 'view_reports', 'edit_settings']
    }
}, { timestamps: true });

module.exports = mongoose.model('BusinessOwner', BusinessOwnerSchema);
