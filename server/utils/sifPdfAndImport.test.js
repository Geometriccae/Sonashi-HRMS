const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");

const { generateSifPdf, buildSifPdfDataset } = require("./sifPdfGenerator");
const {
  parseImportFile,
  buildImportRecords,
  applyBatchToEmployees,
} = require("./sifImportBatchUtils");
const {
  generateSifContent,
  parseSifContent,
  getPayableAmount,
  employeeWithSlipPayable,
  EMPLOYER_BANK_ROUTING_CODE,
} = require("./sifUtils");
const { matchSlipsToEmployees } = require("./sifSalaryReportRows");

test("PDF Generation - Individual Employee PDF matches SIF dataset exactly", () => {
  const emp = {
    employeeId: "IDFO-000",
    employeeName: "Kantesh Nihalchandani",
    department: "Executive Management",
    designation: "Managing Director",
    workPermitNo: "12345678901234",
    companyCode: "0000000172509",
    salaryDetails: {
      basicSalary: 10000,
      houseRent: 3000,
      travelExp: 2000,
      deduction: 0,
      totalSalary: 15000,
      agentCode: "600310101",
      ibanNumber: "AE420030000841552920001",
    },
  };

  const sifResult = generateSifContent({
    employees: [emp],
    employerId: "0000000172509",
    defaultAgentRoutingCode: "600310101",
    year: 2026,
    month: 10,
    isIndividual: true,
  });

  assert.equal(sifResult.edrCount, 1);
  assert.equal(sifResult.totalSalary, 15000);

  const pdfBuffer = generateSifPdf({
    employees: [emp],
    employerId: "0000000172509",
    companyCode: "SON-01",
    companyName: "Sonashi General Trading LLC",
    defaultAgentRoutingCode: "600310101",
    year: 2026,
    month: 10,
    isIndividual: true,
    fileRef: sifResult.fileRef,
    fileName: sifResult.fileName,
  });

  assert(Buffer.isBuffer(pdfBuffer));
  assert(pdfBuffer.length > 5000, "PDF buffer must contain substantial document content");
  // PDF header signature %PDF-
  assert.equal(pdfBuffer.slice(0, 5).toString("utf8"), "%PDF-");
});

test("PDF Generation - Company-wide PDF with skipped/excluded records includes summary and reasons", () => {
  const empValid = {
    employeeId: "EMP-001",
    employeeName: "Valid Employee",
    emiratesId: "784199012345671",
    salaryDetails: {
      basicSalary: 5000,
      totalSalary: 5000,
      agentCode: "740810000",
      ibanNumber: "AE012345678901234567890",
    },
  };

  const skipped = [
    {
      staffId: "EMP-002",
      empName: "Incomplete Employee",
      empId: "",
      reason: "Missing EMPID / Person Code",
    },
  ];

  const pdfBuffer = generateSifPdf({
    employees: [empValid],
    employerId: "0000000172509",
    companyName: "Sonashi Head Office",
    companyCode: "0000000172509",
    defaultAgentRoutingCode: "600310101",
    year: 2026,
    month: 10,
    isIndividual: false,
    skipped,
    excludedByCompany: 1,
  });

  assert(Buffer.isBuffer(pdfBuffer));
  assert(pdfBuffer.length > 5000);
});

test("Import Parser - Parses Excel (.xlsx) file and maps headers correctly", () => {
  const rows = [
    {
      StaffID: "EMP-101",
      EMPID: "784199012345601",
      EMPNAME: "Ahmad Test",
      EMPLOYERID: "0000000172509",
      AGENTCODE: "009710001", // leading zero
      BANKACCOUNT: "AE123456789012345678901",
      BASIC: 8000,
      HRA: 2000,
      TRANSPOR: 1000,
      OTHERALLOV: 500,
      DEDUCTIO: 500,
      TOTA: 11000,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const parsed = parseImportFile(buffer, "salary_report.xlsx");
  assert.equal(parsed.fileType, "excel");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].staffId, "EMP-101");
  assert.equal(parsed.rows[0].agentCode, "009710001"); // leading zeros preserved
  assert.equal(parsed.rows[0].basic, 8000);
  assert.equal(parsed.rows[0].totalSalary, 11000);
});

