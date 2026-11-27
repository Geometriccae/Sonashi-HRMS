/**
 * UAE WPS SIF helpers — matches sample format:
 * EDR,<EMPID>,<AGENTCODE>,<BANKACCOUNT>,<start>,<end>,<days>,<fixed>,<variable>,<leaveDays>
 * SCR,<EMPLOYERID>,<employerBankRouting>,<fileDate>,<fileTime>,<MMYYYY>,<count>,<total>,AED,<fileRef>
 *
 * SCR Column C is the company employer bank routing code (never an employee agent code).
 */

/** Sonashi company employer bank routing code (SCR Column C) — 9 digits */
const EMPLOYER_BANK_ROUTING_CODE = "600310101";

const pad = (value, len) => String(value ?? "").padStart(len, "0");

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const normalizeEmiratesId = (value) => digitsOnly(value);

/**
 * Retrieve the UAE WPS Person ID / Person Code for an employee.
 * Strictly stored in workPermitNo (or personCode / personId).
 * Per client instructions, DO NOT use Emirates ID or passport number as fallback.
 */
const getPersonId = (emp) => {
  if (!emp) return "";
  const raw =
    emp.workPermitNo ||
    emp.personCode ||
    emp.personId ||
    emp.labourCardNumber ||
    "";
  return digitsOnly(raw);
};

const normalizeEmpId = (value) => {
  const d = digitsOnly(value);
  if (!d) return "";
  if (d.length === 14) return d;
  if (d.length >= 6 && d.length < 14) return d.padStart(14, "0");
  return d; // Do not truncate > 14 so validation can report it
};

