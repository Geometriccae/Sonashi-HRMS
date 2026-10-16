const mongoose = require("mongoose");

const companySifSettingsSchema = new mongoose.Schema(
  {
    // Singleton key — only one company settings document
    key: { type: String, default: "default", unique: true },
    employerId: { type: String, default: "" }, // 13-digit MOL employer ID
    defaultAgentRoutingCode: { type: String, default: "" }, // 9-digit SCR agent routing
    // SCR routing is company-level. Keep the legacy pair above as the selected
    // default while retaining an explicit routing code for every employer.
    employerRoutingCodes: {
      type: [{
        _id: false,
        employerId: { type: String, required: true },
        agentRoutingCode: { type: String, required: true },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanySifSettings", companySifSettingsSchema);
