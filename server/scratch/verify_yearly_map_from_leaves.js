/**
 * Unit checks for yearly-sheet leave totals (no Mongo).
 * node scratch/verify_yearly_map_from_leaves.js
 */
const assert = require("assert");
const { buildYearlyTakenFromLeaves } = require("../utils/excelLeaveWorkbook");

const years = [2023, 2024, 2025, 2026];

// Empty years stay 0; never copy another year or another employee
{
  const emp = { employeeId: "IDMM-169", staffName: "MAHESH KUMAR CHINTAKINDI" };
  const leaves = [
    {
      employeeId: "IDMO-999",
      staffName: "SOMEONE ELSE",
      year: 2026,
      excelDays: 55,
    },
  ];
  const map = buildYearlyTakenFromLeaves(leaves, emp, years);
  assert.strictEqual(map["2026"], 0);
  assert.strictEqual(map["2024"], 0);
  assert.strictEqual(map["2025"], 0);
}

// Same employee ID matches; end−start style days sum
{
  const emp = { employeeId: "IDFO-000", staffName: "KANTESH GAGAN DAS NIHALACHANDANI" };
  const leaves = [
    { employeeId: "IDFO-000", staffName: "KANTESH", year: 2026, excelDays: 2 },
    { employeeId: "IDFO-000", staffName: "KANTESH", year: 2026, excelDays: 2 },
  ];
  const map = buildYearlyTakenFromLeaves(leaves, emp, years);
  assert.strictEqual(map["2026"], 4);
}

// Exact normalized name match when ID missing on leave row
{
  const emp = { employeeId: "IDMM-151", staffName: "PRINCE KANOJIA MANI RAM" };
  const leaves = [
    { employeeId: "", staffName: "PRINCE KANOJIA MANI RAM", year: 2026, excelDays: 70 },
    { employeeId: "", staffName: "PRINCE KANOJIA MANI RAM", year: 2023, excelDays: 0 },
  ];
  const map = buildYearlyTakenFromLeaves(leaves, emp, years);
  assert.strictEqual(map["2026"], 70);
  assert.strictEqual(map["2023"], 0);
}

// Do not assign leave when names differ even if first token overlaps
{
  const emp = { employeeId: "IDMO-198", staffName: "NAINIKA GIRISH" };
  const leaves = [
    { employeeId: "IDMO-197", staffName: "CONCEITA BANZ VINCENT BANZ", year: 2026, excelDays: 30 },
  ];
  const map = buildYearlyTakenFromLeaves(leaves, emp, years);
  assert.strictEqual(map["2026"], 0);
}

console.log("verify_yearly_map_from_leaves: OK");
