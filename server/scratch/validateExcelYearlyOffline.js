/**
 * Offline Excel yearly-sheet validation (no Mongo).
 * Confirms Master cached formulas are NOT used as source of truth.
 *
 * Usage:
 *   node scratch/validateExcelYearlyOffline.js [path-to-xlsx]
 */
const path = require("path");
const ExcelJS = require("../../frontend/node_modules/exceljs");
const {
  parseLeaveMasterWorkbook,
  buildYearlyTakenFromLeaves,
} = require("../utils/excelLeaveWorkbook");

const SRC =
  process.argv[2] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

const EXPECTED = [
  {
    label: "Mahesh Kumar Chintakindi",
    id: "IDMM-169",
    name: /mahesh\s+kumar\s+chintakindi/i,
    years: { 2024: 0, 2025: 0, 2026: 0 },
    masterCachedMustDiffer: { 2026: 55 },
  },
  {
    label: "Nainika Girish",
    id: "IDMO-197",
    name: /nainika\s+girish/i,
    years: { 2024: 0, 2025: 0, 2026: 0 },
  },
  {
    label: "Melvin Thomas",
    name: /^melvin\s+thomas$/i,
    years: { 2026: 60 },
  },
  {
    label: "Prince Kanojia Mani Ram",
    id: "IDMM-151",
    name: /prince/i,
    years: { 2023: 0, 2026: 70 },
  },
  {
    label: "Kantesh",
    id: "IDFO-000",
    name: /kantesh/i,
    years: { 2026: 4 },
  },
  {
    label: "Pawan Jaikishin Kotai",
    id: "IDMO-032",
    name: /pawan/i,
    years: { 2026: 19 },
  },
  {
    label: "Sandeep",
    id: "IDMO-044",
    name: /sandeep\s+pullanchiodan/i,
    years: { 2026: 0 },
  },
  {
    label: "Amal Sid",
    id: "IDMO-133",
    name: /^amal\s+sid$/i,
    years: { 2026: 30 },
  },
];

function findEmp(employees, spec) {
  if (spec.id) {
    const byId = employees.find(
      (e) => String(e.employeeId || "").toLowerCase() === spec.id.toLowerCase()
    );
    if (byId && (!spec.name || spec.name.test(byId.staffName || ""))) return byId;
  }
  if (spec.name) {
    const hits = employees.filter((e) => spec.name.test(String(e.staffName || "")));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      // Prefer exact-ish when multiple (e.g. two Mahesh)
      const exact = hits.find((e) => spec.name.test(e.staffName) && (!spec.id || true));
      return exact || hits[0];
    }
  }
  return null;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const parsed = await parseLeaveMasterWorkbook(wb);

  let failed = 0;
  console.log("File:", SRC);
  console.log("Employees:", parsed.master.employees.length, "Leave slots:", parsed.leaves.length);

  // Spot-check date math: Kantesh 2026 slots should sum to 4 via end-start
  const kanteshLeaves = parsed.leaves.filter(
    (l) =>
      l.year === 2026 &&
      (/kantesh/i.test(l.staffName || "") || String(l.employeeId || "").toUpperCase() === "IDFO-000")
  );
  console.log(
    "\nKantesh 2026 leave slots:",
    kanteshLeaves.map((l) => ({
      name: l.staffName,
      id: l.employeeId,
      start: l.startDate,
      end: l.endDate,
      days: l.excelDays ?? l.days,
    }))
  );

  for (const spec of EXPECTED) {
    const emp = findEmp(parsed.master.employees, spec);
    if (!emp) {
      console.log("FAIL", spec.label, "- employee not found in Master");
      failed += 1;
      continue;
    }
    const yearly =
      emp.yearsFromSheets ||
      buildYearlyTakenFromLeaves(parsed.leaves, emp, parsed.yearList);
    const master = emp.years || {};
    const issues = [];
    for (const [y, expected] of Object.entries(spec.years)) {
      const got = Number(yearly[y] ?? yearly[String(y)] ?? 0);
      if (got !== expected) {
        issues.push(`year ${y}: got ${got}, expected ${expected}`);
      }
    }
    if (spec.masterCachedMustDiffer) {
      for (const [y, stale] of Object.entries(spec.masterCachedMustDiffer)) {
        const cached = Number(master[y] ?? master[String(y)]);
        const sheet = Number(yearly[y] ?? yearly[String(y)] ?? 0);
        if (cached === stale && sheet !== stale) {
          // Good — we deliberately ignore stale cache
        } else if (sheet === stale) {
          issues.push(`year ${y}: sheet total incorrectly equals stale master ${stale}`);
        }
      }
    }
    if (issues.length) {
      failed += 1;
      console.log("FAIL", spec.label, emp.employeeId, issues.join("; "));
      console.log("  yearly", Object.fromEntries(
        Object.keys(spec.years).map((y) => [y, yearly[y] ?? yearly[String(y)]])
      ));
      console.log("  master ", Object.fromEntries(
        Object.keys(spec.years).map((y) => [y, master[y] ?? master[String(y)]])
      ));
    } else {
      console.log(
        "OK  ",
        spec.label,
        emp.employeeId,
        Object.fromEntries(Object.keys(spec.years).map((y) => [y, yearly[y] ?? yearly[String(y)]]))
      );
      if (spec.masterCachedMustDiffer) {
        console.log(
          "     (ignored stale master)",
          Object.fromEntries(
            Object.keys(spec.masterCachedMustDiffer).map((y) => [
              y,
              master[y] ?? master[String(y)],
            ])
          )
        );
      }
    }
  }

  // Full audit: every master employee — sheet total must not silently use master when sheets say 0 and master says >0 for same year
  let staleIgnored = 0;
  let sheetMasterDiff = 0;
  for (const emp of parsed.master.employees) {
    const yearly = emp.yearsFromSheets || {};
    for (const y of Object.keys(yearly)) {
      const sheet = Number(yearly[y] || 0);
      const cached = emp.years?.[y] ?? emp.years?.[Number(y)];
      if (cached == null || cached === "") continue;
      const masterVal = Number(cached);
      if (!Number.isFinite(masterVal)) continue;
      if (sheet !== masterVal) {
        sheetMasterDiff += 1;
        if (sheet === 0 && masterVal > 0) staleIgnored += 1;
      }
    }
  }
  console.log("\n--- Full workbook ---");
  console.log("Years where Master cache ≠ yearly-sheet total:", sheetMasterDiff);
  console.log("Of those, Master>0 but sheet=0 (stale zeros fixed):", staleIgnored);

  if (failed) {
    console.error(`\n${failed} regression case(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll regression cases PASSED");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
