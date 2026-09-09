/**
 * Verifies the payslip employee block and the payroll rule:
 *   Earnings        = exactly the Employee Master values (never prorated)
 *   Leave Deduction = (Gross Salary / 30) x unpaid days
 *   Net Payable     = Gross Salary - (Leave Deduction + other deductions)
 * Pure functions only — no database connection required.
 *   node scratch/verify_payslip_and_proration.js
 */
const assert = require("assert");
const {
  scaleSalaryAmount,
  leaveDeductionAmount,
  unpaidPayrollDays,
  PAYROLL_MONTH_DAYS,
} = require("../utils/payrollPayableDays");
const { inspectSlipProration } = require("../utils/salarySlipReprice");
const { composeSalarySlipAmounts } = require("../utils/salarySlipAmounts");
const { buildPayslipEmployeeDetails } = require("../utils/payslipEmployeeDetails");

const run = (label, fn) => {
  try {
    fn();
    console.log("PASS", label);
  } catch (err) {
    console.error("FAIL", label, err.message);
    process.exitCode = 1;
  }
};

// ---------------------------------------------------------------- fixtures

const nainika = {
  employeeId: "IDMO-178",
  employeeName: "Nainika Girish",
  emailId: "nainika@example.com",
  department: "Operations",
  designation: "Documentation Officer",
  role: "Documentation Officer",
  workPermitNo: "PC-778899",
  emiratesId: "784-1990-1234567-1",
  doj: new Date(2024, 3, 15),
  salaryDetails: {
    basicSalary: 2500,
    houseRent: 0,
    travelExp: 0,
    other: 0,
    deduction: 0,
    accountNumber: "0123456789012",
    ibanNumber: "AE070331234567890123456",
  },
};

const melvin = {
  employeeId: "IDMO-042",
  employeeName: "Melvin Dsouza",
  emailId: "melvin@example.com",
  department: "Sales",
  designation: "",
  role: "Sales Executive", // designation falls back to role
  workPermitNo: "PC-112233",
  emiratesId: "784-1988-7654321-2",
  doj: "2021-06-01",
  salaryDetails: {
    basicSalary: 1500,
    houseRent: 500,
    travelExp: 300,
    other: 200,
    deduction: 0,
    accountNumber: "9876543210001",
    ibanNumber: "AE480339999888877776666",
  },
};

// No email, no bank details, no Emirates ID — optional information missing.
const pawan = {
  employeeId: "IDMO-010",
  employeeName: "Pawan Kumar",
  emailId: "",
  department: "Warehouse",
  designation: "Storekeeper",
  role: "Storekeeper",
  workPermitNo: "",
  emiratesId: "",
  doj: null,
  salaryDetails: { basicSalary: 3000, houseRent: 0, travelExp: 0, other: 0, deduction: 0 },
};

// Small salary plus a standing deduction held in Employee Master.
const thousandBasic = {
  employeeId: "IDMO-500",
  employeeName: "Thousand Basic",
  emailId: "thousand@example.com",
  department: "Operations",
  designation: "Helper",
  role: "Helper",
  salaryDetails: { basicSalary: 1000, houseRent: 0, travelExp: 0, other: 0, deduction: 50 },
};

const slip = (overrides = {}) => ({
  employeeName: "Slip Name",
  emailId: "nainika@example.com",
  department: "Operations",
  designation: "Documentation Officer",
  dateOfJoining: "2024-04-15",
  month: "August",
  year: "2026",
  totalWorkingDays: 31,
  presentDays: 17,
  payableDays: 17,
  basicPay: 2500,
  hra: 0,
  conveyanceAllowance: 0,
  otherAllowance: 0,
  grossSalary: 2500,
  advance: 0,
  leave: 1083.33,
  totalDeduction: 1083.33,
  deductionsPFTax: 1083.33,
  netSalary: 1416.67,
  ...overrides,
});

/** A slip as the old code stored it: earnings prorated on a given divisor. */
const legacySlip = (divisor, overrides = {}) => {
  const scale = (amount, payable) => Math.round(((amount * payable) / divisor) * 100) / 100;
  const payable = overrides.payableDays ?? 17;
  return slip({
    basicPay: scale(2500, payable),
    grossSalary: scale(2500, payable),
    advance: 0,
    leave: 0,
    totalDeduction: 0,
    deductionsPFTax: 0,
    netSalary: scale(2500, payable),
    ...overrides,
  });
};

/**
 * Every employee's Employee Master salary structure, as the Salary Details tab
 * shows it. Used to prove Employee Master Basic Pay === Salary Slip Basic Pay.
 */
