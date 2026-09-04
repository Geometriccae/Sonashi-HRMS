/**
 * Payable working days for a salary period.
 * Calendar days are used only to count payable/present days.
 * Salary amounts always prorate on a fixed 30-day month:
 *   Daily Salary = Monthly Salary / 30
 *   Payable Salary = Daily Salary × Payable Days
 */

const { lastWorkingDayIsEmploymentExit } = require("./employeeStatus");

const PAYROLL_MONTH_DAYS = 30;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const APPROVED_LEAVE_STATUSES = new Set(["Approved", "HOD Approved"]);

const toDayStart = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const dateKey = (value) => {
  const d = toDayStart(value);
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const inclusiveDays = (start, end) => {
  const s = toDayStart(start);
  const e = toDayStart(end);
  if (!s || !e || e < s) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
};

const getMonthIndex = (monthValue) => {
  const n = Number(monthValue);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return n - 1;
  const normalized = String(monthValue || "").trim().toLowerCase();
  return MONTH_NAMES.findIndex((name) => name.toLowerCase() === normalized);
};

const getPayrollPeriod = (monthValue, yearValue) => {
  const monthIndex = getMonthIndex(monthValue);
  const year = Number(yearValue);
  if (monthIndex < 0 || !Number.isFinite(year)) return null;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    monthIndex,
    year,
    start,
    end,
    totalCalendarDays: end.getDate(),
  };
};

const laterDay = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const earlierDay = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

const normalizeName = (name) =>
  String(name || "").toLowerCase().replace(/[\s_.-]+/g, "").trim();

const leaveMatchesEmployee = (leave, employee) => {
  if (!leave || !employee) return false;
  const empMongo = String(employee._id || "");
  const empCode = String(employee.employeeId || "").toLowerCase();
  const empName = normalizeName(employee.employeeName);

  const recordId = String(leave.employeeRecordId?._id || leave.employeeRecordId || "");
  if (empMongo && recordId && recordId === empMongo) return true;

  const populated = leave.employee;
  if (populated && typeof populated === "object") {
    const linkedEmp = populated.employeeId?._id || populated.employeeId || null;
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

  const hasRef = Boolean(
    recordId ||
      leave.employeeId ||
      (populated && (populated._id || populated.employeeId || populated))
  );
  if (hasRef) return false;

  const leaveName = normalizeName(leave.employeeName || "");
  return Boolean(empName && leaveName && leaveName === empName);
};

const isHalfDayLeave = (leave) => {
  const text = `${leave?.leaveType || ""} ${leave?.reason || ""} ${leave?.changeRemarks || ""}`;
  return /half[\s-]?day/i.test(text);
};

const isUnpaidLeaveType = (leave) => {
  const text = `${leave?.leaveType || ""} ${leave?.reason || ""} ${leave?.changeRemarks || ""}`;
  return /\b(lwp|unpaid|without\s*pay)\b/i.test(text);
};

/**
 * Deduct approved leave from payable days (full-month leave → 0).
 * Half-day / LWP use existing wording on the leave record when present;
 * other approved leave still reduces payable working days.
 */
const unpaidFractionForLeave = (leave) => {
  if (isHalfDayLeave(leave)) return 0.5;
  if (isUnpaidLeaveType(leave)) return 1;
  return 1;
};

const getPayrollExitDate = (employee) => {
  // Vacation lastWorkingDay must not cut later payroll months.
  // Only Relieved/Resigned/Terminated/InActive and Notice Period are employment exits.
  if (!lastWorkingDayIsEmploymentExit(employee?.employeeStatus)) return null;
  return toDayStart(employee?.lastWorkingDay) || toDayStart(employee?.noticePeriodEndDate);
};

const getEmploymentWindow = (employee, monthStart, monthEnd) => {
  const join = toDayStart(employee?.doj);
  const last = getPayrollExitDate(employee);
  if (join && join > monthEnd) return null;
  if (last && last < monthStart) return null;
  const start = laterDay(monthStart, join);
  const end = earlierDay(monthEnd, last);
  if (!start || !end || end < start) return null;
  return { start, end };
};

const attendanceEmployeeId = (record) =>
  String(record?.employee?._id || record?.employee || "");

/**
 * @returns {{
 *   totalWorkingDays: number,
 *   presentDays: number,
 *   payableDays: number,
 *   skip: boolean,
 *   skipReason: string,
 * }}
 */
const computePayablePayrollDays = ({
  employee,
  month,
  year,
  attendanceRecords = [],
  leaveRequests = [],
} = {}) => {
  const period = getPayrollPeriod(month, year);
  if (!period) {
    return {
      totalWorkingDays: 0,
      presentDays: 0,
      payableDays: 0,
      skip: true,
      skipReason: "Invalid payroll month",
    };
  }

  const totalWorkingDays = period.totalCalendarDays;
  const window = getEmploymentWindow(employee, period.start, period.end);
  if (!window) {
    return {
      totalWorkingDays,
      presentDays: 0,
      payableDays: 0,
      skip: true,
      skipReason: "Not employed during this month",
    };
  }

  const empId = String(employee._id || "");
  const attendanceByDay = {};
  (attendanceRecords || []).forEach((record) => {
    if (attendanceEmployeeId(record) !== empId) return;
    const key = dateKey(record.date);
    if (key) attendanceByDay[key] = record.status;
  });

  const unpaidByDay = {};
  (leaveRequests || []).forEach((leave) => {
    if (!APPROVED_LEAVE_STATUSES.has(leave?.status)) return;
    if (!leaveMatchesEmployee(leave, employee)) return;
    const start = laterDay(window.start, toDayStart(leave.startDate));
    const end = earlierDay(window.end, toDayStart(leave.endDate));
    if (!start || !end || end < start) return;
    const fraction = unpaidFractionForLeave(leave);
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = dateKey(cursor);
      unpaidByDay[key] = Math.max(unpaidByDay[key] || 0, fraction);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  let payableDays = 0;
  let presentDays = 0;
  const cursor = new Date(window.start);
  while (cursor <= window.end) {
    const key = dateKey(cursor);
    const att = attendanceByDay[key];
    let unpaid = unpaidByDay[key] || 0;
    if (att === "Leave") unpaid = Math.max(unpaid, 1);
    const payable = Math.max(0, 1 - unpaid);
    payableDays += payable;
    if (att === "Onsite") presentDays += payable;
    else if (!att && payable > 0) presentDays += payable;
    cursor.setDate(cursor.getDate() + 1);
  }

  payableDays = Math.round(payableDays * 100) / 100;
  presentDays = Math.round(presentDays * 100) / 100;

  if (payableDays <= 0) {
    return {
      totalWorkingDays,
      presentDays: 0,
      payableDays: 0,
      skip: true,
      skipReason: "No payable working days",
    };
  }

  return {
    totalWorkingDays,
    presentDays: Math.min(presentDays, totalWorkingDays),
    payableDays: Math.min(payableDays, totalWorkingDays),
    skip: false,
    skipReason: "",
  };
};

const scaleSalaryAmount = (amount, payableDays) => {
  const base = Number(amount);
  const payable = Number(payableDays);
  if (!Number.isFinite(base) || base === 0) return 0;
  if (!Number.isFinite(payable) || payable <= 0) return 0;
  return Math.round(((base * payable) / PAYROLL_MONTH_DAYS) * 100) / 100;
};

module.exports = {
  MONTH_NAMES,
  PAYROLL_MONTH_DAYS,
  getPayrollPeriod,
  getEmploymentWindow,
  computePayablePayrollDays,
  scaleSalaryAmount,
  inclusiveDays,
  dateKey,
  toDayStart,
};
