/**
 * Resolve Company Code from Company Documents.
 * Company name is matched to document `particulars`; code comes from `docNumber`.
 */

export function resolveCompanyCodeFromDocuments(companyName, documents = []) {
  const key = String(companyName || "").trim().toLowerCase();
  if (!key) return "";

  const matches = (documents || []).filter(
    (d) => String(d.particulars || "").trim().toLowerCase() === key
  );
  if (matches.length === 0) {
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
  return "";
}

/** Dropdown options: company = particulars, companyCode = docNumber */
export function buildCompanyOptionsFromDocuments(documents = []) {
  const byCode = new Map();

  (documents || []).forEach((d) => {
    const name = String(d.particulars || "").trim();
    const code = String(d.docNumber || "").trim();
    if (!name || !code) return;
    if (!byCode.has(code)) byCode.set(code, { name, code, document: d });
  });

  return Array.from(byCode.values())
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
    })
    .map(({ name, code, document }) => ({
      value: name,
      label: code ? `${name} (${code})` : name,
      companyCode: code,
      employerId: document.employerId || "",
      companyId: document._id,
    }));
}
