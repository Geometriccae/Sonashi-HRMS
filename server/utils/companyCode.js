/**
 * Shared Company Code / Employer ID helpers.
 * Authoritative sources:
 *  - Employee.companyCode (per-employee assignment)
 *  - Company Documents (particulars → docNumber) when companyCode is empty
 */

const CompanyDocument = require("../models/CompanyDocument");

const DEFAULT_COMPANY_CODE = "0000000172509";
const COMPANY_CODE_TTL_MS = 60000;

let _companyCodeCache = { map: null, ts: 0 };

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

/** Normalize to 13-digit MOL Employer ID / Company Code. */
function normalizeCompanyCode(value) {
  const d = digitsOnly(value);
  if (!d) return "";
  return d.padStart(13, "0").slice(-13);
}

async function getCompanyCodeMap() {
  try {
    if (_companyCodeCache.map && Date.now() - _companyCodeCache.ts < COMPANY_CODE_TTL_MS) {
      return _companyCodeCache.map;
    }
    const docs = await CompanyDocument.find({})
      .select("particulars docNumber updatedAt createdAt")
      .lean();
    const map = {};
    const sorted = [...docs].sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return ta - tb;
    });
    for (const d of sorted) {
      const key = String(d.particulars || "").trim().toLowerCase();
      const code = String(d.docNumber || "").trim();
      if (key && code) map[key] = code;
    }
    _companyCodeCache = { map, ts: Date.now() };
    return map;
  } catch (err) {
    console.error("Failed to load company codes from Company Documents:", err.message);
    return {};
  }
}

/**
 * Live Company Code from Company Documents (by employee.office / company name).
 * Preserve stored company codes. Empty → built-in default.
 * Does not write to the database.
 */
function applyLiveCompanyCodes(employees, codeMap) {
  if (!Array.isArray(employees)) return employees;
  return employees.map((e) => {
    const stored = String(e.companyCode || "").trim();
    if (stored) return e;
    const key = String(e.office || "").trim().toLowerCase();
    const live = key && codeMap ? codeMap[key] : "";
    if (live) return { ...e, companyCode: live };
    return { ...e, companyCode: DEFAULT_COMPANY_CODE };
  });
}

/**
 * Resolve the Employer ID that should apply to one employee for SIF export.
 * Prefer stored/live companyCode; never invent a new code beyond the documented fallbacks.
 */
function resolveEmployeeEmployerId(emp) {
  return normalizeCompanyCode(emp?.companyCode);
}

/**
 * WPS: each SIF file is for one employer only.
 * Match employees whose companyCode equals the selected Employer ID.
 */
function filterEmployeesForEmployer(employees, employerId) {
  const target = normalizeCompanyCode(employerId);
  const matched = [];
  const excluded = [];

  (employees || []).forEach((emp) => {
    const empEmployer = resolveEmployeeEmployerId(emp);
    if (target && empEmployer && empEmployer === target) {
      matched.push(emp);
      return;
    }
    excluded.push({
      staffId: emp.employeeId || "",
      empName: emp.employeeName || "",
      companyCode: emp.companyCode || "",
      employerId: empEmployer || "",
      reason: !empEmployer
        ? "Missing company code / Employer ID"
        : !target
          ? "No Employer ID selected"
          : `Company code ${empEmployer} does not match selected Employer ID ${target}`,
    });
  });

  return { matched, excluded, targetEmployerId: target };
}

function invalidateCompanyCodeCache() {
  _companyCodeCache = { map: null, ts: 0 };
}

module.exports = {
  DEFAULT_COMPANY_CODE,
  digitsOnly,
  normalizeCompanyCode,
  getCompanyCodeMap,
  applyLiveCompanyCodes,
  resolveEmployeeEmployerId,
  filterEmployeesForEmployer,
  invalidateCompanyCodeCache,
};
