const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const SalarySlip = require('../models/SalarySlip');
require('../models/User');
const {
  isWorkingEmployeeStatus,
  lastWorkingDayIsEmploymentExit,
} = require('./employeeStatus');
const {
  getPayrollPeriod,
  computePayablePayrollDays,
  scaleSalaryAmount,
  toDayStart,
} = require('./payrollPayableDays');
const {
  isSalarySlipEligibleForMonth,
  FULL_MONTH_LEAVE_REASON,
} = require('./salarySlipEligibility');

const toAmt = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const payrollEmailForEmployee = (emp) => {
  const email = String(emp?.emailId || '').trim().toLowerCase();
  if (email) return email;
  const code = String(emp?.employeeId || emp?._id || 'unknown')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `noemail+${code}@import.hrms.placeholder`;
};

const yearQueryValue = (yearStr) => {
  const yearNum = Number(yearStr);
  if (Number.isFinite(yearNum) && String(yearNum) === yearStr) {
    return { $in: [yearStr, yearNum] };
  }
  return yearStr;
};

const isPayrollCandidateForPeriod = (emp, period) => {
  if (isWorkingEmployeeStatus(emp?.employeeStatus)) return true;
  if (!lastWorkingDayIsEmploymentExit(emp?.employeeStatus)) return false;
  const last = toDayStart(emp?.lastWorkingDay) || toDayStart(emp?.noticePeriodEndDate);
  if (!last) return false;
  return last >= period.start && last <= period.end;
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

  const employees = (await Employee.find({}).lean()).filter((emp) =>
    isPayrollCandidateForPeriod(emp, period)
  );

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

      const email = payrollEmailForEmployee(emp);
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
        {
          emailId: email,
          month: { $regex: new RegExp(`^${month}$`, 'i') },
          year: yearQueryValue(yearStr),
        },
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
      continue;
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
  payrollEmailForEmployee,
  isPayrollCandidateForPeriod,
  yearQueryValue,
};
