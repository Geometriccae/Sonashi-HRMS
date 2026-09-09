/**
 * Rebuild historical salary slips on the current payroll rule:
 *   Earnings        = exactly the Employee Master values (never prorated)
 *   Leave Deduction = (Gross Salary / 30) x unpaid days
 *   Net Payable     = Gross Salary - (Leave Deduction + other deductions)
 *
 * Older slips stored a prorated Basic Pay (e.g. 2500/31x17 or 2500/30x17)
 * instead of the employee's real Basic Pay. This restores the full earnings and
 * moves the unpaid days into the Leave deduction, which leaves net pay on the
 * same 30-day basis while showing the correct Basic Pay.
 *
 * Payable Days, Present Days, Total Working Days and the non-leave deductions
 * are left exactly as stored.
 *
 *   node scripts/repriceSalarySlipsTo30DayBasis.js            # report only
 *   node scripts/repriceSalarySlipsTo30DayBasis.js --apply    # write changes
 */

require("dotenv").config();
const mongoose = require("mongoose");
const SalarySlip = require("../models/SalarySlip");
const Employee = require("../models/Employee");
const { PAYROLL_MONTH_DAYS } = require("../utils/payrollPayableDays");
const { inspectSlipProration } = require("../utils/salarySlipReprice");
const { payrollEmailForEmployee } = require("../utils/generateSalarySlips");

const PLACEHOLDER_EMAIL_HOST = "import.hrms.placeholder";

const employeeKey = (value) => String(value || "").trim().toLowerCase();

/** Employee ID normalised the way the generated payroll address encodes it. */
const employeeCode = (value) =>
  employeeKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Employee ID carried inside a generated "no email" address, e.g.
 * noemail+idml-129+r72-d81fd248d0ba@import.hrms.placeholder -> idml-129.
 * Slips written before an employee's email changed still hold the old address,
 * so this recovers the identifier rather than falling back to name matching.
 */
const placeholderEmployeeCode = (email) => {
  const value = employeeKey(email);
  if (!value.endsWith(`@${PLACEHOLDER_EMAIL_HOST}`)) return "";
  const [prefix, code] = value.slice(0, value.indexOf("@")).split("+");
  return prefix === "noemail" ? employeeCode(code) : "";
};

/** Runs against an already-open mongoose connection. */
async function repriceSalarySlips({ apply = false } = {}) {
  const [slips, employees] = await Promise.all([
    SalarySlip.find({}).lean(),
    Employee.find({}).lean(),
  ]);

  // Same payroll identity the generator uses, so a slip can never be matched
  // to a different employee than the one it was generated for.
  const byPayrollEmail = new Map();
  employees.forEach((emp) => {
    const key = employeeKey(payrollEmailForEmployee(emp));
    if (key) byPayrollEmail.set(key, emp);
    const stored = placeholderEmployeeCode(emp.emailId);
    if (stored) byPayrollEmail.set(`${stored}@${PLACEHOLDER_EMAIL_HOST}`, emp);
  });

  // Fallback index on the employee ID alone, used only when it identifies
  // exactly one employee.
  const byEmployeeCode = new Map();
  employees.forEach((emp) => {
    const code = employeeCode(emp.employeeId);
    if (!code) return;
    byEmployeeCode.set(code, byEmployeeCode.has(code) ? null : emp);
  });

  const employeeForSlip = (slip) =>
    byPayrollEmail.get(employeeKey(slip.emailId)) ||
    byEmployeeCode.get(placeholderEmployeeCode(slip.emailId)) ||
    null;

  console.log(
    `Payroll basis: ${PAYROLL_MONTH_DAYS}-day month | slips: ${slips.length} | employees: ${employees.length}`
  );
  console.log(apply ? "MODE: apply (writing changes)" : "MODE: dry run (no writes)");
  console.log("");

  const buckets = { ok: [], reprice: [], review: [], "unknown-basis": [] };

  for (const slip of slips) {
    const employee = employeeForSlip(slip);
    const verdict = inspectSlipProration(slip, employee);
    buckets[verdict.action].push({ slip, verdict });
  }

  const label = (slip) => `${slip.employeeName} | ${slip.month} ${slip.year}`;

  console.log(`\nAlready correct: ${buckets.ok.length}`);
  console.log(`To rebuild:      ${buckets.reprice.length}`);
  console.log(`Needs review:    ${buckets.review.length}`);
  console.log(`No basis:        ${buckets["unknown-basis"].length}`);

  if (buckets.reprice.length) {
    console.log("\n--- Slips to rebuild (Basic Pay restored, leave charged separately) ---");
    buckets.reprice.forEach(({ slip, verdict }) => {
      console.log(
        `  ${label(slip)} | payable ${slip.payableDays}/${slip.totalWorkingDays} | ` +
          `basic ${verdict.storedBasic} -> ${verdict.expectedBasic} | ` +
          `leave deduction ${verdict.expectedLeaveDeduction} for ${verdict.unpaidDays} unpaid days | ` +
          `net -> ${verdict.amounts.netSalary} (${verdict.reason})`
      );
    });
  }

  if (buckets.review.length) {
    console.log("\n--- Left untouched, please review manually ---");
    buckets.review.forEach(({ slip, verdict }) => {
      console.log(
        `  ${label(slip)} | stored basic ${verdict.storedBasic} | Employee Master basic ${verdict.expectedBasic} | ${verdict.reason}`
      );
    });
  }

  if (buckets["unknown-basis"].length) {
    console.log("\n--- Cannot be checked ---");
    buckets["unknown-basis"].forEach(({ slip, verdict }) => {
      console.log(`  ${label(slip)} | ${verdict.reason}`);
    });
  }

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to write these changes.");
  } else if (buckets.reprice.length === 0) {
    console.log("\nNothing to write; every slip already follows the payroll rule.");
  } else {
    let updated = 0;
    for (const { slip, verdict } of buckets.reprice) {
      await SalarySlip.updateOne({ _id: slip._id }, { $set: { ...verdict.amounts } });
      updated += 1;
    }
    console.log(`\nRebuilt ${updated} salary slips on the current payroll rule.`);
  }

  return buckets;
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
  await mongoose.connect(process.env.MONGO_URI);
  await repriceSalarySlips({ apply: process.argv.includes("--apply") });
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error("ERROR:", err.message);
    try {
      await mongoose.disconnect();
    } catch (_) {
      /* already closed */
    }
    process.exitCode = 1;
  });
}

module.exports = { repriceSalarySlips };
