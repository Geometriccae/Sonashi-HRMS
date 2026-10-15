/**
 * Backup then delete ONLY the 2 confirmed our-side duplicates of live admin leaves.
 * Does not touch employees, salary, documents, attendance, or other leave records.
 *
 * Usage:
 *   node scratch/deleteConfirmedLeaveDuplicates.js          # dry-run
 *   node scratch/deleteConfirmedLeaveDuplicates.js --apply  # delete
 */
require("dns").setDefaultResultOrder("ipv4first");
try {
  require("dns").setServers(["8.8.8.8", "1.1.1.1", "192.168.1.1"]);
} catch (_) {}
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const LeaveRequest = require("../models/LeaveRequest");
const Employee = require("../models/Employee");

const APPLY = process.argv.includes("--apply");
const DELETE_IDS = [
  "6a8e75581f4cff133424b3f2", // MUHAMMAD MEHTAB - Imported from Excel 2026, duplicates Melvin-created Annual Vacation
  "6a9a6bc8e31d52a8ca0bb8e8", // MELVIN ABRAHAM THOMAS - Imported from Excel 2026, duplicates genuine Personal leave
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const beforeCount = await LeaveRequest.countDocuments();
  const docs = await LeaveRequest.find({ _id: { $in: DELETE_IDS } }).lean();
  const employeeCountBefore = await Employee.countDocuments();

  const backupPath = path.join(__dirname, `leaveCleanupBackup-confirmed-duplicates-${new Date().toISOString().slice(0, 10)}.json`);
  if (!fs.existsSync(backupPath)) {
    fs.writeFileSync(backupPath, JSON.stringify({
      createdAt: new Date().toISOString(),
      note: "Restore with LeaveRequest.insertMany(records) if needed. Original backup must not be modified.",
      records: docs,
    }, null, 2));
  }

  console.log(JSON.stringify({
    apply: APPLY,
    leaveCountBefore: beforeCount,
    employeeCountBefore,
    matchedForDelete: docs.map((d) => ({
      id: String(d._id),
      employeeId: d.employeeId,
      employeeName: d.employeeName,
      leaveType: d.leaveType,
      startDate: d.startDate,
      endDate: d.endDate,
      status: d.status,
      reason: d.reason,
      importSource: d.importSource,
      createdAt: d.createdAt,
    })),
    backupPath,
  }, null, 2));

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to delete these 2 records.");
    await mongoose.disconnect();
    return;
  }

  if (docs.length !== DELETE_IDS.length) {
    console.error("Refusing to delete: expected", DELETE_IDS.length, "documents, found", docs.length);
    await mongoose.disconnect();
    process.exit(1);
  }

  const result = await LeaveRequest.deleteMany({ _id: { $in: DELETE_IDS } });
  const afterCount = await LeaveRequest.countDocuments();
  const employeeCountAfter = await Employee.countDocuments();
  const stillThere = await LeaveRequest.find({ _id: { $in: DELETE_IDS } }).select("_id").lean();
  const melvinLeft = await LeaveRequest.find({ employeeName: /melvin/i })
    .select("employeeId employeeName leaveType startDate endDate reason status importSource createdAt changedBy")
    .lean();

  console.log(JSON.stringify({
    deletedCount: result.deletedCount,
    leaveCountAfter: afterCount,
    employeeCountAfter,
    remainingDeleteIds: stillThere,
    melvinRemaining: melvinLeft,
  }, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
