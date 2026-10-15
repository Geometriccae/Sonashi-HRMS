/**
 * Validate leave calc vs Excel yearly sheets for regression employees.
 * Usage: node scratch/validateLeaveFix.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "192.168.1.1"]);
} catch (_) {
  /* ignore */
}
const mongoose = require("mongoose");
const path = require("path");
const { pathToFileURL } = require("url");
const Employee = require("../models/Employee");
const LeaveRequest = require("../models/LeaveRequest");

const CASES = [
  { label: "Mahesh", employeeId: /IDMM-169/i },
  { label: "Melvin", employeeId: /IDMO-178/i },
  { label: "Nainika", name: /nainika/i },
  { label: "Amal", employeeId: /IDMO-133/i },
  { label: "Sandeep", employeeId: /IDMO-044/i },
  { label: "Prince", employeeId: /IDMM-151/i },
  { label: "Kantesh", name: /kantesh/i },
  { label: "Pawan", name: /pawan.*kotai/i },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const { computeExcelLeaveCalculation } = await import(
    pathToFileURL(path.join(__dirname, "../../frontend/src/utils/leaveCalculator.js")).href
  );

  for (const q of CASES) {
    const filter = q.name
      ? { $or: [{ employeeId: q.employeeId }, { employeeName: q.name }] }
      : { employeeId: q.employeeId };
    const emp = await Employee.findOne(filter)
      .select("employeeId employeeName doj excelLeaveYearTaken excelLeaveImportedAt")
      .lean();
    if (!emp) {
      console.log("MISSING", q.label, q);
      continue;
    }
    const leaves = await LeaveRequest.find({
      status: { $in: ["Approved", "HOD Approved"] },
      $or: [
        { employeeRecordId: emp._id },
        { employeeId: emp.employeeId },
        { employeeName: emp.employeeName },
      ],
    }).lean();

    const calc = computeExcelLeaveCalculation(emp, leaves, "2026-08-31");
    const map = emp.excelLeaveYearTaken || {};
    console.log("\n===", q.label, emp.employeeId, emp.employeeName, "===");
    console.log("map", JSON.stringify(map));
    console.log("yearTotals", calc.yearTotals);
    console.log("totalTaken", calc.totalTaken, "entitlement", calc.entitlement, "available", calc.available);

    const excel2026 = leaves.filter(
      (l) =>
        String(l.importSource || "") === "excel-master-tracker" &&
        new Date(l.startDate).getFullYear() === 2026
    );
    const live2026 = leaves.filter(
      (l) =>
        String(l.importSource || "") !== "excel-master-tracker" &&
        new Date(l.startDate).getUTCFullYear() === 2026
    );
    console.log(
      "excel2026",
      excel2026.map((l) => ({
        id: String(l._id).slice(-4),
        start: l.startDate,
        end: l.endDate,
        days: l.leaveDays,
      }))
    );
    console.log(
      "live2026",
      live2026.map((l) => ({
        id: String(l._id).slice(-4),
        start: l.startDate,
        end: l.endDate,
        days: l.leaveDays,
        status: l.status,
        src: l.importSource,
      }))
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
