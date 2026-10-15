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
  toDayStart,
} = require('./payrollPayableDays');
const { composeSalarySlipAmounts } = require('./salarySlipAmounts');
const {
  isSalarySlipEligibleForMonth,
  FULL_MONTH_LEAVE_REASON,
} = require('./salarySlipEligibility');
const {
  buildPayrollCycleInputs,
  applyCarryForwardDeduction,
  payrollCycleDataRange,
} = require('./payrollCycle');

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
 * Salary slip for one employee and month (no database access).
 * Days after the cut-off (or approved after it) move to the next cycle;
 * earlier cycles' leftovers are carried into this slip. See utils/payrollCycle.js.
 *
 * @param {object[]} params.employeeSlips Stored slips of this employee (any month).
 * @returns {{ skipped: true, reason: string } | { skipped: false, slipData: object }}
 */
function buildEmployeeSalarySlip({
  employee,
  month,
  year,
  attendanceRecords = [],
  leaveRequests = [],
  employeeSlips = [],
}) {
  const yearStr = String(year).trim();
  const eligibility = isSalarySlipEligibleForMonth({
    employee,
    month,
    year: yearStr,
    attendanceRecords,
    leaveRequests,
  });
  if (!eligibility.eligible) {
    return { skipped: true, reason: eligibility.reason || FULL_MONTH_LEAVE_REASON };
  }

  const cycle = buildPayrollCycleInputs({
    employee,
    month,
    year: yearStr,
    leaveRequests,
    attendanceRecords,
    employeeSlips,
  });

  const days = computePayablePayrollDays({
    employee,
    month,
    year: yearStr,
    attendanceRecords: cycle.ownAttendanceRecords,
    leaveRequests: cycle.ownLeaveRequests,
  });

  if (days.skip || days.payableDays <= 0) {
    return { skipped: true, reason: days.skipReason || 'No payable working days' };
  }

  // Original salary components stay untouched; unpaid days become a
  // separate leave deduction. See utils/salarySlipAmounts.js.
  const carry = applyCarryForwardDeduction(
    composeSalarySlipAmounts({
      salaryDetails: employee.salaryDetails,
      payableDays: days.payableDays,
    }),
    cycle.carryDays
  );

  return {
    skipped: false,
    slipData: {
      employeeName: employee.employeeName,
      emailId: payrollEmailForEmployee(employee),
      department: employee.department || '',
      designation: employee.designation || employee.role || 'Employee',
      dateOfJoining: employee.doj ? new Date(employee.doj).toISOString().slice(0, 10) : '',
      month,
      year: yearStr,
      totalWorkingDays: days.totalWorkingDays,
      presentDays: days.presentDays,
      payableDays: days.payableDays,
      ...carry.amounts,
      payrollCutoffDate: cycle.cutoffDate,
      carriedForwardLeaveDays: carry.carriedForwardLeaveDays,
      carriedForwardLeaveDeduction: carry.carriedForwardLeaveDeduction,
      processedLeaveDays: [...cycle.ownLedger, ...carry.carriedLedger],
      pendingCarryForward: carry.pendingCarryForward,
    },
  };
}

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

  // Stored slips of these employees: needed to know which unpaid days were already charged.
  const cycleRange = payrollCycleDataRange(month, yearStr);
  const payrollEmails = employees.map(payrollEmailForEmployee);
  const existingSlips = await SalarySlip.find({ emailId: { $in: payrollEmails } })
    .select('emailId month year updatedAt payrollCutoffDate processedLeaveDays pendingCarryForward')
    .lean();
  const slipsByEmail = new Map();
  existingSlips.forEach((slip) => {
    const key = String(slip.emailId || '').toLowerCase();
    if (!slipsByEmail.has(key)) slipsByEmail.set(key, []);
    slipsByEmail.get(key).push(slip);
  });
  const pendingLeaveIds = new Set();
  const pendingAttendanceIds = new Set();
  existingSlips.forEach((slip) => {
    (slip.pendingCarryForward || []).forEach((entry) => {
      const target = entry.source === 'attendance' ? pendingAttendanceIds : pendingLeaveIds;
      if (entry.sourceId) target.add(entry.sourceId);
    });
  });
  const validIds = (ids) => Array.from(ids).filter((id) => /^[a-f0-9]{24}$/i.test(id));

  // This month, the previous month (post-cut-off days), leave approved during this
  // cycle for earlier dates, and anything still pending from an earlier cycle.
  const [attendanceRecords, leaveRequests] = await Promise.all([
    Attendance.find({
      $or: [
        { date: { $gte: cycleRange.previousMonthStart, $lte: monthEndInclusive } },
        { _id: { $in: validIds(pendingAttendanceIds) } },
      ],
    }).lean(),
    LeaveRequest.find({
      status: { $in: ['Approved', 'HOD Approved'] },
      $or: [
        { startDate: { $lte: monthEndInclusive }, endDate: { $gte: cycleRange.previousMonthStart } },
        { hodApprovedAt: { $gt: cycleRange.previousCutoffEnd, $lte: cycleRange.cutoffEnd } },
        { adminApprovedAt: { $gt: cycleRange.previousCutoffEnd, $lte: cycleRange.cutoffEnd } },
        { _id: { $in: validIds(pendingLeaveIds) } },
      ],
    })
      .populate('employee', 'employeeId username emailId')
      .lean(),
  ]);

  const results = [];
  const skipped = [];
  const errors = [];

  for (const emp of employees) {
    try {
      const email = payrollEmailForEmployee(emp);
      const built = buildEmployeeSalarySlip({
        employee: emp,
        month,
        year: yearStr,
        attendanceRecords,
        leaveRequests,
        employeeSlips: slipsByEmail.get(email) || [],
      });
      if (built.skipped) {
        skipped.push({ name: emp.employeeName, reason: built.reason });
        continue;
      }

      const slipData = built.slipData;
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
        payableDays: slipData.payableDays,
        netSalary: slipData.netSalary,
        carriedForwardLeaveDays: slipData.carriedForwardLeaveDays,
        carriedForwardLeaveDeduction: slipData.carriedForwardLeaveDeduction,
      });
    } catch (err) {
      errors.push({ name: emp.employeeName, error: err.message });
      continue;
    }
  }

  const carriedCount = results.filter((r) => r.carriedForwardLeaveDays > 0).length;

  return {
    ok: true,
    message: `Successfully generated/updated ${results.length} salary slips${skipped.length ? ` (${skipped.length} skipped)` : ''}${carriedCount ? `; ${carriedCount} include carried-forward leave deduction` : ''}.`,
    count: results.length,
    results,
    skipped,
    errors,
  };
}

module.exports = {
  generateSalarySlipsForMonth,
  buildEmployeeSalarySlip,
  payrollEmailForEmployee,
  isPayrollCandidateForPeriod,
  yearQueryValue,
};
