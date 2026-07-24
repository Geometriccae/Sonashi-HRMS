/**
 * UAE WPS SIF helpers — matches sample format:
 * EDR,<EMPID>,<AGENTCODE>,<BANKACCOUNT>,<start>,<end>,<days>,<fixed>,<variable>,<leaveDays>
 * SCR,<EMPLOYERID>,<agent>,<fileDate>,<fileTime>,<MMYYYY>,<count>,<total>,AED,<fileRef>
 */

const pad = (value, len) => String(value ?? "").padStart(len, "0");

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const normalizeEmiratesId = (value) => digitsOnly(value);

const getBankAccount = (emp) => {
  const sal = emp.salaryDetails || {};
  const iban = String(sal.ibanNumber || "").trim();
  const account = String(sal.accountNumber || "").trim();
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

/**
 * Build EDR rows + skip list from employees for a pay period.
 */
const buildEdrPayload = (employees, year, month) => {
  const { start, end, days } = periodDates(year, month);
  const daysField = pad(days, 4);
  const edrLines = [];
  const edrRecords = [];
  const skipped = [];
  let totalSalary = 0;

  employees.forEach((emp) => {
    const empid = normalizeEmiratesId(emp.emiratesId);
    let agent = digitsOnly(emp.salaryDetails?.bankSortCode);
    const bank = getBankAccount(emp) || "";
    const fixed = getFixedIncome(emp);

    // Include all employees; pad missing agent code rather than blocking export
    if (agent.length !== 9) {
      agent = pad(agent || "0", 9).slice(-9);
    }

    const line = [
      "EDR",
      empid || "",
      agent,
      bank,
      start,
      end,
      daysField,
      formatMoney(fixed),
      "0.00",
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
    totalSalary += fixed;
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

const buildFileReference = (employerId, now = new Date()) => {
  const emp = digitsOnly(employerId);
  const dd = pad(now.getDate(), 2);
  const mm = pad(now.getMonth() + 1, 2);
  const yy = String(now.getFullYear()).slice(-2);
  const hh = pad(now.getHours(), 2);
  const mi = pad(now.getMinutes(), 2);
  const seq = "00";
  return `${emp}${dd}${mm}${yy}${hh}${mi}${seq}`;
};

const generateSifContent = ({
  employees,
  employerId,
  defaultAgentRoutingCode,
  year,
  month,
  now = new Date(),
}) => {
  // Allow empty Employer ID / Agent Code — pad with zeros for a valid file shape
  const safeEmployerId = pad(digitsOnly(employerId) || "0", 13).slice(-13);

  const { edrLines, edrRecords, skipped, totalSalary } = buildEdrPayload(
    employees,
    year,
    month
  );

  if (edrLines.length === 0) {
    return {
      error: "No employees found for SIF export.",
      skipped,
    };
  }

  const fileDate = [
    now.getFullYear(),
    pad(now.getMonth() + 1, 2),
    pad(now.getDate(), 2),
  ].join("-");
  const fileTime = `${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}`;
  const fileRef = buildFileReference(safeEmployerId, now);

  let scrAgent = digitsOnly(defaultAgentRoutingCode);
  if (scrAgent.length !== 9 && edrRecords[0]) {
    scrAgent = digitsOnly(edrRecords[0].agentCode);
  }
  if (scrAgent.length !== 9) {
    scrAgent = pad(scrAgent || "0", 9).slice(-9);
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

  const content = [...edrLines, scr].join("\n") + "\n";
  const fileName = `${fileRef}.SIF`;

  return {
    content,
    fileName,
    fileRef,
    edrCount: edrLines.length,
    totalSalary,
    skipped,
    edrRecords,
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

const employeeToExcelRow = (emp, employerId) => {
  const sal = emp.salaryDetails || {};
  return {
    StaffID: emp.employeeId || "",
    EMPID: normalizeEmiratesId(emp.emiratesId),
    EMPNAME: emp.employeeName || "",
    EMPLOYERID: digitsOnly(employerId),
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
  pad,
  digitsOnly,
  normalizeEmiratesId,
  getBankAccount,
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
