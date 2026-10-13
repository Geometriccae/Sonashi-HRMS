require("dns").setDefaultResultOrder("ipv4first");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const ExcelJS = require("../../frontend/node_modules/exceljs");
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const {
  parseLeaveMasterWorkbook,
  compactName,
  ymd,
} = require("../utils/excelLeaveWorkbook");

const SRC =
  process.argv[2] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const parsed = await parseLeaveMasterWorkbook(wb);

  const names = [
    /mahesh.*chintakindi/i,
    /nainika/i,
    /melvin/i,
    /prince.*kani|prince kanoja/i,
    /kantesh/i,
    /pawan.*kotai/i,
    /sandeep.*pullanchiodan/i,
    /^amal sid\b/i,
  ];

  console.log("=== MASTER vs YEAR SHEETS ===");
  for (const re of names) {
    const emp = parsed.master.employees.find((e) => re.test(e.staffName) || re.test(e.employeeId || ""));
    if (!emp) {
      console.log("NOT IN MASTER", String(re));
      continue;
    }
    const sheetYears = {};
    Object.values(parsed.yearSheets).forEach((sheet) => {
      const rows = sheet.rows.filter(
        (r) =>
          (emp.employeeId && r.employeeId && r.employeeId.toLowerCase() === emp.employeeId.toLowerCase()) ||
          compactName(r.staffName) === compactName(emp.staffName)
      );
      const days = rows.reduce((s, r) => s + (r.slotDays || 0), 0);
      sheetYears[sheet.year] = { rows: rows.length, days, slots: rows.flatMap((r) => r.slots.map((s) => ({ start: ymd(s.start), end: ymd(s.end), days: s.days }))) };
    });
    const masterYears = {};
    Object.entries(emp.years || {}).forEach(([k, v]) => {
      if (/^\d{4}$/.test(k)) masterYears[k] = v;
    });
    console.log("\n", emp.employeeId, emp.staffName);
    console.log("  master years", masterYears);
    console.log("  sheet years", Object.fromEntries(Object.entries(sheetYears).map(([y, v]) => [y, v.days])));
    [2024, 2025, 2026].forEach((y) => {
      if (sheetYears[y]?.slots?.length) console.log("  slots", y, sheetYears[y].slots);
    });
  }

  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const mahesh = await Employee.findOne({
    $or: [{ employeeId: /IDMM-169/i }, { employeeName: /mahesh.*chintakindi/i }],
  })
    .select("employeeId employeeName doj excelLeaveYearTaken excelLeaveImportedAt")
    .lean();
  console.log("\n=== DB MAHESH ===", mahesh);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
