/**
 * UAE WPS SIF helpers (client Matrix / bank reference format).
 * Export (Emirates ID is not exported):
 * EDR,<LABOURCARD>,<AGENTCODE>,<IBAN>,<start>,<end>,<days>,<fixed>,<variable>,<leaveDays>
 * SCR,<EMPLOYERID>,<agent>,<fileDate>,<fileTime>,<MMYYYY>,<count>,<total>,AED,<fileName without .SIF>
 * Lines are CRLF-terminated.
 *
 * Source fields:
 *   LABOURCARD = Employee.workPermitNo (14-digit MOHRE person code, "Person Code" in the UI)
 *   EMPLOYERID = Employee.companyCode (one SIF per employer)
 *   AGENTCODE  = salaryDetails.bankSortCode, IBAN = salaryDetails.ibanNumber || accountNumber
 *   salary = net salary of the stored SalarySlip for the pay month (existing payroll result)
 *   days = days in the salary period, leave = 0000 (as in the client's reference files)
 * Import reads EDR lines whose second field is the labour card number or a legacy Emirates ID.
 */

const { getEmploymentWindow, inclusiveDays } = require("./payrollPayableDays");

const pad = (value, len) => String(value ?? "").padStart(len, "0");

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const normalizeEmiratesId = (value) => digitsOnly(value);

const SIF_ACCOUNT_LENGTH = 23;
const LABOUR_CARD_LENGTH = 14;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getBankAccount = (emp) => {
  const sal = emp.salaryDetails || {};
  const iban = String(sal.ibanNumber || "").trim();
  const account = String(sal.accountNumber || "").trim();
  if (iban) return iban.replace(/\s+/g, "");
  return account.replace(/\s+/g, "");
};

/** Labour card / MOHRE person code written as the EDR employee ID. */
const getLabourCardNumber = (emp) =>
  String(emp?.workPermitNo || "").replace(/[\s-]+/g, "").toUpperCase();

const validateLabourCardNumber = (value) => {
  if (!value) return "Missing Staff ID / Labour Card Number";
  if (!new RegExp(`^\\d{${LABOUR_CARD_LENGTH}}$`).test(value)) {
    return `Invalid Staff ID / Labour Card Number (must be ${LABOUR_CARD_LENGTH} digits)`;
  }
  return null;
};

/** Employer (MOHRE establishment) ID the employee is paid under. */
const getEmployeeEmployerId = (emp) =>
  String(emp?.companyCode || "").replace(/[\s-]+/g, "").toUpperCase();

/** IBAN as stored, or a numeric account / card number zero-padded to 23 characters. */
const formatSifAccount = (emp) => {
  const raw = getBankAccount(emp).toUpperCase();
  if (/^\d+$/.test(raw) && raw.length < SIF_ACCOUNT_LENGTH) {
    return pad(raw, SIF_ACCOUNT_LENGTH);
  }
  return raw;
};

const validateSifAccount = (account) => {
  if (!account) return "Missing IBAN / Bank Account";
  if (/^[A-Z]{2}/.test(account)) {
    return /^AE\d{21}$/.test(account) ? null : "Invalid IBAN (must be AE followed by 21 digits)";
  }
  return /^\d{23}$/.test(account) ? null : "Invalid IBAN / account number (max 23 digits)";
};

const getFixedIncome = (emp) => {
  const sal = emp.salaryDetails || {};
  if (sal.totalSalary != null && Number(sal.totalSalary) > 0) {
    return Number(sal.totalSalary);
  }
  const basic = Number(sal.basicSalary) || 0;
  const house = Number(sal.houseRent) || 0;
  const travel = Number(sal.travelExp) || 0;
  const other = Number(sal.other) || 0;
  const allowance = Number(sal.totalAllowance) || house + travel + other;
  const deduction = Number(sal.deduction) || 0;
  return Math.max(0, basic + allowance - deduction);
};

const formatMoney = (n) => Number(n || 0).toFixed(2);

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const periodDates = (year, month) => {
  const days = daysInMonth(year, month);
  const mm = pad(month, 2);
  const start = `${year}-${mm}-01`;
  const end = `${year}-${mm}-${pad(days, 2)}`;
  return { start, end, days };
};

const validateEmployerId = (employerId) => {
  const d = digitsOnly(employerId);
  if (d.length !== 13) {
    return "Employer ID must be exactly 13 digits";
  }
  return null;
};

const validateEmpId = (empid) => {
  const d = digitsOnly(empid);
  if (d.length < 14 || d.length > 15) {
    return "EMPID (Emirates ID) must be 14–15 digits";
  }
  return null;
};