const SALARY_STRUCTURES = [
  // Nainika Girish, exactly as held in Employee Master.
  { name: "Nainika Girish", basicSalary: 500, houseRent: 800, travelExp: 400, other: 800, deduction: 0 },
  { name: "Melvin Dsouza", basicSalary: 1500, houseRent: 500, travelExp: 300, other: 200, deduction: 0 },
  { name: "Pawan Kumar", basicSalary: 3000, houseRent: 0, travelExp: 0, other: 0, deduction: 0 },
  { name: "Standing deduction", basicSalary: 1000, houseRent: 0, travelExp: 0, other: 0, deduction: 50 },
  { name: "Allowance heavy", basicSalary: 1200, houseRent: 2400, travelExp: 600, other: 1800, deduction: 0 },
  { name: "Basic only, odd amount", basicSalary: 4333.33, houseRent: 0, travelExp: 0, other: 0, deduction: 0 },
];

// ------------------------------- PART 0: Employee Master === Salary Slip

run("Nainika: Basic Pay stays AED 500 with 17 payable days", () => {
  const master = { basicSalary: 500, houseRent: 800, travelExp: 400, other: 800, deduction: 0 };
  const amounts = composeSalarySlipAmounts({ salaryDetails: master, payableDays: 17 });
  assert.strictEqual(amounts.basicPay, 500, "Basic Pay must not be prorated");
  assert.strictEqual(amounts.hra, 800);
  assert.strictEqual(amounts.conveyanceAllowance, 400);
  assert.strictEqual(amounts.otherAllowance, 800);
  assert.strictEqual(amounts.grossSalary, 2500);
  assert.strictEqual(amounts.leave, 1083.33);
  assert.strictEqual(amounts.advance, 0);
  assert.strictEqual(amounts.totalDeduction, 1083.33);
  assert.strictEqual(amounts.netSalary, 1416.67);
  assert.notStrictEqual(amounts.basicPay, 283.33, "283.33 is the old prorated value");
});

run("Employee Master Basic Pay equals Salary Slip Basic Pay for every employee and day count", () => {
  const dayCounts = [1, 5, 10, 15, 17, 20, 25, 28, 29, 30, 31];
  SALARY_STRUCTURES.forEach((master) => {
    dayCounts.forEach((payableDays) => {
      const amounts = composeSalarySlipAmounts({ salaryDetails: master, payableDays });
      const where = `${master.name} @ ${payableDays} payable days`;
      assert.strictEqual(amounts.basicPay, master.basicSalary, where);
      assert.strictEqual(amounts.hra, master.houseRent, where);
      assert.strictEqual(amounts.conveyanceAllowance, master.travelExp, where);
      assert.strictEqual(amounts.otherAllowance, master.other, where);
    });
  });
});

run("the salary structure object itself is never mutated", () => {
  const master = { basicSalary: 500, houseRent: 800, travelExp: 400, other: 800, deduction: 0 };
  const snapshot = JSON.stringify(master);
  composeSalarySlipAmounts({ salaryDetails: master, payableDays: 17 });
  composeSalarySlipAmounts({ salaryDetails: master, payableDays: 3 });
  assert.strictEqual(JSON.stringify(master), snapshot, "Employee Master data must not change");
});

run("gross salary always equals the sum of the original components", () => {
  SALARY_STRUCTURES.forEach((master) => {
    [7, 17, 30].forEach((payableDays) => {
      const a = composeSalarySlipAmounts({ salaryDetails: master, payableDays });
      const sum = Math.round(
        (a.basicPay + a.hra + a.conveyanceAllowance + a.otherAllowance) * 100
      ) / 100;
      assert.strictEqual(a.grossSalary, sum, master.name);
      assert.strictEqual(
        a.netSalary,
        Math.round((a.grossSalary - a.totalDeduction) * 100) / 100,
        master.name
      );
    });
  });
});

run("only the deduction reflects the days worked", () => {
  const master = { basicSalary: 500, houseRent: 800, travelExp: 400, other: 800, deduction: 0 };
  const full = composeSalarySlipAmounts({ salaryDetails: master, payableDays: 30 });
  const partial = composeSalarySlipAmounts({ salaryDetails: master, payableDays: 17 });
  assert.strictEqual(full.basicPay, partial.basicPay);
  assert.strictEqual(full.grossSalary, partial.grossSalary);
  assert.strictEqual(full.leave, 0);
  assert.strictEqual(full.netSalary, 2500);
  assert.ok(partial.leave > 0 && partial.netSalary < full.netSalary);
});

