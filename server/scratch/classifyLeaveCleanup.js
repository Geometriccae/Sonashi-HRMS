/**
 * READ-ONLY classification of Leave Management records.
 * Writes proposed-delete / keep / uncertain reports. No deletions.
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
const User = require("../models/User");
const Employee = require("../models/Employee");

function ymd(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function reasonClass(reason) {
  const r = String(reason || "").trim();
  if (/^Imported from Excel \d{4}/i.test(r)) return "script_importExcelLeaveMaster";
  if (/^Imported from \d{4}$/i.test(r)) return "script_syncLeaveFromExcel";
  return "other";
}

const CLIENT_CREATOR_NAMES = new Set(["melvin", "kantesh", "mahesh"]);

function historyTouchedByClient(row) {
  const names = [];
  if (row.changedBy) names.push(String(row.changedBy));
  (row.statusChangeHistory || []).forEach((h) => {
    if (h.changedBy) names.push(String(h.changedBy));
  });
  return names.some((n) => CLIENT_CREATOR_NAMES.has(n.trim().toLowerCase()));
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const [leaves, users, employees] = await Promise.all([
    LeaveRequest.find({}).lean(),
    User.find({}).select("_id username role").lean(),
    Employee.find({}).select("_id employeeId employeeName excelLeaveYearTaken excelLeaveImportedAt").lean(),
  ]);
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const userLabel = (id) => {
    if (!id) return "";
    const u = userById.get(String(id));
    return u ? `${u.username} (${u.role})` : String(id);
  };

  const proposedDelete = [];
  const keep = [];
  const uncertain = [];

  leaves.forEach((l) => {
    const cls = reasonClass(l.reason);
    const clientTouched = historyTouchedByClient(l);
    const summary = {
      id: String(l._id),
      employeeId: l.employeeId || "",
      employeeName: l.employeeName || "",
      leaveType: l.leaveType || "",
      startDate: ymd(l.startDate),
      endDate: ymd(l.endDate),
      leaveDays: l.leaveDays,
      status: l.status || "",
      createdAt: l.createdAt || "",
      createdBy: l.changedBy || "",
      updatedAt: l.updatedAt || "",
      updatedBy: l.changedBy || "",
      importSource: l.importSource || "",
      reason: l.reason || "",
      reasonClass: cls,
      changeStatus: l.changeStatus || "",
      changeRemarks: l.changeRemarks || "",
      isPastLeave: !!l.isPastLeave,
      appliedOn: l.appliedOn || "",
      adminApprovedBy: userLabel(l.adminApprovedBy),
      hodApprovedBy: userLabel(l.hodApprovedBy),
      clientTouched,
      provenance:
        cls === "script_importExcelLeaveMaster"
          ? "reason written by server/scripts/importExcelLeaveMaster.js"
          : cls === "script_syncLeaveFromExcel"
            ? "reason written by server/scratch/syncLeaveFromExcel.js"
            : l.importSource === "excel-master-tracker"
              ? "importSource tagged excel-master-tracker (may be leftover tagging of a live record)"
              : "live / unknown",
    };

    if (cls === "script_importExcelLeaveMaster" || cls === "script_syncLeaveFromExcel") {
      if (clientTouched) {
        uncertain.push({
          ...summary,
          uncertainWhy:
            "Created by our Excel import script, but later modified by a client/admin user (Melvin/Kantesh/Mahesh). Not deleted.",
        });
      } else {
        proposedDelete.push(summary);
      }
      return;
    }

    if (/restored from Excel/i.test(l.changeRemarks || "")) {
      uncertain.push({
        ...summary,
        uncertainWhy: "Scratch script wrote changeRemarks 'restored from Excel' onto an existing row. Could be a genuine record that was only date-fixed.",
      });
      return;
    }

    keep.push({
      ...summary,
      keepWhy: clientTouched
        ? "Client/admin created or modified this leave in Leave Management."
        : l.importSource === "excel-master-tracker"
          ? "Not a script-generated reason. importSource tag alone is not enough (leftover tagging exists). Kept."
          : "No script import reason. Treated as live Leave Management data.",
    });
  });

  const withYearMap = employees.filter((e) => e.excelLeaveYearTaken && typeof e.excelLeaveYearTaken === "object").length;
  const deleteEmployeeNames = [...new Set(proposedDelete.map((r) => r.employeeName))].sort();
  const keepMelvin = keep.filter((r) => /melvin/i.test(r.employeeName));
  const deleteMelvin = proposedDelete.filter((r) => /melvin/i.test(r.employeeName));
  const uncertainMelvin = uncertain.filter((r) => /melvin/i.test(r.employeeName));

  const report = {
    generatedAt: new Date().toISOString(),
    totalsBefore: leaves.length,
    proposedDeleteCount: proposedDelete.length,
    keepCount: keep.length,
    uncertainCount: uncertain.length,
    employeesWithExcelYearMap: withYearMap,
    employeeCount: employees.length,
    proposedDeleteByReasonClass: proposedDelete.reduce((acc, r) => {
      acc[r.reasonClass] = (acc[r.reasonClass] || 0) + 1;
      return acc;
    }, {}),
    proposedDeleteEmployeeCount: deleteEmployeeNames.length,
    melvin: {
      keep: keepMelvin,
      proposedDelete: deleteMelvin,
      uncertain: uncertainMelvin,
    },
    proposedDelete: proposedDelete,
    uncertain: uncertain,
    keepIds: keep.map((r) => r.id),
  };

  const dir = __dirname;
  fs.writeFileSync(path.join(dir, "leaveCleanupProposedDelete.json"), JSON.stringify({
    generatedAt: report.generatedAt,
    count: proposedDelete.length,
    criteria: [
      "reason matches /^Imported from Excel YYYY/ (importExcelLeaveMaster.js)",
      "OR reason matches /^Imported from YYYY$/ (scratch/syncLeaveFromExcel.js)",
      "AND the record was never modified by Melvin, Kantesh, or Mahesh",
    ],
    records: proposedDelete,
  }, null, 2));
  fs.writeFileSync(path.join(dir, "leaveCleanupUncertain.json"), JSON.stringify({
    generatedAt: report.generatedAt,
    count: uncertain.length,
    records: uncertain,
  }, null, 2));
  fs.writeFileSync(path.join(dir, "leaveCleanupKeep.json"), JSON.stringify({
    generatedAt: report.generatedAt,
    count: keep.length,
    records: keep,
  }, null, 2));
  fs.writeFileSync(path.join(dir, "leaveCleanupSummary.json"), JSON.stringify({
    generatedAt: report.generatedAt,
    totalsBefore: report.totalsBefore,
    proposedDeleteCount: report.proposedDeleteCount,
    keepCount: report.keepCount,
    uncertainCount: report.uncertainCount,
    employeesWithExcelYearMap: report.employeesWithExcelYearMap,
    employeeCount: report.employeeCount,
    proposedDeleteByReasonClass: report.proposedDeleteByReasonClass,
    proposedDeleteEmployeeCount: report.proposedDeleteEmployeeCount,
    melvin: report.melvin,
    uncertain: report.uncertain,
    proposedDeleteSample: proposedDelete.slice(0, 25),
  }, null, 2));

  console.log(JSON.stringify({
    totalsBefore: report.totalsBefore,
    proposedDeleteCount: report.proposedDeleteCount,
    keepCount: report.keepCount,
    uncertainCount: report.uncertainCount,
    employeesWithExcelYearMap: report.employeesWithExcelYearMap,
    employeeCount: report.employeeCount,
    proposedDeleteByReasonClass: report.proposedDeleteByReasonClass,
    proposedDeleteEmployeeCount: report.proposedDeleteEmployeeCount,
    melvinKeep: keepMelvin.length,
    melvinProposedDelete: deleteMelvin.length,
    melvinUncertain: uncertainMelvin.length,
    uncertain: uncertain.length,
  }, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