const validateAgentCode = (code) => {
  const d = digitsOnly(code);
  if (d.length !== 9) {
    return "AGENTCODE must be exactly 9 digits";
  }
  return null;
};

const validateBankAccount = (account) => {
  const a = String(account || "").trim();
  if (!a) return "BANKACCOUNT is required";
  return null;
};

const roundAed = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * One Salary Report / SIF row: Employee Master WPS fields + the stored salary
 * slip of the pay month. The Salary Report and the SIF are both built from this.
 *
 * @param {object} params.employee Employee Master record.
 * @param {object|null} params.slip Stored SalarySlip of this employee for the month.
 */
const buildSalaryReportPayrollRow = ({ employee, slip, year, month }) => {
  const { start, end, days } = periodDates(year, month);
  const payrollMonth = `${MONTH_NAMES[month - 1]} ${year}`;
  const staffId = getLabourCardNumber(employee);
  const employerId = getEmployeeEmployerId(employee);
  const agentCode = digitsOnly(employee?.salaryDetails?.bankSortCode);
  const iban = formatSifAccount(employee);

  let daysWorked = null;
  let leaveDays = null;
  let fixedIncome = null;
  if (slip) {
    // Unpaid days inside the employee's employment window are leave; days
    // before joining / after exiting are neither worked nor leave.
    const window = getEmploymentWindow(employee, new Date(year, month - 1, 1), new Date(year, month, 0));
    const employedDays = window ? inclusiveDays(window.start, window.end) : days;
    const payable = Number(slip.payableDays);
    daysWorked = Number.isFinite(payable) && payable > 0
      ? Math.min(Math.floor(payable), employedDays)
      : employedDays;
    leaveDays = Math.max(0, employedDays - daysWorked);
    fixedIncome = roundAed(slip.netSalary);
  }

  const missing = [];
  const labourErr = validateLabourCardNumber(staffId);
  if (labourErr) missing.push(labourErr);
  if (!agentCode) missing.push("Missing Bank Agent Code");
  else if (validateAgentCode(agentCode)) missing.push("Invalid Bank Agent Code (must be 9 digits)");
  const accountErr = validateSifAccount(iban);
  if (accountErr) missing.push(accountErr);
  if (!employerId) missing.push("Missing Company Code (Employer ID)");
  else if (!/^\d{13}$/.test(employerId)) missing.push("Invalid Company Code (Employer ID must be 13 digits)");
  if (!slip) missing.push(`Salary slip not generated for ${payrollMonth}`);
  else if (!(fixedIncome > 0)) missing.push(`No net salary payable for ${payrollMonth}`);

  return {
    employeeRecordId: String(employee?._id || ""),
    employeeId: employee?.employeeId || "",
    employeeName: employee?.employeeName || "",
    staffId,
    employerId,
    companyCode: employee?.companyCode || "",
    agentCode,
    iban,
    payrollMonth,
    salaryStartDate: start,
    salaryEndDate: end,
    daysWorked,
    leaveDays,
    fixedIncome,
    variableIncome: slip ? 0 : null,
    salarySlipFound: Boolean(slip),
    missing,
  };
};

/**
 * Build EDR rows + skip list from Salary Report rows (see buildSalaryReportPayrollRow).
 * Rows with any missing / invalid mandatory SIF field are skipped, never written.
 */
const buildEdrPayload = (rows, year, month) => {
  const { start, end, days } = periodDates(year, month);
  const edrLines = [];
  const edrRecords = [];
  const skipped = [];
  let totalSalary = 0;

  rows.forEach((row) => {
    if (row.missing && row.missing.length) {
      skipped.push({
        staffId: row.employeeId,
        labourCardNumber: row.staffId,
        empName: row.employeeName,
        missing: row.missing,
        reason: row.missing.join("; "),
      });
      return;
    }

    // Client reference files always carry the days in the salary period and
    // 0000 leave; leave and proration are already reflected in the salary.
    const line = [
      "EDR",
      row.staffId,
      row.agentCode,
      row.iban,
      row.salaryStartDate,
      row.salaryEndDate,
      pad(days, 4),
      formatMoney(row.fixedIncome),
      formatMoney(row.variableIncome),
      "0000",
    ].join(",");

    edrLines.push(line);
    edrRecords.push({
      staffId: row.employeeId,
      labourCardNumber: row.staffId,
      empName: row.employeeName,
      agentCode: row.agentCode,
      bankAccount: row.iban,
      daysWorked: row.daysWorked,
      leaveDays: row.leaveDays,
      fixedIncome: row.fixedIncome,
      variableIncome: row.variableIncome,
    });
    totalSalary = roundAed(totalSalary + row.fixedIncome + row.variableIncome);
  });

  return { edrLines, edrRecords, skipped, totalSalary, start, end, days };
};

