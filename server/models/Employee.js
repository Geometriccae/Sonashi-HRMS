const mongoose = require("mongoose");
const assignEventSchema = require('./AssignEvent');

const employeeSchema = new mongoose.Schema({
  // HR / Compliance fields
  workPermitNo: { type: String, default: "" },
  office: { type: String, default: "" },
  emiratesId: { type: String, default: "" },
  nationality: { type: String, default: "" },
  reportingManager: { type: String, default: "" },
  gender: { type: String, default: "" },
  doj: { type: Date, default: null },
  lastWorkingDay: { type: Date, default: null },
  totalYearsExperience: { type: Number, default: null },
  dateOfBirth: { type: Date, default: null },
  passportNo: { type: String, default: "" },
  passportExpiryDate: { type: Date, default: null },
  labourCardExpiryDate: { type: Date, default: null },
  visaExpiryDate: { type: Date, default: null },
  remarks: { type: String, default: "" },

  employeeId: { type: String, required: true, unique: true }, // unique employee code/ID
  employeeName: { type: String, required: true },

  employeeStatus: {
    type: String,
    enum: ["Active", "InActive"],
    default: "Active"
  },

   attendance: {
    type: String,
    enum: ["Onsite", "Leave"],
    default: "Onsite"
  },

  mobile: { type: String, default: "" },
  /** Optional; sparse unique allows many employees with no email (field omitted or null). */
  emailId: { type: String },

  profilePhoto: { type: String, default: "" }, // URL or path to photo

  role: { type: String, required: true }, // e.g., Operations Manager, Sales Executive
  designation: { type: String }, // same or different from role if needed

  department: {
    type: String,
    required: true
  },

  salaryDetails: {
    basicSalary: { type: Number, default: 0 },
    houseRent: { type: Number, default: 0 },
    travelExp: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
    totalAllowance: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },
    totalSalary: { type: Number, default: 0 },
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ibanNumber: { type: String, default: "" },
    bankSortCode: { type: String, default: "" }
  },

  lifeInsurance: { type: Boolean, default: false },
  medicalInsurance: { type: Boolean, default: false },
  airFare: { type: Boolean, default: false },

  assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Client" }], // multiple projects can be assigned

  events: [assignEventSchema],
  
  increments: [{
    date: { type: Date, default: Date.now },
    previousSalary: { type: Number, default: 0 },
    incrementAmount: { type: Number, default: 0 },
    newSalary: { type: Number, default: 0 },
    reason: { type: String, default: "" }
  }]

}, { timestamps: true });

employeeSchema.index({ emailId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Employee", employeeSchema);
