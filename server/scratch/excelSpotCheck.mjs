import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ExcelJS = require("../../frontend/node_modules/exceljs");
const path =
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

function cellVal(cell) {
  const v = cell?.value;
  if (v == null) return null;
  if (typeof v === "object" && v.result != null) return v.result;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v;
}

const names = /talhat|nainika|pawan|kantesh|aslam|stobin/i;
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(path);
const ws = wb.getWorksheet("Sheet") || wb.worksheets[0];
console.log("MASTER");
for (let r = 3; r <= ws.rowCount; r += 1) {
  const id = String(cellVal(ws.getCell(r, 2)) || "");
  const name = String(cellVal(ws.getCell(r, 3)) || "");
  if (!names.test(`${id} ${name}`)) continue;
  const years = {};
  for (let c = 19; c <= 24; c += 1) years[2010 + (c - 8)] = cellVal(ws.getCell(r, c));
  console.log(JSON.stringify({
    id, name,
    doj: cellVal(ws.getCell(r, 6)),
    calc: cellVal(ws.getCell(r, 7)),
    y2021: years[2021], y2022: years[2022], y2023: years[2023],
    y2024: years[2024], y2025: years[2025], y2026: years[2026],
    taken: cellVal(ws.getCell(r, 25)),
    avrg: cellVal(ws.getCell(r, 26)),
    due: cellVal(ws.getCell(r, 27)),
    yrs: cellVal(ws.getCell(r, 29)),
    work: cellVal(ws.getCell(r, 30)),
  }));
}

const yws = wb.getWorksheet("2026");
console.log("\n2026 SHEET matches");
for (let r = 2; r <= yws.rowCount; r += 1) {
  const name = String(cellVal(yws.getCell(r, 2)) || "");
  if (!names.test(name)) continue;
  const row = [];
  for (let c = 1; c <= 16; c += 1) {
    const cell = yws.getCell(r, c);
    row.push(`${c}:${JSON.stringify(cellVal(cell))}${cell.formula ? `[${cell.formula}]` : ""}`);
  }
  console.log(r, name, row.join(" | "));
}
