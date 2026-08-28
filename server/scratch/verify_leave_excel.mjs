import {
  accrueLeaveDays,
  computeExcelLeaveCalculation,
  countCompletedMonths,
  getActiveLeaveWindow,
  leaveRequestDays,
  matchesLeaveEmployee,
} from "../../frontend/src/utils/leaveCalculator.js";

const asOf = new Date(2026, 7, 24); // 24/08/2026
const asOf2027 = new Date(2027, 7, 24);
const asOf2028 = new Date(2028, 7, 24);

const empA = computeExcelLeaveCalculation({ employeeName: "A", doj: "2017-01-01" }, [], asOf);
const empB = computeExcelLeaveCalculation({ employeeName: "B", doj: "2021-01-01" }, [], asOf);
const empC = computeExcelLeaveCalculation({ employeeName: "C", doj: "2024-01-01" }, [], asOf);
const empD = computeExcelLeaveCalculation({ employeeName: "D", doj: "2025-01-01" }, [], asOf);
const empE = computeExcelLeaveCalculation({ employeeName: "E", doj: "2026-03-01" }, [], asOf);
const empExact5 = computeExcelLeaveCalculation({ employeeName: "Exact5", doj: "2021-08-24" }, [], asOf);
const emp2y = computeExcelLeaveCalculation({ employeeName: "2y", doj: "2024-08-24" }, [], asOf);
const emp3y = computeExcelLeaveCalculation({ employeeName: "3y", doj: "2023-08-24" }, [], asOf);

const win2026 = getActiveLeaveWindow(asOf, "2007-08-01");
const win2027 = getActiveLeaveWindow(asOf2027, "2007-08-01");
const win2028 = getActiveLeaveWindow(asOf2028, "2007-08-01");

const oldWindowLeave = [
  { status: "Approved", employeeName: "Hist", startDate: "2018-01-01", endDate: "2018-01-21" },
  { status: "Approved", employeeName: "Hist", startDate: "2023-06-01", endDate: "2023-07-03" },
];
const empHist = computeExcelLeaveCalculation(
  { employeeName: "Hist", doj: "2014-01-01" },
  oldWindowLeave,
  asOf
);

const empTaken = computeExcelLeaveCalculation(
  { employeeName: "Taken", doj: "2017-01-01" },
  [{ status: "Approved", employeeName: "Taken", startDate: "2024-01-01", endDate: "2024-02-02" }],
  asOf
);

const near = (a, b, tol = 0.15) => Math.abs(Number(a) - Number(b)) <= tol;

