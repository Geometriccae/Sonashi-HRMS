const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildEdrPayload,
  generateSifContent,
  parseSifContent,
  digitsOnly,
  validateAgentCode,
  employeeToExcelRow,
} = require("./sifUtils");

const {
  buildCompanyEmployerMap,
  resolveEmployeeCompanyMapping,
  applyCompanyEmployerMapping,
} = require("./sifCompanyMapping");

test("Multiple employees in the same company have distinct Agent Codes and preserve them in company-wide SIF export", () => {
  const companyEmployerId = "0000000172509";
  const companyDefaultRouting = "302620122";

  const empA = {
    _id: "emp-a",
    employeeId: "EMP-001",
    employeeName: "Alice Smith",
    emiratesId: "784199012345671",
    companyCode: companyEmployerId,
    salaryDetails: {
      agentCode: "600310101",
      bankSortCode: "600310101",
      ibanNumber: "AE012345678901234567890",
      totalSalary: 5000,
    },
  };

  const empB = {
    _id: "emp-b",
    employeeId: "EMP-002",
    employeeName: "Bob Jones",
    emiratesId: "784199012345672",
    companyCode: companyEmployerId,
    salaryDetails: {
      agentCode: "740810000",
      bankSortCode: "740810000",
      ibanNumber: "AE987654321098765432109",
      totalSalary: 8000,
    },
  };

  const empC = {
    _id: "emp-c",
    employeeId: "EMP-003",
    employeeName: "Charlie Brown",
    emiratesId: "784199012345673",
    companyCode: companyEmployerId,
    salaryDetails: {
      agentCode: "",
      bankSortCode: "",
      ibanNumber: "AE111111111111111111111",
      totalSalary: 4000,
    },
  };

  const employees = [empA, empB, empC];

  // Company-wide export
  const sifResult = generateSifContent({
    employees,
    employerId: companyEmployerId,
    defaultAgentRoutingCode: companyDefaultRouting,
    year: 2026,
    month: 9,
    isIndividual: false,
  });

  assert.equal(sifResult.edrCount, 2, "Emp A and Emp B are valid; Emp C is skipped");
  assert.equal(sifResult.skipped.length, 1, "Emp C with missing Agent Code must be skipped");
  assert.equal(sifResult.skipped[0].staffId, "EMP-003");
  assert.match(sifResult.skipped[0].reason, /AGENTCODE must be exactly 9 digits/);

  // Parse lines to verify field positions and distinct Agent Codes
  const { edrs, scr } = parseSifContent(sifResult.content);
  assert.equal(edrs.length, 2);

  // Emp A must have Agent Code 600310101
  assert.equal(edrs[0].empId, "784199012345671");
  assert.equal(edrs[0].agentCode, "600310101");
  assert.equal(edrs[0].fixedIncome, 5000);

  // Emp B must have Agent Code 740810000 (different from Emp A)
  assert.equal(edrs[1].empId, "784199012345672");
  assert.equal(edrs[1].agentCode, "740810000");
  assert.equal(edrs[1].fixedIncome, 8000);

  // SCR line in company-wide export must use company defaultAgentRoutingCode (302620122),
  // NEVER Emp A's code or Emp B's code!
  assert.ok(scr, "SCR record must exist");
  assert.equal(scr.employerId, companyEmployerId);
  assert.equal(scr.agentRouting, companyDefaultRouting);
  assert.notEqual(scr.agentRouting, "600310101", "SCR routing must not substitute Emp A's agent code");
  assert.notEqual(scr.agentRouting, "740810000", "SCR routing must not substitute Emp B's agent code");
  assert.equal(scr.edrCount, 2);
  assert.equal(scr.totalSalary, 13000);
});

test("Individual SIF export for Emp A uses Emp A's own Agent Code in both EDR and SCR", () => {
  const companyEmployerId = "0000000172509";
  const companyDefaultRouting = "302620122";

  const empA = {
    _id: "emp-a",
    employeeId: "EMP-001",
    employeeName: "Alice Smith",
    emiratesId: "784199012345671",
    companyCode: companyEmployerId,
    salaryDetails: {
      agentCode: "600310101",
      bankSortCode: "600310101",
      ibanNumber: "AE012345678901234567890",
      totalSalary: 5000,
    },
  };

  const sifResult = generateSifContent({
    employees: [empA],
    employerId: companyEmployerId,
    defaultAgentRoutingCode: companyDefaultRouting,
    year: 2026,
    month: 9,
    isIndividual: true,
  });

  assert.equal(sifResult.edrCount, 1);
  const { edrs, scr } = parseSifContent(sifResult.content);
  assert.equal(edrs.length, 1);
  assert.equal(edrs[0].agentCode, "600310101", "EDR must use Emp A's agent code");

  // In individual export, SCR agent routing uses the selected employee's own Agent Code
  assert.equal(scr.agentRouting, "600310101", "SCR routing must use Emp A's agent code in individual export");
  assert.equal(scr.edrCount, 1);
  assert.equal(scr.totalSalary, 5000);
});