test("Import Parser - Parses SIF file (.sif) and extracts EDR records", () => {
  const sifContent = [
    "EDR,784199012345602,CBUE00001,AE9988776655443322110,2026-10-01,2026-10-31,31,9500.00,0.00,0000",
    "SCR,0000000172509,CBUE00001,2026-10-30,1200,102026,1,9500.00,REF123456",
  ].join("\n");

  const parsed = parseImportFile(Buffer.from(sifContent, "utf8"), "test.sif");
  assert.equal(parsed.fileType, "sif");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].empId, "784199012345602");
  assert.equal(parsed.rows[0].agentCode, "CBUE00001"); // alphanumeric preserved
  assert.equal(parsed.rows[0].totalSalary, 9500);
  assert.equal(parsed.month, 10);
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.employerId, "0000000172509");
});

test("Import Validation - Matches employees by unique ID and flags Agent Code changes for review", () => {
  const existingEmployees = [
    {
      _id: "mongo-emp-1",
      employeeId: "EMP-101",
      employeeName: "Saved Ahmad",
      emiratesId: "784199012345601",
      companyCode: "0000000172509",
      sifEmployerId: "0000000172509",
      salaryDetails: {
        basicSalary: 7000,
        houseRent: 2000,
        travelExp: 1000,
        deduction: 0,
        totalSalary: 10000,
        agentCode: "740810000", // Saved agent code
        ibanNumber: "AE123456789012345678901",
      },
    },
  ];

  const rawRows = [
    // Row 1: Valid employee with changed salary and changed Agent Code
    {
      staffId: "EMP-101",
      empId: "784199012345601",
      empName: "Ahmad (Edited)",
      employerId: "0000000172509",
      agentCode: "600310101", // Different from saved 740810000
      basic: 8000, // Changed from 7000
      totalSalary: 11000, // Changed from 10000
    },
    // Row 2: Unknown employee ID (should be Invalid)
    {
      staffId: "UNKNOWN-999",
      empId: "784999999999999",
      basic: 5000,
      totalSalary: 5000,
    },
    // Row 3: Negative salary (should be Invalid)
    {
      staffId: "EMP-101",
      totalSalary: -500,
    },
  ];

  const { records, summary } = buildImportRecords({
    rawRows,
    existingEmployees,
    targetEmployerId: "0000000172509",
  });

  assert.equal(summary.totalRecords, 3);
  assert.equal(summary.invalidCount, 2); // UNKNOWN-999 and negative salary
  assert.equal(summary.warningCount, 1); // EMP-101 has Agent Code mismatch warning

  const emp1Record = records[0];
  assert.equal(emp1Record.employeeId, "EMP-101");
  assert.equal(emp1Record.validationStatus, "Warning");
  assert(emp1Record.isChanged);
  assert(emp1Record.issues.some((i) => i.includes("Agent Code mismatch")));
  assert(emp1Record.changes.some((c) => c.includes("Total Salary: AED 10000.00 -> AED 11000.00")));
  assert(emp1Record.changes.some((c) => c.includes("Agent Code: 740810000 -> 600310101")));
});

test("Import Staging & Approval - DB is NOT modified before approval; only modified upon approval", async () => {
  // Mock DB store
  const dbEmp = {
    _id: "mongo-emp-1",
    employeeId: "EMP-101",
    salaryDetails: {
      basicSalary: 7000,
      totalSalary: 10000,
      agentCode: "740810000",
    },
    markModified: function () {},
    save: async function () {
      return this;
    },
  };

  const MockEmployeeModel = {
    findById: async (id) => (id === "mongo-emp-1" ? dbEmp : null),
    findOne: async ({ employeeId }) => (employeeId === "EMP-101" ? dbEmp : null),
  };

  const stagedBatch = {
    batchId: "BATCH-TEST-001",
    status: "Pending", // Staged, not approved yet
    records: [
      {
        employeeId: "EMP-101",
        employeeMongoId: "mongo-emp-1",
        validationStatus: "Valid",
        uploaded: {
          basicSalary: 8500,
          totalSalary: 12000,
          agentCode: "600310101",
        },
      },
      {
        employeeId: "UNKNOWN-002",
        validationStatus: "Invalid",
        uploaded: { totalSalary: 5000 },
      },
    ],
  };

  // 1. Verify before approval: DB still has old values
  assert.equal(dbEmp.salaryDetails.totalSalary, 10000);
  assert.equal(dbEmp.salaryDetails.basicSalary, 7000);
  assert.equal(dbEmp.salaryDetails.agentCode, "740810000");

  // 2. Perform approval and application
  const result = await applyBatchToEmployees(stagedBatch, MockEmployeeModel);
  assert.equal(result.updatedCount, 1);

  // 3. Verify after approval: DB now has approved new values
  assert.equal(dbEmp.salaryDetails.totalSalary, 12000);
  assert.equal(dbEmp.salaryDetails.basicSalary, 8500);
  assert.equal(dbEmp.salaryDetails.agentCode, "600310101");

  // 4. Verify idempotency: cannot apply twice
  stagedBatch.status = "Approved";
  await assert.rejects(
    async () => applyBatchToEmployees(stagedBatch, MockEmployeeModel),
    /already been approved and applied/
  );
});

