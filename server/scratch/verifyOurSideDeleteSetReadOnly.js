/**
 * READ-ONLY final pre-delete verification of leaveOurSideAudit.json delete list.
 * Writes backup of the 479 candidates. Performs no inserts/updates/deletes.
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

const AUDIT_PATH = path.join(__dirname, "leaveOurSideAudit.json");
const BACKUP_PATH = path.join(__dirname, "leaveOurSideDeleteBackup-2026-09-11.json");
const PROTECTED_IDS = [
  "6a28031146c7ddf03d6da481",
  "6a28038146c7ddf03d6da490",
  "6a2a7a9c54828137fa01f3fc",
];
const CLIENT_ACTORS = ["melvin", "kantesh", "kailash", "mahesh"];
const CLIENT_USER_IDS = new Set([
  "6a645fc53e059e77428433e2", // Kailash
  "6a645fc63e059e77428433e9", // Mahesh
  "6a6461633e059e77428434c0", // Melvin
  "6a6461633e059e77428434c7", // Kantesh
]);

function ymd(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function scriptProvenance(reason) {
  const r = String(reason || "").trim();
  if (/^Imported from Excel \d{4}/i.test(r)) return "importExcelLeaveMaster.js";
  if (/^Imported from \d{4}(\s|$)/i.test(r) && !/^Imported from Excel /i.test(r)) {
    return "syncLeaveFromExcel.js";
  }
  return "";
}

function actorHits(doc) {
  const blobs = [];
  if (doc.changedBy) blobs.push(String(doc.changedBy));
  (doc.statusChangeHistory || []).forEach((h) => {
    if (h.changedBy) blobs.push(String(h.changedBy));
  });
  const nameHits = CLIENT_ACTORS.filter((name) =>
    blobs.some((b) => b.trim().toLowerCase() === name)
  );
  const idFields = [
    doc.changedByUser,
    doc.adminApprovedBy,
    doc.hodApprovedBy,
    doc.cancelledBy,
    ...((doc.statusChangeHistory || []).map((h) => h.changedByUser)),
  ]
    .filter(Boolean)
    .map((v) => String(v));
  const idHits = idFields.filter((id) => CLIENT_USER_IDS.has(id));
  return { names: nameHits, userIds: idHits };
}

(async () => {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const deleteIds = audit.delete.map((r) => String(r.id));
  const keepIds = new Set(audit.keep.map((r) => String(r.id)));
  const uncertainIds = new Set(audit.uncertain.map((r) => String(r.id)));
  const deleteSet = new Set(deleteIds);

  const uniqueDelete = new Set(deleteIds);
  const overlapKeep = deleteIds.filter((id) => keepIds.has(id));
  const overlapUncertain = deleteIds.filter((id) => uncertainIds.has(id));
  const protectedInDelete = PROTECTED_IDS.filter((id) => deleteSet.has(id));

  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const currentCount = await LeaveRequest.countDocuments();
  const objectIds = deleteIds.map((id) => new mongoose.Types.ObjectId(id));
  const docs = await LeaveRequest.find({ _id: { $in: objectIds } }).lean();
  const foundIds = new Set(docs.map((d) => String(d._id)));
  const missingIds = deleteIds.filter((id) => !foundIds.has(id));
  const unexpectedIds = [...foundIds].filter((id) => !deleteSet.has(id));

  const failures = [];
  const clientActivity = [];
  const verified = [];

  docs.forEach((doc) => {
    const id = String(doc._id);
    const src = scriptProvenance(doc.reason);
    const client = actorHits(doc);
    const row = {
      id,
      employeeId: doc.employeeId || "",
      employeeName: doc.employeeName || "",
      leaveType: doc.leaveType || "",
      startDate: ymd(doc.startDate),
      endDate: ymd(doc.endDate),
      leaveDays: doc.leaveDays == null ? "" : doc.leaveDays,
      reason: doc.reason || "",
      importSource: doc.importSource || "",
      createdBy: doc.changedBy || "",
      changedBy: doc.changedBy || "",
      changedByUser: doc.changedByUser ? String(doc.changedByUser) : "",
      adminApprovedBy: doc.adminApprovedBy ? String(doc.adminApprovedBy) : "",
      statusChangeHistory: doc.statusChangeHistory || [],
      createdAt: doc.createdAt || "",
      updatedAt: doc.updatedAt || "",
      scriptSource: src,
    };
    if (!src) {
      failures.push({ id, issue: "missing script provenance in reason", reason: row.reason });
    }
    if (client.names.length || client.userIds.length) {
      clientActivity.push({
        id,
        employeeName: row.employeeName,
        actors: client.names,
        userIds: client.userIds,
        reason: row.reason,
      });
    }
    verified.push(row);
  });

  const protectedLive = await LeaveRequest.find({
    _id: { $in: PROTECTED_IDS.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("_id employeeName employeeId leaveType startDate endDate reason changedBy")
    .lean();

  const uncertainLiveCount = await LeaveRequest.countDocuments({
    _id: { $in: [...uncertainIds].map((id) => new mongoose.Types.ObjectId(id)) },
  });

  const backup = {
    createdAt: new Date().toISOString(),
    note: "READ-ONLY backup of proposed deletion candidates. Restore with LeaveRequest.insertMany(records) if needed. Do not modify this file.",
    sourceAudit: "server/scratch/leaveOurSideAudit.json",
    count: docs.length,
    records: docs,
  };
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2));

  const countAfterRead = await LeaveRequest.countDocuments();
  const safe =
    missingIds.length === 0 &&
    unexpectedIds.length === 0 &&
    uniqueDelete.size === 479 &&
    deleteIds.length === 479 &&
    docs.length === 479 &&
    failures.length === 0 &&
    clientActivity.length === 0 &&
    protectedInDelete.length === 0 &&
    overlapKeep.length === 0 &&
    overlapUncertain.length === 0 &&
    currentCount === 730 &&
    countAfterRead === 730 &&
    protectedLive.length === 3 &&
    uncertainLiveCount === uncertainIds.size &&
    730 - 479 === 251;

  const report = {
    verifiedDeletionCandidates: docs.length,
    auditDeleteListCount: deleteIds.length,
    uniqueDeleteIds: uniqueDelete.size,
    missingIds,
    unexpectedIds,
    provenanceFailures: failures,
    clientAdminActivityFound: clientActivity,
    protectedIdsInDeletionSet: protectedInDelete,
    uncertainIdsInDeletionSet: overlapUncertain,
    keepIdsInDeletionSet: overlapKeep,
    protectedLive: protectedLive.map((d) => ({
      id: String(d._id),
      employeeName: d.employeeName,
      employeeId: d.employeeId || "",
      leaveType: d.leaveType,
      startDate: ymd(d.startDate),
      endDate: ymd(d.endDate),
      reason: d.reason,
      changedBy: d.changedBy || "",
      inDeletionSet: deleteSet.has(String(d._id)),
    })),
    uncertainCountInAudit: uncertainIds.size,
    uncertainStillInDb: uncertainLiveCount,
    currentCount,
    countAfterRead,
    expectedRemainingAfterDeletion: 730 - 479,
    math: "730 - 479 = 251",
    backupPath: BACKUP_PATH,
    backupRecordCount: backup.count,
    writesPerformed: 0,
    safeForExplicitApproval: safe,
    scriptBreakdown: verified.reduce((acc, r) => {
      acc[r.scriptSource] = (acc[r.scriptSource] || 0) + 1;
      return acc;
    }, {}),
  };

  fs.writeFileSync(path.join(__dirname, "leaveOurSidePreDeleteVerification.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
