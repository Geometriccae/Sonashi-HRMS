/**
 * Payroll cut-off (25th) + carry-forward verification. No database: replays a
 * Sep → Oct → Nov timeline through the same buildEmployeeSalarySlip used by
 * POST /api/salary-slips/generate-bulk, with an in-memory slip store.
 *
 *   node scratch/verify_payroll_cycle_carry_forward.js
 */
const assert = require("assert");
const { buildEmployeeSalarySlip } = require("../utils/generateSalarySlips");
const { composeSalarySlipAmounts } = require("../utils/salarySlipAmounts");

const d = (y, m, day, h = 0, min = 0) => new Date(y, m - 1, day, h, min);
let idSeq = 0;
const oid = () => (++idSeq).toString(16).padStart(24, "0");

const employee = (code, gross = 3000) => ({
  _id: oid(),
  employeeId: code,
  employeeName: `Employee ${code}`,
  emailId: `${code.toLowerCase()}@example.com`,
  employeeStatus: "Active",
  doj: "2020-01-01",
  salaryDetails: { basicSalary: gross, houseRent: 0, travelExp: 0, other: 0, deduction: 0 },
});

const leave = (emp, start, end, approvedAt, extra = {}) => ({
  _id: oid(),
  employeeRecordId: emp._id,
  employeeId: emp.employeeId,
  employeeName: emp.employeeName,
  leaveType: "Annual Leave",
  status: "Approved",
  startDate: start,
  endDate: end,
  adminApprovedAt: approvedAt,
  ...extra,
});

/** In-memory SalarySlip collection keyed by email|month|year. */
const store = new Map();
const generate = (emps, month, year, leaves, generatedAt, attendance = []) => {
  const out = {};
  emps.forEach((emp) => {
    const email = emp.emailId;
    const employeeSlips = [...store.values()].filter((s) => s.emailId === email);
    const built = buildEmployeeSalarySlip({
      employee: emp,
      month,
      year,
      attendanceRecords: attendance,
      leaveRequests: leaves,
      employeeSlips,
    });
    if (built.skipped) {
      out[emp.employeeId] = built;
      return;
    }
    const slip = { ...built.slipData, updatedAt: generatedAt };
    store.set(`${email}|${month}|${year}`, slip);
    out[emp.employeeId] = slip;
  });
  return out;
};

const A = employee("A"); // leave before cut-off
const B = employee("B"); // leave after cut-off
const C = employee("C"); // multiple post-cut-off leaves incl. late approval
const D = employee("D"); // no leave
const E = employee("E"); // post-cut-off leave edited / deleted
const G = employee("G"); // leave crossing the October cut-off
const all = [A, B, C, D, E, G];
const DAILY = 100; // 3000 / 30

const leaveA = leave(A, d(2026, 9, 10), d(2026, 9, 11), d(2026, 9, 5));
const leaveB = leave(B, d(2026, 9, 26), d(2026, 9, 30), d(2026, 9, 20));
const leaveC1 = leave(C, d(2026, 9, 26), d(2026, 9, 27), d(2026, 9, 20));
const leaveC2 = leave(C, d(2026, 9, 29), d(2026, 9, 30), d(2026, 9, 28));
const leaveC3 = leave(C, d(2026, 9, 10), d(2026, 9, 10), d(2026, 9, 27)); // approved after cut-off
let leaveE = leave(E, d(2026, 9, 27), d(2026, 9, 28), d(2026, 9, 20));
const leaveG = leave(G, d(2026, 10, 24), d(2026, 10, 28), d(2026, 10, 1));

// ── 25 Sep: September slips (only leave known by then) ─────────────────────
const knownOn25Sep = [leaveA, leaveB, leaveC1, leaveE];
const sep = generate(all, "September", "2026", knownOn25Sep, d(2026, 9, 25, 10));