test("Import Staging & Rejection - Rejected batch leaves DB records completely untouched", async () => {
  const dbEmp = {
    _id: "mongo-emp-2",
    employeeId: "EMP-102",
    salaryDetails: {
      totalSalary: 9000,
    },
  };

  const MockEmployeeModel = {
    findById: async () => dbEmp,
    findOne: async () => dbEmp,
  };

  const rejectedBatch = {
    batchId: "BATCH-REJECT-001",
    status: "Rejected",
    records: [
      {
        employeeId: "EMP-102",
        validationStatus: "Valid",
        uploaded: { totalSalary: 15000 },
      },
    ],
  };

  await assert.rejects(
    async () => applyBatchToEmployees(rejectedBatch, MockEmployeeModel),
    /Cannot apply a rejected import batch/
  );

  // DB record was NOT modified
  assert.equal(dbEmp.salaryDetails.totalSalary, 9000);
});

test("Payable amount uses the month slip once, including a zero net, and does not deduct a standing deduction twice", () => {
  const withSlip = employeeWithSlipPayable(
    {
      employeeId: "IDMO-215",
      salaryDetails: { totalSalary: 5700, deduction: 300, basicSalary: 1000 },
    },
    { basicPay: 1000, hra: 2000, conveyanceAllowance: 1000, otherAllowance: 2000, grossSalary: 6000, totalDeduction: 300, netSalary: 5700 }
  );
  assert.equal(getPayableAmount(withSlip), 5700);
  assert.equal(withSlip.payrollBreakdown.deduction, 300);

  const zeroNet = employeeWithSlipPayable(
    { employeeId: "IDMM-074", salaryDetails: { totalSalary: 2400 } },
    { basicPay: 400, hra: 800, conveyanceAllowance: 500, otherAllowance: 500, grossSalary: 2200, totalDeduction: 2200, netSalary: 0 }
  );
  assert.equal(getPayableAmount(zeroNet), 0);

  const masterOnly = {
    employeeId: "IDMO-223",
    salaryDetails: {
      basicSalary: 1000,
      houseRent: 2000,
      travelExp: 2000,
      other: 1000,
      deduction: 300,
      totalSalary: 5700,
    },
  };
  assert.equal(getPayableAmount(masterOnly), 5700);
});

test("Placeholder payslip addresses match the employee code for every month", () => {
  const noEmail = { _id: "1", employeeId: "IDMM-053", employeeName: "Thirupathi Jainapurapu", emailId: "" };
  const renamedPlaceholder = {
    _id: "2",
    employeeId: "IDMM-137",
    employeeName: "Sachin Kanoujiya",
    emailId: "noemail+idmm-137+e89f831ceb27@import.hrms.placeholder",
  };
  const slips = [
    { emailId: "noemail+idmm-053@import.hrms.placeholder", employeeName: "THIRUPATHI JAINAPURAPU", netSalary: 766.67, updatedAt: "2026-11-01" },
    { emailId: "noemail+idmm-137@import.hrms.placeholder", employeeName: "SACHIN KANOUJIYA", netSalary: 1800, updatedAt: "2026-11-01" },
  ];
  const matched = matchSlipsToEmployees(slips, [noEmail, renamedPlaceholder]);
  assert.equal(matched.get("1").netSalary, 766.67);
  assert.equal(matched.get("2").netSalary, 1800);
});

