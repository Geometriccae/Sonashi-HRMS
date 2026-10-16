/**
 * SIF export against the client's reference SIF format — offline checks.
 *   node scratch/verify_sif_export_no_empid.js
 *
 * Reference lines (client Matrix output):
 *   EDR,31615069381813,740810000,00000000945015240928803,2026-09-01,2026-09-30,0030,2300.00,0.00,0000
 *   SCR,0000000246878,302620122,2026-09-26,1647,092026,18,142991.67,AED,0000000246878260926164700
 */
const assert = require("assert");
const {
  generateSifContent,
  buildSalaryReportPayrollRow,
  employeeToExcelRow,
  excelHeaders,
} = require("../utils/sifUtils");
const {
  buildCompanyEmployerMap,
  applyCompanyEmployerMapping,
  resolveEmployeeCompanyMapping,
} = require("../utils/sifCompanyMapping");
const { buildSifAudit, validateSifExports } = require("../utils/sifAudit");
const { buildEmployeeSalarySlip } = require("../utils/generateSalarySlips");

const EMPLOYER = "0000000246878";
const OTHER_EMPLOYER = "0000000172509";
const ROUTING = "302620122";
const YEAR = 2026;
const MONTH = 9;

let seq = 0;
const emp = (overrides = {}, salary = {}) => {
  seq += 1;
  return {
    _id: `emp${seq}`,
    employeeId: `IDMM-${String(seq).padStart(3, "0")}`,
    employeeName: `Employee ${seq}`,
    emiratesId: "784-1990-1234567-1",
    workPermitNo: "31615069381813",
    companyCode: EMPLOYER,
    employeeStatus: "Active",
    doj: "2020-01-01",
    salaryDetails: {
      basicSalary: 1500,
      houseRent: 500,
      travelExp: 300,
      other: 0,
      deduction: 0,
      totalSalary: 2300,
      bankSortCode: "740810000",
      ibanNumber: "945015240928803",
      ...salary,
    },
    ...overrides,
  };
};

/** Salary slip exactly as the existing payroll generator would store it. */
const slipFor = (employee, { leaveRequests = [] } = {}) => {
  const built = buildEmployeeSalarySlip({
    employee,
    month: "September",
    year: String(YEAR),
    leaveRequests,
  });
  assert.ok(!built.skipped, built.reason);
  return built.slipData;
};

const rowsFor = (list) =>
  list.map(({ employee, slip }) =>
    buildSalaryReportPayrollRow({ employee, slip, year: YEAR, month: MONTH })
  );

const generate = (rows, now = new Date(2026, 8, 26, 16, 47, 0)) =>
  generateSifContent({
    rows,
    employerId: EMPLOYER,
    defaultAgentRoutingCode: ROUTING,
    year: YEAR,
    month: MONTH,
    now,
  });

// ── Test 1 + 6: multiple employees, reference format ────────────────────────
const refEmp = emp();
const second = emp(
  { workPermitNo: "12345678901234" },
  { bankSortCode: "803320101", ibanNumber: "AE07 0331 2345 6789 0123 456", basicSalary: 3000, houseRent: 1000, travelExp: 500, totalSalary: 4500 }
);
const otherEmployer = emp({ companyCode: OTHER_EMPLOYER, workPermitNo: "99999999999999" });

const base = [
  { employee: refEmp, slip: slipFor(refEmp) },
  { employee: second, slip: slipFor(second) },
  { employee: otherEmployer, slip: slipFor(otherEmployer) },
];
const result = generate(rowsFor(base));
assert.ok(!result.error, result.error);
console.log(result.content);

const lines = result.content.trim().split(/\r\n/);
assert.ok(result.content.endsWith("\r\n") && !/[^\r]\n/.test(result.content), "CRLF line endings like the reference files");
const edrs = lines.filter((l) => l.startsWith("EDR,"));
const scr = lines.find((l) => l.startsWith("SCR,"));

