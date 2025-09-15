const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  staffId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Staff", 
    required: true 
  },
  clientId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Client", 
    required: false
  },
  businessId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Business", 
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
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true
  },
  serviceName: { 
    type: String, 
    required: true 
  }, // Added service name
  clientName: { 
    type: String, 
    required: true 
  },
  description: { 
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
  status: { 
    type: String, 
    enum: ["cancelled", "booked","completed"], 
    default: "booked" 
  },
  taxesApplied: [
    {
      taxType: { type: String, required: true }, 
      percentage: { type: Number, required: true }, 
      amount: { type: Number, required: true }
    }
  ],
    billId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "BillComplete", 
    required: false 
  },
   note: {
    type: String,
    required: false
  },
  noteImageFilename: {
    type: String,
    required: false
  },
totalTax: {    
  type: Number,
  default: 0 
},
  totalBill: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Allow taxesApplied to be an empty array
appointmentSchema.path("taxesApplied").default([]);

module.exports = mongoose.model("Appointment", appointmentSchema);
