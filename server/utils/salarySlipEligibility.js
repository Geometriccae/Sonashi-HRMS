/**
 * Salary-slip month eligibility (generation gate only).
 * Does not change how salary amounts are calculated for eligible employees.
 *
 * Rule: if the employee has no Onsite/work attendance in the month AND approved
 * leave covers their entire employment window for that month → not eligible.
 */

const {
  getPayrollPeriod,
  toDayStart,
  dateKey,
} = require('./payrollPayableDays');

const APPROVED_LEAVE_STATUSES = new Set(['Approved', 'HOD Approved']);

const laterDay = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const earlierDay = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

const normalizeName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/[\s_.-]+/g, '')
    .trim();

const FULL_MONTH_LEAVE_REASON =
  'Salary slip cannot be generated because the employee was on approved leave for the entire month.';

/**
 * Match leave → Employee using canonical IDs first (never invent new leave math).
 */
function leaveMatchesEmployeeForPayroll(leave, employee) {
  if (!leave || !employee) return false;

  const empMongo = String(employee._id || '');
  const empCode = String(employee.employeeId || '').toLowerCase();
  const empName = normalizeName(employee.employeeName);

  const recordId = String(leave.employeeRecordId?._id || leave.employeeRecordId || '');
  if (empMongo && recordId && recordId === empMongo) return true;

  const populated = leave.employee;
  if (populated && typeof populated === 'object') {
    const linkedEmp =
      populated.employeeId?._id || populated.employeeId || null;
    if (linkedEmp && String(linkedEmp) === empMongo) return true;
    if (populated._id && String(populated._id) === empMongo) return true;
  } else if (populated && String(populated) === empMongo) {
    return true;
  }

  if (leave.employeeId) {
    const rid = String(leave.employeeId).toLowerCase();
    if (empMongo && rid === empMongo.toLowerCase()) return true;
    if (empCode && rid === empCode) return true;
  }

  // Name only when leave has no employee identity fields
  const hasRef = Boolean(
    recordId ||
      leave.employeeId ||
      (populated && (populated._id || populated.employeeId || populated))
  );
  if (hasRef) return false;

  const leaveName = normalizeName(leave.employeeName || '');
  return Boolean(empName && leaveName && leaveName === empName);
}

const attendanceEmployeeId = (record) =>
  String(record?.employee?._id || record?.employee || '');

const getEmploymentWindow = (employee, monthStart, monthEnd) => {
  const join = toDayStart(employee?.doj);
  const last = toDayStart(employee?.lastWorkingDay);
  if (join && join > monthEnd) return null;
  if (last && last < monthStart) return null;
  const start = laterDay(monthStart, join);
  const end = earlierDay(monthEnd, last);
  if (!start || !end || end < start) return null;
  return { start, end };
};

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
