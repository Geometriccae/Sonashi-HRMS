/**
 * READ-ONLY: find script-imported leaves that duplicate a kept live record.
 */
require("dns").setDefaultResultOrder("ipv4first");
try {
  require("dns").setServers(["8.8.8.8", "1.1.1.1", "192.168.1.1"]);
} catch (_) {}
const fs = require("fs");
const path = require("path");

const proposed = JSON.parse(fs.readFileSync(path.join(__dirname, "leaveCleanupProposedDelete.json"), "utf8")).records;
const keep = JSON.parse(fs.readFileSync(path.join(__dirname, "leaveCleanupKeep.json"), "utf8")).records;

function ownerKeys(r) {
  const keys = [];
  const id = String(r.employeeId || "").trim().toLowerCase();
  const name = String(r.employeeName || "").trim().toLowerCase();
  if (id) keys.push(`id:${id}`);
  if (name) keys.push(`name:${name}`);
  return keys;
}

function toDay(s) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function overlaps(a, b) {
  const as = toDay(a.startDate);
  const ae = toDay(a.endDate) || as;
  const bs = toDay(b.startDate);
  const be = toDay(b.endDate) || bs;
  if (!as || !ae || !bs || !be) return false;
  return as <= be && bs <= ae;
}

const keepByOwner = new Map();
keep.forEach((r) => {
  ownerKeys(r).forEach((k) => {
    if (!keepByOwner.has(k)) keepByOwner.set(k, []);
    keepByOwner.get(k).push(r);
  });
});

const duplicateOfLive = [];
const noLiveDuplicate = [];

proposed.forEach((r) => {
  const seen = new Set();
  const matches = [];
  ownerKeys(r).forEach((k) => {
    (keepByOwner.get(k) || []).forEach((row) => {
      if (seen.has(row.id)) return;
      if (!overlaps(r, row)) return;
      seen.add(row.id);
      matches.push(row);
    });
  });
  if (matches.length) {
    duplicateOfLive.push({
      imported: r,
      liveMatches: matches.map((k) => ({
        id: k.id,
        employeeName: k.employeeName,
        employeeId: k.employeeId,
        leaveType: k.leaveType,
        startDate: k.startDate,
        endDate: k.endDate,
        reason: k.reason,
        createdBy: k.createdBy,
        clientTouched: k.clientTouched,
      })),
    });
  } else {
    noLiveDuplicate.push(r);
  }
});

const out = {
  proposedDeleteCount: proposed.length,
  keepCount: keep.length,
  scriptImportsThatOverlapLiveKeep: duplicateOfLive.length,
  scriptImportsWithNoLiveOverlap: noLiveDuplicate.length,
  overlapping: duplicateOfLive,
};
fs.writeFileSync(path.join(__dirname, "leaveCleanupLiveOverlaps.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  proposedDeleteCount: proposed.length,
  keepCount: keep.length,
  scriptImportsThatOverlapLiveKeep: duplicateOfLive.length,
  scriptImportsWithNoLiveOverlap: noLiveDuplicate.length,
  overlappingEmployees: [...new Set(duplicateOfLive.map((x) => x.imported.employeeName))],
}, null, 2));
