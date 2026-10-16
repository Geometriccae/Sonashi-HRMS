const CompanyDocument = require("../models/CompanyDocument");

const normalizeCompanyName = (value) =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeEmployerId = (value) =>
  String(value || "").replace(/[\s-]+/g, "").toUpperCase();

const isEmployerId = (value) => /^\d{13}$/.test(normalizeEmployerId(value));

/**
 * Company Documents is the existing company-name -> company-code configuration.
 * Keep every distinct code so conflicting documents are reported instead of
 * silently choosing whichever document happened to be edited last.
 */
function buildCompanyEmployerMap(documents = []) {
  const map = new Map();
  documents.forEach((document) => {
    const companyKey = normalizeCompanyName(document?.particulars);
    const employerId = normalizeEmployerId(document?.docNumber);
    if (!companyKey || !employerId) return;
    if (!map.has(companyKey)) map.set(companyKey, new Set());
    map.get(companyKey).add(employerId);
  });
  return map;
}

async function loadCompanyEmployerMap() {
  const documents = await CompanyDocument.find({})
    .select("particulars docNumber")
    .lean();
  return buildCompanyEmployerMap(documents);
}

/**
 * Resolve an employee's SIF employer without changing Employee Master data.
 * A single Company Documents mapping is authoritative for the assigned office;
 * otherwise the employee's stored companyCode remains the source. Ambiguous
 * company configuration is never guessed.
 */
function resolveEmployeeCompanyMapping(employee, companyEmployerMap = new Map()) {
  const employeeCompany = String(employee?.office || "").trim();
  const storedCompanyCode = normalizeEmployerId(employee?.companyCode);
  const configuredCodes = Array.from(
    companyEmployerMap.get(normalizeCompanyName(employeeCompany)) || []
  );
  const validConfigured = configuredCodes.filter(isEmployerId);
  const invalidConfigured = configuredCodes.filter((code) => !isEmployerId(code));
  const issues = [];

  if (validConfigured.length > 1) {
    issues.push(
      `Conflicting Company Documents codes for ${employeeCompany || "unassigned company"}: ${validConfigured.join(", ")}`
    );
    return {
      employeeCompany,
      storedCompanyCode,
      employerId: "",
      source: "conflict",
      status: "Mismatch",
      configuredCodes,
      issues,
    };
  }

  if (invalidConfigured.length) {
    issues.push(
      `Invalid Company Documents code for ${employeeCompany || "unassigned company"}: ${invalidConfigured.join(", ")}`
    );
  }

  if (validConfigured.length === 1) {
    const employerId = validConfigured[0];
    if (storedCompanyCode && storedCompanyCode !== employerId) {
      issues.push(
        `Stored Company Code ${storedCompanyCode} differs from configured Employer ID ${employerId}`
      );
    }
    return {
      employeeCompany,
      storedCompanyCode,
      employerId,
      source: "company-document",
      status: issues.length ? "Mismatch" : "Pass",
      configuredCodes,
      issues,
    };
  }

  if (!storedCompanyCode) issues.push("Missing Company Code / Employer ID");
  else if (!isEmployerId(storedCompanyCode)) {
    issues.push("Stored Company Code is not a 13-digit Employer ID");
  }

  return {
    employeeCompany,
    storedCompanyCode,
    employerId: storedCompanyCode,
    source: "employee",
    status: issues.length ? (storedCompanyCode ? "Mismatch" : "Missing Data") : "Pass",
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
