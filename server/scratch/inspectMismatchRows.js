const ExcelJS = require("../../frontend/node_modules/exceljs");
const { parseLeaveMasterWorkbook, cellText, cellDate, cellNumber } = require("../utils/excelLeaveWorkbook");

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
    out.push(`${c}:${v}${f}`);
  }
  return out.join(" | ");
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const parsed = await parseLeaveMasterWorkbook(wb);

  const names = ["SABIR", "NAINIKA", "PERIYADAN", "MAHESH CHAINANI", "GANGARAJAM"];
  for (const needle of names) {
    const emp = parsed.master.employees.find((e) => String(e.staffName).toUpperCase().includes(needle));
    if (!emp) {
      console.log("\nNO MASTER", needle);
      continue;
    }
    console.log("\n====", emp.employeeId, emp.staffName, "====");
    console.log("years", emp.years);
    const slots = parsed.leaves.filter(
      (l) => l.employeeId && emp.employeeId && l.employeeId.toLowerCase() === emp.employeeId.toLowerCase()
    );
    console.log(
      "slots",
      slots.map((s) => `${s.year} ${s.start}..${s.end}=${s.days}`)
    );
  }

  console.log("\n===== 2026 NAINIKA / SABIR rows =====");
  const y2026 = wb.getWorksheet("2026");
  for (let r = 1; r <= y2026.rowCount; r += 1) {
    const t = `${cellText(y2026.getCell(r, 1))} ${cellText(y2026.getCell(r, 2))}`;
    if (/nainika|sabir/i.test(t)) console.log(r, dumpRow(y2026, r, 14));
  }
  console.log("\n===== 2025 SABIR =====");
  const y2025 = wb.getWorksheet("2025");
  for (let r = 1; r <= y2025.rowCount; r += 1) {
    const t = `${cellText(y2025.getCell(r, 1))} ${cellText(y2025.getCell(r, 2))}`;
    if (/sabir/i.test(t)) console.log(r, dumpRow(y2025, r, 14));
  }
  console.log("\n===== 2024 MAHESH =====");
  const y2024 = wb.getWorksheet("2024");
  for (let r = 1; r <= y2024.rowCount; r += 1) {
    const t = `${cellText(y2024.getCell(r, 1))} ${cellText(y2024.getCell(r, 2))}`;
    if (/mahesh/i.test(t)) console.log(r, dumpRow(y2024, r, 14));
  }

  const last5Mismatch = [];
  parsed.master.employees.forEach((emp) => {
    const slots = parsed.leaves.filter(
      (l) => emp.employeeId && l.employeeId && emp.employeeId.toLowerCase() === l.employeeId.toLowerCase()
    );
    const slotYears = {};
    slots.forEach((s) => {
      slotYears[s.year] = (slotYears[s.year] || 0) + s.days;
    });
    for (let y = 2021; y <= 2026; y += 1) {
      const masterVal = emp.years[y];
      const slotVal = slotYears[y] || 0;
      if (masterVal == null && slotVal === 0) continue;
      if (Number(masterVal || 0) !== Number(slotVal || 0)) {
        last5Mismatch.push({
          id: emp.employeeId,
          name: emp.staffName,
          year: y,
          master: masterVal,
          slots: slotVal,
        });
      }
    }
  });
  console.log("\nlast5 mismatches", last5Mismatch.length);
  console.log(JSON.stringify(last5Mismatch, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
