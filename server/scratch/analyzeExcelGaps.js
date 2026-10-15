const ExcelJS = require("../../frontend/node_modules/exceljs");
const slots = require("../../frontend/src/data/masterTrackerLeaveSlots.json");

const SRC =
  process.argv[2] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

function cellText(cell) {
  const v = cell?.value;
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && v.result != null) {
    const r = v.result;
    return r instanceof Date ? r.toISOString().slice(0, 10) : String(r);
  }
  return String(v);
}

(async () => {
  const byYear = {};
  slots.forEach((s) => {
    const y = String(s.start || "").slice(0, 4);
    if (!byYear[y]) byYear[y] = { total: 0, withId: 0, noId: 0 };
    byYear[y].total += 1;
    if (s.employeeId) byYear[y].withId += 1;
    else byYear[y].noId += 1;
  });
  console.log("JSON slots by year", byYear);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);

  ["2026", "2025", "2024", "2023", "2022"].forEach((name) => {
    const ws = wb.getWorksheet(name);
    if (!ws) return;
    const row1 = [];
    const row2 = [];
    for (let c = 1; c <= 8; c += 1) {
      row1.push(cellText(ws.getCell(1, c)).slice(0, 28));
      row2.push(cellText(ws.getCell(2, c)).slice(0, 28));
    }
    console.log(`\n${name} headers:`, row1.join(" | "));
    console.log(`${name} row2:   `, row2.join(" | "));
  });

  const sheet = wb.getWorksheet("Sheet");
  const header = [];
  for (let c = 1; c <= 32; c += 1) header.push(cellText(sheet.getCell(2, c)));
  const yearCols = {};
  header.forEach((h, i) => {
    const y = Number(h);
    if (y >= 2010 && y <= 2026) yearCols[y] = i + 1;
  });
  console.log("\nsummary year cols", yearCols);

  const expected = [];
  for (let r = 3; r <= sheet.rowCount; r += 1) {
    const id = cellText(sheet.getCell(r, 2)).trim();
    const name = cellText(sheet.getCell(r, 3)).trim();
    if (!name) continue;
    const years = {};
    let last5 = 0;
    [2021, 2022, 2023, 2024, 2025, 2026].forEach((y) => {
      const raw = cellText(sheet.getCell(r, yearCols[y])).trim();
      const n = Number(raw);
      const days = Number.isFinite(n) ? n : 0;
      years[y] = days;
      last5 += days;
    });
    expected.push({ id, name: name.slice(0, 40), years, last5: Math.round(last5 * 100) / 100 });
  }
  console.log("\nsummary employees", expected.length);
  console.log("sample last5", expected.slice(0, 8));
  const fs = require("fs");
  const out = require("path").resolve(__dirname, "excelExpectedLast5.json");
  fs.writeFileSync(out, JSON.stringify(expected, null, 2));
  console.log("wrote", out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
