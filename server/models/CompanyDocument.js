const mongoose = require("mongoose");

const companyDocumentSchema = new mongoose.Schema(
  {
    particulars: { type: String, required: true, trim: true },
    docNumber: { type: String, trim: true, default: "" },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    fileName: String,
    filePath: String,
    fileType: String,
    fileSize: Number,
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    uploadedBy: String,
    userRole: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("CompanyDocument", companyDocumentSchema);
