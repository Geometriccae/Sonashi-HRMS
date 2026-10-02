/**
 * Monthly payroll cycle with a salary-slip cut-off day (default the 25th).
 *
 * A month's salary slip is generated on its cut-off day. Each unpaid day
 * (approved leave or a "Leave" attendance mark) belongs to the first payroll
 * cycle whose cut-off is on/after BOTH the day itself and the moment it was
 * approved. So for September (cut-off 25/09):
 *   - leave on 10/09 approved 20/09        → September slip
 *   - leave on 26/09–30/09 (any approval)  → October slip (carried forward)
 *   - leave on 10/09 approved on 27/09     → October slip (carried forward)
 *
 * Days of the slip month up to the cut-off stay inside the existing
 * payable-days calculation. Earlier days that belong to this cycle are charged
 * as a carried-forward leave deduction at the same Gross / 30 daily rate.
 * Every charged day is recorded on the slip so it is never deducted twice.
 */

const {
  MONTH_NAMES,
  getPayrollPeriod,
  leaveMatchesEmployee,
  unpaidFractionForLeave,
  scaleSalaryAmount,
  toDayStart,
  dateKey,
} = require("./payrollPayableDays");

const DEFAULT_PAYROLL_CUTOFF_DAY = 25;
const APPROVED_LEAVE_STATUSES = new Set(["Approved", "HOD Approved"]);

/** Cut-off day of month; PAYROLL_CUTOFF_DAY in the server env overrides the default. */
const getPayrollCutoffDay = () => {
  const configured = Number(process.env.PAYROLL_CUTOFF_DAY);
  return Number.isInteger(configured) && configured >= 1 && configured <= 31
    ? configured
    : DEFAULT_PAYROLL_CUTOFF_DAY;
};

/** Cut-off day for a month (clamped to the month's last day). */
const getPayrollCutoffDate = (monthIndex, year) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(getPayrollCutoffDay(), lastDay));
};

/** End of the cut-off day — anything known after this belongs to the next cycle. */
const getPayrollCutoffEnd = (monthIndex, year) => {
  const cutoff = getPayrollCutoffDate(monthIndex, year);
  return new Date(cutoff.getFullYear(), cutoff.getMonth(), cutoff.getDate(), 23, 59, 59, 999);
};

const cycleIndex = (monthIndex, year) => year * 12 + monthIndex;

/** Payroll cycle (year*12 + monthIndex) a day belongs to, given when it became known. */
const payrollCycleIndexFor = (day, knownAt = null) => {
  const dayStart = toDayStart(day);
  if (!dayStart) return null;
  const known = knownAt ? new Date(knownAt) : null;
  const effective =
    known && !Number.isNaN(known.getTime()) && known > dayStart ? known : dayStart;
  const monthIndex = effective.getMonth();
  const year = effective.getFullYear();
  return effective <= getPayrollCutoffEnd(monthIndex, year)
    ? cycleIndex(monthIndex, year)
    : cycleIndex(monthIndex, year) + 1;
};

/**
 * When an approved leave became effective for payroll.
 * Excel-imported history is stamped with the import time, so it is treated as
 * approved on time (it must never be pulled into a later cycle).
 */
const leaveApprovedAt = (leave) => {
  if (!leave || leave.importSource) return null;
  const stamps = [leave.hodApprovedAt, leave.adminApprovedAt]
    .map((v) => (v ? new Date(v) : null))
    .filter((d) => d && !Number.isNaN(d.getTime()));
  if (!stamps.length) return null;
  return new Date(Math.min(...stamps.map((d) => d.getTime())));
};

const monthKeyOf = (monthValue, yearValue) => {
  const period = getPayrollPeriod(monthValue, yearValue);
  return period ? cycleIndex(period.monthIndex, period.year) : null;
};

const ledgerKey = (entry) => `${entry.source}:${entry.sourceId}:${entry.date}`;

const attendanceEmployeeId = (record) => String(record?.employee?._id || record?.employee || "");

/**
 * Every unpaid day for one employee from approved leave + "Leave" attendance.
 * @returns {Array<{date, day, fraction, source, sourceId, knownAt, leave?, record?}>}
 */
