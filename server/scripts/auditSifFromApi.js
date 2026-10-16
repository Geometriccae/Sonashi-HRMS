/**
 * Read-only SIF mapping audit via the running API (no schema/data writes).
 *
 * Usage:
 *   SIF_AUDIT_BASE=https://backend.sonashi.in/api \
 *   SIF_AUDIT_USER=... SIF_AUDIT_PASS=... \
 *   node scripts/auditSifFromApi.js
 */
const {
  applyLiveCompanyCodes,
  resolveEmployeeEmployerId,
  normalizeCompanyCode,
} = require("../utils/companyCode");
const {
  digitsOnly,
  normalizeEmiratesId,
  validateAgentCode,
  getBankAccount,
  getFixedIncome,
} = require("../utils/sifUtils");
const { isWorkingEmployeeStatus } = require("../utils/employeeStatus");

const BASE = (process.env.SIF_AUDIT_BASE || "http://localhost:5000/api").replace(/\/$/, "");
const USER = process.env.SIF_AUDIT_USER;
const PASS = process.env.SIF_AUDIT_PASS;

async function postJson(url, body, token) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `${res.status} ${url}`);
  return data;
}

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `${res.status} ${url}`);
  return data;
}

function docMap(documents) {
  const map = {};
  const list = Array.isArray(documents) ? documents : documents?.documents || documents?.data || [];
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return ta - tb;
  });
  for (const d of sorted) {
    const key = String(d.particulars || "").trim().toLowerCase();
    const code = String(d.docNumber || "").trim();
    if (key && code) map[key] = code;
  }
  return map;
}

async function main() {
  if (!USER || !PASS) {
    console.error("Set SIF_AUDIT_USER and SIF_AUDIT_PASS");
    process.exit(1);
  }

  const login = await postJson(`${BASE}/auth/login`, { username: USER, password: PASS });
  const token = login.token;
  if (!token) throw new Error("Login succeeded but no token returned");

  const [employeesRaw, settings, documents] = await Promise.all([
    getJson(`${BASE}/employees`, token),
    getJson(`${BASE}/sif/settings`, token),
    getJson(`${BASE}/company-documents`, token).catch(() => []),
  ]);

  const empList = Array.isArray(employeesRaw)
    ? employeesRaw
    : employeesRaw.employees || employeesRaw.data || [];
  const employees = applyLiveCompanyCodes(empList, docMap(documents));
  const settingsEmployerId = normalizeCompanyCode(settings.employerId);

  const byEmployer = {};
  const officeByEmployer = {};
  let agentOk = 0;
  let agentMissing = 0;
  let agentInvalid = 0;
  const rows = [];

  for (const emp of employees) {
    const employerId = resolveEmployeeEmployerId(emp);
    const agentRaw = digitsOnly(emp.salaryDetails?.bankSortCode);
    const agentErr = agentRaw ? validateAgentCode(agentRaw) : "AGENTCODE missing";
    const bank = getBankAccount(emp) || "";
    const empid = normalizeEmiratesId(emp.emiratesId);
    const issues = [];
    if (!employerId) issues.push("Missing Employer ID / company code");
    else if (employerId.length !== 13) {
      issues.push(`Employer ID length ${employerId.length} (expected 13)`);
    }
    if (!empid || empid.length < 14 || empid.length > 15) {
      issues.push("Missing/invalid Emirates ID");
    }
    if (!bank) issues.push("Missing IBAN / bank account");
    if (agentErr) issues.push(agentErr);

    const hardMissing =
      !employerId || !empid || empid.length < 14 || empid.length > 15 || !bank;
    const hardMismatch = Boolean(employerId && employerId.length !== 13);
    let validation = "Pass";
    if (hardMissing) validation = "Missing Data";
    else if (hardMismatch) validation = "Mismatch";

    if (!agentRaw) agentMissing += 1;
    else if (agentErr) agentInvalid += 1;
    else agentOk += 1;

    const key = employerId || "(empty)";
    byEmployer[key] = (byEmployer[key] || 0) + 1;
    const office = String(emp.office || "").trim() || "(none)";
    if (!officeByEmployer[key]) officeByEmployer[key] = {};
    officeByEmployer[key][office] = (officeByEmployer[key][office] || 0) + 1;

    rows.push({
      employeeId: emp.employeeId || "",
      employeeName: emp.employeeName || "",
      sifEligible: isWorkingEmployeeStatus(emp.employeeStatus),
      employeeStatus: emp.employeeStatus || "",
      office,
      companyCode: emp.companyCode || "",
      employerId,
      agentCode: agentRaw ? `${agentRaw.slice(0, 2)}*******` : "",
      agentLen: agentRaw.length,
      hasIban: Boolean(bank),
      hasEmiratesId: Boolean(empid),
      labourCard: emp.labourCardNumber ? "present" : "",
      salary: getFixedIncome(emp),
      validation,
      issues,
      agentIssue: Boolean(agentErr),
    });
  }

  const eligible = rows.filter((r) => r.sifEligible);
  const pass = eligible.filter((r) => r.validation === "Pass").length;
  const missingData = eligible.filter((r) => r.validation === "Missing Data").length;
  const mismatch = eligible.filter((r) => r.validation === "Mismatch").length;
  const unresolved = eligible.filter((r) => r.validation !== "Pass" || r.agentIssue);
  const eligibleAgentOk = eligible.filter((r) => !r.agentIssue && r.agentLen === 9).length;
  const eligibleAgentMissing = eligible.filter((r) => r.agentLen === 0).length;
  const eligibleAgentInvalid = eligible.filter((r) => r.agentLen > 0 && r.agentIssue).length;
  const byEmployerEligible = {};
  eligible.forEach((r) => {
    const k = r.employerId || "(empty)";
    byEmployerEligible[k] = (byEmployerEligible[k] || 0) + 1;
  });

  const like24687 = rows.filter((r) => String(r.employerId || r.companyCode).includes("24687"));

  console.log(JSON.stringify({
    source: BASE,
    auditedAt: new Date().toISOString(),
    totalFetched: empList.length,
    totalEligibleWorking: eligible.length,
    inactiveExcludedFromSif: empList.length - eligible.length,
    sifSettings: {
      employerId: settings.employerId || "",
      defaultAgentRoutingCode: settings.defaultAgentRoutingCode
        ? `${String(settings.defaultAgentRoutingCode).slice(0, 2)}*******`
        : "",
      defaultAgentLen: digitsOnly(settings.defaultAgentRoutingCode).length,
    },
    summary: { pass, missingData, mismatch, unresolvedForReview: unresolved.length },
    agentCodeAll: { ok9Digits: agentOk, missing: agentMissing, invalidLength: agentInvalid },
    agentCodeEligible: {
      ok9Digits: eligibleAgentOk,
      missing: eligibleAgentMissing,
      invalidLength: eligibleAgentInvalid,
    },
    byEmployerIdAll: byEmployer,
    byEmployerIdEligible: byEmployerEligible,
    officeByEmployer,
    codesLike24687Count: like24687.length,
    codesLike24687: like24687.slice(0, 15).map((r) => ({
      employeeId: r.employeeId,
      office: r.office,
      employerId: r.employerId,
      companyCode: r.companyCode,
    })),
    unresolvedSample: unresolved.slice(0, 25).map((r) => ({
      employeeId: r.employeeId,
      employerId: r.employerId,
      validation: r.validation,
      issues: r.issues,
      agentLen: r.agentLen,
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
