/**
 * Salary-slip month eligibility (generation gate only).
 * Does not change how salary amounts are calculated for eligible employees.
 *
 * Rule: if the employee has no Onsite/work attendance in the month AND approved
 * leave covers their entire employment window for that month → not eligible.
 */

const {
  getPayrollPeriod,
  getEmploymentWindow,
  toDayStart,
  dateKey,
  leaveMatchesEmployee,
} = require('./payrollPayableDays');

const APPROVED_LEAVE_STATUSES = new Set(['Approved', 'HOD Approved']);

const laterDay = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const earlierDay = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

const FULL_MONTH_LEAVE_REASON =
  'Salary slip cannot be generated because the employee was on approved leave for the entire month.';

function leaveMatchesEmployeeForPayroll(leave, employee) {
  return leaveMatchesEmployee(leave, employee);
}

const attendanceEmployeeId = (record) =>
  String(record?.employee?._id || record?.employee || '');

/**
 * @returns {{
 *   eligible: boolean,
 *   reason: string,
 *   attendanceStatus: 'has_work' | 'none' | 'n/a',
 *   leaveCoverage: 'full_month' | 'partial_or_none' | 'n/a',
 * }}
 */
function isSalarySlipEligibleForMonth({
  employee,
  month,
  year,
  attendanceRecords = [],
  leaveRequests = [],
} = {}) {
  const period = getPayrollPeriod(month, year);
  if (!period) {
    return {
      eligible: false,
      reason: 'Invalid payroll month',
      attendanceStatus: 'n/a',
      leaveCoverage: 'n/a',
    };
  }

  const window = getEmploymentWindow(employee, period.start, period.end);
  if (!window) {
    return {
      eligible: false,
      reason: 'Not employed during this month',
      attendanceStatus: 'n/a',
      leaveCoverage: 'n/a',
    };
  }

  const empId = String(employee._id || '');

  // Step 2 – any Onsite / work attendance in the employment window → eligible
  const hasWorkAttendance = (attendanceRecords || []).some((record) => {
    if (attendanceEmployeeId(record) !== empId) return false;
    if (String(record.status || '') !== 'Onsite') return false;
    const day = toDayStart(record.date);
    if (!day) return false;
    return day >= window.start && day <= window.end;
  });

  if (hasWorkAttendance) {
    return {
      eligible: true,
      reason: '',
      attendanceStatus: 'has_work',
      leaveCoverage: 'n/a',
    };
  }

  // Step 3 – approved leave covering every day of the employment window
  const coveredDays = new Set();
  (leaveRequests || []).forEach((leave) => {
    if (!APPROVED_LEAVE_STATUSES.has(leave?.status)) return;
    if (!leaveMatchesEmployeeForPayroll(leave, employee)) return;
    const start = laterDay(window.start, toDayStart(leave.startDate));
    const end = earlierDay(window.end, toDayStart(leave.endDate));
    if (!start || !end || end < start) return;
    const cursor = new Date(start);
    while (cursor <= end) {
      coveredDays.add(dateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  let totalDays = 0;
  let uncovered = 0;
  const cursor = new Date(window.start);
  while (cursor <= window.end) {
    totalDays += 1;
    if (!coveredDays.has(dateKey(cursor))) uncovered += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  if (totalDays > 0 && uncovered === 0) {
    return {
      eligible: false,
      reason: FULL_MONTH_LEAVE_REASON,
      attendanceStatus: 'none',
      leaveCoverage: 'full_month',
    };
  }

  // No attendance + not full-month approved leave → preserve existing generation path
  return {
    eligible: true,
    reason: '',
    attendanceStatus: 'none',
    leaveCoverage: 'partial_or_none',
  };
}

module.exports = {
  isSalarySlipEligibleForMonth,
  leaveMatchesEmployeeForPayroll,
  FULL_MONTH_LEAVE_REASON,
};