run("a standing Employee Master deduction is added to the leave deduction", () => {
  const master = { basicSalary: 1000, houseRent: 0, travelExp: 0, other: 0, deduction: 50 };
  const amounts = composeSalarySlipAmounts({ salaryDetails: master, payableDays: 17 });
  assert.strictEqual(amounts.basicPay, 1000);
  assert.strictEqual(amounts.advance, 50);
  assert.strictEqual(amounts.leave, 433.33);
  assert.strictEqual(amounts.totalDeduction, 483.33);
  assert.strictEqual(amounts.netSalary, 516.67);
});

// -------------------------------------------- PART 1: the payroll rule

run("unpaid days come off the 30-day month, never below zero", () => {
  assert.strictEqual(PAYROLL_MONTH_DAYS, 30);
  assert.strictEqual(unpaidPayrollDays(17), 13);
  assert.strictEqual(unpaidPayrollDays(30), 0);
  assert.strictEqual(unpaidPayrollDays(31), 0);
  assert.strictEqual(unpaidPayrollDays(0), 30);
});

run("leave deduction is monthly gross / 30 x unpaid days", () => {
  assert.strictEqual(leaveDeductionAmount(2500, 17), 1083.33);
  assert.strictEqual(leaveDeductionAmount(2500, 30), 0);
  assert.strictEqual(leaveDeductionAmount(3000, 15), 1500);
  assert.strictEqual(scaleSalaryAmount(2500, 17), 1416.67); // still the /30 helper
});

run("Basic Pay of 1000 stays 1000 with 17 payable days", () => {
  const verdict = inspectSlipProration(
    legacySlip(30, {
      emailId: "thousand@example.com",
      basicPay: 566.67,
      grossSalary: 566.67,
      // The old generator stored the Employee Master deduction as the total.
      totalDeduction: 50,
      deductionsPFTax: 50,
      netSalary: 516.67,
    }),
    thousandBasic
  );
  assert.strictEqual(verdict.action, "reprice");
  assert.strictEqual(verdict.amounts.basicPay, 1000, "Basic Pay must equal Employee Master");
  assert.strictEqual(verdict.amounts.grossSalary, 1000);
  assert.strictEqual(verdict.amounts.leave, 433.33); // 1000/30 x 13
  assert.strictEqual(verdict.amounts.advance, 50); // standing deduction preserved
  assert.strictEqual(verdict.amounts.totalDeduction, 483.33);
  assert.strictEqual(verdict.amounts.netSalary, 516.67);
});

run("Nainika August 2026: Basic Pay 2500, leave deduction 1083.33, net 1416.67", () => {
  const verdict = inspectSlipProration(legacySlip(31), nainika);
  assert.strictEqual(verdict.action, "reprice");
  assert.strictEqual(verdict.storedBasic, 1370.97);
  assert.strictEqual(verdict.amounts.basicPay, 2500);
  assert.strictEqual(verdict.amounts.grossSalary, 2500);
  assert.strictEqual(verdict.unpaidDays, 13);
  assert.strictEqual(verdict.amounts.leave, 1083.33);
  assert.strictEqual(verdict.amounts.netSalary, 1416.67);
});

run("a slip prorated on 30 days is also rebuilt to full Basic Pay", () => {
  const verdict = inspectSlipProration(legacySlip(30), nainika);
  assert.strictEqual(verdict.storedBasic, 1416.67);
  assert.strictEqual(verdict.action, "reprice");
  assert.strictEqual(verdict.amounts.basicPay, 2500);
  assert.strictEqual(verdict.amounts.netSalary, 1416.67);
});

run("net pay is unchanged by moving proration into the deduction", () => {
  [13, 17, 20, 25, 30].forEach((payable) => {
    const verdict = inspectSlipProration(legacySlip(30, { payableDays: payable }), nainika);
    const proratedNet = scaleSalaryAmount(2500, payable);
    const rebuiltNet = verdict.action === "reprice" ? verdict.amounts.netSalary : verdict.storedGross;
    assert.ok(
      Math.abs(rebuiltNet - proratedNet) <= 0.01,
      `payable ${payable}: net ${rebuiltNet} should still be ${proratedNet}`
    );
  });
});

run("a correct slip is left alone", () => {
  const verdict = inspectSlipProration(slip(), nainika);
  assert.strictEqual(verdict.action, "ok");
  assert.strictEqual(verdict.amounts, null);
});

run("full earnings with the leave deduction missing are corrected", () => {
  const verdict = inspectSlipProration(
    slip({ leave: 0, advance: 0, totalDeduction: 0, deductionsPFTax: 0, netSalary: 2500 }),
    nainika
  );
  assert.strictEqual(verdict.action, "reprice");
  assert.strictEqual(verdict.amounts.basicPay, 2500);
  assert.strictEqual(verdict.amounts.leave, 1083.33);
  assert.strictEqual(verdict.amounts.netSalary, 1416.67);
});