// Scenario 1: before cut-off → September deduction
assert.strictEqual(sep.A.leave, 2 * DAILY, "A: Sep deducts 10–11 Sep");
// Scenario 2: after cut-off → September unchanged
assert.strictEqual(sep.B.leave, 0, "B: Sep slip ignores 26–30 Sep leave");
assert.strictEqual(sep.B.netSalary, 3000);
assert.strictEqual(sep.C.leave, 0);
assert.strictEqual(sep.E.leave, 0);
// Scenario 5: no leave → identical to the existing calculation
const dExisting = composeSalarySlipAmounts({ salaryDetails: D.salaryDetails, payableDays: sep.D.payableDays });
["basicPay", "hra", "grossSalary", "advance", "leave", "totalDeduction", "netSalary"].forEach((k) =>
  assert.strictEqual(sep.D[k], dExisting[k], `D: ${k} unchanged`)
);
assert.strictEqual(sep.D.carriedForwardLeaveDays, 0);

// ── 26–30 Sep: more leave approved after the cut-off ───────────────────────
const leavesAfterSepCutoff = [...knownOn25Sep, leaveC2, leaveC3];

// Regenerating September later must not pick up post-cut-off leave.
const sepAgain = generate(all, "September", "2026", leavesAfterSepCutoff, d(2026, 9, 30, 9));
assert.strictEqual(sepAgain.C.leave, 0, "C: Sep regenerated still unchanged");
assert.strictEqual(sepAgain.A.leave, sep.A.leave);

// Scenario 6: E's leave is extended to 27–29 Sep before October payroll.
leaveE = { ...leaveE, endDate: d(2026, 9, 29) };
const leavesOn25Oct = [leaveA, leaveB, leaveC1, leaveC2, leaveC3, leaveE, leaveG];

// ── 25 Oct: October slips ─────────────────────────────────────────────────
const oct = generate(all, "October", "2026", leavesOn25Oct, d(2026, 10, 25, 10));
assert.strictEqual(oct.A.carriedForwardLeaveDays, 0, "A: nothing carried");
assert.strictEqual(oct.B.carriedForwardLeaveDays, 5, "B: 26–30 Sep carried");
assert.strictEqual(oct.B.leave, 5 * DAILY);
assert.strictEqual(oct.B.netSalary, 3000 - 5 * DAILY);
// Scenario 3: multiple post-cut-off leaves + late approval all carried
assert.strictEqual(oct.C.carriedForwardLeaveDays, 5, "C: 26,27,29,30 Sep + late-approved 10 Sep");
assert.strictEqual(oct.E.carriedForwardLeaveDays, 3, "E: edited leave carries 27–29 Sep");
// G: 24–25 Oct in October, 26–28 Oct moves to November
assert.strictEqual(oct.G.payableDays, 31 - 2, "G: Oct unpaid days are only 24–25 Oct");
assert.strictEqual(
  oct.G.leave,
  composeSalarySlipAmounts({ salaryDetails: G.salaryDetails, payableDays: 29 }).leave,
  "G: Oct leave deduction follows the existing 30-day rule"
);
assert.strictEqual(oct.D.carriedForwardLeaveDays, 0);
// September slips stay exactly as generated
assert.strictEqual(store.get("b@example.com|September|2026").leave, 0);

// Scenario 4: regenerating October does not double-charge…
const octAgain = generate(all, "October", "2026", leavesOn25Oct, d(2026, 10, 26, 9));
assert.strictEqual(octAgain.B.carriedForwardLeaveDays, 5, "B: Oct regenerated = same carry");
assert.strictEqual(octAgain.B.leave, 5 * DAILY);

// …and November never re-deducts what October already processed.
const nov = generate(all, "November", "2026", leavesOn25Oct, d(2026, 11, 25, 10));
assert.strictEqual(nov.B.carriedForwardLeaveDays, 0, "B: nothing deducted twice");
assert.strictEqual(nov.C.carriedForwardLeaveDays, 0);
assert.strictEqual(nov.E.carriedForwardLeaveDays, 0);
assert.strictEqual(nov.G.carriedForwardLeaveDays, 3, "G: 26–28 Oct carried to November");

