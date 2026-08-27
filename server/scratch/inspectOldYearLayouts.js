const ExcelJS = require("../../frontend/node_modules/exceljs");
const { cellText, cellDate, cellNumber, isYellowFill } = require("../utils/excelLeaveWorkbook");

const SRC =
  process.argv[2] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

function dumpRow(ws, r, maxC = 16) {
  const out = [];
  for (let c = 1; c <= maxC; c += 1) {
    const cell = ws.getCell(r, c);
    const d = cellDate(cell);
    const n = cellNumber(cell);
    const t = cellText(cell);
    const v = d ? d.toISOString().slice(0, 10) : n != null ? n : t;
    const f = cell.value && cell.value.formula ? ` [${cell.value.formula}]` : "";
    out.push(`${c}:${v}${f}${isYellowFill(cell) ? " Y" : ""}`);
  }
  return out.join(" | ");
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);

  console.log("=== 2013 rows 1-6 ===");
  const y2013 = wb.getWorksheet("2013");
  for (let r = 1; r <= 6; r += 1) console.log(r, dumpRow(y2013, r, 12));

  console.log("\n=== 2016 rows 1-12 ===");
  const y2016 = wb.getWorksheet("2016");
  for (let r = 1; r <= 12; r += 1) console.log(r, dumpRow(y2016, r, 14));

  console.log("\n=== 2012 rows 1-8 ===");
  const y2012 = wb.getWorksheet("2012");
  for (let r = 1; r <= 8; r += 1) console.log(r, dumpRow(y2012, r, 12));

  console.log("\n=== 2010 rows 1-8 ===");
  const y2010 = wb.getWorksheet("2010");
  for (let r = 1; r <= 8; r += 1) console.log(r, dumpRow(y2010, r, 12));

  console.log("\n=== 2017 rows 1-8 ===");
  const y2017 = wb.getWorksheet("2017");
  for (let r = 1; r <= 8; r += 1) console.log(r, dumpRow(y2017, r, 14));

  const master = wb.worksheets[0];
  console.log("\n=== master 2016/2017 formulas row3-6 ===");
  for (let r = 3; r <= 8; r += 1) {
    const name = cellText(master.getCell(r, 3));
    const y2016c = master.getCell(r, 14);
    const y2017c = master.getCell(r, 15);
    console.log(r, name, "2016", y2016c.value, "2017", y2017c.value);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
