const XLSX = require("xlsx");
const {
  parseSifContent,
  digitsOnly,
  cleanAgentCode,
  getAgentCode,
  getBankAccount,
  getFixedIncome,
  normalizeEmiratesId,
  normalizeExcelHeader,
  HEADER_ALIASES,
} = require("./sifUtils");

/**
 * Identify file type and parse either Excel or SIF into uniform row payloads.
 */
function parseImportFile(buffer, fileName = "") {
  const name = String(fileName || "").toLowerCase();
  const isSif = name.endsWith(".sif") || name.endsWith(".txt");
  const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");

  if (isSif) {
    const text = buffer.toString("utf8");
    const { edrs, scr } = parseSifContent(text);
    const rows = edrs.map((edr) => ({
      staffId: edr.staffId || "",
      empId: edr.empId || "",
      empName: "",
      employerId: scr?.employerId || "",
      agentCode: cleanAgentCode(edr.agentCode),
      bankAccount: String(edr.bankAccount || "").trim(),
      basic: undefined,
      hra: undefined,
      transport: undefined,
      other: undefined,
      deduction: undefined,
      totalSalary: edr.fixedIncome != null ? Number(edr.fixedIncome) : undefined,
    }));
    return {
      fileType: "sif",
      rows,
      scr,
      month: scr?.monthYear ? Number(scr.monthYear.slice(0, 2)) : undefined,
      year: scr?.monthYear ? Number(scr.monthYear.slice(2)) : undefined,
      employerId: scr?.employerId ? digitsOnly(scr.employerId) : undefined,
    };
  }

  if (isExcel) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("Excel file contains no worksheets.");
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!json.length) throw new Error("Excel worksheet has no data rows.");

    const rows = json.map((row) => {
      const mapped = {};
      Object.keys(row).forEach((key) => {
        const norm = normalizeExcelHeader(key);
        const canonical = HEADER_ALIASES[norm] || norm;
        mapped[canonical] = row[key];
      });

      const staffId = String(mapped.StaffID || mapped.STAFFID || mapped.EMPLOYEEID || mapped["Employee ID"] || "").trim();
      const empId = normalizeEmiratesId(mapped.EMPID || mapped.EmiratesId || mapped["Emirates ID"]);
      const empName = String(mapped.EMPNAME || mapped.EmployeeName || mapped["Employee Name"] || "").trim();
      const employerId = digitsOnly(mapped.EMPLOYERID || mapped.EmployerId || mapped["Employer ID"]);
      const agentCode = cleanAgentCode(mapped.AGENTCODE || mapped.AgentCode || mapped.BankSortCode || mapped["Agent Code"]);
      const bankAccount = String(mapped.BANKACCOUNT || mapped.BankAccount || mapped.IBAN || mapped["Bank Account"] || "").trim();

      const parseNum = (val) => (val !== "" && val != null && !Number.isNaN(Number(val)) ? Number(val) : undefined);

      const basic = parseNum(mapped.BASIC || mapped.Basic || mapped.BasicSalary);
      const hra = parseNum(mapped.HRA || mapped.HouseRent);
      const transport = parseNum(mapped.TRANSPOR || mapped.TRANSPORT || mapped.TravelExp);
      const other = parseNum(mapped.OTHERALLOV || mapped.OTHERALLOW || mapped.Other);
      const deduction = parseNum(mapped.DEDUCTIO || mapped.DEDUCTION || mapped.Deduction);
      const totalSalary = parseNum(mapped.TOTA || mapped.TOTAL || mapped.TotalSalary || mapped.NetSalary);

      return {
        staffId,
        empId,
        empName,
        employerId,
        agentCode,
        bankAccount,
        basic,
        hra,
        transport,
        other,
        deduction,
        totalSalary,
      };
    });

    return { fileType: "excel", rows };
  }

  throw new Error("Unsupported file format. Please upload a valid .xlsx, .xls, or .sif file.");
}

/**
 * Build comparison records of existing database employees vs uploaded file rows.
 * Validates matching, salary numbers, agent codes, company assignment.
 */