const getBankAccount = (emp) => {
  const sal = emp?.salaryDetails || {};
  const iban = String(
    sal.ibanNumber || emp?.ibanNumber || sal.iban || emp?.iban || ""
  ).trim();
  const account = String(
    sal.accountNumber ||
      emp?.accountNumber ||
      sal.bankAccount ||
      emp?.bankAccount ||
      sal.accountNo ||
      emp?.accountNo ||
      ""
  ).trim();
  if (iban) return iban.replace(/\s+/g, "");
  return account.replace(/\s+/g, "");
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

const roundAed = (value) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * Payment amount written to an EDR and to the supporting PDF.
 * A finalized salary slip for the month (including a zero net) wins.
 * Otherwise the existing Employee Master total is used, unchanged.
 */
const getPayableAmount = (emp) => {
  if (emp?.customTransferAmount != null && emp.customTransferAmount !== "") {
    const net = Number(emp.customTransferAmount);
    if (Number.isFinite(net) && net >= 0) return roundAed(net);
  }
  return roundAed(getFixedIncome(emp));
};

/**
 * Attach one month's salary slip onto an employee without changing the slip.
 * Net pay is the slip net. The displayed deduction is gross minus that net,
 * so leave, standing deductions and salary-advance recovery are shown once.
 */
const employeeWithSlipPayable = (emp, slip) => {
  if (!slip || slip.netSalary == null) return emp;
  const net = Number(slip.netSalary);
  if (!Number.isFinite(net) || net < 0) return emp;
  const basic = Number(slip.basicPay) || 0;
  const hra = Number(slip.hra) || 0;
  const allowances =
    (Number(slip.conveyanceAllowance) || 0) + (Number(slip.otherAllowance) || 0);
  const gross = Number(slip.grossSalary);
  const deduction = Number.isFinite(gross)
    ? Math.max(0, roundAed(gross - net))
    : roundAed((Number(slip.totalDeduction) || 0) + (Number(slip.salaryAdvanceDeduction) || 0));
  return {
    ...emp,
    customTransferAmount: roundAed(net),
    payrollBreakdown: {
      basic: roundAed(basic),
      hra: roundAed(hra),
      allowances: roundAed(allowances),
      deduction,
    },
  };
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

const validateEmpId = (empid, empName, staffId) => {
  const d = digitsOnly(empid);
  const identifier = empName ? `${empName}${staffId ? ` (${staffId})` : ""}` : staffId || "Employee";
  if (!d) {
    return `Person ID is missing for ${identifier}. Person ID (14 digits) is required for SIF generation.`;
  }
  if (d.length > 14) {
    return `Person ID cannot be more than 14 characters for ${identifier} (got ${d.length} digits: ${d}).`;
  }
  if (d.length < 6) {
    return `Person ID is invalid for ${identifier} (got ${d.length} digits: ${d}). Must be between 6 and 14 digits.`;
  }
  return null;
};

const cleanAgentCode = (value) => {
  if (value == null) return "";
  const s = String(value).trim();
  return s.replace(/[^A-Za-z0-9]/g, "");
};

const getAgentCode = (emp) => {
  if (!emp) return "";
  const sal = emp.salaryDetails || {};
  const raw =
    sal.agentCode ||
    sal.bankSortCode ||
    emp.agentCode ||
    emp.bankSortCode ||
    sal.cif ||
    sal.cifNumber ||
    emp.cif ||
    emp.cifNumber ||
    "";
  return cleanAgentCode(raw);
};

const validateAgentCode = (code) => {
  const s = cleanAgentCode(code);
  if (!s || s.length !== 9 || !/^[A-Za-z0-9]{9}$/.test(s)) {
    return "AGENTCODE must be exactly 9 digits";
  }
  return null;
};

const validateBankAccount = (account) => {
  const a = String(account || "").trim();
  if (!a) return "BANKACCOUNT is required";
  return null;
};

/**
 * Build EDR rows + skip list from employees for a pay period.
 */
const buildEdrPayload = (employees, year, month) => {
  const { start, end, days } = periodDates(year, month);
  const daysField = pad(days, 4);
  const edrLines = [];
  const edrRecords = [];
  const includedEmployees = [];
  const skipped = [];
  let totalSalary = 0;

  employees.forEach((emp) => {
    const empidRaw = getPersonId(emp);
    const empid = normalizeEmpId(empidRaw);
    const agent = getAgentCode(emp);
    const bank = getBankAccount(emp) || "";
    const fixed = getPayableAmount(emp);
    const variable =
      emp.customVariableAmount != null ? Number(emp.customVariableAmount) : 0;

    const reasons = [];
    const empErr = validateEmpId(empid, emp.employeeName, emp.employeeId);
    const agentErr = validateAgentCode(agent);
    const bankErr = validateBankAccount(bank);
    if (empErr) reasons.push(empErr);
    if (agentErr) reasons.push(agentErr);
    if (bankErr) reasons.push(bankErr);
    if (reasons.length) {
      skipped.push({
        staffId: emp.employeeId || "",
        empName: emp.employeeName || "",
        empId: empid,
        agentCode: agent,
        reason: reasons.join("; "),
      });
      return;
    }

    const line = [
      "EDR",
      empid,
      agent,
      bank,
      start,
      end,
      daysField,
      formatMoney(fixed),
      formatMoney(variable),
      "0000",
    ].join(",");

    edrLines.push(line);
    edrRecords.push({
      staffId: emp.employeeId || "",
      empId: empid,
      empName: emp.employeeName || "",
      agentCode: agent,
      bankAccount: bank,
      fixedIncome: fixed,
    });
    includedEmployees.push(emp);
    totalSalary = roundAed(totalSalary + fixed);
  });

  return { edrLines, edrRecords, includedEmployees, skipped, totalSalary, start, end, days };
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
  const cleanTime = String(fileTime || "").replace(/[^0-9]/g, "").slice(0, 4);
  return [
    "SCR",
    digitsOnly(employerId),
    cleanAgentCode(agentRouting),
    fileDate,
    cleanTime,
    mmYYYY,
    String(edrCount),
    formatMoney(totalSalary),
    "AED",
    fileRef,
  ].join(",");
};

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
 * Resolve the employer bank routing code used in SCR Column C.
 * Never falls back to an employee agent / bank routing code.
 * Rejects the legacy incorrect company default (740810000).
 */
const resolveEmployerBankRoutingCode = (defaultAgentRoutingCode) => {
  const fromSettings = cleanAgentCode(defaultAgentRoutingCode);
  if (
    fromSettings.length === 9 &&
    /^[A-Za-z0-9]{9}$/.test(fromSettings) &&
    fromSettings !== "740810000"
  ) {
    return fromSettings;
  }
  return EMPLOYER_BANK_ROUTING_CODE;
};

const generateSifContent = ({
  employees,
  employerId,
  defaultAgentRoutingCode,
  year,
  month,
  now = new Date(),
  isIndividual = false,
}) => {
  const safeEmployerId = digitsOnly(employerId);
  const employerErr = validateEmployerId(safeEmployerId);
  // SCR Column C = employer bank routing code (company-level), for all SIF scenarios
  const scrRoutingCode = resolveEmployerBankRoutingCode(defaultAgentRoutingCode);
  const routingErr = validateAgentCode(scrRoutingCode);
  if (employerErr || routingErr) {
    return {
      error: [employerErr, routingErr].filter(Boolean).join("; "),
      skipped: [],
    };
  }

  const { edrLines, edrRecords, includedEmployees, skipped, totalSalary } = buildEdrPayload(
    employees,
    year,
    month
  );

  if (edrLines.length === 0) {
    return {
      error: isIndividual
        ? (skipped[0]?.reason || "Employee is not eligible for SIF export.")
        : "No employees found for SIF export.",
      skipped,
      includedEmployees: [],
    };
  }

  const fileDate = [
    now.getFullYear(),
    pad(now.getMonth() + 1, 2),
    pad(now.getDate(), 2),
  ].join("-");
  const fileTime = `${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}`;
  const fileRef = buildFileReference(safeEmployerId, now);

  const scr = buildScrLine({
    employerId: safeEmployerId,
    agentRouting: scrRoutingCode,
    fileDate,
    fileTime,
    year,
    month,
    edrCount: edrLines.length,
    totalSalary,
    fileRef,
  });

  const content = [...edrLines, scr].join("\r\n") + "\r\n";
  const fileName = `${fileRef}.SIF`;

  return {
    content,
    fileName,
    fileRef,
    edrCount: edrLines.length,
    totalSalary,
    skipped,
    edrRecords,
    includedEmployees,
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
        agentCode: cleanAgentCode(parts[2]),
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
        agentRouting: cleanAgentCode(parts[2]),
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
  "EMPID",
  "EMPLOYERID",
  "AGENTCODE",
  "BANKACCOUNT",
]);

const employeeToExcelRow = (emp) => {
  const sal = emp.salaryDetails || {};
  const rowEmployerId = digitsOnly(emp.sifEmployerId || emp.companyCode);
  const empidRaw = getPersonId(emp);
  return {
    StaffID: emp.employeeId || "",
    EMPID: normalizeEmpId(empidRaw),
    EMPNAME: emp.employeeName || "",
    EMPLOYERID: rowEmployerId,
    AGENTCODE: getAgentCode(emp),
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
  EMPID: "EMPID",
  EMPNAME: "EMPNAME",
  EMPLOYERID: "EMPLOYERID",
  AGENTCODE: "AGENTCODE",
  AGENTCODI: "AGENTCODE",
  BANKACCOUNT: "BANKACCOUNT",
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
};

module.exports = {
  EMPLOYER_BANK_ROUTING_CODE,
  pad,
  digitsOnly,
  normalizeEmiratesId,
  getPersonId,
  normalizeEmpId,
  getBankAccount,
  getFixedIncome,
  getPayableAmount,
  employeeWithSlipPayable,
  roundAed,
  formatMoney,
  daysInMonth,
  periodDates,
  validateEmployerId,
  validateEmpId,
  validateAgentCode,
  cleanAgentCode,
  getAgentCode,
  validateBankAccount,
  buildEdrPayload,
  buildScrLine,
  buildFileReference,
  resolveEmployerBankRoutingCode,
  generateSifContent,
  parseSifContent,
  excelHeaders,
  RED_HEADERS,
  employeeToExcelRow,
  normalizeExcelHeader,
  HEADER_ALIASES,
};
