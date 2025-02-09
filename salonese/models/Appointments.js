const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  staffId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Staff", 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  serviceType: { 
    type: String, 
    required: true 
  },
  clientName: { 
    type: String, 
    required: true 
  },
  serviceCharges: { 
    type: Number, 
    required: true 
  },
  start: { 
    type: Date, 
    required: true 
  },
  end: { 
    type: Date, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model("Appointment", appointmentSchema);