function buildImportRecords({ rawRows = [], existingEmployees = [], targetEmployerId = "" }) {
  const byStaffId = new Map();
  const byEmiratesId = new Map();
  const byWorkPermit = new Map();

  existingEmployees.forEach((emp) => {
    if (emp.employeeId) {
      byStaffId.set(String(emp.employeeId).trim().toLowerCase(), emp);
    }
    const eid = normalizeEmiratesId(emp.emiratesId);
    if (eid) {
      byEmiratesId.set(eid, emp);
    }
    const wp = String(emp.workPermitNo || "").trim();
    if (wp) {
      byWorkPermit.set(wp, emp);
    }
  });

  const seenIds = new Set();
  const records = [];

  let validCount = 0;
  let warningCount = 0;
  let invalidCount = 0;
  let changedCount = 0;
  let totalSalary = 0;

  rawRows.forEach((row, idx) => {
    const staffIdRaw = String(row.staffId || "").trim();
    const empIdRaw = normalizeEmiratesId(row.empId);

    // Strict matching order: employeeId -> workPermitNo -> emiratesId. Never by name.
    let matchedEmp = null;
    if (staffIdRaw && byStaffId.has(staffIdRaw.toLowerCase())) {
      matchedEmp = byStaffId.get(staffIdRaw.toLowerCase());
    } else if (empIdRaw && byEmiratesId.has(empIdRaw)) {
      matchedEmp = byEmiratesId.get(empIdRaw);
    } else if (staffIdRaw && byWorkPermit.has(staffIdRaw)) {
      matchedEmp = byWorkPermit.get(staffIdRaw);
    }

    const issues = [];
    const changes = [];
    let validationStatus = "Valid";

    if (!matchedEmp) {
      validationStatus = "Invalid";
      issues.push(`No matching employee found in database for ID "${staffIdRaw || empIdRaw || `#${idx + 1}`}"`);
    }

    const resolvedEmpId = matchedEmp ? matchedEmp.employeeId || staffIdRaw : staffIdRaw || empIdRaw || `ROW-${idx + 1}`;

    // Duplicate detection in file
    if (resolvedEmpId && seenIds.has(resolvedEmpId.toLowerCase())) {
      validationStatus = validationStatus === "Invalid" ? "Invalid" : "Warning";
      issues.push(`Duplicate record for Employee ID "${resolvedEmpId}" in uploaded file.`);
    }
    if (resolvedEmpId) seenIds.add(resolvedEmpId.toLowerCase());

    const existingSal = matchedEmp?.salaryDetails || {};
    const existingBasic = Number(existingSal.basicSalary) || 0;
    const existingHra = Number(existingSal.houseRent) || 0;
    const existingTravel = Number(existingSal.travelExp) || 0;
    const existingOther = Number(existingSal.other) || 0;
    const existingDed = Number(existingSal.deduction) || 0;
    const existingTotal = matchedEmp ? getFixedIncome(matchedEmp) : 0;
    const existingAgent = matchedEmp ? getAgentCode(matchedEmp) : "";
    const existingBank = matchedEmp ? getBankAccount(matchedEmp) : "";
    const existingCompCode = matchedEmp?.companyCode || "";
    const existingEmpId = matchedEmp?.sifEmployerId || matchedEmp?.employerId || "";

    // Uploaded values (fall back to existing if omitted in file)
    const uploadedBasic = row.basic != null ? Number(row.basic) : existingBasic;
    const uploadedHra = row.hra != null ? Number(row.hra) : existingHra;
    const uploadedTravel = row.transport != null ? Number(row.transport) : existingTravel;
    const uploadedOther = row.other != null ? Number(row.other) : existingOther;
    const uploadedDed = row.deduction != null ? Number(row.deduction) : existingDed;
    const uploadedTotal = row.totalSalary != null ? Number(row.totalSalary) : (row.basic != null ? (uploadedBasic + uploadedHra + uploadedTravel + uploadedOther - uploadedDed) : existingTotal);
    const uploadedAgent = row.agentCode ? cleanAgentCode(row.agentCode) : existingAgent;
    const uploadedBank = row.bankAccount ? String(row.bankAccount).trim() : existingBank;
    const uploadedEmpId = row.employerId ? digitsOnly(row.employerId) : existingEmpId;

    // Numerical salary validation
    if (Number.isNaN(uploadedTotal) || uploadedTotal < 0) {
      validationStatus = "Invalid";
      issues.push("Total salary cannot be negative or invalid.");
    }
    if (Number.isNaN(uploadedBasic) || uploadedBasic < 0) {
      validationStatus = "Invalid";
      issues.push("Basic salary cannot be negative.");
    }

    // Company & Employer ID check
    if (targetEmployerId && uploadedEmpId && uploadedEmpId !== targetEmployerId) {
      validationStatus = validationStatus === "Invalid" ? "Invalid" : "Warning";
      issues.push(`Assigned Employer ID (${uploadedEmpId}) does not match expected company Employer ID (${targetEmployerId}).`);
    }

    // Agent Code mismatch check: flag for review if uploaded code differs from authoritative saved code
    if (existingAgent && uploadedAgent && existingAgent !== uploadedAgent) {
      validationStatus = validationStatus === "Invalid" ? "Invalid" : "Warning";
      issues.push(`Agent Code mismatch: Uploaded "${uploadedAgent}" differs from saved "${existingAgent}".`);
    }

    // Change tracking
    if (matchedEmp) {
      if (Math.abs(uploadedTotal - existingTotal) > 0.01) {
        changes.push(`Total Salary: AED ${existingTotal.toFixed(2)} -> AED ${uploadedTotal.toFixed(2)}`);
      }
      if (Math.abs(uploadedBasic - existingBasic) > 0.01) {
        changes.push(`Basic Salary: AED ${existingBasic.toFixed(2)} -> AED ${uploadedBasic.toFixed(2)}`);
      }
      if (Math.abs(uploadedHra - existingHra) > 0.01) {
        changes.push(`HRA: AED ${existingHra.toFixed(2)} -> AED ${uploadedHra.toFixed(2)}`);
      }
      if (Math.abs(uploadedDed - existingDed) > 0.01) {
        changes.push(`Deduction: AED ${existingDed.toFixed(2)} -> AED ${uploadedDed.toFixed(2)}`);
      }
      if (uploadedAgent && existingAgent && uploadedAgent !== existingAgent) {
        changes.push(`Agent Code: ${existingAgent} -> ${uploadedAgent}`);
      }
      if (uploadedBank && existingBank && uploadedBank !== existingBank) {
        changes.push(`Bank Account: ${existingBank} -> ${uploadedBank}`);
      }
    }

    const isChanged = changes.length > 0;
    if (isChanged) changedCount++;

    if (validationStatus === "Valid") validCount++;
    else if (validationStatus === "Warning") warningCount++;
    else invalidCount++;

    totalSalary += uploadedTotal > 0 ? uploadedTotal : 0;

    records.push({
      employeeId: resolvedEmpId,
      employeeMongoId: matchedEmp ? matchedEmp._id : null,
      empName: matchedEmp ? matchedEmp.employeeName : row.empName || "Unknown",
      emiratesId: matchedEmp ? matchedEmp.emiratesId : empIdRaw,
      workPermitNo: matchedEmp ? matchedEmp.workPermitNo : staffIdRaw,
      department: matchedEmp?.department || "",
      designation: matchedEmp?.designation || "",
      companyCode: matchedEmp?.companyCode || row.employerId || "",
      employerId: uploadedEmpId || existingEmpId || targetEmployerId || "",

      validationStatus,
      issues,
      changes,
      isChanged,

      existing: {
        basicSalary: existingBasic,
        houseRent: existingHra,
        travelExp: existingTravel,
        other: existingOther,
        deduction: existingDed,
        totalSalary: existingTotal,
        agentCode: existingAgent,
        bankAccount: existingBank,
        companyCode: existingCompCode,
        employerId: existingEmpId,
      },

      uploaded: {
        basicSalary: uploadedBasic,
        houseRent: uploadedHra,
        travelExp: uploadedTravel,
        other: uploadedOther,
        deduction: uploadedDed,
        totalSalary: uploadedTotal,
        agentCode: uploadedAgent,
        bankAccount: uploadedBank,
        companyCode: existingCompCode,
        employerId: uploadedEmpId,
      },
    });
  });

  return {
    records,
    summary: {
      totalRecords: records.length,
      validCount,
      warningCount,
      invalidCount,
      changedCount,
      totalSalary,
    },
  };
}

/**
 * Apply approved records to actual Employee database documents safely.
 * Only applies records with validationStatus !== 'Invalid'.
 * Returns count of applied records and audit details.
 */
async function applyBatchToEmployees(batch, EmployeeModel) {
  if (batch.status === "Approved" || batch.status === "Applied") {
    throw new Error("This import batch has already been approved and applied.");
  }
  if (batch.status === "Rejected") {
    throw new Error("Cannot apply a rejected import batch.");
  }

  const eligibleRecords = (batch.records || []).filter((r) => r.validationStatus !== "Invalid");
  let updatedCount = 0;
  const errors = [];

  for (const record of eligibleRecords) {
    try {
      let emp = null;
      if (record.employeeMongoId) {
        emp = await EmployeeModel.findById(record.employeeMongoId);
      }
      if (!emp && record.employeeId) {
        emp = await EmployeeModel.findOne({ employeeId: record.employeeId });
      }
      if (!emp) {
        errors.push(`Employee not found: ${record.employeeId}`);
        continue;
      }

      if (!emp.salaryDetails) emp.salaryDetails = {};

      const up = record.uploaded;
      if (up.basicSalary != null) emp.salaryDetails.basicSalary = Number(up.basicSalary) || 0;
      if (up.houseRent != null) emp.salaryDetails.houseRent = Number(up.houseRent) || 0;
      if (up.travelExp != null) emp.salaryDetails.travelExp = Number(up.travelExp) || 0;
      if (up.other != null) emp.salaryDetails.other = Number(up.other) || 0;
      if (up.deduction != null) emp.salaryDetails.deduction = Number(up.deduction) || 0;
      if (up.totalSalary != null) emp.salaryDetails.totalSalary = Number(up.totalSalary) || 0;

      if (up.agentCode) {
        const clean = cleanAgentCode(up.agentCode);
        emp.salaryDetails.agentCode = clean;
        emp.salaryDetails.bankSortCode = clean;
      }

      if (up.bankAccount) {
        const bank = String(up.bankAccount).trim();
        if (/^AE/i.test(bank)) {
          emp.salaryDetails.ibanNumber = bank.toUpperCase();
        } else {
          emp.salaryDetails.accountNumber = bank;
          if (!emp.salaryDetails.ibanNumber) emp.salaryDetails.ibanNumber = bank;
        }
      }

      emp.markModified("salaryDetails");
      await emp.save();
      updatedCount++;
    } catch (err) {
      errors.push(`Error updating ${record.employeeId}: ${err.message}`);
    }
  }

  return { updatedCount, errors };
}

module.exports = {
  parseImportFile,
  buildImportRecords,
  applyBatchToEmployees,
};