run("a manually edited slip is reported, never overwritten", () => {
  const verdict = inspectSlipProration(
    slip({ basicPay: 1800, grossSalary: 1800, netSalary: 1800, leave: 0, totalDeduction: 0 }),
    nainika
  );
  assert.strictEqual(verdict.action, "review");
  assert.strictEqual(verdict.amounts, null);
});

run("every component keeps its Employee Master value", () => {
  const verdict = inspectSlipProration(
    slip({
      emailId: "melvin@example.com",
      basicPay: 822.58,
      hra: 274.19,
      conveyanceAllowance: 164.52,
      otherAllowance: 109.68,
      grossSalary: 1370.97,
      leave: 0,
      totalDeduction: 0,
      deductionsPFTax: 0,
      netSalary: 1370.97,
    }),
    melvin
  );
  assert.strictEqual(verdict.action, "reprice");
  assert.strictEqual(verdict.amounts.basicPay, 1500);
  assert.strictEqual(verdict.amounts.hra, 500);
  assert.strictEqual(verdict.amounts.conveyanceAllowance, 300);
  assert.strictEqual(verdict.amounts.otherAllowance, 200);
  assert.strictEqual(verdict.amounts.grossSalary, 2500);
  assert.strictEqual(verdict.amounts.leave, 1083.33);
  assert.strictEqual(verdict.amounts.netSalary, 1416.67);
});

run("full attendance keeps Basic Pay whole in 28/29/30/31-day months", () => {
  // The 30-day convention normalises every month to 30 days, so a fully worked
  // 28- or 29-day month still carries 2 / 1 unpaid days — the same net pay the
  // system produced before, now shown as a deduction instead of a cut Basic Pay.
  [
    ["February", "2026", 28, 2, 166.67, 2333.33],
    ["February", "2024", 29, 1, 83.33, 2416.67],
    ["April", "2026", 30, 0, 0, 2500],
    ["August", "2026", 31, 0, 0, 2500],
  ].forEach(([month, year, days, unpaidDays, leave, net]) => {
    const verdict = inspectSlipProration(
      legacySlip(30, {
        month,
        year,
        totalWorkingDays: days,
        presentDays: days,
        payableDays: days,
      }),
      nainika
    );
    const where = `${month} ${year}`;
    // A fully worked 30/31-day month needs no correction at all.
    const actualNet = verdict.amounts
      ? verdict.amounts.netSalary
      : verdict.storedGross - verdict.expectedLeaveDeduction;
    assert.strictEqual(verdict.unpaidDays, unpaidDays, where);
    assert.strictEqual(verdict.expectedLeaveDeduction, leave, where);
    assert.strictEqual(verdict.expectedBasic, 2500, where);
    assert.strictEqual(verdict.expectedGross, 2500, where);
    assert.strictEqual(actualNet, net, where);
  });
});

run("the deduction divisor stays 30 whatever the calendar month length", () => {
  [
    [28, 15],
    [29, 15],
    [30, 15],
    [31, 15],
  ].forEach(([calendarDays, payable]) => {
    const verdict = inspectSlipProration(
      legacySlip(30, {
        totalWorkingDays: calendarDays,
        presentDays: payable,
        payableDays: payable,
      }),
      nainika
    );
    assert.strictEqual(verdict.amounts.leave, 1250, `calendar ${calendarDays}`); // 2500/30 x 15
    assert.strictEqual(verdict.amounts.basicPay, 2500, `calendar ${calendarDays}`);
    assert.strictEqual(verdict.amounts.netSalary, 1250, `calendar ${calendarDays}`);
  });
});

run("slips without a basis are skipped rather than guessed", () => {
  assert.strictEqual(inspectSlipProration(slip(), null).action, "unknown-basis");
  assert.strictEqual(inspectSlipProration(slip({ payableDays: 0 }), nainika).action, "unknown-basis");
  assert.strictEqual(
    inspectSlipProration(slip(), { ...nainika, salaryDetails: {} }).action,
    "unknown-basis"
  );
});

run("the deduction rows always add up to the stored total", () => {
  const verdict = inspectSlipProration(
    legacySlip(31, { emailId: "thousand@example.com", basicPay: 548.39, grossSalary: 548.39, netSalary: 548.39 }),
    thousandBasic
  );
  const { advance, leave, totalDeduction, grossSalary, netSalary } = verdict.amounts;
  assert.strictEqual(Math.round((advance + leave) * 100) / 100, totalDeduction);
  assert.strictEqual(Math.round((grossSalary - totalDeduction) * 100) / 100, netSalary);
});

