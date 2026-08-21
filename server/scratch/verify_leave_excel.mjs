import {
  computeExcelLeaveCalculation,
  excelDateDiffDays,
  getLeaveTillDate,
} from "../../frontend/src/utils/leaveCalculator.js";

const till = getLeaveTillDate(new Date("2026-08-19"));
const tillExpected = new Date(2026, 11, 31);

const emp1 = computeExcelLeaveCalculation(
  { employeeName: "Emp 1", doj: "2024-01-01" },
  [],
  tillExpected
);

const emp2Leaves = [
  {
    status: "Approved",
    employeeName: "Emp 2",
    startDate: "2024-06-01",
    endDate: "2024-06-25",
  },
];
const emp2 = computeExcelLeaveCalculation(
  { employeeName: "Emp 2", doj: "2024-03-01" },
  emp2Leaves,
  tillExpected
);

const emp3 = computeExcelLeaveCalculation(
  { employeeName: "Emp 3", doj: "2019-12-01" },
  [],
  tillExpected
);

const checks = [
  ["till is 31 Dec 2026", till.getTime() === tillExpected.getTime()],
  ["emp1 working days 1095", emp1.workingDays === 1095],
  ["emp1 working years 3", emp1.workingYears === 3],
  ["emp1 taken 0", emp1.totalTaken === 0],
  ["emp1 average 3", emp1.averageLeave === 3],
  ["emp1 due 90", emp1.leaveDue === 90],
  ["emp2 working days 1035", emp2.workingDays === 1035],
  ["emp2 taken 25", emp2.totalTaken === 25],
  ["emp2 average = years capped 5", emp2.averageLeave === emp2.workingYears && emp2.workingYears < 5],
  [
    "emp2 due (avg*30)-25",
    emp2.leaveDue === Number((emp2.averageLeave * 30 - 25).toFixed(2)),
  ],
  ["emp3 calc date is joining", emp3.calculateLeaveDate.getTime() === new Date(2019, 11, 1).getTime()],
  [
    "emp3 working days till-join",
    emp3.workingDays === excelDateDiffDays(tillExpected, new Date(2019, 11, 1)),
  ],
  ["emp3 average capped at 5", emp3.averageLeave === 5],
  ["emp3 due 150 when no leave", emp3.leaveDue === 150],
  ["do not use Jan 1 for Mar joiner", emp2.workingDays !== emp1.workingDays],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("FAIL", failed.map(([n]) => n));
  console.log({ emp1, emp2, emp3 });
  process.exit(1);
}
console.log("PASS", checks.map(([n]) => n).join("; "));
console.log({
  emp1: { days: emp1.workingDays, years: emp1.workingYears, due: emp1.leaveDue },
  emp2: { days: emp2.workingDays, years: emp2.workingYears, avg: emp2.averageLeave, taken: emp2.totalTaken, due: emp2.leaveDue },
  emp3: { days: emp3.workingDays, years: emp3.workingYears, avg: emp3.averageLeave, due: emp3.leaveDue },
});
