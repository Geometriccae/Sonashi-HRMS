/**
 * Unit checks for SIF employer/company filtering (no DB).
 * Usage: node scratch/test_sif_employer_filter.js
 */
const assert = require("assert");
const {
  filterEmployeesForEmployer,
  normalizeCompanyCode,
  resolveEmployeeEmployerId,
  applyLiveCompanyCodes,
} = require("../utils/companyCode");
const { generateSifContent, employeeToExcelRow } = require("../utils/sifUtils");

const EMP_A = {
  employeeId: "E001",
  employeeName: "Alpha",
  emiratesId: "784199012345678",
  companyCode: "0000000172509",
  salaryDetails: {
    bankSortCode: "302620122",
    ibanNumber: "AE070331234567890123456",
    totalSalary: 5000,
  },
};

const EMP_B = {
  employeeId: "E002",
  employeeName: "Beta",
  emiratesId: "784199012345679",
  companyCode: "0000000246878",
  salaryDetails: {
    bankSortCode: "302620122",
    ibanNumber: "AE070331234567890123457",
    totalSalary: 4000,
  },
};

const EMP_EMPTY = {
  employeeId: "E003",
  employeeName: "Gamma",
  emiratesId: "784199012345680",
  companyCode: "",
  office: "JOINT VEN TRADING CO LLC",
  salaryDetails: {
    bankSortCode: "302620122",
    ibanNumber: "AE070331234567890123458",
    totalSalary: 3000,
  },
};

// normalize
assert.strictEqual(normalizeCompanyCode("172509"), "0000000172509");
assert.strictEqual(normalizeCompanyCode("0000000246878"), "0000000246878");

// filter — only matching company
{
  const { matched, excluded } = filterEmployeesForEmployer(
    [EMP_A, EMP_B],
    "0000000172509"
  );
  assert.strictEqual(matched.length, 1);
  assert.strictEqual(matched[0].employeeId, "E001");
  assert.strictEqual(excluded.length, 1);
  assert.strictEqual(excluded[0].staffId, "E002");
}

// filter legacy company
{
  const { matched, excluded } = filterEmployeesForEmployer(
    [EMP_A, EMP_B],
    "0000000246878"
  );
  assert.strictEqual(matched.length, 1);
  assert.strictEqual(matched[0].employeeId, "E002");
  assert.strictEqual(excluded.length, 1);
}

// live fill empty companyCode from map / default
{
  const filled = applyLiveCompanyCodes([EMP_EMPTY], {
    "joint ven trading co llc": "0000000172509",
  });
  assert.strictEqual(resolveEmployeeEmployerId(filled[0]), "0000000172509");
}

// generateSifContent SCR uses selected employer; EDR only for matched employees
{
  const { matched } = filterEmployeesForEmployer([EMP_A, EMP_B], "0000000172509");
  const result = generateSifContent({
    employees: matched,
    employerId: "0000000172509",
    defaultAgentRoutingCode: "302620122",
    year: 2026,
    month: 10,
  });
  assert.strictEqual(result.edrCount, 1);
  assert.ok(result.content.includes("SCR,0000000172509,"));
  assert.ok(result.content.includes("EDR,784199012345678,"));
  assert.ok(!result.content.includes("784199012345679"));
  assert.strictEqual(result.totalSalary, 5000);
}

// Invalid / missing agent codes are skipped, not padded
{
  const badAgent = {
    ...EMP_A,
    employeeId: "E004",
    emiratesId: "784199012345681",
    salaryDetails: { ...EMP_A.salaryDetails, bankSortCode: "12" },
  };
  const result = generateSifContent({
    employees: [EMP_A, badAgent],
    employerId: "0000000172509",
    defaultAgentRoutingCode: "302620122",
    year: 2026,
    month: 10,
  });
  assert.strictEqual(result.edrCount, 1);
  assert.strictEqual(result.skipped.length, 1);
  assert.ok(String(result.skipped[0].reason).includes("AGENTCODE"));
}

// Excel row uses employee companyCode, not a global override
{
  const row = employeeToExcelRow(EMP_B, "0000000172509");
  assert.strictEqual(row.EMPLOYERID, "0000000246878");
  assert.strictEqual(row.AGENTCODE, "302620122");
}

console.log("All SIF employer-filter tests passed.");
