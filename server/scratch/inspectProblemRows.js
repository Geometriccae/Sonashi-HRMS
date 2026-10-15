const ExcelJS = require("../../frontend/node_modules/exceljs");
const SRC = "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

function dumpCell(cell) {
  const v = cell?.value;
  const t = v == null ? "null" : typeof v;
  let extra = "";
  if (v && typeof v === "object") extra = " keys=" + Object.keys(v).join(",") + " json=" + JSON.stringify(v).slice(0, 180);
  return `${t} ${String(v).slice(0, 80)}${extra}`;
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const sheet = wb.getWorksheet("Sheet");
  console.log("=== summary rows mentioning pavan/jihad/faryad ===");
  for (let r = 3; r <= sheet.rowCount; r += 1) {
    const id = String(sheet.getCell(r, 2).value || "");
    const name = sheet.getCell(r, 3).value;
    const n = String(name || "");
    if (/pavan|jihad|faryad|126/i.test(id + n)) {
      console.log(r, "id", dumpCell(sheet.getCell(r, 2)));
      console.log(r, "name", dumpCell(sheet.getCell(r, 3)));
    }
  }
  const y2026 = wb.getWorksheet("2026");
  console.log("\n=== 2026 names with pavan ===");
  for (let r = 2; r <= y2026.rowCount; r += 1) {
    const name = String(y2026.getCell(r, 2).value || "");
    if (/pavan/i.test(name)) {
      console.log(r, "c1", dumpCell(y2026.getCell(r, 1)), "c2", dumpCell(y2026.getCell(r, 2)));
    }
  }
  const y2025 = wb.getWorksheet("2025");
  console.log("\n=== 2025 jihad ===");
  for (let r = 2; r <= y2025.rowCount; r += 1) {
    const name = String(y2025.getCell(r, 2).value || "");
    if (/jihad/i.test(name)) {
      console.log(r, "c1", dumpCell(y2025.getCell(r, 1)), "c2", dumpCell(y2025.getCell(r, 2)));
    }
  }
  const y2022 = wb.getWorksheet("2022");
  console.log("\n=== 2022 faryad ===");
  for (let r = 2; r <= y2022.rowCount; r += 1) {
    const name = String(y2022.getCell(r, 2).value || "");
    if (/faryad/i.test(name)) {
      console.log(r, "c1", dumpCell(y2022.getCell(r, 1)), "c2", dumpCell(y2022.getCell(r, 2)));
    }
  }
  const y2024 = wb.getWorksheet("2024");
  console.log("\n=== 2024 IDMM-126 ===");
  for (let r = 2; r <= y2024.rowCount; r += 1) {
    const c1 = String(y2024.getCell(r, 1).value || "");
    const c2 = String(y2024.getCell(r, 2).value || "");
    if (/126/.test(c1 + c2)) {
      console.log(r, "c1", dumpCell(y2024.getCell(r, 1)), "c2", dumpCell(y2024.getCell(r, 2)), "c3", dumpCell(y2024.getCell(r, 3)));
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
