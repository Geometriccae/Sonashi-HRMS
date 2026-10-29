const mongoose = require('mongoose');

/**
 * SalaryAdvance — tracks a salary advance given to an employee.
 *
 * The `advance` field on SalarySlip is the legacy fixed deduction from
 * Employee Master (salaryDetails.deduction).  Salary advances are tracked
 * separately here and applied to payslips as `salaryAdvanceDeduction`.
 *
 * Recovery logic
 * --------------
 * Each payroll run may deduct up to `outstandingBalance` from the employee's
 * net salary (but never make it negative — remainder carries forward).
 * Every deduction appends one entry to `recoveryHistory` and updates
 * `recoveredAmount` / `outstandingBalance`.  When `outstandingBalance` reaches
 * 0 the status transitions to 'fully_recovered'.
 *
 * Idempotency
 * -----------
 * The `recoveryHistory.slipKey` field (month|year|email) is checked before
 * applying a deduction so that regenerating a slip does not double-deduct.
 */
const recoveryEntrySchema = new mongoose.Schema(
  {
    slipKey: {
      type: String, // `${month}|${year}|${emailId}` — unique per payroll cycle
      required: true,
    },
    slipId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalarySlip' },
    month: { type: String, required: true },
    year: { type: String, required: true },
    amountDeducted: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const salaryAdvanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    employeeId: { type: String, default: '' },      // human-readable employee code
    employeeEmail: { type: String, default: '' },   // payroll identity key
    employeeName: { type: String, default: '' },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
    company: { type: String, default: '' },

    /** Amount granted. No upper limit — validated > 0 at the route level. */
    originalAmount: { type: Number, required: true },
    advanceDate: { type: Date, required: true },
    remarks: { type: String, default: '' },

    /** Running tally of how much has been recovered so far. */
    recoveredAmount: { type: Number, default: 0 },
    /** outstandingBalance = originalAmount − recoveredAmount (kept denormalised for fast queries). */
    outstandingBalance: { type: Number, required: true },

    status: {
      type: String,
      enum: ['active', 'fully_recovered', 'cancelled'],
      default: 'active',
    },

    recoveryHistory: { type: [recoveryEntrySchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Fast lookups needed by the payroll generator
salaryAdvanceSchema.index({ employee: 1, status: 1 });
salaryAdvanceSchema.index({ employeeEmail: 1, status: 1 });

module.exports = mongoose.model('SalaryAdvance', salaryAdvanceSchema);
