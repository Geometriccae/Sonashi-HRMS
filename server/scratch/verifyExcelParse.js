const ExcelJS = require("../../frontend/node_modules/exceljs");
const { parseLeaveMasterWorkbook, compactName } = require("../utils/excelLeaveWorkbook");

const SRC =
  process.argv[2] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const parsed = await parseLeaveMasterWorkbook(wb);

  console.log("master employees", parsed.master.employees.length);
  console.log("leave slots", parsed.leaves.length);
  console.log(
    "year sheets",
    Object.keys(parsed.yearSheets)
      .sort()
      .map((y) => `${y}:${parsed.yearSheets[y].rows.length}r/${parsed.yearSheets[y].rows.reduce((s, r) => s + r.slots.length, 0)}slots`)
      .join(" | ")
  );

  const kantesh = parsed.master.employees.find((e) => /kantesh/i.test(e.staffName));
  const kSlots = parsed.leaves.filter(
    (l) => l.employeeId === "IDFO-000" || /kantesh/i.test(l.staffName)
  );
  const byYear = {};
  kSlots.forEach((s) => {
    byYear[s.year] = (byYear[s.year] || 0) + s.days;
  });
  console.log("\nKANTESH master years", kantesh?.years);
  console.log("KANTESH last5", kantesh?.last5Taken, "due", kantesh?.leaveDue, "calc", kantesh?.calculateLeave);
  console.log("KANTESH slot year totals", byYear);
  console.log("KANTESH slots", kSlots);

  const mismatches = [];
  parsed.master.employees.forEach((emp) => {
    const slots = parsed.leaves.filter((l) => {
      if (emp.employeeId && l.employeeId && emp.employeeId.toLowerCase() === l.employeeId.toLowerCase()) return true;
      return false;
    });
    const slotYears = {};
    slots.forEach((s) => {
      slotYears[s.year] = (slotYears[s.year] || 0) + s.days;
    });
    for (let y = 2010; y <= 2026; y += 1) {
      const masterVal = emp.years[y];
      const slotVal = slotYears[y] || 0;
      if (masterVal == null && slotVal === 0) continue;
      if (Number(masterVal || 0) !== Number(slotVal || 0)) {
        mismatches.push({
          id: emp.employeeId,
          name: emp.staffName,
          year: y,
          master: masterVal,
          slots: slotVal,
        });
      }
    }
  });
  console.log("\nmaster vs slot mismatches", mismatches.length);
  console.log(JSON.stringify(mismatches.slice(0, 40), null, 2));

  const y2017 = parsed.yearSheets[2017];
  console.log("\n2017 rows", y2017?.rows?.length, "header", y2017?.headerRow);
  console.log("2017 first 5", y2017?.rows?.slice(0, 5).map((r) => ({ r: r.excelRow, id: r.employeeId, name: r.staffName, slots: r.slots.length, days: r.slotDays })));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
