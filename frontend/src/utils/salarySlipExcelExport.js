/**
 * Excel export for filtered salary slips — stored slip fields only.
 */
import { saveAs } from "file-saver";
import { isPlaceholderEmployeeEmail } from "./employeeEmailDisplay";

const loadXlsx = async () => {
  const XLSX = await import("xlsx");
  return XLSX;
};

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Map a stored salary slip to an Excel row (same source of truth as the table). */
export const salarySlipToExcelRow = (slip) => {
  const basicPay = num(slip.basicPay);
  const hra = num(slip.hra);
  const conveyance = num(slip.conveyanceAllowance);
  const other = num(slip.otherAllowance);
  let advance = num(slip.advance);
  const leave = num(slip.leave);
  const staffLoan = num(slip.staffLoan);
  const profTax = num(slip.profTax);
  const incomeTaxTDS = num(slip.incomeTaxTDS);
  const hasBreakdown = advance + leave + staffLoan + profTax + incomeTaxTDS > 0;
  const legacyDeduction = num(slip.deductionsPFTax || slip.totalDeduction);
  if (!hasBreakdown && legacyDeduction > 0) advance = legacyDeduction;

  const grossSalary = num(slip.grossSalary) || basicPay + hra + conveyance + other;
  const totalDeduction =
    num(slip.totalDeduction) ||
    advance + leave + staffLoan + profTax + incomeTaxTDS ||
    num(slip.deductionsPFTax);
  const netSalary = num(slip.netSalary) || grossSalary - totalDeduction;

  return {
    "Employee Name": slip.employeeName || "",
    "Email ID": isPlaceholderEmployeeEmail(slip.emailId)
      ? ""
      : String(slip.emailId || "").trim(),
    Department: slip.department || "",
    Designation: slip.designation || "",
    Month: slip.month || "",
    Year: String(slip.year || ""),
    "Payable Days": slip.payableDays ?? "",
    "Present Days": slip.presentDays ?? "",
    "Basic Pay (AED)": basicPay,
    "HRA (AED)": hra,
    "Travel / Conveyance (AED)": conveyance,
    "Other Allowance (AED)": other,
    "Gross Salary (AED)": grossSalary,
    "Advance (AED)": advance,
    "Leave Deduction (AED)": leave,
    "Staff Loan (AED)": staffLoan,
    "Prof. Tax (AED)": profTax,
    "Income Tax / TDS (AED)": incomeTaxTDS,
    "Total Deduction (AED)": totalDeduction,
    "Net Salary (AED)": netSalary,
  };
};

export async function exportSalarySlipsToExcel(slips, fileNameBase = "Salary_Slips") {
  const list = Array.isArray(slips) ? slips : [];
  if (list.length === 0) {
    throw new Error("No salary slips found for the selected period.");
  }
  const XLSX = await loadXlsx();
  const rows = list.map(salarySlipToExcelRow);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Salary Slips");
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const safeName = String(fileNameBase || "Salary_Slips").replace(/[^a-zA-Z0-9_-]/g, "_");
  saveAs(
    new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${safeName}.xlsx`
  );
}
