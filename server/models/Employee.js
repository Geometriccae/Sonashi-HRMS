const mongoose = require("mongoose");
const assignEventSchema = require('./AssignEvent');

const employeeSchema = new mongoose.Schema({
  // HR / Compliance fields
  workPermitNo: { type: String, default: "" },
  office: { type: String, default: "" },
  emiratesId: { type: String, default: "" },
  emiratesIdExpiryDate: { type: Date, default: null },
  contractRenewalDate: { type: Date, default: null },
  nationality: { type: String, default: "" },
  reportingManager: { type: String, default: "" },
  gender: { type: String, default: "" },
  doj: { type: Date, default: null },
  noticePeriod: { type: String, default: "" },
  provisionPeriod: { type: String, default: "" },
  noticePeriodStartDate: { type: Date, default: null },
  noticePeriodEndDate: { type: Date, default: null },
  provisionPeriodStartDate: { type: Date, default: null },
  provisionPeriodEndDate: { type: Date, default: null },
  lastWorkingDay: { type: Date, default: null },
  travellingDate: { type: Date, default: null },
  leaveEndDate: { type: Date, default: null },
  returnDate: { type: Date, default: null },
  firstWorkingDay: { type: Date, default: null },
  totalYearsExperience: { type: Number, default: null },
  dateOfBirth: { type: Date, default: null },
  passportNo: { type: String, default: "" },
  passportExpiryDate: { type: Date, default: null },
  labourCardNumber: { type: String, default: "" },
  labourCardExpiryDate: { type: Date, default: null },
  companyCode: { type: String, default: "0000000172509" },
  visaExpiryDate: { type: Date, default: null },
  remarks: { type: String, default: "" },

  employeeId: { type: String, required: true, unique: true }, // unique employee code/ID
  employeeName: { type: String, required: true },

  employeeStatus: {
    type: String,
    enum: [
      "Active",
      "Provision Period",
      "Notice Period",
      "Confirmed",
      "Resigned",
      "Terminated",
      "Relieved",
      "On Hold",
      "InActive",
    ],
    default: "Active"
  },

  /** Status before Notice Period / Provision Period, used to restore on Reset. */
  previousEmployeeStatus: { type: String, default: null },

  vacationStatus: {
    type: String,
    enum: ["Onsite", "On Vacation", "Vacation Approved", "Vacation Pending", "Onboarding"],
    default: "Onsite"
  },

  attendance: {
    type: String,
    enum: ["Onsite", "Leave"],
    default: "Onsite"
  },

  mobile: { type: String, default: "" },
  /** Optional; sparse unique allows many employees with no email (field omitted or null). */
  emailId: { type: String },
  profilePhoto: { type: String, default: "" },

  emergencyContact: {
    uae: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      address: { type: String, default: "" },
      contactNo: { type: String, default: "" }
    },
    homeCountry: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      address: { type: String, default: "" },
      contactNo: { type: String, default: "" }
    },
    homeCountry2: {
      name: { type: String, default: "" },
      relationship: { type: String, default: "" },
      address: { type: String, default: "" },
      contactNo: { type: String, default: "" }
    }
  },

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

  /**
   * Exact yearly leave-taken values from the client Master tracker sheet.
   * Keys are calendar years as strings ("2010"…"2026"). Null years are omitted.
   * Used by the central leave calculator; never hardcoded in the UI.
   */
  excelLeaveYearTaken: { type: mongoose.Schema.Types.Mixed, default: null },
  excelLeaveImportedAt: { type: Date, default: null },

  assignedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Client" }], // multiple projects can be assigned

  events: [assignEventSchema],

  increments: [{
    date: { type: Date, default: Date.now },
    previousSalary: { type: Number, default: 0 },
    incrementAmount: { type: Number, default: 0 },
    newSalary: { type: Number, default: 0 },
    basicSalaryIncrement: { type: Number, default: 0 },
    houseRentIncrement: { type: Number, default: 0 },
    travelExpIncrement: { type: Number, default: 0 },
    otherIncrement: { type: Number, default: 0 },
    reason: { type: String, default: "" }
  }]

}, { timestamps: true });

employeeSchema.index({ emailId: 1 }, { unique: true, sparse: true });
employeeSchema.index({ employeeStatus: 1, vacationStatus: 1 });
employeeSchema.index({ vacationStatus: 1, returnDate: 1 });
employeeSchema.index({ vacationStatus: 1, firstWorkingDay: 1 });
employeeSchema.index({ visaExpiryDate: 1 });
employeeSchema.index({ passportExpiryDate: 1 });
employeeSchema.index({ employeeStatus: 1, createdAt: -1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ employeeName: 1 });
employeeSchema.index({ doj: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
