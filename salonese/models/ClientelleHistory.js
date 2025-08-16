const mongoose = require("mongoose");

const ClientelleHistorySchema = new mongoose.Schema(
  {
    clientelleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clientelle",
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "changedByModel", // dynamic reference
    },
    changedByModel: {
      type: String,
      required: true,
      enum: ["Staff", "BusinessOwner"], // the allowed models
    },
    changes: [
      {
        field: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClientelleHistory", ClientelleHistorySchema);
