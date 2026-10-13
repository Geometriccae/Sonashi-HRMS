/**
 * Compare DB excelLeaveYearTaken vs leaveReconciliation yearly (sheet-built) maps.
 * Usage: node scratch/auditDbYearMaps.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {
  /* ignore */
}
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Employee = require("../models/Employee");

const recon = JSON.parse(
  fs.readFileSync(path.join(__dirname, "leaveReconciliation.json"), "utf8")
);

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  let checked = 0;
  let mismatch = 0;
  let missing = 0;
  const sample = [];

  for (const row of recon.rows) {
    if (!row.softwareId && !row.softwareName) continue;
    const clauses = [];
    if (row.softwareId) {
      clauses.push({
        employeeId: new RegExp(
          `^${String(row.softwareId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      });
    }
    if (row.softwareName) clauses.push({ employeeName: row.softwareName });
    const emp = await Employee.findOne({ $or: clauses })
      .select("employeeId employeeName excelLeaveYearTaken")
      .lean();
    if (!emp) {
      missing += 1;
      continue;
    }
    checked += 1;
    const map = emp.excelLeaveYearTaken || {};
    for (const y of ["2021", "2022", "2023", "2024", "2025", "2026"]) {
      const expect = Number(row.yearly?.[y] ?? 0);
      const got = Number(map[y] ?? map[Number(y)] ?? 0);
      if (expect !== got) {
        mismatch += 1;
        if (sample.length < 20) {
          sample.push({
            id: emp.employeeId,
            name: emp.employeeName,
            y,
            expect,
            got,
            excelId: row.excelId,
          });
        }
      }
    }
  }

  console.log({ checked, mismatch, missing, sample });
  await mongoose.disconnect();
  process.exit(mismatch ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
