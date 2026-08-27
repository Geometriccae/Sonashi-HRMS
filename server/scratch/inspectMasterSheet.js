const ExcelJS = require("../../frontend/node_modules/exceljs");
const SRC = process.argv[2] || "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  console.log("sheets", wb.worksheets.map((w) => `${w.name}[${w.rowCount}x${w.columnCount}]`).join(" | "));
  const ws = wb.worksheets[0];
  console.log("\n===", ws.name, "===");
  for (let r = 1; r <= 6; r += 1) {
    const row = [];
    for (let c = 1; c <= 12; c += 1) {
      const v = ws.getCell(r, c).value;
      const t = v instanceof Date ? v.toISOString().slice(0, 10) : (v && v.result) || v;
      row.push(String(t ?? "").slice(0, 40));
    }
    console.log(r, row.join(" | "));
  }
  const y2026 = wb.getWorksheet("2026");
  if (y2026) {
    console.log("\n=== 2026 row1-3 col1-8 ===");
    for (let r = 1; r <= 3; r += 1) {
      const row = [];
      for (let c = 1; c <= 8; c += 1) {
        const v = y2026.getCell(r, c).value;
        const t = v instanceof Date ? v.toISOString().slice(0, 10) : (v && v.result) || v;
        row.push(String(t ?? "").slice(0, 36));
      }
      console.log(r, row.join(" | "));
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
