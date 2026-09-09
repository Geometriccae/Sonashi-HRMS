/**
 * The one place that turns an employee's salary structure into salary-slip
 * amounts. Every generator, repair and check path uses this, so a payslip can
 * never disagree with Employee Master.
 *
 * Original salary components (never touched by leave or attendance):
 *   Basic Pay / House Rent / Travel Exp / Other = exactly Employee Master
 *   Gross Salary = their sum
 *
 * Payroll adjustments (the only thing leave affects):
 *   Leave Deduction = (Gross Salary / 30) x unpaid days
 *   Net Payable     = Gross Salary - (Leave Deduction + other deductions)
 */

const { leaveDeductionAmount } = require("./payrollPayableDays");

const toAmt = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const roundAed = (value) => Math.round(toAmt(value) * 100) / 100;

/** Original salary components, exactly as stored in Employee Master. */
const originalSalaryComponents = (salaryDetails) => {
  const salary = salaryDetails || {};
  return {
    basicPay: toAmt(salary.basicSalary),
    hra: toAmt(salary.houseRent),
    conveyanceAllowance: toAmt(salary.travelExp),
    otherAllowance: toAmt(salary.other),
  };
};

const grossOf = (components) =>
  roundAed(
    components.basicPay +
      components.hra +
      components.conveyanceAllowance +
      components.otherAllowance
  );

/**
 * @param {object} params
 * @param {object} params.salaryDetails Employee Master salaryDetails.
 * @param {number} params.payableDays Payable days as already calculated.
 * @param {number} [params.fixedDeduction] Non-leave deduction to keep; defaults
 *   to the standing deduction held in Employee Master.
 * @returns {object} Salary-slip amount fields, ready to store.
 */
const composeSalarySlipAmounts = ({ salaryDetails, payableDays, fixedDeduction } = {}) => {
  const components = originalSalaryComponents(salaryDetails);
  const grossSalary = grossOf(components);

  const fixed = roundAed(
    fixedDeduction == null ? toAmt(salaryDetails?.deduction) : fixedDeduction
  );
  const leave = leaveDeductionAmount(grossSalary, payableDays);
  const totalDeduction = roundAed(fixed + leave);

  return {
    ...components,
    grossSalary,
    advance: fixed,
    leave,
    totalDeduction,
    // Legacy mirror still read by the salary-slip list column.
    deductionsPFTax: totalDeduction,
    netSalary: roundAed(grossSalary - totalDeduction),
  };
};

module.exports = {
  composeSalarySlipAmounts,
  originalSalaryComponents,
  grossOf,
};
