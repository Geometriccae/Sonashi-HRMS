const mongoose = require("mongoose");

const salarySlipSchema = new mongoose.Schema({
    employeeName: { type: String, required: true },
    emailId: { type: String, required: true },
    designation: { type: String, required: true },
    month: { type: String, required: true },
    year: { type: String, required: true },
    basicPay: { type: Number, required: true },
    hra: { type: Number, required: true },
    deductionsPFTax: { type: Number, required: true },
    netSalary: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Ensure unique combination of employee, month, and year to prevent duplicates
salarySlipSchema.index({ emailId: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("SalarySlip", salarySlipSchema);