test("Individual SIF export for Emp B uses Emp B's own Agent Code in both EDR and SCR", () => {
  const companyEmployerId = "0000000172509";
  const companyDefaultRouting = "302620122";

  const empB = {
    _id: "emp-b",
    employeeId: "EMP-002",
    employeeName: "Bob Jones",
    emiratesId: "784199012345672",
    companyCode: companyEmployerId,
    salaryDetails: {
      agentCode: "740810000",
      bankSortCode: "740810000",
      ibanNumber: "AE987654321098765432109",
      totalSalary: 8000,
    },
  };

  const sifResult = generateSifContent({
    employees: [empB],
    employerId: companyEmployerId,
    defaultAgentRoutingCode: companyDefaultRouting,
    year: 2026,
    month: 9,
    isIndividual: true,
  });

  assert.equal(sifResult.edrCount, 1);
  const { edrs, scr } = parseSifContent(sifResult.content);
  assert.equal(edrs.length, 1);
  assert.equal(edrs[0].agentCode, "740810000", "EDR must use Emp B's agent code");
  assert.equal(scr.agentRouting, "740810000", "SCR routing must use Emp B's agent code in individual export");
  assert.equal(scr.edrCount, 1);
  assert.equal(scr.totalSalary, 8000);
});

test("Individual SIF export validates missing Agent Code and does not substitute any other value", () => {
  const companyEmployerId = "0000000172509";

  const empC = {
    _id: "emp-c",
    employeeId: "EMP-003",
    employeeName: "Charlie Brown",
    emiratesId: "784199012345673",
    companyCode: companyEmployerId,
    salaryDetails: {
      agentCode: "",
      bankSortCode: "",
      ibanNumber: "AE111111111111111111111",
      totalSalary: 4000,
    },
  };

  const sifResult = generateSifContent({
    employees: [empC],
    employerId: companyEmployerId,
    defaultAgentRoutingCode: "302620122",
    year: 2026,
    month: 9,
    isIndividual: true,
  });

  assert.ok(sifResult.error, "Should produce an error when employee Agent Code is missing");
  assert.match(sifResult.error, /AGENTCODE must be exactly 9 digits/);
  assert.equal(sifResult.skipped.length, 1);
  assert.equal(sifResult.skipped[0].agentCode, "");
});

test("Agent Code is not fetched or assigned from Company Code or Employer ID", () => {
  const companyEmployerId = "0000000172509"; // 13 digits

  const emp = {
    employeeId: "EMP-010",
    employeeName: "Diana Prince",
    emiratesId: "784199012345675",
    companyCode: companyEmployerId,
    salaryDetails: {
      bankName: "First Abu Dhabi Bank",
      ibanNumber: "AE123456789012345678901",
      totalSalary: 6000,
      // No agentCode provided
    },
  };

  const row = employeeToExcelRow(emp);
  assert.equal(row.EMPLOYERID, companyEmployerId);
  assert.equal(row.AGENTCODE, "", "Agent code must NOT be derived from Company Code / Employer ID");

  const validation = validateAgentCode(row.AGENTCODE);
  assert.equal(validation, "AGENTCODE must be exactly 9 digits");
});

test("Authoritative company mapping preserves Employer ID and employee assignment", () => {
  const docMap = buildCompanyEmployerMap([
    { particulars: "Sonashi Head Office", docNumber: "0000000172509" },
    { particulars: "Joint Ven Trading Co LLC", docNumber: "0000000246878" },
  ]);

  const emp1 = applyCompanyEmployerMapping(
    { office: "Sonashi Head Office", companyCode: "0000000172509" },
    docMap
  );
  assert.equal(emp1.sifEmployerId, "0000000172509");
  assert.equal(emp1.sifCompanyMapping.source, "company-document");

  const emp2 = applyCompanyEmployerMapping(
    { office: "Joint Ven Trading Co LLC", companyCode: "0000000172509" },
    docMap
  );
  // Authoritative company configuration takes precedence over legacy stored code
  assert.equal(emp2.sifEmployerId, "0000000246878");
  assert.equal(emp2.sifCompanyMapping.source, "company-document");

  // Without company document, falls back to employee stored company code
  const emp3 = applyCompanyEmployerMapping(
    { office: "Unregistered Branch", companyCode: "0000002795780" },
    docMap
  );
  assert.equal(emp3.sifEmployerId, "0000002795780");
  assert.equal(emp3.sifCompanyMapping.source, "employee");
});

