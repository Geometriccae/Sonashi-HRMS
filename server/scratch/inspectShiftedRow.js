const ExcelJS = require("../../frontend/node_modules/exceljs");
const SRC = "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const y2024 = wb.getWorksheet("2024");
  const r = 203;
  for (let c = 1; c <= 16; c += 1) {
    const v = y2024.getCell(r, c).value;
    const t = v instanceof Date ? v.toISOString().slice(0, 10) : v;
    console.log(c, t);
  }
})();
