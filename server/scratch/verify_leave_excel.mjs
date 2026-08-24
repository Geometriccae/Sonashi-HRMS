import {
  accrueLeaveDays,
  computeExcelLeaveCalculation,
  countCompletedMonths,
  getActiveLeaveWindow,
} from "../../frontend/src/utils/leaveCalculator.js";

const asOf = new Date(2026, 7, 24); // 24/08/2026

const empA = computeExcelLeaveCalculation({ employeeName: "A", doj: "2017-01-01" }, [], asOf);
const empB = computeExcelLeaveCalculation({ employeeName: "B", doj: "2021-01-01" }, [], asOf);
const empC = computeExcelLeaveCalculation({ employeeName: "C", doj: "2024-01-01" }, [], asOf);
const empD = computeExcelLeaveCalculation({ employeeName: "D", doj: "2025-01-01" }, [], asOf);
const empE = computeExcelLeaveCalculation({ employeeName: "E", doj: "2026-03-01" }, [], asOf);

const empExact5 = computeExcelLeaveCalculation(
  { employeeName: "Exact5", doj: "2021-08-24" },
  [],
  asOf
);

const emp66 = computeExcelLeaveCalculation(
  { employeeName: "66m", doj: "2021-02-01" },
  [],
  asOf
);

const oldWindowLeave = [
  {
    status: "Approved",
    employeeName: "Hist",
    startDate: "2018-01-01",
    endDate: "2018-01-20",
  },
  {
    status: "Approved",
    employeeName: "Hist",
    startDate: "2023-06-01",
    endDate: "2023-07-02",
  },
];
const empHist = computeExcelLeaveCalculation(
  { employeeName: "Hist", doj: "2014-01-01" },
  oldWindowLeave,
  asOf
);

const empTaken = computeExcelLeaveCalculation(
  { employeeName: "Taken", doj: "2017-01-01" },
  [
    {
      status: "Approved",
      employeeName: "Taken",
      startDate: "2024-01-01",
      endDate: "2024-02-01",
    },
  ],
  asOf
);

const { effectiveStart: histStart } = getActiveLeaveWindow(asOf, "2014-01-01");

const checks = [
  ["2.5 accrual helper", accrueLeaveDays(6) === 15 && accrueLeaveDays(60) === 150],
  ["completed months 24/02→24/08 = 6", countCompletedMonths("2026-02-24", asOf) === 6],
  ["completed months exact 5y = 60", countCompletedMonths("2021-08-24", asOf) === 60],
  ["A >5y entitlement capped 150", empA.entitlement === 150],
  ["A expired > 0", empA.expiredDays > 0],
  ["A available 150 with no taken", empA.leaveDue === 150],
  ["B ~5y+ entitlement 150", empB.entitlement === 150],
  ["C ~31m entitlement 77.5", empC.activeEligibleMonths === 31 && empC.entitlement === 77.5 && empC.expiredDays === 0],
  ["C less than 5y not capped at 150", empC.entitlement < 150],
  ["exact 24 months from DOJ = 60", (() => {
    const e = computeExcelLeaveCalculation({ employeeName: "24m", doj: "2024-08-24" }, [], asOf);
    return e.activeEligibleMonths === 24 && e.entitlement === 60;
  })()],
  ["D ~1y entitlement ~45 (19m to Aug)", empD.activeEligibleMonths === 19 && empD.entitlement === 47.5],
  ["E ~5m from Mar 1", empE.activeEligibleMonths === 5 && empE.entitlement === 12.5],
  ["exact 5y = 150 / expired 0", empExact5.entitlement === 150 && empExact5.expiredDays === 0],
  ["66 months total accrued 165", emp66.totalAccruedDays === 165],
  ["66 months active 150 expired 15", emp66.entitlement === 150 && emp66.expiredDays === 15],
  ["old leave not in active taken", empHist.totalTaken === 32],
  ["old leave historical before window", empHist.historicalTakenOutsideWindow === 20],
  ["hist start is window not DOJ", histStart.getTime() === empHist.calculationStartDate.getTime()],
  ["taken 32 → available 118", empTaken.totalTaken === 32 && empTaken.leaveDue === 118],
  ["taken equals sum of active year totals", (() => {
    const leaves = [
      { status: "Approved", employeeName: "X", startDate: "2024-04-30", endDate: "2024-04-30" },
      { status: "Approved", employeeName: "X", startDate: "2025-06-01", endDate: "2025-06-28" },
      { status: "Approved", employeeName: "X", startDate: "2026-01-01", endDate: "2026-03-24" },
    ];
    const emp = { employeeName: "X", doj: "2024-05-01" };
    const calc = computeExcelLeaveCalculation(emp, leaves, asOf);
    const activeSum = Object.values(calc.yearTotals).reduce((s, d) => s + d, 0);
    // Joining-year leave before exact DOJ still counts (imported Excel day)
    return calc.totalTaken === activeSum && calc.totalTaken === 1 + 28 + 83;
  })()],
  ["screenshot case 54+28+1 = 83", (() => {
    const leaves = [
      { status: "Approved", employeeName: "Y", startDate: "2026-06-20", endDate: "2026-08-12" },
      { status: "Approved", employeeName: "Y", startDate: "2025-04-08", endDate: "2025-05-05" },
      { status: "Approved", employeeName: "Y", startDate: "2024-03-11", endDate: "2024-03-11" },
    ];
    // ~2y 3m experience as of Aug 2026 → DOJ around May 2024
    const emp = { employeeName: "Y", doj: "2024-05-01" };
    const calc = computeExcelLeaveCalculation(emp, leaves, asOf);
    return (
      calc.yearTotals[2026] === 54 &&
      calc.yearTotals[2025] === 28 &&
      calc.yearTotals[2024] === 1 &&
      calc.totalTaken === 83
    );
  })()],
  ["never double-deduct expired", empA.leaveDue === empA.entitlement - empA.totalTaken],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("FAIL", failed.map(([n]) => n));
  console.log({ empA, empB, empC, empD, empE, empExact5, emp66, empHist, empTaken });
  process.exit(1);
}

console.log("PASS", checks.map(([n]) => n).join("; "));
console.log({
  A: { ent: empA.entitlement, exp: empA.expiredDays, months: empA.totalEligibleMonths },
  B: { ent: empB.entitlement, months: empB.activeEligibleMonths },
  C: { ent: empC.entitlement, months: empC.activeEligibleMonths },
  D: { ent: empD.entitlement, months: empD.activeEligibleMonths },
  E: { ent: empE.entitlement, months: empE.activeEligibleMonths },
  Exact5: { ent: empExact5.entitlement, exp: empExact5.expiredDays },
  M66: { accrued: emp66.totalAccruedDays, ent: emp66.entitlement, exp: emp66.expiredDays },
  Hist: { taken: empHist.totalTaken, histOld: empHist.historicalTakenOutsideWindow },
  Taken: { taken: empTaken.totalTaken, due: empTaken.leaveDue },
});