const checks = [
  ["2.5 accrual helper", accrueLeaveDays(6) === 15 && accrueLeaveDays(60) === 150],
  ["completed months 24/02→24/08 = 6", countCompletedMonths("2026-02-24", asOf) === 6],
  ["2026 window starts 2021-01-01", win2026.windowStart.getFullYear() === 2021 && win2026.windowStart.getMonth() === 0 && win2026.windowStart.getDate() === 1],
  ["2027 window starts 2022-01-01", win2027.windowStart.getFullYear() === 2022],
  ["2028 window starts 2023-01-01", win2028.windowStart.getFullYear() === 2023],
  ["A >5y entitlement capped 150", empA.entitlement === 150],
  ["A expired > 0", empA.expiredDays > 0],
  ["A leave due = 30×yrs when taken is 0", near(empA.leaveDue, empA.workingYearsExact * 30)],
  ["B from window start entitlement 150, expired 0", empB.entitlement === 150 && empB.expiredDays === 0],
  ["C less than 5y not 150", empC.entitlement < 150 && empC.expiredDays === 0],
  ["C entitlement = windowYears × 30", near(empC.entitlement, empC.workingYearsExact * 30)],
  ["DOJ after window start uses DOJ", empC.calculateLeaveDate.getTime() === new Date(2024, 0, 1).getTime()],
  ["2 years ≈ 60", near(emp2y.entitlement, 60)],
  ["3 years ≈ 90", near(emp3y.entitlement, 90)],
  ["new joiner not 150", empE.entitlement > 0 && empE.entitlement < 30],
  ["D not 150", empD.entitlement < 150],
  ["old leave not in active taken", empHist.totalTaken === 32],
  ["old leave historical before window", empHist.historicalTakenOutsideWindow === 20],
  ["taken 32 uses Excel LEAVE DUE formula", (() => {
    const avrg = empTaken.totalTaken / Math.min(5, empTaken.workingYearsExact);
    return empTaken.totalTaken === 32 && near(empTaken.leaveDue, (30 - avrg) * empTaken.workingYearsExact);
  })()],
  ["entitlement stays capped when leave due is not", empA.entitlement === 150 && empA.leaveDue > 150],
  ["pre-DOJ years excluded", empC.historicalYearTotals[2021] == null || empC.historicalYearTotals[2021] === 0],
  ["staff code mismatch never matches", matchesLeaveEmployee(
    { employeeId: "IDMM-999", employeeName: "OTHER", status: "Approved", startDate: "2023-01-01", endDate: "2023-01-10" },
    { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", employeeId: "IDMM-151", employeeName: "PRINCE" }
  ) === false],
  ["staff code match is employee-specific", matchesLeaveEmployee(
    { employeeId: "IDMM-151", employeeRecordId: "bbbbbbbbbbbbbbbbbbbbbbbb", status: "Approved" },
    { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", employeeId: "IDMM-151" }
  ) === true],
  ["implausible multi-year span is 0 Taken days", leaveRequestDays({
    status: "Approved",
    employeeId: "IDMM-151",
    startDate: "2023-06-17",
    endDate: "2026-07-20",
    leaveDays: 1129,
  }) === 0],
  ["plausible stored leave days still count", leaveRequestDays({
    status: "Approved",
    employeeId: "IDMM-151",
    startDate: "2026-01-01",
    endDate: "2026-03-12",
    leaveDays: 70,
  }) === 70],
  ["other employee's leave does not inflate Taken", (() => {
    const emp = {
      _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      employeeId: "IDMM-151",
      employeeName: "PRINCE",
      doj: "2023-06-17",
    };
    const leaves = [
      {
        _id: "1",
        status: "Approved",
        employeeId: "IDMM-999",
        employeeName: "OTHER PERSON",
        startDate: "2023-01-01",
        endDate: "2026-02-04",
        leaveDays: 1129,
      },
      {
        _id: "2",
        status: "Approved",
        employeeId: "IDMM-151",
        employeeRecordId: emp._id,
        startDate: "2026-01-01",
        endDate: "2026-03-12",
        leaveDays: 70,
      },
      {
        _id: "2",
        status: "Approved",
        employeeId: "IDMM-151",
        employeeRecordId: emp._id,
        startDate: "2026-01-01",
        endDate: "2026-03-12",
        leaveDays: 70,
      },
    ];
    const calc = computeExcelLeaveCalculation(emp, leaves, asOf);
    return calc.totalTaken === 70 && (calc.yearTotals[2023] || 0) === 0 && calc.yearTotals[2026] === 70;
  })()],
  ["own implausible 2023 span does not invent Taken", (() => {
    const emp = {
      _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
      employeeId: "IDMM-151",
      doj: "2023-06-17",
      excelLeaveYearTaken: { 2023: 0, 2026: 70 },
    };
    const calc = computeExcelLeaveCalculation(emp, [{
      _id: "3",
      status: "Approved",
      employeeId: "IDMM-151",
      employeeRecordId: emp._id,
      startDate: "2023-06-17",
      endDate: "2026-07-20",
      leaveDays: 1129,
    }], asOf);
    return (calc.yearTotals[2023] || 0) === 0 && calc.yearTotals[2026] === 70 && calc.totalTaken === 70;
  })()],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("FAIL", failed.map(([n]) => n));
  console.log({ empA, empB, empC, empD, empE, empExact5, emp2y, emp3y, empHist, empTaken });
  process.exit(1);
}

console.log("PASS", checks.map(([n]) => n).join("; "));
console.log({
  A: { ent: empA.entitlement, exp: empA.expiredDays, due: empA.leaveDue, yrs: empA.workingYears },
  C: { ent: empC.entitlement, yrs: empC.workingYears, start: empC.calculateLeaveDate },
  "2y": emp2y.entitlement,
  "3y": emp3y.entitlement,
  E: empE.entitlement,
  Taken: { taken: empTaken.totalTaken, due: empTaken.leaveDue },
  windows: { 2026: win2026.windowStart.toISOString().slice(0, 10), 2027: win2027.windowStart.toISOString().slice(0, 10), 2028: win2028.windowStart.toISOString().slice(0, 10) },
});