// Scenario 6b: a post-cut-off leave deleted before the next payroll is not charged.
store.clear();
const H = employee("H");
const leaveH = leave(H, d(2026, 9, 27), d(2026, 9, 28), d(2026, 9, 20));
generate([H], "September", "2026", [leaveH], d(2026, 9, 25, 10));
const octDeleted = generate([H], "October", "2026", [], d(2026, 10, 25, 10));
assert.strictEqual(octDeleted.H.carriedForwardLeaveDays, 0, "H: deleted leave not carried");
assert.strictEqual(store.get("h@example.com|September|2026").leave, 0);

// Slips generated before cycle tracking already deducted the whole calendar month.
store.clear();
const F = employee("F");
store.set("f@example.com|September|2026", {
  emailId: F.emailId,
  month: "September",
  year: "2026",
  updatedAt: d(2026, 9, 25, 12),
  leave: 100,
  payrollCutoffDate: null,
});
const leaveFKnown = leave(F, d(2026, 9, 28), d(2026, 9, 28), d(2026, 9, 20)); // in legacy slip
const leaveFLate = leave(F, d(2026, 9, 29), d(2026, 9, 29), d(2026, 9, 26)); // after legacy slip
const octF = generate([F], "October", "2026", [leaveFKnown, leaveFLate], d(2026, 10, 25, 10));
assert.strictEqual(octF.F.carriedForwardLeaveDays, 1, "F: only the day missing from the legacy slip");

// Excel-imported history (stamped with import time) is never carried.
store.clear();
const I = employee("I");
generate([I], "September", "2026", [], d(2026, 9, 25, 10));
const imported = leave(I, d(2026, 9, 10), d(2026, 9, 12), d(2026, 10, 2), { importSource: "excel-master-tracker" });
const octI = generate([I], "October", "2026", [imported], d(2026, 10, 25, 10));
assert.strictEqual(octI.I.carriedForwardLeaveDays, 0, "I: imported history not carried");

// Approval at 18:00 on the 25th still belongs to that month.
store.clear();
const J = employee("J");
const leaveJ = leave(J, d(2026, 9, 20), d(2026, 9, 20), d(2026, 9, 25, 18));
const sepJ = generate([J], "September", "2026", [leaveJ], d(2026, 9, 25, 19));
assert.strictEqual(sepJ.J.leave, DAILY, "J: approved on the 25th → September");

// Carry larger than the remaining net pay: the rest stays pending for the next slip.
store.clear();
const K = employee("K");
K.salaryDetails.deduction = 2800; // net before carry = 200 → room for 2 days
const leaveK = leave(K, d(2026, 9, 26), d(2026, 9, 30), d(2026, 9, 20));
generate([K], "September", "2026", [leaveK], d(2026, 9, 25, 10));
const octK = generate([K], "October", "2026", [leaveK], d(2026, 10, 25, 10));
assert.strictEqual(octK.K.carriedForwardLeaveDays, 2, "K: only what fits this month");
assert.ok(octK.K.netSalary >= 0, "K: net never negative");
assert.strictEqual(octK.K.pendingCarryForward.length, 3);
const novK = generate([K], "November", "2026", [leaveK], d(2026, 11, 25, 10));
assert.strictEqual(novK.K.carriedForwardLeaveDays, 2, "K: next 2 pending days in November");
const decK = generate([K], "December", "2026", [leaveK], d(2026, 12, 25, 10));
assert.strictEqual(decK.K.carriedForwardLeaveDays, 1, "K: last pending day in December");
const janK = generate([K], "January", "2027", [leaveK], d(2027, 1, 25, 10));
assert.strictEqual(janK.K.carriedForwardLeaveDays, 0, "K: fully recovered, nothing repeated");

console.log("All payroll cut-off / carry-forward scenarios passed.");
console.table(
  Object.entries(oct).map(([code, s]) => ({
    employee: code,
    octLeaveDeduction: s.leave,
    carriedDays: s.carriedForwardLeaveDays,
    carriedAmount: s.carriedForwardLeaveDeduction,
    net: s.netSalary,
  }))
);