assert.strictEqual(
  edrs[0],
  "EDR,31615069381813,740810000,00000000945015240928803,2026-09-01,2026-09-30,0030,2300.00,0.00,0000",
  "EDR must match the reference line byte for byte"
);
assert.strictEqual(
  edrs[1],
  "EDR,12345678901234,803320101,AE070331234567890123456,2026-09-01,2026-09-30,0030,4500.00,0.00,0000"
);
edrs.forEach((l) => assert.strictEqual(l.split(",").length, 10, `10 fields: ${l}`));
assert.strictEqual(edrs.length, 2, "only employees of the selected employer");
assert.ok(!result.content.includes("99999999999999"), "other employer's employee excluded");
assert.strictEqual(result.otherEmployerCount, 1);
assert.strictEqual(
  scr,
  `SCR,${EMPLOYER},${ROUTING},2026-09-26,1647,092026,2,6800.00,AED,${EMPLOYER}260926164700`
);
assert.strictEqual(result.fileName, `${EMPLOYER}260926164700.SIF`);
["784199012345671", "784-1990-1234567-1"].forEach((v) =>
  assert.ok(!result.content.includes(v), `SIF must not contain Emirates ID ${v}`)
);
console.log("PASS Test 1/6: EDR field order, padding, decimals, dates; SCR count/total; file name match reference");

// File name is built from the generation time (YYMMDDHHMMSS), not hardcoded.
const later = generate(rowsFor(base), new Date(2026, 9, 3, 9, 5, 7));
assert.strictEqual(later.fileName, `${EMPLOYER}261003090507.SIF`);
assert.ok(later.content.includes(",2026-10-03,0905,092026,2,"));
console.log("PASS file date/time/name follow the generation moment");

// ── Test 2: missing mandatory bank info / labour card ───────────────────────
const noBank = emp({}, { ibanNumber: "", accountNumber: "" });
const noAgent = emp({}, { bankSortCode: "" });
const noCard = emp({ workPermitNo: "", emiratesId: "" });
const noEmiratesId = emp({ emiratesId: "", workPermitNo: "11111111111111" });
const noSlip = emp({ workPermitNo: "22222222222222" });
const badCompany = emp({ companyCode: "EZJ00001364308", workPermitNo: "33333333333333" });
const r2 = generate(
  rowsFor([
    { employee: refEmp, slip: slipFor(refEmp) },
    { employee: noBank, slip: slipFor(noBank) },
    { employee: noAgent, slip: slipFor(noAgent) },
    { employee: noCard, slip: slipFor(noCard) },
    { employee: noEmiratesId, slip: slipFor(noEmiratesId) },
    { employee: noSlip, slip: null },
    { employee: badCompany, slip: slipFor(badCompany) },
  ])
);
assert.ok(!r2.error, r2.error);
const skippedBy = Object.fromEntries(r2.skipped.map((s) => [s.staffId, s.reason]));
assert.strictEqual(skippedBy[noBank.employeeId], "Missing IBAN / Bank Account");
assert.strictEqual(skippedBy[noAgent.employeeId], "Missing Bank Agent Code");
assert.strictEqual(skippedBy[noCard.employeeId], "Missing Staff ID / Labour Card Number");
assert.strictEqual(skippedBy[noSlip.employeeId], "Salary slip not generated for September 2026");
assert.strictEqual(skippedBy[badCompany.employeeId], "Invalid Company Code (Employer ID must be 13 digits)");
assert.ok(!skippedBy[noEmiratesId.employeeId], "missing Emirates ID must not skip");
assert.strictEqual(r2.edrCount, 2);
assert.ok(r2.content.includes("EDR,11111111111111,"));
console.log("PASS Test 2: incomplete employees listed with the missing field; no invalid EDR; Emirates ID not required");