const collectUnpaidDays = ({ employee, leaveRequests = [], attendanceRecords = [], rangeEnd }) => {
  const days = [];
  const empId = String(employee?._id || "");

  (leaveRequests || []).forEach((leave) => {
    if (!APPROVED_LEAVE_STATUSES.has(leave?.status)) return;
    if (!leaveMatchesEmployee(leave, employee)) return;
    const start = toDayStart(leave.startDate);
    const endRaw = toDayStart(leave.endDate) || start;
    if (!start || !endRaw || endRaw < start) return;
    const end = rangeEnd && endRaw > rangeEnd ? rangeEnd : endRaw;
    const fraction = unpaidFractionForLeave(leave);
    const knownAt = leaveApprovedAt(leave);
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push({
        date: dateKey(cursor),
        day: new Date(cursor),
        fraction,
        source: "leave",
        sourceId: String(leave._id || ""),
        knownAt,
        leave,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  (attendanceRecords || []).forEach((record) => {
    if (attendanceEmployeeId(record) !== empId) return;
    if (String(record.status || "") !== "Leave") return;
    const day = toDayStart(record.date);
    if (!day || (rangeEnd && day > rangeEnd)) return;
    days.push({
      date: dateKey(day),
      day,
      fraction: 1,
      source: "attendance",
      sourceId: String(record._id || ""),
      knownAt: null,
      record,
    });
  });

  return days;
};

/**
 * Split one employee's unpaid days for a slip month into:
 *   - inputs for the existing payable-days calculation (own days ≤ cut-off)
 *   - carried-forward days from earlier months that belong to this cycle
 *
 * @param {object} params
 * @param {object[]} params.employeeSlips Every stored slip for this employee.
 */
const buildPayrollCycleInputs = ({
  employee,
  month,
  year,
  leaveRequests = [],
  attendanceRecords = [],
  employeeSlips = [],
}) => {
  const period = getPayrollPeriod(month, year);
  if (!period) return null;

  const slipCycle = cycleIndex(period.monthIndex, period.year);
  const cutoffDate = getPayrollCutoffDate(period.monthIndex, period.year);
  const cutoffEnd = getPayrollCutoffEnd(period.monthIndex, period.year);

  // Slips by month, excluding the one being (re)generated.
  const slipsByMonth = new Map();
  const processed = new Set();
  let pendingFromPrevious = new Set();
  (employeeSlips || []).forEach((slip) => {
    const key = monthKeyOf(slip.month, slip.year);
    if (key == null || key === slipCycle) return;
    slipsByMonth.set(key, slip);
    (slip.processedLeaveDays || []).forEach((entry) => processed.add(ledgerKey(entry)));
    if (key === slipCycle - 1) {
      pendingFromPrevious = new Set((slip.pendingCarryForward || []).map(ledgerKey));
    }
  });

  /** Was this day already charged on another slip? */
  const alreadyProcessed = (entry) => {
    if (processed.has(ledgerKey(entry))) return true;
    const dayMonthSlip = slipsByMonth.get(cycleIndex(entry.day.getMonth(), entry.day.getFullYear()));
    // Slips generated before cycle tracking deducted every approved day of their
    // calendar month that was known when the slip was last generated.
    if (dayMonthSlip && !dayMonthSlip.payrollCutoffDate) {
      const knownAt =
        entry.source === "attendance" ? entry.record?.createdAt : entry.knownAt;
      if (!knownAt) return true;
      const generatedAt = dayMonthSlip.updatedAt ? new Date(dayMonthSlip.updatedAt) : null;
      return !generatedAt || new Date(knownAt) <= generatedAt;
    }
    return false;
  };

  const unpaidDays = collectUnpaidDays({
    employee,
    leaveRequests,
    attendanceRecords,
    rangeEnd: period.end,
  });

  const ownLeaveRequests = [];
  const ownAttendanceKeep = new Set();
  const ownLedger = [];
  const carryByDate = new Map();

  unpaidDays.forEach((entry) => {
    const cycle = payrollCycleIndexFor(entry.day, entry.knownAt);
    const inSlipMonth = entry.day >= period.start && entry.day <= period.end;

    if (inSlipMonth) {
      if (cycle !== slipCycle || processed.has(ledgerKey(entry))) return;
      if (entry.source === "leave") {
        ownLeaveRequests.push({ ...entry.leave, startDate: entry.day, endDate: entry.day });
      } else {
        ownAttendanceKeep.add(entry.sourceId);
      }
      ownLedger.push({
        source: entry.source,
        sourceId: entry.sourceId,
        date: entry.date,
        fraction: entry.fraction,
        carried: false,
      });
      return;
    }

    if (entry.day >= period.start) return;
    const isPending = pendingFromPrevious.has(ledgerKey(entry));
    if (cycle !== slipCycle && !isPending) return;
    // Only recover pay for days that were actually paid on an earlier slip.
    if (!slipsByMonth.has(cycleIndex(entry.day.getMonth(), entry.day.getFullYear()))) return;
    if (alreadyProcessed(entry)) return;

    const bucket = carryByDate.get(entry.date) || { date: entry.date, day: entry.day, fraction: 0, sources: [] };
    bucket.fraction = Math.max(bucket.fraction, entry.fraction);
    bucket.sources.push({ source: entry.source, sourceId: entry.sourceId, fraction: entry.fraction });
    carryByDate.set(entry.date, bucket);
  });

  const empId = String(employee?._id || "");
  const ownAttendanceRecords = (attendanceRecords || []).filter((record) => {
    if (attendanceEmployeeId(record) !== empId) return true;
    if (String(record.status || "") !== "Leave") return true;
    return ownAttendanceKeep.has(String(record._id || ""));
  });

  const carryDays = Array.from(carryByDate.values()).sort((a, b) => a.day - b.day);

  return {
    period,
    cutoffDate,
    cutoffEnd,
    ownLeaveRequests,
    ownAttendanceRecords,
    ownLedger,
    carryDays,
  };
};

const roundAed = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Add the carried-forward leave deduction on top of the existing slip amounts.
 * Carried days are charged oldest first while net pay stays ≥ 0; any remainder
 * stays pending for the next cycle instead of being lost or duplicated.
 */
const applyCarryForwardDeduction = (amounts, carryDays = []) => {
  if (!carryDays.length) {
    return {
      amounts,
      carriedForwardLeaveDays: 0,
      carriedForwardLeaveDeduction: 0,
      carriedLedger: [],
      pendingCarryForward: [],
    };
  }

  const gross = Number(amounts.grossSalary) || 0;
  const available = Math.max(0, roundAed(gross - (Number(amounts.totalDeduction) || 0)));

  let chargedDays = 0;
  const carriedLedger = [];
  const pendingCarryForward = [];
  carryDays.forEach((bucket) => {
    const next = chargedDays + bucket.fraction;
    const entries = bucket.sources.map((s) => ({
      source: s.source,
      sourceId: s.sourceId,
      date: bucket.date,
      fraction: s.fraction,
      carried: true,
    }));
    if (scaleSalaryAmount(gross, next) <= available + 0.001) {
      chargedDays = next;
      carriedLedger.push(...entries);
    } else {
      pendingCarryForward.push(...entries.map(({ carried, ...rest }) => rest));
    }
  });

  const carriedForwardLeaveDays = Math.round(chargedDays * 100) / 100;
  const carriedForwardLeaveDeduction = scaleSalaryAmount(gross, carriedForwardLeaveDays);
  const leave = roundAed((Number(amounts.leave) || 0) + carriedForwardLeaveDeduction);
  const totalDeduction = roundAed((Number(amounts.totalDeduction) || 0) + carriedForwardLeaveDeduction);

  return {
    amounts: {
      ...amounts,
      leave,
      totalDeduction,
      deductionsPFTax: totalDeduction,
      netSalary: roundAed(gross - totalDeduction),
    },
    carriedForwardLeaveDays,
    carriedForwardLeaveDeduction,
    carriedLedger,
    pendingCarryForward,
  };
};

/** Range of leave/attendance data a slip month needs (previous month + this month). */
const payrollCycleDataRange = (month, year) => {
  const period = getPayrollPeriod(month, year);
  if (!period) return null;
  const prevMonthIndex = period.monthIndex === 0 ? 11 : period.monthIndex - 1;
  const prevYear = period.monthIndex === 0 ? period.year - 1 : period.year;
  return {
    period,
    previousMonthStart: new Date(prevYear, prevMonthIndex, 1),
    previousCutoffEnd: getPayrollCutoffEnd(prevMonthIndex, prevYear),
    cutoffEnd: getPayrollCutoffEnd(period.monthIndex, period.year),
    previousMonthName: MONTH_NAMES[prevMonthIndex],
    previousYear: prevYear,
  };
};

module.exports = {
  DEFAULT_PAYROLL_CUTOFF_DAY,
  getPayrollCutoffDay,
  getPayrollCutoffDate,
  getPayrollCutoffEnd,
  payrollCycleIndexFor,
  leaveApprovedAt,
  monthKeyOf,
  ledgerKey,
  collectUnpaidDays,
  buildPayrollCycleInputs,
  applyCarryForwardDeduction,
  payrollCycleDataRange,
};
