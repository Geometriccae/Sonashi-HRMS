const assert = require("assert");
const {
  computePayablePayrollDays,
  scaleSalaryAmount,
  getPayrollPeriod,
  PAYROLL_MONTH_DAYS,
  leaveMatchesEmployee,
} = require("../utils/payrollPayableDays");
const { isSalarySlipEligibleForMonth } = require("../utils/salarySlipEligibility");
const {
  payrollEmailForEmployee,
  isPayrollCandidateForPeriod,
} = require("../utils/generateSalarySlips");

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

run("employment exit on 17 Aug 2026 → 17 payable days and 2500/30×17", () => {
  const days = computePayablePayrollDays({
    employee: employee({ employeeStatus: "Relieved", lastWorkingDay: "2026-08-17" }),
    month: "August",
    year: 2026,
  });
  assert.strictEqual(days.payableDays, 17);
  assert.strictEqual(days.totalWorkingDays, 31);
  assert.strictEqual(scaleSalaryAmount(2500, days.payableDays), 1416.67);
  assert.notStrictEqual(scaleSalaryAmount(2500, days.payableDays), 1370.97);
});

run("Active vacation lastWorkingDay does not end employment", () => {
  const days = computePayablePayrollDays({
    employee: employee({
      employeeStatus: "Active",
      lastWorkingDay: "2026-07-31",
      vacationStatus: "Onsite",
    }),
    month: "August",
    year: 2026,
  });
  assert.strictEqual(days.skip, false);
  assert.strictEqual(days.payableDays, 31);
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

run("left mid-July (10th) prorates until employment exit on /30", () => {
  const days = computePayablePayrollDays({
    employee: employee({ employeeStatus: "Relieved", lastWorkingDay: "2026-07-10" }),
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

run("separated employee with exit before the month is skipped", () => {
  const days = computePayablePayrollDays({
    employee: employee({ employeeStatus: "Relieved", lastWorkingDay: "2026-06-30" }),
    month: "July",
    year: 2026,
  });
  assert.strictEqual(days.skip, true);
  assert.strictEqual(days.payableDays, 0);
});

run("CASE 1: full July leave does not suppress August payroll", () => {
  const emp = employee({
    employeeStatus: "Active",
    lastWorkingDay: "2026-06-30",
    vacationStatus: "Onsite",
  });
  const julyLeave = [{
    employeeName: "Test User",
    status: "Approved",
    startDate: "2026-07-01",
    endDate: "2026-07-31",
    leaveType: "Vacation",
    reason: "Annual vacation",
  }];
  const july = computePayablePayrollDays({
    employee: emp,
    month: "July",
    year: 2026,
    leaveRequests: julyLeave,
  });
  const august = computePayablePayrollDays({
    employee: emp,
    month: "August",
    year: 2026,
    leaveRequests: julyLeave,
  });
  assert.strictEqual(july.payableDays, 0);
  assert.strictEqual(july.skip, true);
  assert.strictEqual(isSalarySlipEligibleForMonth({
    employee: emp,
    month: "July",
    year: 2026,
    leaveRequests: julyLeave,
  }).eligible, false);
  assert.strictEqual(august.skip, false);
  assert.strictEqual(august.payableDays, 31);
  assert.strictEqual(isSalarySlipEligibleForMonth({
    employee: emp,
    month: "August",
    year: 2026,
    leaveRequests: julyLeave,
  }).eligible, true);
  assert.strictEqual(scaleSalaryAmount(2500, august.payableDays), 2583.33);
});

run("CASE 2: full August leave skips August only", () => {
  const emp = employee({ employeeStatus: "Active" });
  const augustLeave = [{
    employeeName: "Test User",
    status: "Approved",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    leaveType: "Vacation",
    reason: "August vacation",
  }];
  assert.strictEqual(isSalarySlipEligibleForMonth({
    employee: emp, month: "August", year: 2026, leaveRequests: augustLeave,
  }).eligible, false);
  assert.strictEqual(computePayablePayrollDays({
    employee: emp, month: "August", year: 2026, leaveRequests: augustLeave,
  }).payableDays, 0);
});

run("CASE 4: partial August leave still generates with prorated /30 salary", () => {
  const days = computePayablePayrollDays({
    employee: employee({ employeeStatus: "Active" }),
    month: "August",
    year: 2026,
    leaveRequests: [{
      employeeName: "Test User",
      status: "Approved",
      startDate: "2026-08-18",
      endDate: "2026-08-31",
      leaveType: "Vacation",
      reason: "Leave from 18 Aug",
    }],
  });
  assert.strictEqual(days.payableDays, 17);
  assert.strictEqual(days.skip, false);
  assert.strictEqual(scaleSalaryAmount(2500, days.payableDays), 1416.67);
});

run("CASE 5: leave Jul 20–Aug 10 only deducts August overlap", () => {
  const leave = [{
    employeeName: "Test User",
    status: "Approved",
    startDate: "2026-07-20",
    endDate: "2026-08-10",
    leaveType: "Vacation",
    reason: "Crossing months",
  }];
  const august = computePayablePayrollDays({
    employee: employee({ employeeStatus: "Active" }),
    month: "August",
    year: 2026,
    leaveRequests: leave,
  });
  assert.strictEqual(august.payableDays, 21);
  assert.strictEqual(august.skip, false);
});

run("CASE 6: leave Aug 25–Sep 10 only deducts August overlap", () => {
  const days = computePayablePayrollDays({
    employee: employee({ employeeStatus: "Active" }),
    month: "August",
    year: 2026,
    leaveRequests: [{
      employeeName: "Test User",
      status: "Approved",
      startDate: "2026-08-25",
      endDate: "2026-09-10",
      leaveType: "Vacation",
      reason: "Into September",
    }],
  });
  assert.strictEqual(days.payableDays, 24);
});

run("CASE 9: older May/June/July leave does not suppress August", () => {
  const oldLeaves = [
    { employeeName: "Test User", status: "Approved", startDate: "2026-05-01", endDate: "2026-05-31", leaveType: "Vacation", reason: "May" },
    { employeeName: "Test User", status: "Approved", startDate: "2026-06-01", endDate: "2026-06-30", leaveType: "Vacation", reason: "June" },
    { employeeName: "Test User", status: "Approved", startDate: "2026-07-01", endDate: "2026-07-31", leaveType: "Vacation", reason: "July" },
  ];
  const emp = employee({
    employeeStatus: "Active",
    lastWorkingDay: "2026-04-30",
    vacationStatus: "On Vacation",
  });
  const august = computePayablePayrollDays({
    employee: emp,
    month: "August",
    year: 2026,
    leaveRequests: oldLeaves,
  });
  assert.strictEqual(august.skip, false);
  assert.strictEqual(august.payableDays, 31);
  assert.strictEqual(isSalarySlipEligibleForMonth({
    employee: emp,
    month: "August",
    year: 2026,
    leaveRequests: oldLeaves,
  }).eligible, true);
});

run("Notice Period lastWorkingDay still caps payroll", () => {
  const days = computePayablePayrollDays({
    employee: employee({ employeeStatus: "Notice Period", lastWorkingDay: "2026-08-17" }),
    month: "August",
    year: 2026,
  });
  assert.strictEqual(days.payableDays, 17);
  const september = computePayablePayrollDays({
    employee: employee({ employeeStatus: "Notice Period", lastWorkingDay: "2026-08-17" }),
    month: "September",
    year: 2026,
  });
  assert.strictEqual(september.skip, true);
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

run("leave.employee ObjectId matching the Employee still counts for that employee only", () => {
  const emp = employee({ _id: "69e08bbea74d89f831ceb2f8", employeeId: "IDMO-178" });
  assert.strictEqual(
    leaveMatchesEmployee({
      employee: "69e08bbea74d89f831ceb2f8",
      employeeId: "IDMO-178",
      status: "Approved",
      startDate: "2026-06-20",
      endDate: "2026-08-05",
    }, emp),
    true
  );
  assert.strictEqual(
    leaveMatchesEmployee({
      employee: "69e08bbea74d89f831ceb2f8",
      employeeId: "IDMO-178",
      status: "Approved",
    }, employee({ _id: "other", employeeId: "IDMO-001" })),
    false
  );
});

run("employees without email still get a stable unique payroll identity", () => {
  assert.strictEqual(
    payrollEmailForEmployee({ employeeId: "IDMO-010", emailId: "" }),
    "noemail+idmo-010@import.hrms.placeholder"
  );
  assert.strictEqual(
    payrollEmailForEmployee({ employeeId: "IDMO-010", emailId: "  A@B.COM " }),
    "a@b.com"
  );
});

run("working staff remain payroll candidates despite a previous-month vacation LWD", () => {
  const august = getPayrollPeriod("August", 2026);
  assert.strictEqual(isPayrollCandidateForPeriod({
    employeeStatus: "Active",
    lastWorkingDay: "2026-07-30",
  }, august), true);
  assert.strictEqual(isPayrollCandidateForPeriod({
    employeeStatus: "Relieved",
    lastWorkingDay: "2026-07-30",
  }, august), false);
  assert.strictEqual(isPayrollCandidateForPeriod({
    employeeStatus: "Relieved",
    lastWorkingDay: "2026-08-17",
  }, august), true);
});

if (!process.exitCode) console.log("All payroll payable-day scenarios passed.");
