/**
 * Employee information block for a generated payslip.
 *
 * Values come from the employee record the slip was generated for, plus the
 * day counts already stored on the slip. Nothing is derived or defaulted to
 * another employee: a missing value is returned as an empty string so the
 * payslip renders the application's "not provided" text.
 */

const PLACEHOLDER_EMAIL_HOST = "import.hrms.placeholder";

/** Fields required to build the payslip employee block (no profile photo). */
const PAYSLIP_EMPLOYEE_FIELDS = [
  "employeeId",
  "employeeName",
  "emailId",
  "department",
  "designation",
  "role",
  "workPermitNo",
  "emiratesId",
  "doj",
  "salaryDetails",
].join(" ");

const text = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

const isPlaceholderEmail = (emailId) => {
  const value = text(emailId);
  if (!value) return true;
  return value.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_HOST}`);
};

const emailForPayslip = (...candidates) => {
  for (const candidate of candidates) {
    if (!isPlaceholderEmail(candidate)) return text(candidate);
  }
  return "";
};

const dateForPayslip = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return match[0];
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${month}-${day}`;
};

const dayCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.round(n * 100) / 100);
};

/**
 * @param {object|null} employee Employee record matched to the slip, if found.
 * @param {object|null} slip Stored salary slip.
 * @returns {object} Payslip employee block; every value is a string.
 */
const buildPayslipEmployeeDetails = (employee, slip) => {
  const emp = employee || {};
  const row = slip || {};
  const salary = emp.salaryDetails || {};

  return {
    empId: text(emp.employeeId),
    employeeName: text(emp.employeeName) || text(row.employeeName),
    payableDays: dayCount(row.payableDays),
    presentDays: dayCount(row.presentDays),
    department: text(emp.department) || text(row.department),
    // Same designation fallback the salary-slip generator uses.
    designation: text(emp.designation) || text(emp.role) || text(row.designation),
    bankAccNo: text(salary.accountNumber),
    ibanNumber: text(salary.ibanNumber),
    // "Person Code" is the work permit number across exports and the profile view.
    personCode: text(emp.workPermitNo),
    modeOfPay: text(emp.modeOfPay),
    doj: dateForPayslip(emp.doj) || dateForPayslip(row.dateOfJoining),
    emailId: emailForPayslip(emp.emailId, row.emailId),
    emiratesId: text(emp.emiratesId),
    unifiedId: text(emp.unifiedId),
  };
};

module.exports = {
  PAYSLIP_EMPLOYEE_FIELDS,
  PLACEHOLDER_EMAIL_HOST,
  buildPayslipEmployeeDetails,
  isPlaceholderEmail,
  dateForPayslip,
};
