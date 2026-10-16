/**
 * Read-only full-population SIF audit.
 * Usage: node scripts/auditSifMappings.js <month 1-12> <year>
 * Writes JSON and CSV reports to server/scratch without updating any record.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const CompanySifSettings = require("../models/CompanySifSettings");
const { loadSalaryReportRows } = require("../utils/sifSalaryReportRows");
const { buildSifAudit, validateSifExports } = require("../utils/sifAudit");
const { generateSifContent } = require("../utils/sifUtils");

const month = Number(process.argv[2]);
const year = Number(process.argv[3]);
if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
  console.error("Usage: node scripts/auditSifMappings.js <month 1-12> <year>");
  process.exit(1);
}

const csvCell = (value) => {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const [rows, settings] = await Promise.all([
    loadSalaryReportRows({ month, year }),
    CompanySifSettings.findOne({ key: "default" }).lean(),
  ]);
  const audit = buildSifAudit(rows);
  const routes = new Map();
  (settings?.employerRoutingCodes || []).forEach((entry) => {
    if (/^\d{13}$/.test(entry.employerId || "") && /^\d{9}$/.test(entry.agentRoutingCode || "")) {
      routes.set(entry.employerId, entry.agentRoutingCode);
    }
  });
  if (/^\d{13}$/.test(settings?.employerId || "") && /^\d{9}$/.test(settings?.defaultAgentRoutingCode || "")) {
    if (!routes.has(settings.employerId)) routes.set(settings.employerId, settings.defaultAgentRoutingCode);
  }
  const scrRouting = [...new Set(rows.map((row) => row.employerId).filter((id) => /^\d{13}$/.test(id)))]
    .map((employerId) => ({
      employerId,
      agentRoutingCode: routes.get(employerId) || "",
      validationResult: routes.has(employerId) ? "Pass" : "Missing Data",
    }));
  audit.summary.scrRoutingConfigured = scrRouting.filter((entry) => entry.validationResult === "Pass").length;
  audit.summary.scrRoutingMissing = scrRouting.filter((entry) => entry.validationResult !== "Pass").length;
  const exportValidation = validateSifExports({ rows, audit, scrRouting, month, year });
  audit.summary.edrScrValidationPass = exportValidation.filter((entry) => entry.edrScrValidation === "Pass").length;
  audit.summary.edrScrValidationUnresolved = exportValidation.filter((entry) => entry.edrScrValidation !== "Pass").length;
  const base = path.resolve(__dirname, `../scratch/sif-mapping-audit-${year}-${String(month).padStart(2, "0")}`);
  const columns = [
    "employeeId", "employeeName", "employeeCompany", "employerId", "companyCode",
    "companyMappingSource", "agentCode", "labourCardPersonCode", "iban", "payrollMonth",
    "salaryStartDate", "salaryEndDate", "netSalary", "payableDays", "leaveDays",
    "salarySlipFound", "edrReady", "validationResult", "issues",
  ];
  const csv = [
    columns.map(csvCell).join(","),
    ...audit.records.map((record) => columns.map((column) => csvCell(record[column])).join(",")),
  ].join("\r\n") + "\r\n";

  const generatedSifFiles = [];
  scrRouting.filter((routing) => routing.validationResult === "Pass").forEach((routing) => {
    const result = generateSifContent({
      rows,
      employerId: routing.employerId,
      defaultAgentRoutingCode: routing.agentRoutingCode,
      year,
      month,
      now: new Date(),
    });
    if (!result.error) {
      const filePath = path.resolve(__dirname, `../scratch/${result.fileName}`);
      fs.writeFileSync(filePath, result.content);
      generatedSifFiles.push(filePath);
    }
  });
  fs.writeFileSync(`${base}.json`, JSON.stringify({
    month, year, ...audit, scrRouting, exportValidation, generatedSifFiles,
  }, null, 2));
  fs.writeFileSync(`${base}.csv`, csv);
  console.log(JSON.stringify(audit.summary, null, 2));
  console.log(`JSON: ${base}.json`);
  console.log(`CSV:  ${base}.csv`);
  generatedSifFiles.forEach((filePath) => console.log(`SIF:  ${filePath}`));
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
