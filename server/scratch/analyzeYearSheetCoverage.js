require("dns").setDefaultResultOrder("ipv4first");
const ExcelJS = require("../../frontend/node_modules/exceljs");
const {
  parseLeaveMasterWorkbook,
  compactName,
} = require("../utils/excelLeaveWorkbook");

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(
    "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx"
  );
  const parsed = await parseLeaveMasterWorkbook(wb);

  for (const y of Object.keys(parsed.yearSheets).map(Number).sort()) {
    const sheet = parsed.yearSheets[y];
    const withSlots = sheet.rows.filter((r) => r.slots.length).length;
    const totalDays = sheet.rows.reduce((s, r) => s + (r.slotDays || 0), 0);
    console.log(
      y,
      "rows",
      sheet.rows.length,
      "withSlots",
      withSlots,
      "totalDays",
      totalDays,
      "header",
      sheet.headerRow
    );
  }

  const prince = parsed.master.employees.filter((e) => /prince/i.test(e.staffName));
  console.log(
    "PRINCE master",
    prince.map((e) => ({
      id: e.employeeId,
      name: e.staffName,
      y23: e.years?.[2023],
      y24: e.years?.[2024],
      y25: e.years?.[2025],
      y26: e.years?.[2026],
    }))
  );

  let staleMaster = 0;
  let bothAgree = 0;
  let sheetHasMore = 0;
  const samples = [];
  for (const emp of parsed.master.employees) {
    for (const y of [2021, 2022, 2023, 2024, 2025, 2026]) {
      const sheet = parsed.yearSheets[y];
      if (!sheet) continue;
      const rows = sheet.rows.filter(
        (r) =>
          (emp.employeeId &&
            r.employeeId &&
            r.employeeId.toLowerCase() === emp.employeeId.toLowerCase()) ||
          compactName(r.staffName) === compactName(emp.staffName)
      );
      const sv = rows.reduce((s, r) => s + (r.slotDays || 0), 0);
      const mn = emp.years?.[y] == null ? null : Number(emp.years[y]);
      if (mn == null && sv === 0) continue;
      if (mn != null && Math.abs(mn - sv) < 0.01) bothAgree += 1;
      else if (mn != null && sv === 0 && mn > 0) {
        staleMaster += 1;
        if (samples.length < 15) {
          samples.push({ id: emp.employeeId, name: emp.staffName, y, master: mn, sheet: sv });
        }
      } else if ((mn == null || mn === 0) && sv > 0) sheetHasMore += 1;
      else if (mn != null && sv > 0 && Math.abs(mn - sv) >= 0.01) {
        staleMaster += 1;
        if (samples.length < 15) {
          samples.push({ id: emp.employeeId, name: emp.staffName, y, master: mn, sheet: sv });
        }
      }
    }
  }
  console.log({ bothAgree, staleMaster, sheetHasMore, samples });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