test("Individual employee export contains only the selected employee and excludes all other employees", () => {
  const companyEmployerId = "0000000172509";
  const defaultRouting = "302620122";

  const empA = {
    _id: "emp-a",
    employeeId: "EMP-001",
    employeeName: "Alice Smith",
    emiratesId: "784199012345671",
    companyCode: companyEmployerId,
    salaryDetails: {
      agentCode: "600310101",
      bankSortCode: "600310101",
      ibanNumber: "AE012345678901234567890",
      totalSalary: 5000,
    },
  };

  const empB = {
    _id: "emp-b",
    employeeId: "EMP-002",
    employeeName: "Bob Jones",
    emiratesId: "784199012345672",
    companyCode: companyEmployerId,
    salaryDetails: {
      agentCode: "740810000",
      bankSortCode: "740810000",
      ibanNumber: "AE987654321098765432109",
      totalSalary: 8000,
    },
  };

  // Export for Emp A only
  const sifResultA = generateSifContent({
    employees: [empA],
    employerId: companyEmployerId,
    defaultAgentRoutingCode: defaultRouting,
    year: 2026,
    month: 10,
    isIndividual: true,
  });

  assert.equal(sifResultA.edrCount, 1);
  assert.equal(sifResultA.totalSalary, 5000);
  const { edrs: edrsA, scr: scrA } = parseSifContent(sifResultA.content);
  assert.equal(edrsA.length, 1);
  assert.equal(edrsA[0].empId, "784199012345671");
  assert.equal(edrsA[0].agentCode, "600310101");
  assert.equal(scrA.edrCount, 1);
  assert.equal(scrA.totalSalary, 5000);
  assert.equal(scrA.agentRouting, "600310101");

  // Export for Emp B only
  const sifResultB = generateSifContent({
    employees: [empB],
    employerId: companyEmployerId,
    defaultAgentRoutingCode: defaultRouting,
    year: 2026,
    month: 10,
    isIndividual: true,
  });

  assert.equal(sifResultB.edrCount, 1);
  assert.equal(sifResultB.totalSalary, 8000);
  const { edrs: edrsB, scr: scrB } = parseSifContent(sifResultB.content);
  assert.equal(edrsB.length, 1);
  assert.equal(edrsB[0].empId, "784199012345672");
  assert.equal(edrsB[0].agentCode, "740810000");
  assert.equal(scrB.edrCount, 1);
  assert.equal(scrB.totalSalary, 8000);
  assert.equal(scrB.agentRouting, "740810000");
});

test("Company-wise SIF export includes all eligible employees belonging to that company without mixing", () => {
  const company1 = "0000000172509";
  const company2 = "0000000246878";
  const defaultRouting = "302620122";

  const emp1 = {
    _id: "emp-1",
    employeeId: "EMP-001",
    employeeName: "Alice Smith",
    emiratesId: "784199012345671",
    sifEmployerId: company1,
    salaryDetails: {
      agentCode: "600310101",
      ibanNumber: "AE012345678901234567890",
      totalSalary: 5000,
    },
  };

  const emp2 = {
    _id: "emp-2",
    employeeId: "EMP-002",
    employeeName: "Bob Jones",
    emiratesId: "784199012345672",
    sifEmployerId: company1,
    salaryDetails: {
      agentCode: "740810000",
      ibanNumber: "AE987654321098765432109",
      totalSalary: 8000,
    },
  };

  const emp3 = {
    _id: "emp-3",
    employeeId: "EMP-003",
    employeeName: "Charlie Other",
    emiratesId: "784199012345673",
    sifEmployerId: company2,
    salaryDetails: {
      agentCode: "123456789",
      ibanNumber: "AE111111111111111111111",
      totalSalary: 7000,
    },
  };

  const allEmployees = [emp1, emp2, emp3];
  // Scoped to company1
  const company1Employees = allEmployees.filter(e => e.sifEmployerId === company1);
  assert.equal(company1Employees.length, 2);

  const sifResult = generateSifContent({
    employees: company1Employees,
    employerId: company1,
    defaultAgentRoutingCode: defaultRouting,
    year: 2026,
    month: 10,
    isIndividual: false,
  });

  assert.equal(sifResult.edrCount, 2);
  assert.equal(sifResult.totalSalary, 13000);
  const { edrs, scr } = parseSifContent(sifResult.content);
  assert.equal(edrs.length, 2);
  assert.equal(edrs.some(e => e.empId === "784199012345673"), false, "Employee from Company 2 must not be included");
  assert.equal(scr.employerId, company1);
  assert.equal(scr.agentRouting, defaultRouting);
});
