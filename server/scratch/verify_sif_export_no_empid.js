/**
 * SIF export without EMPID / Emirates ID — offline checks against generateSifContent.
 *   node scratch/verify_sif_export_no_empid.js
 */
const assert = require("assert");
const { generateSifContent, employeeToExcelRow, excelHeaders } = require("../utils/sifUtils");

const employer = "1234567890123";
const routing = "987654321";

const emp = (overrides = {}) => ({
  employeeId: "IDMM-001",
  employeeName: "Valid Employee",
  emiratesId: "784-1990-1234567-1",
  employeeStatus: "Active",
  salaryDetails: {
    bankSortCode: "803320101",
    ibanNumber: "AE07 0331 2345 6789 0123 456",
    basicSalary: 3000,
    houseRent: 1000,
    travelExp: 500,
    other: 0,
    deduction: 0,
  },
  ...overrides,
});

const employees = [
  emp(),
  emp({ employeeId: "IDMM-002", employeeName: "No Emirates ID", emiratesId: "" }),
  emp({ employeeId: "IDMM-003", employeeName: "Bad Emirates ID", emiratesId: "12345" }),
  emp({
    employeeId: "IDMM-004",
    employeeName: "Missing Bank",
    salaryDetails: { bankSortCode: "803320101", totalSalary: 4000 },
  }),
  emp({
    employeeId: "IDMM-005",
    employeeName: "Missing Agent",
    salaryDetails: { accountNumber: "0011223344", totalSalary: 2500 },
  }),
];

const result = generateSifContent({
  employees,
  employerId: employer,
  defaultAgentRoutingCode: routing,
  year: 2026,
  month: 9,
  now: new Date(2026, 9, 2, 12, 5),
});

assert.ok(!result.error, result.error);
const lines = result.content.trim().split("\n");
const edrs = lines.filter((l) => l.startsWith("EDR,"));
const scr = lines.find((l) => l.startsWith("SCR,"));
console.log(result.content);

// 2. No EMPID / Emirates ID anywhere in the file
["784199012345671", "784-1990-1234567-1", "12345,"].forEach((v) =>
  assert.ok(!result.content.includes(v), `SIF must not contain ${v}`)
);
console.log("PASS EMPID / Emirates ID not present in generated SIF");

// 3 + 6. Values auto-fetched from employee record; EDR has 9 fields
assert.strictEqual(edrs.length, 3);
edrs.forEach((l) => assert.strictEqual(l.split(",").length, 9, `9 fields: ${l}`));
assert.strictEqual(
  edrs[0],
  "EDR,803320101,AE070331234567890123456,2026-09-01,2026-09-30,0030,4500.00,0.00,0000"
);
assert.strictEqual(scr, `SCR,${employer},${routing},2026-10-02,1205,092026,3,13500.00,AED,${employer}0210261205` + "00");
console.log("PASS EDR = AGENTCODE, IBAN, period, days, salary (auto-fetched); SCR count/total match");

// 4. Employees with no / invalid Emirates ID are no longer skipped
const skippedIds = result.skipped.map((s) => s.staffId);
assert.ok(!skippedIds.includes("IDMM-002") && !skippedIds.includes("IDMM-003"));
assert.ok(result.skipped.every((s) => !/emirates/i.test(s.reason)));
console.log("PASS employees without Emirates ID are exported, not skipped");

// 5. Genuinely missing mandatory fields still skipped with reason
assert.deepStrictEqual(
  result.skipped.map((s) => [s.staffId, s.reason]),
  [
    ["IDMM-004", "Missing IBAN / Bank Account"],
    ["IDMM-005", "Missing AGENTCODE"],
  ]
);
console.log("PASS missing AGENTCODE / bank still listed in skipped employees");

// No valid employees → clear error, no invalid file
const none = generateSifContent({
  employees: [employees[3]],
  employerId: employer,
  defaultAgentRoutingCode: routing,
  year: 2026,
  month: 9,
});
assert.ok(none.error && !none.content && none.skipped.length === 1);
console.log("PASS no file generated when no employee has complete data");

// 7. Excel export unchanged (still has EMPID column)
assert.ok(excelHeaders.includes("EMPID"));
assert.strictEqual(employeeToExcelRow(employees[0], employer).EMPID, "784199012345671");
console.log("PASS Excel export columns unchanged");

console.log("\nAll SIF export checks passed.");
