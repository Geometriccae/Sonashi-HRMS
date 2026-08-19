const assert = require("assert");
const {
  computePayablePayrollDays,
  scaleSalaryAmount,
  getPayrollPeriod,
} = require("../utils/payrollPayableDays");

const monthly = 30000;
const empId = "emp1";

const employee = (overrides = {}) => ({
  _id: empId,
  employeeId: "E001",
  employeeName: "Test User",
  ...overrides,
});

const run = (label, fn) => {
  try {
    fn();
    console.log("PASS", label);
  } catch (err) {
    console.error("FAIL", label, err.message);
    process.exitCode = 1;
  }
};

run("full month July 2026 → 31/31 and full salary", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "July",
    year: 2026,
  });
  assert.strictEqual(days.totalWorkingDays, 31);
  assert.strictEqual(days.payableDays, 31);
  assert.strictEqual(days.skip, false);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays, days.totalWorkingDays), 30000);
});

run("February 2026 has 28 working/calendar days", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "February",
    year: 2026,
  });
  assert.strictEqual(days.totalWorkingDays, 28);
  assert.strictEqual(days.payableDays, 28);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays, days.totalWorkingDays), 30000);
});

run("joined mid-July (15th) prorates from joining date", () => {
  const days = computePayablePayrollDays({
    employee: employee({ doj: "2026-07-15" }),
    month: "July",
    year: 2026,
  });
  assert.strictEqual(days.payableDays, 17);
  assert.strictEqual(days.totalWorkingDays, 31);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays, days.totalWorkingDays), 16451.61);
});

run("left mid-July (10th) prorates until last working day", () => {
  const days = computePayablePayrollDays({
    employee: employee({ lastWorkingDay: "2026-07-10" }),
    month: "July",
    year: 2026,
  });
  assert.strictEqual(days.payableDays, 10);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays, days.totalWorkingDays), 9677.42);
});

run("partial approved leave reduces payable days", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "July",
    year: 2026,
    leaveRequests: [{
      employeeName: "Test User",
      status: "Approved",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      leaveType: "Annual Leave",
      reason: "Vacation",
    }],
  });
  assert.strictEqual(days.payableDays, 26);
  assert.strictEqual(days.skip, false);
});

run("half-day leave deducts 0.5 day", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "July",
    year: 2026,
    leaveRequests: [{
      employeeName: "Test User",
      status: "Approved",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      leaveType: "Sick Leave",
      reason: "Half day medical",
    }],
  });
  assert.strictEqual(days.payableDays, 30.5);
});

run("full month leave → 0 payable days and skip", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "July",
    year: 2026,
    leaveRequests: [{
      employeeName: "Test User",
      status: "Approved",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      leaveType: "Vacation",
      reason: "Full month leave",
    }],
  });
  assert.strictEqual(days.payableDays, 0);
  assert.strictEqual(days.skip, true);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays, days.totalWorkingDays), 0);
});

run("attendance Leave days are unpaid", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "July",
    year: 2026,
    attendanceRecords: [
      { employee: empId, date: "2026-07-01", status: "Leave" },
      { employee: empId, date: "2026-07-02", status: "Leave" },
    ],
  });
  assert.strictEqual(days.payableDays, 29);
});

run("not employed in month is skipped", () => {
  const days = computePayablePayrollDays({
    employee: employee({ lastWorkingDay: "2026-06-30" }),
    month: "July",
    year: 2026,
  });
  assert.strictEqual(days.skip, true);
  assert.strictEqual(days.payableDays, 0);
});

run("getPayrollPeriod uses actual month length", () => {
  assert.strictEqual(getPayrollPeriod("April", 2026).totalCalendarDays, 30);
  assert.strictEqual(getPayrollPeriod("February", 2024).totalCalendarDays, 29);
});

if (!process.exitCode) console.log("All payroll payable-day scenarios passed.");
