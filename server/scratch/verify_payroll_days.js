const assert = require("assert");
const {
  computePayablePayrollDays,
  scaleSalaryAmount,
  getPayrollPeriod,
  PAYROLL_MONTH_DAYS,
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

run("payroll month days is a fixed 30-day basis", () => {
  assert.strictEqual(PAYROLL_MONTH_DAYS, 30);
});

run("scaleSalaryAmount always divides by 30, never calendar days", () => {
  assert.strictEqual(scaleSalaryAmount(2500, 17), 1416.67);
  assert.strictEqual(scaleSalaryAmount(3000, 15), 1500);
  assert.strictEqual(scaleSalaryAmount(4500, 20), 3000);
  assert.strictEqual(scaleSalaryAmount(2500, 31), 2583.33);
  assert.strictEqual(scaleSalaryAmount(2500, 28), 2333.33);
  assert.strictEqual(scaleSalaryAmount(2500, 29), 2416.67);
  assert.strictEqual(scaleSalaryAmount(2500, 30), 2500);
});

run("last working day 17 Aug 2026 → 17 payable days and 2500/30×17", () => {
  const days = computePayablePayrollDays({
    employee: employee({ lastWorkingDay: "2026-08-17" }),
    month: "August",
    year: 2026,
  });
  assert.strictEqual(days.payableDays, 17);
  assert.strictEqual(days.totalWorkingDays, 31);
  assert.strictEqual(scaleSalaryAmount(2500, days.payableDays), 1416.67);
  assert.notStrictEqual(scaleSalaryAmount(2500, days.payableDays), 1370.97);
});

run("full month July 2026 still counts 31 payable days, salary uses /30", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "July",
    year: 2026,
  });
  assert.strictEqual(days.totalWorkingDays, 31);
  assert.strictEqual(days.payableDays, 31);
  assert.strictEqual(days.skip, false);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays), 31000);
});

run("February 2026 has 28 payable/calendar days, salary uses /30", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "February",
    year: 2026,
  });
  assert.strictEqual(days.totalWorkingDays, 28);
  assert.strictEqual(days.payableDays, 28);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays), 28000);
});

run("joined mid-July (15th) prorates from joining date on /30", () => {
  const days = computePayablePayrollDays({
    employee: employee({ doj: "2026-07-15" }),
    month: "July",
    year: 2026,
  });
  assert.strictEqual(days.payableDays, 17);
  assert.strictEqual(days.totalWorkingDays, 31);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays), 17000);
});

run("left mid-July (10th) prorates until last working day on /30", () => {
  const days = computePayablePayrollDays({
    employee: employee({ lastWorkingDay: "2026-07-10" }),
    month: "July",
    year: 2026,
  });
  assert.strictEqual(days.payableDays, 10);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays), 10000);
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
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays), 26000);
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
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays), 30500);
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
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays), 0);
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

run("getPayrollPeriod still reports actual month length for day counting", () => {
  assert.strictEqual(getPayrollPeriod("April", 2026).totalCalendarDays, 30);
  assert.strictEqual(getPayrollPeriod("February", 2024).totalCalendarDays, 29);
  assert.strictEqual(getPayrollPeriod("August", 2026).totalCalendarDays, 31);
});

run("April 30-day month: full month salary equals monthly on /30", () => {
  const days = computePayablePayrollDays({
    employee: employee(),
    month: "April",
    year: 2026,
  });
  assert.strictEqual(days.payableDays, 30);
  assert.strictEqual(scaleSalaryAmount(monthly, days.payableDays), 30000);
});

run("salary components each prorate independently on /30", () => {
  const payable = 17;
  const basic = scaleSalaryAmount(1500, payable);
  const hra = scaleSalaryAmount(500, payable);
  const conveyance = scaleSalaryAmount(300, payable);
  const other = scaleSalaryAmount(200, payable);
  const gross = basic + hra + conveyance + other;
  assert.strictEqual(basic, 850);
  assert.strictEqual(hra, 283.33);
  assert.strictEqual(conveyance, 170);
  assert.strictEqual(other, 113.33);
  assert.strictEqual(Math.round(gross * 100) / 100, 1416.66);
});

if (!process.exitCode) console.log("All payroll payable-day scenarios passed.");
