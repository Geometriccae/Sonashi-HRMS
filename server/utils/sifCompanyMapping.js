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
  const byName = new Map();
  const byCode = new Map();

  documents.forEach((document) => {
    const companyKey = normalizeCompanyName(document?.particulars);
    const companyCode = normalizeEmployerId(document?.docNumber);
    const employerId =
      normalizeEmployerId(document?.employerId) || normalizeEmployerId(document?.docNumber);

    if (!employerId) return;

    if (companyKey) {
      if (!byName.has(companyKey)) byName.set(companyKey, new Set());
      byName.get(companyKey).add(employerId);
    }
    if (companyCode) {
      if (!byCode.has(companyCode)) byCode.set(companyCode, new Set());
      byCode.get(companyCode).add(employerId);
    }
  });

  return {
    byName,
    byCode,
    get(key) {
      return byCode.get(key) || byName.get(key);
    },
    has(key) {
      return byCode.has(key) || byName.has(key);
    },
  };
}

async function loadCompanyEmployerMap() {
  const documents = await CompanyDocument.find({
    $or: [{ recordType: "company" }, { recordType: { $exists: false } }],
  })
    .select("particulars docNumber employerId")
    .lean();
  return buildCompanyEmployerMap(documents);
}

/**
 * Resolve an employee's SIF employer without changing Employee Master data.
 * A single Company Documents mapping is authoritative for the assigned office;
 * otherwise the employee's stored companyCode remains the source. Ambiguous
 * company configuration is never guessed.
 */
function resolveEmployeeCompanyMapping(employee, companyEmployerMap) {
  const employeeCompany = String(employee?.office || "").trim();
  const storedCompanyCode = normalizeEmployerId(employee?.companyCode);

  const byName = companyEmployerMap?.byName || (companyEmployerMap instanceof Map ? companyEmployerMap : null);
  const byCode = companyEmployerMap?.byCode || (companyEmployerMap instanceof Map ? companyEmployerMap : null);

  const nameKey = normalizeCompanyName(employeeCompany);
  const configuredByName = byName && nameKey ? Array.from(byName.get(nameKey) || []) : [];
  const configuredByCode = byCode && storedCompanyCode ? Array.from(byCode.get(storedCompanyCode) || []) : [];

  const configuredCodes = configuredByName.length > 0 ? configuredByName : configuredByCode;
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
      source: configuredByName.length > 0 ? "company-document" : "company-configuration",
      status: issues.length ? "Mismatch" : "Pass",
      configuredCodes,
      issues,
    };
  }

  if (storedCompanyCode && isEmployerId(storedCompanyCode)) {
    return {
      employeeCompany,
      storedCompanyCode,
      employerId: storedCompanyCode,
      source: "employee",
      status: "Pass",
      configuredCodes,
      issues: [],
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
