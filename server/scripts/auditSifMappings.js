/**
 * Read-only SIF Employer ID / Company Code / Agent Code audit for all eligible employees.
 * Usage: node scripts/auditSifMappings.js
 * Optional: node scripts/auditSifMappings.js --out=./sif-audit-report.json
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const CompanySifSettings = require("../models/CompanySifSettings");
const { workingStatusFilter } = require("../utils/employeeStatus");
const {
  loadCompanyEmployerMap,
  applyCompanyEmployerMapping,
} = require("../utils/sifCompanyMapping");
const {
  digitsOnly,
  validateAgentCode,
  getBankAccount,
  getFixedIncome,
} = require("../utils/sifUtils");

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const settings =
    (await CompanySifSettings.findOne({ key: "default" }).lean()) || {};
  const settingsEmployerId = digitsOnly(settings.employerId);
  const [raw, companyEmployerMap] = await Promise.all([
    Employee.find(workingStatusFilter()).lean(),
    loadCompanyEmployerMap(),
  ]);
  const employees = raw.map((employee) =>
    applyCompanyEmployerMapping(employee, companyEmployerMap)
  );

  const byEmployer = {};
  const rows = [];
  let agentOk = 0;
  let agentMissing = 0;
  let agentInvalid = 0;

  for (const emp of employees) {
    const employerId = emp.sifEmployerId || "";
    const agentRaw = digitsOnly(emp.salaryDetails?.bankSortCode);
    const agentErr = agentRaw ? validateAgentCode(agentRaw) : "AGENTCODE missing";
    const bank = getBankAccount(emp) || "";
    const empid = digitsOnly(emp.workPermitNo);

    const issues = [];
    if (!employerId) {
      issues.push(...(emp.sifCompanyMapping?.issues || ["Missing Employer ID / company code"]));
    }
    else if (employerId.length !== 13) {
      issues.push(`Employer ID length ${employerId.length} (expected 13)`);
    }
    if (!empid || empid.length < 14 || empid.length > 15) {
      issues.push("Missing/invalid Labour Card / Person Code");
    }
    if (!bank) issues.push("Missing IBAN / bank account");
    if (agentErr) issues.push(agentErr);
    if (settingsEmployerId && employerId && settingsEmployerId !== employerId) {
      issues.push(
        `Assigned to ${employerId} (settings default ${settingsEmployerId})`
      );
    }

    const hardMissing =
      !employerId ||
      !empid ||
      empid.length < 14 ||
      empid.length > 15 ||
      !bank;
    const hardMismatch = Boolean(employerId && employerId.length !== 13);
    let validation = "Pass";
    if (hardMissing) validation = "Missing Data";
    else if (hardMismatch) validation = "Mismatch";

    if (!agentRaw) agentMissing += 1;
    else if (agentErr) agentInvalid += 1;
    else agentOk += 1;

    const key = employerId || "(empty)";
    byEmployer[key] = (byEmployer[key] || 0) + 1;

    rows.push({
      employeeId: emp.employeeId || "",
      employeeName: emp.employeeName || "",
      office: emp.office || "",
      companyCode: emp.companyCode || "",
      employerId,
      expectedEmployerId: employerId,
      employerMappingStatus: emp.sifCompanyMapping?.status || "Missing Data",
      employerMappingSource: emp.sifCompanyMapping?.source || "missing",
      agentCode: agentRaw,
      labourCard: emp.labourCardNumber || "",
      emiratesId: empid,
      iban: bank,
      salary: getFixedIncome(emp),
      validation,
      issues,
      agentIssue: Boolean(agentErr),
    });
  }

  const pass = rows.filter((r) => r.validation === "Pass").length;
  const missingData = rows.filter((r) => r.validation === "Missing Data").length;
  const mismatch = rows.filter((r) => r.validation === "Mismatch").length;
  const unresolved = rows.filter((r) => r.validation !== "Pass" || r.agentIssue);

  const report = {
    auditedAt: new Date().toISOString(),
    totalEligible: employees.length,
    sifSettings: {
      employerId: settings.employerId || "",
      defaultAgentRoutingCode: settings.defaultAgentRoutingCode || "",
    },
    summary: {
      pass,
      missingData,
      mismatch,
      correctEmployerId: rows.filter((r) => r.employerMappingStatus === "Pass").length,
      missingEmployerId: rows.filter((r) => !r.employerId).length,
      conflictingEmployerConfiguration: rows.filter((r) =>
        r.issues.some((issue) => issue.includes("Conflicting Employer IDs"))
      ).length,
      unresolvedForReview: unresolved.length,
    },
    agentCode: { ok9Digits: agentOk, missing: agentMissing, invalidLength: agentInvalid },
    byEmployerId: byEmployer,
    unresolved: unresolved.map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      employerId: r.employerId,
      expectedEmployerId: r.expectedEmployerId,
      assignedCompany: r.office,
      companyCode: r.companyCode,
      agentCode: r.agentCode,
      validation: r.validation,
      issues: r.issues,
    })),
    employees: rows,
  };

  console.log(JSON.stringify({
    totalEligible: report.totalEligible,
    summary: report.summary,
    agentCode: report.agentCode,
    byEmployerId: report.byEmployerId,
    sifSettings: report.sifSettings,
    unresolvedSample: report.unresolved.slice(0, 20),
  }, null, 2));

  const outArg = process.argv.find((a) => a.startsWith("--out="));
  if (outArg) {
    const outPath = path.resolve(outArg.slice(6));
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Full report written to ${outPath}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
