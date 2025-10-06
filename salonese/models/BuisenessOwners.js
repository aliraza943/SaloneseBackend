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
        businessName: {
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
    },
    businessId: {
        type: mongoose.Schema.Types.ObjectId,
        unique: true
    },
    province: {
        type: String,
        required: true,
        trim: true
    },
    address:{
        type: String,
        trim: true

    },
        notificationSettings: {
        type: {
            type: String,
            enum: ["same-day", "previous-day"],
            default: "same-day"
        },
        minutesBefore: {
            type: Number, // only applies if type = same-day
            default: 30
        },
        time: {
            type: String, // only applies if type = previous-day (HH:mm format)
            default: "18:00"
        }
    }
}, { timestamps: true });



// Set businessId before saving the document
BusinessOwnerSchema.pre('save', function (next) {
    if (!this.businessId) {
        this.businessId = this._id;
    }
    next();
});

module.exports = mongoose.model('BusinessOwner', BusinessOwnerSchema);
