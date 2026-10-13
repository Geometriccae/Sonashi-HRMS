/**
 * Salary Report rows for a pay month: each employee joined with the salary slip
 * the existing payroll generator stored for that month. The Salary Report and
 * the SIF export are both built from exactly these rows.
 */

const Employee = require("../models/Employee");
const SalarySlip = require("../models/SalarySlip");
const { getPayrollPeriod } = require("./payrollPayableDays");
const { PLACEHOLDER_EMAIL_HOST } = require("./payslipEmployeeDetails");
const {
  isPayrollCandidateForPeriod,
  payrollEmailForEmployee,
  yearQueryValue,
} = require("./generateSalarySlips");
const { MONTH_NAMES, buildSalaryReportPayrollRow } = require("./sifUtils");

const employeeCodeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** noemail+idml-129+r72-d81fd248d0ba@import.hrms.placeholder -> idml-129 */
const placeholderEmployeeCode = (email) => {
  const value = String(email || "").trim().toLowerCase();
  if (!value.endsWith(`@${PLACEHOLDER_EMAIL_HOST}`)) return "";
  const [prefix, code] = value.slice(0, value.indexOf("@")).split("+");
  return prefix === "noemail" ? employeeCodeKey(code) : "";
};

const nameKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

/** Unique-only index: a key shared by several items maps to null. */
const uniqueIndex = (items, keyOf) => {
  const index = new Map();
  items.forEach((item) => {
    const key = keyOf(item);
    if (key) index.set(key, index.has(key) ? null : item);
  });
  return index;
};

/**
 * Month's slips keyed by employee _id. A slip belongs to, in order of preference:
 *   1. the employee whose current payroll address it carries;
 *   2. the single employee whose code is inside an older placeholder address;
 *   3. the single employee with exactly the slip's name, when no other slip of
 *      the month carries that name (slips written under a since-replaced address).
 * When an employee still has several slips for the month, the better match wins,
 * then the most recently generated slip.
 *
 * @param {object[]} employees Every employee (uniqueness is checked across all).
 */
function matchSlipsToEmployees(slips, employees) {
  const byPayrollEmail = new Map(employees.map((emp) => [payrollEmailForEmployee(emp), emp]));
  const byCode = uniqueIndex(employees, (emp) => employeeCodeKey(emp.employeeId));
  const byName = uniqueIndex(employees, (emp) => nameKey(emp.employeeName));
  const slipNameCount = new Map();
  slips.forEach((slip) => {
    const key = nameKey(slip.employeeName);
    slipNameCount.set(key, (slipNameCount.get(key) || 0) + 1);
  });

  const chosen = new Map();
  slips.forEach((slip) => {
    const email = String(slip.emailId || "").trim().toLowerCase();
    let emp = byPayrollEmail.get(email);
    let rank = 3;
    if (!emp) {
      emp = byCode.get(placeholderEmployeeCode(email));
      rank = 2;
    }
    if (!emp && slipNameCount.get(nameKey(slip.employeeName)) === 1) {
      emp = byName.get(nameKey(slip.employeeName));
      rank = 1;
    }
    if (!emp) return;
    const key = String(emp._id);
    const candidate = { slip, rank, at: new Date(slip.updatedAt || 0).getTime() };
    const current = chosen.get(key);
    if (
      !current ||
      candidate.rank > current.rank ||
      (candidate.rank === current.rank && candidate.at > current.at)
    ) {
      chosen.set(key, candidate);
    }
  });

  return new Map(Array.from(chosen.entries()).map(([key, c]) => [key, c.slip]));
}

/**
 * @param {boolean} [params.payrollEligibleOnly] Only employees the payroll
 *   generator pays for this month (working, or leaving during the month).
 */
async function loadSalaryReportRows({ month, year, payrollEligibleOnly = true }) {
  const period = getPayrollPeriod(month, year);
  const allEmployees = await Employee.find({}).lean();
  const employees = payrollEligibleOnly
    ? allEmployees.filter((emp) => isPayrollCandidateForPeriod(emp, period))
    : allEmployees;

  const slips = await SalarySlip.find({
    month: { $regex: new RegExp(`^${MONTH_NAMES[month - 1]}$`, "i") },
    year: yearQueryValue(String(year)),
  })
    .select("emailId employeeName month year payableDays totalWorkingDays grossSalary advance staffLoan profTax incomeTaxTDS netSalary processedLeaveDays updatedAt")
    .lean();
  const slipByEmployee = matchSlipsToEmployees(slips, allEmployees);

  return employees.map((employee) =>
    buildSalaryReportPayrollRow({
      employee,
      slip: slipByEmployee.get(String(employee._id)) || null,
      year,
      month,
    })
  );
}

module.exports = {
  loadSalaryReportRows,
  matchSlipsToEmployees,
  placeholderEmployeeCode,
};
