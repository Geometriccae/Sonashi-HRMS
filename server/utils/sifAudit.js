const { formatMoney, generateSifContent, parseSifContent } = require("./sifUtils");

const valueKey = (value) => String(value || "").trim().toLowerCase();

function duplicateValues(rows, field) {
  const index = new Map();
  rows.forEach((row) => {
    const key = valueKey(row[field]);
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(row.employeeId);
  });
  return new Map(Array.from(index.entries()).filter(([, ids]) => ids.length > 1));
}

/** Build the complete, read-only employee mapping audit for one payroll period. */
function buildSifAudit(rows = []) {
  const duplicateEmployeeIds = duplicateValues(rows, "employeeId");
  const duplicateLabourCards = duplicateValues(rows, "staffId");
  const records = rows.map((row) => {
    const issues = [...(row.missing || [])];
    const mappingIssues = row.companyMapping?.issues || [];
    issues.push(...mappingIssues);

    const duplicateId = duplicateEmployeeIds.get(valueKey(row.employeeId));
    if (duplicateId) issues.push(`Duplicate Employee ID: ${duplicateId.join(", ")}`);
    const duplicateCard = duplicateLabourCards.get(valueKey(row.staffId));
    if (duplicateCard) issues.push(`Duplicate Labour Card / Person Code: ${duplicateCard.join(", ")}`);

    let validationResult = "Pass";
    if (issues.length) {
      validationResult = row.missing?.length ? "Missing Data" : "Mismatch";
    }
    const edrReady = !row.missing?.length && /^\d{13}$/.test(row.employerId || "");

    return {
      employeeRecordId: row.employeeRecordId,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeCompany: row.employeeCompany,
      employerId: row.employerId,
      companyCode: row.companyCode,
      companyMappingSource: row.companyMapping?.source || "employee",
      agentCode: row.agentCode,
      labourCardPersonCode: row.staffId,
      iban: row.iban,
      payrollMonth: row.payrollMonth,
      salaryStartDate: row.salaryStartDate,
      salaryEndDate: row.salaryEndDate,
      netSalary: row.fixedIncome,
      payableDays: row.daysWorked,
      leaveDays: row.leaveDays,
      salarySlipFound: row.salarySlipFound,
      edrReady,
      validationResult,
      issues: [...new Set(issues)],
    };
  });

  const employerSummary = {};
  records.forEach((record) => {
    const key = record.employerId || "<missing>";
    if (!employerSummary[key]) {
      employerSummary[key] = { eligibleEmployees: 0, edrReady: 0, netSalaryTotal: 0 };
    }
    employerSummary[key].eligibleEmployees += 1;
    if (record.edrReady) {
      employerSummary[key].edrReady += 1;
      employerSummary[key].netSalaryTotal += Number(record.netSalary) || 0;
    }
  });
  Object.values(employerSummary).forEach((summary) => {
    summary.netSalaryTotal = Number(formatMoney(summary.netSalaryTotal));
  });

  const resolvedCompanyMismatches = records.filter(
    (record) =>
      record.companyMappingSource === "company-document" &&
      record.companyCode &&
      record.employerId &&
      record.companyCode !== record.employerId
  ).length;
  const unresolvedCompanyMappings = records.filter(
    (record) => !/^\d{13}$/.test(record.employerId || "")
  ).length;
  const validAgents = records.filter((record) => /^\d{9}$/.test(record.agentCode || "")).length;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      eligibleEmployees: records.length,
      correctCompanyMappings: records.filter(
        (record) => record.companyMappingSource !== "conflict" &&
          /^\d{13}$/.test(record.employerId || "") &&
          record.companyCode === record.employerId
      ).length,
      resolvedCompanyMismatches,
      unresolvedCompanyMappings,
      pass: records.filter((record) => record.validationResult === "Pass").length,
      missingData: records.filter((record) => record.validationResult === "Missing Data").length,
      mismatches: records.filter((record) => record.validationResult === "Mismatch").length,
      agentCode: {
        valid: validAgents,
        missing: records.filter((record) => !record.agentCode).length,
        invalid: records.length - validAgents - records.filter((record) => !record.agentCode).length,
      },
      duplicateEmployeeIds: duplicateEmployeeIds.size,
      duplicateLabourCards: duplicateLabourCards.size,
    },
    employerSummary,
    records,
  };
}

function validateSifExports({ rows, audit, scrRouting, month, year, now = new Date() }) {
  return scrRouting.map((routing) => {
    if (routing.validationResult !== "Pass") {
      return { ...routing, edrScrValidation: "Missing Data" };
    }
    const result = generateSifContent({
      rows,
      employerId: routing.employerId,
      defaultAgentRoutingCode: routing.agentRoutingCode,
      year,
      month,
      now,
    });
    if (result.error) return { ...routing, edrScrValidation: "Failed", error: result.error };
    const { scr } = parseSifContent(result.content);
    const expected = audit.employerSummary[routing.employerId];
    const reconciled = scr?.employerId === routing.employerId &&
      scr?.agentRouting === routing.agentRoutingCode &&
      result.edrCount === expected.edrReady &&
      scr?.edrCount === result.edrCount &&
      result.totalSalary === expected.netSalaryTotal &&
      scr?.totalSalary === result.totalSalary;
    return {
      ...routing,
      edrCount: result.edrCount,
      salaryTotal: result.totalSalary,
      scrEdrCount: scr?.edrCount,
      scrSalaryTotal: scr?.totalSalary,
      edrScrValidation: reconciled ? "Pass" : "Mismatch",
    };
  });
}

module.exports = { buildSifAudit, duplicateValues, validateSifExports };