const buildScrLine = ({
  employerId,
  agentRouting,
  fileDate,
  fileTime,
  year,
  month,
  edrCount,
  totalSalary,
  fileRef,
}) => {
  const mmYYYY = `${pad(month, 2)}${year}`;
  return [
    "SCR",
    digitsOnly(employerId),
    digitsOnly(agentRouting),
    fileDate,
    fileTime,
    mmYYYY,
    String(edrCount),
    formatMoney(totalSalary),
    "AED",
    fileRef,
  ].join(",");
};

/** <EMPLOYERID><YYMMDDHHMMSS> — the SIF file name without extension. */
const buildFileReference = (employerId, now = new Date()) => {
  const emp = digitsOnly(employerId);
  const yy = String(now.getFullYear()).slice(-2);
  const mm = pad(now.getMonth() + 1, 2);
  const dd = pad(now.getDate(), 2);
  const hh = pad(now.getHours(), 2);
  const mi = pad(now.getMinutes(), 2);
  const ss = pad(now.getSeconds(), 2);
  return `${emp}${yy}${mm}${dd}${hh}${mi}${ss}`;
};

/**
 * @param {object[]} params.rows Salary Report rows (buildSalaryReportPayrollRow) of
 *   every payroll-eligible employee; only rows of `employerId` go into the file.
 */
const generateSifContent = ({
  rows,
  employerId,
  defaultAgentRoutingCode,
  year,
  month,
  now = new Date(),
}) => {
  const employerErr = validateEmployerId(employerId);
  if (employerErr) {
    return {
      error: employerErr + ". Save EMPLOYERID in Company SIF settings before export.",
      skipped: [],
      edrCount: 0,
      totalSalary: 0,
    };
  }

  const safeEmployerId = digitsOnly(employerId);

  // Employees of other employers belong to their own SIF; an unusable company
  // code would leave the employee out of every file, so it is reported here.
  const employerRows = (rows || []).filter(
    (row) => row.employerId === safeEmployerId || !/^\d{13}$/.test(row.employerId)
  );
  const otherEmployerCount = (rows || []).length - employerRows.length;

  const { edrLines, edrRecords, skipped, totalSalary } = buildEdrPayload(
    employerRows,
    year,
    month
  );

  if (edrLines.length === 0) {
    const noSlips = employerRows.length > 0 && employerRows.every((r) => !r.salarySlipFound);
    return {
      error: noSlips
        ? `No salary slips found for ${MONTH_NAMES[month - 1]} ${year} under Employer ID ${safeEmployerId}. Generate salary slips for that month first.`
        : `No employees under Employer ID ${safeEmployerId} with complete WPS data for SIF export.`,
      skipped,
      edrCount: 0,
      totalSalary: 0,
      otherEmployerCount,
    };
  }

  const fileDate = [
    now.getFullYear(),
    pad(now.getMonth() + 1, 2),
    pad(now.getDate(), 2),
  ].join("-");
  const fileTime = `${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}`;
  const fileRef = buildFileReference(safeEmployerId, now);
  const fileName = `${fileRef}.SIF`;

  let scrAgent = digitsOnly(defaultAgentRoutingCode);
  if (scrAgent.length !== 9) {
    return {
      error: "Default agent routing must be exactly 9 digits. Save it in Company SIF settings before export.",
      skipped,
      edrCount: 0,
      totalSalary: 0,
      otherEmployerCount,
    };
  }

  const scr = buildScrLine({
    employerId: safeEmployerId,
    agentRouting: scrAgent,
    fileDate,
    fileTime,
    year,
    month,
    edrCount: edrLines.length,
    totalSalary,
    fileRef,
  });

  // Reference files use Windows line endings, including after the SCR line.
  const content = [...edrLines, scr].join("\r\n") + "\r\n";

  return {
    content,
    fileName,
    fileRef,
    edrCount: edrLines.length,
    totalSalary,
    skipped,
    edrRecords,
    otherEmployerCount,
  };
};

/**
 * Parse SIF text into EDR records + optional SCR.
 */
