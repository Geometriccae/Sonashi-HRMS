const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const SalarySlip = require('../models/SalarySlip');
require('../models/User');
const { workingStatusFilter } = require('./employeeStatus');
const {
  getPayrollPeriod,
  computePayablePayrollDays,
  scaleSalaryAmount,
} = require('./payrollPayableDays');
const {
  isSalarySlipEligibleForMonth,
  FULL_MONTH_LEAVE_REASON,
} = require('./salarySlipEligibility');

const toAmt = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Generate/update salary slips for every eligible employee in a payroll month.
 * Each employee is evaluated independently for that month/year only.
 */
async function generateSalarySlipsForMonth({ month, year, uploadedBy = null } = {}) {
  const period = getPayrollPeriod(month, year);
  if (!period) {
    return { ok: false, message: 'Invalid Month or Year', count: 0, results: [], skipped: [], errors: [] };
  }

  const yearStr = String(year).trim();
  const monthEndInclusive = new Date(period.end);
  monthEndInclusive.setHours(23, 59, 59, 999);

  const employees = await Employee.find({
    $or: [
      workingStatusFilter(),
      { lastWorkingDay: { $gte: period.start, $lte: monthEndInclusive } },
    ],
  }).lean();

  const [attendanceRecords, leaveRequests] = await Promise.all([
    Attendance.find({
      date: { $gte: period.start, $lte: monthEndInclusive },
    }).lean(),
    LeaveRequest.find({
      status: { $in: ['Approved', 'HOD Approved'] },
      startDate: { $lte: monthEndInclusive },
      endDate: { $gte: period.start },
    })
      .populate('employee', 'employeeId username emailId')
      .lean(),
  ]);

  const results = [];
  const skipped = [];
  const errors = [];

  for (const emp of employees) {
    try {
      if (!emp.emailId) {
        skipped.push({ name: emp.employeeName, reason: 'No email ID' });
        continue;
      }

      const eligibility = isSalarySlipEligibleForMonth({
        employee: emp,
        month,
        year: yearStr,
        attendanceRecords,
        leaveRequests,
      });
      if (!eligibility.eligible) {
        skipped.push({
          name: emp.employeeName,
          reason: eligibility.reason || FULL_MONTH_LEAVE_REASON,
        });
        continue;
      }

      const days = computePayablePayrollDays({
        employee: emp,
        month,
        year: yearStr,
        attendanceRecords,
        leaveRequests,
      });

      if (days.skip || days.payableDays <= 0) {
        skipped.push({
          name: emp.employeeName,
          reason: days.skipReason || 'No payable working days',
        });
        continue;
      }

      const email = emp.emailId.trim().toLowerCase();
      const salary = emp.salaryDetails || {};
      const basic = scaleSalaryAmount(toAmt(salary.basicSalary), days.payableDays);
      const houseRent = scaleSalaryAmount(toAmt(salary.houseRent), days.payableDays);
      const travelExp = scaleSalaryAmount(toAmt(salary.travelExp), days.payableDays);
      const other = scaleSalaryAmount(toAmt(salary.other), days.payableDays);
      const deduction = toAmt(salary.deduction);
      const grossSalary = basic + houseRent + travelExp + other;
      const netSalary = grossSalary - deduction;

      const slipData = {
        employeeName: emp.employeeName,
        emailId: email,
        department: emp.department || '',
        designation: emp.designation || emp.role || 'Employee',
        dateOfJoining: emp.doj ? new Date(emp.doj).toISOString().slice(0, 10) : '',
        month,
        year: yearStr,
        totalWorkingDays: days.totalWorkingDays,
        presentDays: days.presentDays,
        payableDays: days.payableDays,
        basicPay: basic,
        hra: houseRent,
        conveyanceAllowance: travelExp,
        otherAllowance: other,
        grossSalary,
        totalDeduction: deduction,
        deductionsPFTax: deduction,
        netSalary,
      };
      if (uploadedBy) slipData.uploadedBy = uploadedBy;

      await SalarySlip.findOneAndUpdate(
        { emailId: email, month: { $regex: new RegExp(`^${month}$`, 'i') }, year: yearStr },
        { $set: slipData },
        { upsert: true, new: true }
      );

      results.push({
        email,
        name: emp.employeeName,
        payableDays: days.payableDays,
        netSalary,
      });
    } catch (err) {
      errors.push({ name: emp.employeeName, error: err.message });
    }
  }

  return {
    ok: true,
    message: `Successfully generated/updated ${results.length} salary slips${skipped.length ? ` (${skipped.length} skipped)` : ''}.`,
    count: results.length,
    results,
    skipped,
    errors,
  };
}

module.exports = {
  generateSalarySlipsForMonth,
};