// ── Test 3: bank / IBAN change is picked up on the next SIF ─────────────────
const changed = { ...refEmp, salaryDetails: { ...refEmp.salaryDetails, bankSortCode: "803320101", ibanNumber: "AE070331234567890123999" } };
const r3 = generate(rowsFor([{ employee: changed, slip: slipFor(changed) }]));
assert.ok(r3.content.startsWith("EDR,31615069381813,803320101,AE070331234567890123999,"));
console.log("PASS Test 3: updated agent code / IBAN used automatically");

// ── Test 4: salary change flows through the regenerated salary slip ─────────
const raised = { ...refEmp, salaryDetails: { ...refEmp.salaryDetails, basicSalary: 2000, totalSalary: 2800 } };
const r4 = generate(rowsFor([{ employee: raised, slip: slipFor(raised) }]));
assert.ok(r4.content.includes(",0030,2800.00,0.00,0000"), r4.content);
console.log("PASS Test 4: current salary used via the existing payroll slip");

// Increment saved as a total only: salary parts (and the slip) still on the old salary.
const incremented = emp({ workPermitNo: "66666666666666" }, { totalSalary: 2500 });
const incSlip = slipFor(incremented);
assert.strictEqual(incSlip.netSalary, 2300);
const incRow = rowsFor([{ employee: incremented, slip: incSlip }])[0];
assert.strictEqual(incRow.fixedIncome, 2500);
const incPartial = rowsFor([{ employee: incremented, slip: { ...incSlip, payableDays: 29, leave: 76.67, totalDeduction: 76.67, netSalary: 2223.33 } }])[0];
assert.strictEqual(incPartial.fixedIncome, 2416.67);
// Standing Employee Master deduction the slip did not charge.
const withDeduction = emp({ workPermitNo: "77777777777777" }, { deduction: 300, totalSalary: 2000 });
const dedRow = rowsFor([{ employee: withDeduction, slip: { ...slipFor(withDeduction), advance: 0, totalDeduction: 0, netSalary: 2300 } }])[0];
assert.strictEqual(dedRow.fixedIncome, 2000);
console.log("PASS SIF salary on Employee Master Total Salary: increment 2500, 29 days 2416.67, standing deduction 2000");

// ── Test 5: approved leave → existing payroll decides days / salary ─────────
const onLeave = emp({ workPermitNo: "44444444444444" });
const leave = {
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  employeeRecordId: onLeave._id,
  status: "Approved",
  leaveType: "Annual Leave",
  startDate: "2026-09-10",
  endDate: "2026-09-12",
  importSource: "test",
};
const leaveSlip = slipFor(onLeave, { leaveRequests: [leave] });
const r5 = generate(rowsFor([{ employee: onLeave, slip: leaveSlip }]));
const expectedNet = leaveSlip.netSalary.toFixed(2);
assert.strictEqual(leaveSlip.payableDays, 27);
assert.ok(
  r5.content.includes(`EDR,44444444444444,740810000,00000000945015240928803,2026-09-01,2026-09-30,0030,${expectedNet},0.00,0000`),
  r5.content
);
assert.ok(r5.content.includes(`,1,${expectedNet},AED,`));
const leaveRow = rowsFor([{ employee: onLeave, slip: leaveSlip }])[0];
assert.strictEqual(leaveRow.daysWorked, 27);
assert.strictEqual(leaveRow.leaveDays, 3);
console.log(`PASS Test 5: 3 approved leave days → salary ${expectedNet} from the payroll slip; report shows 27 worked / 3 leave; EDR keeps reference 0030/0000`);

// Mid-month joiner: days before joining are neither worked nor leave.
const joiner = emp({ workPermitNo: "55555555555555", doj: "2026-09-16" });
const joinerSlip = slipFor(joiner);
const rj = generate(rowsFor([{ employee: joiner, slip: joinerSlip }]));
assert.ok(rj.content.includes(`EDR,55555555555555,740810000,00000000945015240928803,2026-09-01,2026-09-30,0030,${joinerSlip.netSalary.toFixed(2)},0.00,0000`), rj.content);
const joinerRow = rowsFor([{ employee: joiner, slip: joinerSlip }])[0];
assert.strictEqual(joinerRow.daysWorked, 15);
assert.strictEqual(joinerRow.leaveDays, 0);
console.log("PASS mid-month joiner: report 15 worked / 0 leave; EDR 0030/0000 with payroll salary");

