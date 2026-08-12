/**
 * Resolve Company Code from Company Documents.
 * Company name is matched to document `particulars`; code comes from `docNumber`.
 */

import {
  DEFAULT_COMPANY_CODE,
  DEFAULT_COMPANY_NAME,
  LEGACY_COMPANY_CODE,
  LEGACY_COMPANY_NAME,
} from "../constants/employeeDropdownOptions";

export function resolveCompanyCodeFromDocuments(companyName, documents = []) {
  const key = String(companyName || "").trim().toLowerCase();
  if (!key) return "";

  const matches = (documents || []).filter(
    (d) => String(d.particulars || "").trim().toLowerCase() === key
  );
  if (matches.length === 0) {
    if (key === DEFAULT_COMPANY_NAME.toLowerCase()) return DEFAULT_COMPANY_CODE;
    if (key === LEGACY_COMPANY_NAME.toLowerCase()) return LEGACY_COMPANY_CODE;
    return "";
  }

  // Prefer a document that has a docNumber; use the latest by updatedAt/createdAt when possible
  const withCode = matches
    .filter((d) => String(d.docNumber || "").trim())
    .sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });

  if (withCode.length > 0) return String(withCode[0].docNumber).trim();
  if (key === DEFAULT_COMPANY_NAME.toLowerCase()) return DEFAULT_COMPANY_CODE;
  if (key === LEGACY_COMPANY_NAME.toLowerCase()) return LEGACY_COMPANY_CODE;
  return "";
}

/** Dropdown options: company = particulars, companyCode = docNumber */
export function buildCompanyOptionsFromDocuments(documents = [], currentCompany = "") {
  const byName = new Map();

  // Always include built-in default company first so it is selectable
  byName.set(DEFAULT_COMPANY_NAME.toLowerCase(), {
    name: DEFAULT_COMPANY_NAME,
    code: DEFAULT_COMPANY_CODE,
  });
  byName.set(LEGACY_COMPANY_NAME.toLowerCase(), {
    name: LEGACY_COMPANY_NAME,
    code: LEGACY_COMPANY_CODE,
  });

  (documents || []).forEach((d) => {
    const name = String(d.particulars || "").trim();
    if (!name) return;
    const code = String(d.docNumber || "").trim();
    const key = name.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, { name, code });
      return;
    }
    // Keep a code if we find one later (do not wipe default code unless doc has one)
    if (code) {
      byName.set(key, { name: prev.name || name, code });
    }
  });

  const current = String(currentCompany || "").trim();
  if (current && !byName.has(current.toLowerCase())) {
    byName.set(current.toLowerCase(), { name: current, code: "" });
  }

  return Array.from(byName.values())
    .sort((a, b) => {
      // Keep default company near top, then alphabetical
      if (a.name === DEFAULT_COMPANY_NAME) return -1;
      if (b.name === DEFAULT_COMPANY_NAME) return 1;
      return a.name.localeCompare(b.name);
    })
    .map(({ name, code }) => ({
      value: name,
      label: code ? `${name} (${code})` : name,
      companyCode: code,
    }));
}
