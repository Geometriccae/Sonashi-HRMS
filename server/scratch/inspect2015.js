const ExcelJS = require("../../frontend/node_modules/exceljs");
const { cellText, cellDate, cellNumber } = require("../utils/excelLeaveWorkbook");
const SRC = "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const ws = wb.getWorksheet("2015");
  for (let r = 1; r <= 6; r += 1) {
    const row = [];
    for (let c = 1; c <= 14; c += 1) {
      const cell = ws.getCell(r, c);
      const d = cellDate(cell);
      const n = cellNumber(cell);
      const t = cellText(cell);
      const f = cell.value?.formula || "";
      row.push(`${c}:${d ? d.toISOString().slice(0,10) : (n ?? t)}${f ? "["+f+"]" : ""}`);
    }
    console.log(r, row.join(" | "));
  }
})();
