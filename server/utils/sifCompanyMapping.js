const CompanyDocument = require("../models/CompanyDocument");

const normalizeCompanyName = (value) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeEmployerId = (value) =>
  String(value || "").replace(/[\s-]+/g, "").toUpperCase();

const isEmployerId = (value) => /^\d{13}$/.test(normalizeEmployerId(value));

/**
 * Company Documents is the existing company-name -> company-code configuration.
 * Keep every distinct company code so conflicting documents are reported instead of
 * silently choosing whichever document happened to be edited last.
 */
function buildCompanyEmployerMap(documents = []) {
  const map = new Map();
  documents.forEach((document) => {
    const companyCode = normalizeEmployerId(document?.docNumber);
    const employerId = normalizeEmployerId(document?.employerId);
    if (!companyCode) return;
    if (!map.has(companyCode)) map.set(companyCode, new Set());
    if (employerId) map.get(companyCode).add(employerId);
  });
  return map;
}

async function loadCompanyEmployerMap() {
  const documents = await CompanyDocument.find({ recordType: "company" })
    .select("particulars docNumber employerId")
    .lean();
  return buildCompanyEmployerMap(documents);
}

/**
 * Resolve an employee's SIF employer without changing Employee Master data.
 * Employee.companyCode is authoritative. Company Codes are normalized to the
 * 13-digit Employer ID format only for SIF output; the stored assignment is not
 * changed and an empty assignment remains empty.
 */
function resolveEmployeeCompanyMapping(employee, companyEmployerMap = new Map()) {
  const employeeCompany = String(employee?.office || "").trim();
  const storedCompanyCode = normalizeEmployerId(employee?.companyCode);
  const configuredCodes = Array.from(
    companyEmployerMap.get(storedCompanyCode) || []
  );
  const issues = [];

  if (storedCompanyCode) {
    if (configuredCodes.length !== 1) {
      issues.push(
        configuredCodes.length > 1
          ? `Conflicting Employer IDs configured for Company Code ${storedCompanyCode}`
          : `Missing SIF Employer ID configuration for Company Code ${storedCompanyCode}`
      );
    }
    const employerId = configuredCodes.length === 1 ? configuredCodes[0] : "";
    return {
      employeeCompany,
      storedCompanyCode,
      employerId,
      source: employerId ? "company-configuration" : "missing",
      status: isEmployerId(employerId) ? "Pass" : "Missing Data",
      configuredCodes,
      issues,
    };
  }

  issues.push("Missing Company Code / Employer ID");

  return {
    employeeCompany,
    storedCompanyCode,
    employerId: "",
    source: "missing",
    status: "Missing Data",
    configuredCodes,
    issues,
  };
}

function applyCompanyEmployerMapping(employee, companyEmployerMap) {
  const mapping = resolveEmployeeCompanyMapping(employee, companyEmployerMap);
  return {
    ...employee,
    sifEmployerId: mapping.employerId,
    sifCompanyMapping: mapping,
  };
}

module.exports = {
  normalizeCompanyName,
  normalizeEmployerId,
  isEmployerId,
  buildCompanyEmployerMap,
  loadCompanyEmployerMap,
  resolveEmployeeCompanyMapping,
  applyCompanyEmployerMapping,
};