const parseSifContent = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const edrs = [];
  let scr = null;

  lines.forEach((line, idx) => {
    const parts = line.split(",");
    const type = (parts[0] || "").trim().toUpperCase();

    if (type === "EDR") {
      if (parts.length < 10) {
        throw new Error(`Invalid EDR on line ${idx + 1}: expected 10 fields`);
      }
      edrs.push({
        empId: digitsOnly(parts[1]),
        agentCode: digitsOnly(parts[2]),
        bankAccount: String(parts[3] || "").trim(),
        startDate: parts[4],
        endDate: parts[5],
        daysInPeriod: parts[6],
        fixedIncome: Number(parts[7]) || 0,
        variableIncome: Number(parts[8]) || 0,
        leaveDays: parts[9],
        raw: line,
      });
    } else if (type === "SCR") {
      scr = {
        employerId: digitsOnly(parts[1]),
        agentRouting: digitsOnly(parts[2]),
        fileDate: parts[3],
        fileTime: parts[4],
        monthYear: parts[5],
        edrCount: Number(parts[6]) || 0,
        totalSalary: Number(parts[7]) || 0,
        currency: parts[8],
        fileRef: parts[9],
        raw: line,
      };
    }
  });

  if (edrs.length === 0) {
    throw new Error("No EDR records found in SIF file");
  }

  return { edrs, scr };
};

const excelHeaders = [
  "StaffID",
  "LABOURCARD",
  "EMPID",
  "EMPNAME",
  "EMPLOYERID",
  "AGENTCODE",
  "BANKACCOUNT",
  "STATUS",
  "BASIC",
  "HRA",
  "TRANSPOR",
  "OTHERALLOV",
  "DEDUCTIO",
  "TOTA",
];

const RED_HEADERS = new Set([
  "StaffID",
  "LABOURCARD",
  "EMPID",
  "EMPLOYERID",
  "AGENTCODE",
  "BANKACCOUNT",
]);

const employeeToExcelRow = (emp, employerId) => {
  const sal = emp.salaryDetails || {};
  return {
    StaffID: emp.employeeId || "",
    LABOURCARD: getLabourCardNumber(emp),
    EMPID: normalizeEmiratesId(emp.emiratesId),
    EMPNAME: emp.employeeName || "",
    EMPLOYERID: getEmployeeEmployerId(emp) || digitsOnly(employerId),
    AGENTCODE: digitsOnly(sal.bankSortCode),
    BANKACCOUNT: getBankAccount(emp),
    STATUS: emp.employeeStatus || "",
    BASIC: Number(sal.basicSalary) || 0,
    HRA: Number(sal.houseRent) || 0,
    TRANSPOR: Number(sal.travelExp) || 0,
    OTHERALLOV: Number(sal.other) || 0,
    DEDUCTIO: Number(sal.deduction) || 0,
    TOTA: getFixedIncome(emp),
  };
};

const normalizeExcelHeader = (h) =>
  String(h || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const HEADER_ALIASES = {
  STAFFID: "StaffID",
  LABOURCARD: "LABOURCARD",
  LABORCARD: "LABOURCARD",
  LABOURCARDNO: "LABOURCARD",
  LABORCARDNO: "LABOURCARD",
  LABOURCARDNUMBER: "LABOURCARD",
  LABORCARDNUMBER: "LABOURCARD",
  PERSONCODE: "LABOURCARD",
  WORKPERMITNO: "LABOURCARD",
  EMPID: "EMPID",
  EMPNAME: "EMPNAME",
  EMPLOYERID: "EMPLOYERID",
  AGENTCODE: "AGENTCODE",
  AGENTCODI: "AGENTCODE",
  BANKSORTCODE: "AGENTCODE",
  BANKSORT: "AGENTCODE",
  BANKACCOUNT: "BANKACCOUNT",
  IBAN: "BANKACCOUNT",
  IBANBANKACCOUNT: "BANKACCOUNT",
  STATUS: "STATUS",
  BASIC: "BASIC",
  HRA: "HRA",
  TRANSPOR: "TRANSPOR",
  TRANSPORT: "TRANSPOR",
  OTHERALLOV: "OTHERALLOV",
  OTHERALLOW: "OTHERALLOV",
  DEDUCTIO: "DEDUCTIO",
  DEDUCTION: "DEDUCTIO",
  TOTA: "TOTA",
  TOTAL: "TOTA",
  TOTALSALARY: "TOTA",
  SALARY: "TOTA",
};

module.exports = {
  MONTH_NAMES,
  pad,
  digitsOnly,
  normalizeEmiratesId,
  getBankAccount,
  getLabourCardNumber,
  validateLabourCardNumber,
  getEmployeeEmployerId,
  formatSifAccount,
  validateSifAccount,
  buildSalaryReportPayrollRow,
  getFixedIncome,
  formatMoney,
  daysInMonth,
  periodDates,
  validateEmployerId,
  validateEmpId,
  validateAgentCode,
  validateBankAccount,
  buildEdrPayload,
  buildScrLine,
  buildFileReference,
  generateSifContent,
  parseSifContent,
  excelHeaders,
  RED_HEADERS,
  employeeToExcelRow,
  normalizeExcelHeader,
  HEADER_ALIASES,
};