test("PDF and SIF share one dataset for any month: count, net, person code, exclusions, and employer routing", () => {
  const paid = employeeWithSlipPayable(
    {
      employeeId: "IDMM-010",
      employeeName: "Sai Kumar",
      workPermitNo: "10001059622333",
      emiratesId: "784199900000001",
      department: "Operations",
      designation: "Staff",
      salaryDetails: {
        basicSalary: 500,
        houseRent: 800,
        totalAllowance: 1800,
        totalSalary: 2700,
        deduction: 0,
        agentCode: "302620122",
        ibanNumber: "AE111111111111111111111",
      },
    },
    {
      basicPay: 500,
      hra: 800,
      conveyanceAllowance: 700,
      otherAllowance: 300,
      grossSalary: 2300,
      totalDeduction: 0,
      netSalary: 2300,
    }
  );
  const zero = employeeWithSlipPayable(
    {
      employeeId: "IDMM-074",
      employeeName: "Zero Net",
      workPermitNo: "10000000000074",
      salaryDetails: {
        totalSalary: 2400,
        agentCode: "600310101",
        ibanNumber: "AE222222222222222222222",
      },
    },
    { basicPay: 400, hra: 800, conveyanceAllowance: 500, otherAllowance: 500, grossSalary: 2200, totalDeduction: 2200, netSalary: 0 }
  );
  const missingBank = {
    employeeId: "IDMC-247",
    employeeName: "Missing Bank",
    workPermitNo: "10016049367660",
    salaryDetails: { totalSalary: 2600, agentCode: "", basicSalary: 2600 },
  };
  const employees = [paid, zero, missingBank];
  const companyExcluded = [{
    staffId: "IDBL-009",
    empName: "Other Company",
    empId: "20001038179816",
    reason: "Assigned Employer ID 0000000246878 does not match selected Employer ID 0000000172509",
  }];

  [3, 11].forEach((month) => {
    const sif = generateSifContent({
      employees,
      employerId: "0000000172509",
      defaultAgentRoutingCode: "740810000",
      year: 2026,
      month,
      now: new Date("2026-11-25T08:00:00.000Z"),
    });
    const parsed = parseSifContent(sif.content);
    const pdf = buildSifPdfDataset({
      employees,
      year: 2026,
      month,
      skipped: [...sif.skipped, ...companyExcluded],
      excludedByCompany: 0,
    });

    assert.equal(parsed.scr.agentRouting, EMPLOYER_BANK_ROUTING_CODE);
    assert.equal(parsed.scr.edrCount, parsed.edrs.length);
    assert.equal(parsed.scr.totalSalary, parsed.edrs.reduce((sum, row) => sum + row.fixedIncome, 0));
    assert.equal(pdf.includedCount, parsed.scr.edrCount);
    assert.equal(pdf.edrCount, parsed.scr.edrCount);
    assert.equal(pdf.totalNetSalary, parsed.scr.totalSalary);
    assert.equal(pdf.includedCount, 2);
    assert.equal(pdf.totalNetSalary, 2300);
    assert.equal(parsed.edrs[0].empId, "10001059622333");
    assert.notEqual(parsed.edrs[0].empId, "784199900000001");
    assert.equal(parsed.edrs[0].agentCode, "302620122");
    assert.equal(parsed.edrs[1].fixedIncome, 0);
    assert.equal(pdf.rows[0].money.net, 2300);
    assert.equal(pdf.rows[0].money.deduction, 0);
    assert.equal(pdf.rows[1].money.net, 0);
    assert.equal(pdf.rows[1].money.deduction, 2200);
    assert.equal(sif.skipped.length, 1);
    assert.match(sif.skipped[0].reason, /BANKACCOUNT/);
    assert.equal(pdf.totalExcludedCount, 2);
    assert.equal(pdf.excludedRows.some((row) => row.staffId === "IDMC-247"), true);
    assert.equal(pdf.excludedRows.some((row) => row.staffId === "IDBL-009"), true);
  });

  const generated = generateSifContent({
    employees,
    employerId: "0000000172509",
    defaultAgentRoutingCode: EMPLOYER_BANK_ROUTING_CODE,
    year: 2026,
    month: 11,
  });
  const pdfBuffer = generateSifPdf({
    employees,
    employerId: "0000000172509",
    defaultAgentRoutingCode: EMPLOYER_BANK_ROUTING_CODE,
    year: 2026,
    month: 11,
    skipped: [...generated.skipped, ...companyExcluded],
  });
  assert.equal(pdfBuffer.slice(0, 5).toString("utf8"), "%PDF-");
});

