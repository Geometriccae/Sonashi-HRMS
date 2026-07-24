const mongoose = require("mongoose");

const companySifSettingsSchema = new mongoose.Schema(
  {
    // Singleton key — only one company settings document
    key: { type: String, default: "default", unique: true },
    employerId: { type: String, default: "" }, // 13-digit MOL employer ID
    defaultAgentRoutingCode: { type: String, default: "" }, // 9-digit SCR agent routing
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanySifSettings", companySifSettingsSchema);