// ── Excel export: labour card column, per-employee employer ID ──────────────
assert.ok(excelHeaders.includes("LABOURCARD") && excelHeaders.includes("EMPID"));
const xrow = employeeToExcelRow(otherEmployer, EMPLOYER);
assert.strictEqual(xrow.LABOURCARD, "99999999999999");
assert.strictEqual(xrow.EMPLOYERID, OTHER_EMPLOYER);
console.log("PASS SIF Excel export carries labour card + the employee's employer ID");

// Company assignment is resolved from the existing Company Documents mapping.
const companyMap = buildCompanyEmployerMap([
  { particulars: "Branch Company", docNumber: EMPLOYER },
]);
const staleStoredCompany = emp({ office: "Branch Company", companyCode: OTHER_EMPLOYER });
const mappedEmployee = applyCompanyEmployerMapping(staleStoredCompany, companyMap);
const mappedRow = rowsFor([{ employee: mappedEmployee, slip: slipFor(mappedEmployee) }])[0];
assert.strictEqual(mappedRow.employerId, EMPLOYER);
assert.strictEqual(mappedRow.companyCode, OTHER_EMPLOYER);
assert.strictEqual(mappedRow.companyMapping.source, "company-document");
assert.strictEqual(mappedRow.companyMapping.status, "Mismatch");
const mappedExport = generate([mappedRow]);
assert.strictEqual(mappedExport.edrCount, 1, "unambiguous company configuration fixes export without rewriting Employee Master");

const conflictMap = buildCompanyEmployerMap([
  { particulars: "Branch Company", docNumber: EMPLOYER },
  { particulars: "Branch Company", docNumber: OTHER_EMPLOYER },
]);
const conflict = resolveEmployeeCompanyMapping(staleStoredCompany, conflictMap);
assert.strictEqual(conflict.source, "conflict");
assert.strictEqual(conflict.employerId, "");
assert.ok(conflict.issues[0].includes("Conflicting"));
console.log("PASS company mapping: configured employer wins stale stored code; conflicts are not guessed");

const audit = buildSifAudit([mappedRow, rowsFor([{ employee: noAgent, slip: slipFor(noAgent) }])[0]]);
assert.strictEqual(audit.summary.eligibleEmployees, 2);
assert.strictEqual(audit.summary.resolvedCompanyMismatches, 1);
assert.strictEqual(audit.summary.agentCode.missing, 1);
assert.ok(audit.records.some((record) => record.validationResult === "Missing Data"));
const exportAudit = validateSifExports({
  rows: [mappedRow],
  audit: buildSifAudit([mappedRow]),
  scrRouting: [
    { employerId: EMPLOYER, agentRoutingCode: ROUTING, validationResult: "Pass" },
    { employerId: OTHER_EMPLOYER, agentRoutingCode: "", validationResult: "Missing Data" },
  ],
  month: MONTH,
  year: YEAR,
  now: new Date(2026, 8, 26, 16, 47, 0),
});
assert.strictEqual(exportAudit[0].edrScrValidation, "Pass");
assert.strictEqual(exportAudit[1].edrScrValidation, "Missing Data");
console.log("PASS full-population audit summary reports company mismatch and missing Agent Code");

// ── No valid employees → clear error, no file ───────────────────────────────
const none = generate(rowsFor([{ employee: noSlip, slip: null }]));
assert.ok(none.error && !none.content && none.skipped.length === 1);
console.log("PASS no file generated when no employee has complete data");

console.log("\nAll SIF export checks passed.");