// ------------------------------------------- PART 2: payslip employee block

const PAYSLIP_KEYS = [
  "empId", "employeeName", "payableDays", "presentDays", "department", "designation",
  "bankAccNo", "ibanNumber", "personCode", "modeOfPay", "doj", "emailId",
  "emiratesId", "unifiedId",
];

run("payslip block exposes exactly the requested fields", () => {
  const details = buildPayslipEmployeeDetails(nainika, slip());
  assert.deepStrictEqual(Object.keys(details).sort(), [...PAYSLIP_KEYS].sort());
});

run("payslip block reads the employee record, not the slip copy", () => {
  const details = buildPayslipEmployeeDetails(nainika, slip());
  assert.strictEqual(details.empId, "IDMO-178");
  assert.strictEqual(details.employeeName, "Nainika Girish");
  assert.strictEqual(details.department, "Operations");
  assert.strictEqual(details.designation, "Documentation Officer");
  assert.strictEqual(details.bankAccNo, "0123456789012");
  assert.strictEqual(details.ibanNumber, "AE070331234567890123456");
  assert.strictEqual(details.personCode, "PC-778899");
  assert.strictEqual(details.emiratesId, "784-1990-1234567-1");
  assert.strictEqual(details.emailId, "nainika@example.com");
  assert.strictEqual(details.doj, "2024-04-15");
  assert.strictEqual(details.payableDays, "17");
  assert.strictEqual(details.presentDays, "17");
});

run("Person Code uses the work permit number, matching exports and profile", () => {
  assert.strictEqual(buildPayslipEmployeeDetails(melvin, slip()).personCode, "PC-112233");
});

run("designation falls back to role, as the generator does", () => {
  assert.strictEqual(buildPayslipEmployeeDetails(melvin, slip()).designation, "Sales Executive");
});

run("missing optional information stays empty instead of invented", () => {
  const details = buildPayslipEmployeeDetails(pawan, slip({
    emailId: "noemail+idmo-010@import.hrms.placeholder",
    payableDays: 30,
    presentDays: 28,
    dateOfJoining: "",
  }));
  assert.strictEqual(details.bankAccNo, "");
  assert.strictEqual(details.ibanNumber, "");
  assert.strictEqual(details.personCode, "");
  assert.strictEqual(details.emiratesId, "");
  assert.strictEqual(details.doj, "");
  assert.strictEqual(details.emailId, "", "placeholder email must not be printed");
  assert.strictEqual(details.empId, "IDMO-010");
  assert.strictEqual(details.payableDays, "30");
  assert.strictEqual(details.presentDays, "28");
});

run("fields with no source in the employee record are empty for everyone", () => {
  [nainika, melvin, pawan].forEach((emp) => {
    const details = buildPayslipEmployeeDetails(emp, slip());
    assert.strictEqual(details.modeOfPay, "");
    assert.strictEqual(details.unifiedId, "");
  });
});

run("stored values are used only when they belong to the same employee", () => {
  const nainikaDetails = buildPayslipEmployeeDetails(nainika, slip());
  const melvinDetails = buildPayslipEmployeeDetails(melvin, slip({
    employeeName: "Slip Name",
    emailId: "melvin@example.com",
  }));
  assert.notStrictEqual(nainikaDetails.empId, melvinDetails.empId);
  assert.notStrictEqual(nainikaDetails.ibanNumber, melvinDetails.ibanNumber);
  assert.strictEqual(melvinDetails.employeeName, "Melvin Dsouza");
  assert.strictEqual(melvinDetails.bankAccNo, "9876543210001");
});

run("an unresolved employee yields slip-only values, never another employee's", () => {
  const details = buildPayslipEmployeeDetails(null, slip({ employeeName: "Unlinked Person" }));
  assert.strictEqual(details.employeeName, "Unlinked Person");
  assert.strictEqual(details.empId, "");
  assert.strictEqual(details.bankAccNo, "");
  assert.strictEqual(details.ibanNumber, "");
  assert.strictEqual(details.personCode, "");
  assert.strictEqual(details.emiratesId, "");
  assert.strictEqual(details.department, "Operations");
  assert.strictEqual(details.doj, "2024-04-15");
});

run("fractional payable days survive as shown on the slip", () => {
  const details = buildPayslipEmployeeDetails(nainika, slip({ payableDays: 30.5, presentDays: 29.5 }));
  assert.strictEqual(details.payableDays, "30.5");
  assert.strictEqual(details.presentDays, "29.5");
});

if (!process.exitCode) console.log("\nAll payslip + payroll rule checks passed.");
