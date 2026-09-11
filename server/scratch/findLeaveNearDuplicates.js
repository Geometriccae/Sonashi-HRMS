/**
 * READ-ONLY: exact/near-exact duplicates (same employee + same/near start + same/near end).
 */
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

function dayDiff(a, b) {
  const x = toDay(a);
  const y = toDay(b);
  if (!x || !y) return 999;
  return Math.abs(Math.round((x - y) / 86400000));
}

const keepByOwner = new Map();
keep.forEach((r) => {
  ownerKeys(r).forEach((k) => {
    if (!keepByOwner.has(k)) keepByOwner.set(k, []);
    keepByOwner.get(k).push(r);
  });
});

const near = [];
proposed.forEach((r) => {
  const seen = new Set();
  const matches = [];
  ownerKeys(r).forEach((k) => {
    (keepByOwner.get(k) || []).forEach((row) => {
      if (seen.has(row.id)) return;
      const startDiff = dayDiff(r.startDate, row.startDate);
      const endDiff = dayDiff(r.endDate, row.endDate);
      if (startDiff <= 1 && endDiff <= 1) {
        seen.add(row.id);
        matches.push({ live: row, startDiff, endDiff });
      }
    });
  });
  if (matches.length) near.push({ imported: r, matches });
});

fs.writeFileSync(path.join(__dirname, "leaveCleanupNearDuplicates.json"), JSON.stringify({
  count: near.length,
  records: near,
}, null, 2));
console.log(JSON.stringify({
  nearDuplicateCount: near.length,
  rows: near.map((x) => ({
    importedId: x.imported.id,
    employee: x.imported.employeeName,
    imported: `${x.imported.startDate}..${x.imported.endDate} (${x.imported.reason})`,
    live: x.matches.map((m) => `${m.live.id} ${m.live.startDate}..${m.live.endDate} (${m.live.reason}) createdBy=${m.live.createdBy} startDiff=${m.startDiff} endDiff=${m.endDiff}`),
  })),
}, null, 2));
