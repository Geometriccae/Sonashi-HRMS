const assert = require("node:assert/strict");
const {
  getPersonId,
  normalizeEmpId,
  validateEmpId,
  buildFileReference,
  buildScrLine,
  buildEdrPayload,
  generateSifContent,
  parseSifContent,
} = require("../utils/sifUtils");

console.log("=== RUNNING SIF REQUIREMENTS VERIFICATION ===");

// 1. Person ID logic verification
const empWithWorkPermit = {
  employeeId: "IDMO-001",
  employeeName: "John Doe",
  workPermitNo: "10074007721874", // 14 digits
  emiratesId: "784199512345671",  // 15 digits
  passportNo: "N1234567",
};

assert.equal(
  getPersonId(empWithWorkPermit),
  "10074007721874",
  "Must use workPermitNo (Person ID) instead of Emirates ID or Passport"
);

// 2. Reject Emirates ID fallback when workPermitNo is missing
const empWithoutPersonId = {
  employeeId: "IDMO-002",
  employeeName: "Jane Smith",
  workPermitNo: "",
  emiratesId: "784199512345672",
  passportNo: "N7654321",
};

assert.equal(
  getPersonId(empWithoutPersonId),
  "",
  "Must NOT fall back to Emirates ID or Passport when workPermitNo is empty"
);

const missingErr = validateEmpId(getPersonId(empWithoutPersonId), empWithoutPersonId.employeeName, empWithoutPersonId.employeeId);
assert.match(missingErr, /Person ID is missing/, "Must report meaningful error when Person ID is missing");

// 3. Reject Person ID > 14 characters
const empLongId = {
  employeeId: "IDMO-003",
  employeeName: "Bob Long",
  workPermitNo: "123456789012345", // 15 digits
};
const longErr = validateEmpId(getPersonId(empLongId), empLongId.employeeName, empLongId.employeeId);
assert.match(longErr, /cannot be more than 14 characters/, "Must reject Person ID > 14 characters without truncation");

// 4. File Reference Format: EmployerID (13) + YYMMDDHHMISS (12) = 25 chars
const fixedDate = new Date("2026-10-16T10:04:32");
const fileRef = buildFileReference("0000000172509", fixedDate);
assert.equal(fileRef.length, 25, "File reference must be exactly 25 characters");
assert.equal(fileRef, "0000000172509261016100432", "File reference must match reference pattern 0000000172509261016100432");

// 5. SCR Line format matching reference
const scrLine = buildScrLine({
  employerId: "0000000172509",
  agentRouting: "740810000",
  fileDate: "2026-10-16",
  fileTime: "1004",
  year: 2026,
  month: 9,
  edrCount: 132,
  totalSalary: 435480.00,
  fileRef: "0000000172509261016100432",
});

assert.equal(
  scrLine,
  "SCR,0000000172509,740810000,2026-10-16,1004,092026,132,435480.00,AED,0000000172509261016100432",
  "SCR line must match reference format"
);

// 6. SIF generation produces CRLF line endings
const validEmp = {
  employeeId: "IDMO-002",
  employeeName: "Mahesh Chainani",
  workPermitNo: "10074007721874",
  companyCode: "0000000172509",
  salaryDetails: {
    agentCode: "740810000",
    ibanNumber: "AE012345678901234567890",
    totalSalary: 5000,
  },
};

const sifRes = generateSifContent({
  employees: [validEmp],
  employerId: "0000000172509",
  defaultAgentRoutingCode: "740810000",
  year: 2026,
  month: 10,
  now: fixedDate,
  isIndividual: true,
});

assert.ok(sifRes.content.includes("\r\n"), "SIF content must use CRLF (\\r\\n) line endings");
assert.equal(sifRes.edrCount, 1);
assert.equal(sifRes.fileName, "0000000172509261016100432.SIF");

const parsed = parseSifContent(sifRes.content);
assert.equal(parsed.edrs[0].empId, "10074007721874");
assert.equal(parsed.edrs[0].agentCode, "740810000");
assert.equal(parsed.edrs[0].fixedIncome, 5000);
assert.equal(parsed.scr.employerId, "0000000172509");
assert.equal(parsed.scr.fileRef, "0000000172509261016100432");

console.log(" ALL 6 SIF REQUIREMENTS VERIFIED SUCCESSFULLY!");
