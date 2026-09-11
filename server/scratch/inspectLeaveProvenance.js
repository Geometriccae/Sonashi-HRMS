/**
 * READ-ONLY Leave Management provenance inspection.
 * Does not insert, update, or delete anything.
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

function classifyReason(reason) {
  const r = String(reason || "").trim();
  if (/^Imported from Excel \d{4}/i.test(r)) return "script_importExcelLeaveMaster";
  if (/^Imported from \d{4}$/i.test(r)) return "script_syncLeaveFromExcel";
  if (/^Imported from Excel$/i.test(r)) return "ui_or_generic_excel_import";
  if (/^Imported from /i.test(r)) return "other_imported_reason";
  return "";
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });

  const [leaves, users, employees] = await Promise.all([
    LeaveRequest.find({}).lean(),
    User.find({}).select("_id username name email role").lean(),
    Employee.find({}).select("_id employeeId employeeName").lean(),
  ]);

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const empById = new Map(employees.map((e) => [String(e._id), e]));

  const userLabel = (id) => {
    if (!id) return "";
    const u = userById.get(String(id));
    if (!u) return String(id);
    return `${u.username || u.name || ""} (${u.role || ""})`.trim();
  };

  const totals = {
    leaveRecords: leaves.length,
    employees: employees.length,
    users: users.length,
  };

  const byImportSource = {};
  const byStatus = {};
  const byLeaveType = {};
  const byReasonClass = {};
  const byIsPastLeave = { true: 0, false: 0 };
  const changedByCounts = {};
  const createdByHistoryCounts = {};
  const reasonSamples = {};

  const rows = leaves.map((l) => {
    const src = String(l.importSource || "") || "(empty)";
    byImportSource[src] = (byImportSource[src] || 0) + 1;
    byStatus[l.status || "(empty)"] = (byStatus[l.status || "(empty)"] || 0) + 1;
    byLeaveType[l.leaveType || "(empty)"] = (byLeaveType[l.leaveType || "(empty)"] || 0) + 1;
    byIsPastLeave[l.isPastLeave ? "true" : "false"] += 1;

    const reasonClass = classifyReason(l.reason) || "non_import_reason";
    byReasonClass[reasonClass] = (byReasonClass[reasonClass] || 0) + 1;
    if (reasonClass !== "non_import_reason") {
      const key = String(l.reason || "").slice(0, 80);
      reasonSamples[key] = (reasonSamples[key] || 0) + 1;
    }

    const createdByHist = (l.statusChangeHistory || []).find((h) => h.changeStatus === "Created");
    const createdBy = l.changedBy || createdByHist?.changedBy || "";
    if (createdBy) changedByCounts[createdBy] = (changedByCounts[createdBy] || 0) + 1;
    const createdByUser = userLabel(l.changedByUser || createdByHist?.changedByUser);
    if (createdByUser) createdByHistoryCounts[createdByUser] = (createdByHistoryCounts[createdByUser] || 0) + 1;

    const emp =
      (l.employeeRecordId && empById.get(String(l.employeeRecordId))) ||
      employees.find((e) => String(e.employeeId || "").toLowerCase() === String(l.employeeId || "").toLowerCase());

    return {
      id: String(l._id),
      employeeId: l.employeeId || emp?.employeeId || "",
      employeeName: l.employeeName || emp?.employeeName || "",
      leaveType: l.leaveType || "",
      startDate: ymd(l.startDate),
      endDate: ymd(l.endDate),
      leaveDays: l.leaveDays,
      status: l.status || "",
      isPastLeave: !!l.isPastLeave,
      importSource: l.importSource || "",
      reason: l.reason || "",
      reasonClass,
      changeStatus: l.changeStatus || "",
      changedBy: l.changedBy || "",
      changedByUser: userLabel(l.changedByUser),
      changedOn: l.changedOn || "",
      changeRemarks: l.changeRemarks || "",
      appliedOn: l.appliedOn || l.createdAt || "",
      createdAt: l.createdAt || "",
      updatedAt: l.updatedAt || "",
      hodApprovedBy: userLabel(l.hodApprovedBy),
      adminApprovedBy: userLabel(l.adminApprovedBy),
      cancelledBy: userLabel(l.cancelledBy),
      requesterRole: l.requesterRole || "",
      statusChangeHistory: (l.statusChangeHistory || []).map((h) => ({
        changeStatus: h.changeStatus,
        changedBy: h.changedBy || "",
        changedByUser: userLabel(h.changedByUser),
        changedOn: h.changedOn || "",
        remarks: h.remarks || "",
      })),
    };
  });

  const dupMap = new Map();
  rows.forEach((r) => {
    const key = `${String(r.employeeId || r.employeeName).toLowerCase()}|${r.startDate}|${r.endDate}|${r.leaveType}`;
    if (!dupMap.has(key)) dupMap.set(key, []);
    dupMap.get(key).push(r);
  });
  const duplicates = [...dupMap.values()].filter((g) => g.length > 1);

  const confirmedOurSide = rows.filter((r) =>
    r.reasonClass === "script_importExcelLeaveMaster" ||
    r.reasonClass === "script_syncLeaveFromExcel" ||
    /restored from Excel/i.test(r.changeRemarks)
  );

  const liveWorkflow = rows.filter((r) =>
    !r.importSource &&
    r.reasonClass === "non_import_reason" &&
    ["Pending", "HOD Approved", "Approved", "Rejected", "Cancelled"].includes(r.status)
  );

  const importedTagged = rows.filter((r) => r.importSource === "excel-master-tracker");
  const importedWithoutScriptReason = importedTagged.filter(
    (r) => r.reasonClass !== "script_importExcelLeaveMaster" && r.reasonClass !== "script_syncLeaveFromExcel"
  );

  const emptyProvenance = rows.filter(
    (r) =>
      !r.importSource &&
      !r.changedBy &&
      !r.changedByUser &&
      !(r.statusChangeHistory || []).length &&
      r.reasonClass === "non_import_reason"
  );

  const testLikeReason = rows.filter((r) =>
    /\b(test|sample|dummy|temp|scratch|qa)\b/i.test(r.reason) ||
    /\b(test|sample|dummy|temp|scratch|qa)\b/i.test(r.employeeName)
  );

  const melvin = rows.filter((r) => /melvin/i.test(r.employeeName) || /melvin/i.test(r.employeeId));

  const report = {
    generatedAt: new Date().toISOString(),
    totals,
    aggregations: {
      byImportSource,
      byStatus,
      byLeaveType,
      byIsPastLeave,
      byReasonClass,
      changedByCounts,
      createdByHistoryCounts,
      reasonSamples,
      duplicateGroups: duplicates.length,
      duplicateRecords: duplicates.reduce((n, g) => n + g.length, 0),
    },
    classificationCounts: {
      confirmedOurSideScripts: confirmedOurSide.length,
      importedTaggedExcelMasterTracker: importedTagged.length,
      importedTaggedButNotScriptReason: importedWithoutScriptReason.length,
      liveWorkflowEmptyImportSource: liveWorkflow.length,
      emptyProvenance: emptyProvenance.length,
      testLikeReason: testLikeReason.length,
      melvinRecords: melvin.length,
    },
    users: users.map((u) => ({
      id: String(u._id),
      username: u.username,
      name: u.name || "",
      email: u.email || "",
      role: u.role,
    })),
    confirmedOurSideSample: confirmedOurSide.slice(0, 30),
    importedWithoutScriptReasonSample: importedWithoutScriptReason.slice(0, 30),
    liveWorkflowSample: liveWorkflow.slice(0, 30),
    emptyProvenanceSample: emptyProvenance.slice(0, 30),
    testLikeReason,
    duplicates: duplicates.slice(0, 40).map((g) => ({
      key: `${g[0].employeeName}|${g[0].startDate}|${g[0].endDate}`,
      count: g.length,
      records: g.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        status: r.status,
        importSource: r.importSource,
        reasonClass: r.reasonClass,
        reason: r.reason,
        createdAt: r.createdAt,
        changedBy: r.changedBy,
        adminApprovedBy: r.adminApprovedBy,
      })),
    })),
    melvin,
  };

  const outPath = path.join(__dirname, "leaveProvenanceReport.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    outPath,
    totals,
    aggregations: report.aggregations,
    classificationCounts: report.classificationCounts,
    userCount: users.length,
    testLikeReason: testLikeReason.length,
    duplicateGroups: duplicates.length,
  }, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
