/**
 * Detect salary slips that were stored with prorated earnings and rebuild them
 * on the current payroll rule:
 *   Earnings        = exactly the Employee Master values (never prorated)
 *   Leave Deduction = (Gross Salary / 30) x unpaid days
 *   Net Payable     = Gross Salary - (Leave Deduction + other deductions)
 *
 * Payable/present/total days are never recalculated here, and the non-leave
 * part of the deductions is preserved. Only the earnings, the leave deduction
 * and the resulting totals are rebuilt, through the shared payroll helpers, so
 * this stays a single proration implementation.
 *
 * A slip is only rebuilt when its stored earnings are recognisable — either the
 * Employee Master values or a known proration of them. Anything else (edited by
 * hand, or a salary that changed after generation) is reported, not overwritten.
 */

const {
  scaleSalaryAmount,
  unpaidPayrollDays,
  PAYROLL_MONTH_DAYS,
} = require("./payrollPayableDays");
const {
  composeSalarySlipAmounts,
  originalSalaryComponents,
  grossOf,
} = require("./salarySlipAmounts");

/** Tolerance in AED for matching stored amounts against a recomputed basis. */
const MATCH_TOLERANCE = 0.05;

const toAmt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const roundAed = (value) => Math.round(value * 100) / 100;

const close = (a, b) => Math.abs(toAmt(a) - toAmt(b)) <= MATCH_TOLERANCE;

/** Prorate on an explicit divisor; mirrors scaleSalaryAmount for other bases. */
const scaleOnDivisor = (amount, payableDays, divisor) => {
  const base = toAmt(amount);
  const payable = toAmt(payableDays);
  if (base === 0 || payable <= 0 || !divisor) return 0;
  return roundAed((base * payable) / divisor);
};

/** Earnings exactly as held in Employee Master. */
const componentBases = (employee) => originalSalaryComponents(employee?.salaryDetails);

const proratedComponents = (bases, payableDays, divisor) => {
  const scale = (amount) =>
    divisor === PAYROLL_MONTH_DAYS
      ? scaleSalaryAmount(amount, payableDays)
      : scaleOnDivisor(amount, payableDays, divisor);
  return {
    basicPay: scale(bases.basicPay),
    hra: scale(bases.hra),
    conveyanceAllowance: scale(bases.conveyanceAllowance),
    otherAllowance: scale(bases.otherAllowance),
  };
};

const storedEarnings = (slip) => ({
  basicPay: toAmt(slip?.basicPay),
  hra: toAmt(slip?.hra),
  conveyanceAllowance: toAmt(slip?.conveyanceAllowance),
  otherAllowance: toAmt(slip?.otherAllowance),
});

const storedGross = (slip) => {
  const gross = toAmt(slip?.grossSalary);
  return gross > 0 ? gross : grossOf(storedEarnings(slip));
};

/** Total deduction as stored, tolerating legacy rows that only filled one field. */
const storedDeduction = (slip) => {
  const total = toAmt(slip?.totalDeduction);
  if (total > 0) return total;
  const breakdown =
    toAmt(slip?.advance) +
    toAmt(slip?.leave) +
    toAmt(slip?.staffLoan) +
    toAmt(slip?.profTax) +
    toAmt(slip?.incomeTaxTDS);
  if (breakdown > 0) return roundAed(breakdown);
  return toAmt(slip?.deductionsPFTax);
};

const earningsMatch = (stored, expected) =>
  close(stored.basicPay, expected.basicPay) &&
  close(stored.hra, expected.hra) &&
  close(stored.conveyanceAllowance, expected.conveyanceAllowance) &&
  close(stored.otherAllowance, expected.otherAllowance);

/**
 * @returns {{
 *   action: 'ok' | 'reprice' | 'review' | 'unknown-basis',
 *   reason: string,
 *   storedBasic: number,
 *   expectedBasic: number,
 *   storedGross: number,
 *   expectedGross: number,
 *   expectedLeaveDeduction: number,
 *   unpaidDays: number,
 *   amounts: object|null,
 * }}
 */
const inspectSlipProration = (slip, employee) => {
  const payableDays = toAmt(slip?.payableDays);
  const totalWorkingDays = toAmt(slip?.totalWorkingDays);
  const bases = componentBases(employee);
  const masterGross = grossOf(bases);
  const stored = storedEarnings(slip);

  const result = {
    action: "review",
    reason: "",
    storedBasic: stored.basicPay,
    expectedBasic: bases.basicPay,
    storedGross: storedGross(slip),
    expectedGross: masterGross,
    expectedLeaveDeduction: 0,
    unpaidDays: unpaidPayrollDays(payableDays),
    amounts: null,
  };

  if (!employee) {
    result.action = "unknown-basis";
    result.reason = "No matching employee record for this slip";
    return result;
  }
  if (payableDays <= 0) {
    result.action = "unknown-basis";
    result.reason = "Slip has no payable days";
    return result;
  }
  if (masterGross <= 0) {
    result.action = "unknown-basis";
    result.reason = "Employee has no salary components in Employee Master";
    return result;
  }

  // The non-leave part of the stored deductions is preserved as-is.
  const fixedDeduction = Math.max(0, roundAed(storedDeduction(slip) - toAmt(slip?.leave)));
  const expected = composeSalarySlipAmounts({
    salaryDetails: employee.salaryDetails,
    payableDays,
    fixedDeduction,
  });
  const leaveDeduction = expected.leave;
  const totalDeduction = expected.totalDeduction;
  result.expectedLeaveDeduction = leaveDeduction;

  // Which basis explains the stored earnings?
  let basis = null;
  if (earningsMatch(stored, bases)) {
    basis = "Employee Master";
  } else if (earningsMatch(stored, proratedComponents(bases, payableDays, PAYROLL_MONTH_DAYS))) {
    basis = "prorated on 30 days";
  } else if (
    totalWorkingDays &&
    totalWorkingDays !== PAYROLL_MONTH_DAYS &&
    earningsMatch(stored, proratedComponents(bases, payableDays, totalWorkingDays))
  ) {
    basis = `prorated on ${totalWorkingDays} calendar days`;
  }

  if (!basis) {
    result.reason =
      "Stored earnings match neither Employee Master nor a known proration (edited manually or salary changed)";
    return result;
  }

  const alreadyCorrect =
    basis === "Employee Master" &&
    close(slip?.leave, leaveDeduction) &&
    close(storedDeduction(slip), totalDeduction) &&
    close(slip?.netSalary, expected.netSalary);
  if (alreadyCorrect) {
    result.action = "ok";
    result.reason = "Earnings match Employee Master and the leave deduction is correct";
    return result;
  }

  result.action = "reprice";
  result.reason =
    basis === "Employee Master"
      ? "Earnings are correct but the unpaid days are not charged as a leave deduction"
      : `Earnings were stored ${basis}`;
  result.amounts = expected;
  return result;
};

module.exports = {
  MATCH_TOLERANCE,
  inspectSlipProration,
  componentBases,
  proratedComponents,
  grossOf,
  storedGross,
  storedDeduction,
};
