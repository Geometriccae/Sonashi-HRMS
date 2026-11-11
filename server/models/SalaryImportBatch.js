const mongoose = require("mongoose");

const salaryImportRecordSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true },
    employeeMongoId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    empName: { type: String, default: "" },
    emiratesId: { type: String, default: "" },
    workPermitNo: { type: String, default: "" },
    department: { type: String, default: "" },
    designation: { type: String, default: "" },
    companyCode: { type: String, default: "" },
    employerId: { type: String, default: "" },

    validationStatus: {
      type: String,
      enum: ["Valid", "Warning", "Invalid"],
      default: "Valid",
      index: true,
    },
    issues: [{ type: String }],
    changes: [{ type: String }],
    isChanged: { type: Boolean, default: false },

    existing: {
      basicSalary: { type: Number, default: 0 },
      houseRent: { type: Number, default: 0 },
      travelExp: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      deduction: { type: Number, default: 0 },
      totalSalary: { type: Number, default: 0 },
      agentCode: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
      companyCode: { type: String, default: "" },
      employerId: { type: String, default: "" },
    },

    uploaded: {
      basicSalary: { type: Number, default: 0 },
      houseRent: { type: Number, default: 0 },
      travelExp: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      deduction: { type: Number, default: 0 },
      totalSalary: { type: Number, default: 0 },
      agentCode: { type: String, default: "" },
      bankAccount: { type: String, default: "" },
      companyCode: { type: String, default: "" },
      employerId: { type: String, default: "" },
    },
  },
  { _id: false }
);

const salaryImportBatchSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, unique: true, index: true },
    fileName: { type: String, required: true },
    fileType: { type: String, enum: ["excel", "sif"], required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    employerId: { type: String, default: "" },
    companyCode: { type: String, default: "" },
    uploadedBy: { type: String, default: "System" },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    uploadedAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Applied"],
      default: "Pending",
      index: true,
    },
    approvedBy: { type: String, default: "" },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: "" },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    appliedAt: { type: Date, default: null },
    generatedSifRef: { type: String, default: "" },

    summary: {
      totalRecords: { type: Number, default: 0 },
      validCount: { type: Number, default: 0 },
      warningCount: { type: Number, default: 0 },
      invalidCount: { type: Number, default: 0 },
      changedCount: { type: Number, default: 0 },
      totalSalary: { type: Number, default: 0 },
    },

    records: [salaryImportRecordSchema],

    auditLog: [
      {
        _id: false,
        action: { type: String, required: true },
        performedBy: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now },
        details: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("SalaryImportBatch", salaryImportBatchSchema);

