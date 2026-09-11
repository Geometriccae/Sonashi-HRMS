/**
 * APPROVED deletion of EXACT 479 LeaveRequest IDs from leaveOurSideAudit.json.
 * Deletes only by _id $in that list. No broad reason/importSource/employee queries.
 * Does not touch Employee, payroll, schema, or app code.
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
const REPORT_PATH = path.join(__dirname, "leaveOurSideDeleteResult-2026-09-11.json");

const PROTECTED_IDS = [
  "6a28031146c7ddf03d6da481",
  "6a28038146c7ddf03d6da490",
  "6a2a7a9c54828137fa01f3fc",
];

function abort(msg, extra) {
  console.error("ABORT:", msg, extra ? JSON.stringify(extra, null, 2) : "");
  process.exit(1);
}

(async () => {
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8"));
  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf8"));

  const deleteIds = audit.delete.map((r) => String(r.id));
  const keepIds = audit.keep.map((r) => String(r.id));
  const uncertainIds = audit.uncertain.map((r) => String(r.id));
  const backupIds = backup.records.map((r) => String(r._id));

  const deleteSet = new Set(deleteIds);
  const keepSet = new Set(keepIds);
  const uncertainSet = new Set(uncertainIds);
  const backupSet = new Set(backupIds);

  if (deleteIds.length !== 479) abort("delete list length != 479", { n: deleteIds.length });
  if (new Set(deleteIds).size !== 479) abort("delete IDs not unique");
  if (keepIds.length !== 182) abort("keep list length != 182", { n: keepIds.length });
  if (uncertainIds.length !== 69) abort("uncertain list length != 69", { n: uncertainIds.length });
  if (backupIds.length !== 479) abort("backup length != 479", { n: backupIds.length });
  if (backup.count !== 479) abort("backup.count != 479", { n: backup.count });

  const missingInBackup = deleteIds.filter((id) => !backupSet.has(id));
  const extraInBackup = backupIds.filter((id) => !deleteSet.has(id));
  if (missingInBackup.length || extraInBackup.length) {
    abort("audit delete IDs do not match backup IDs", { missingInBackup, extraInBackup });
  }

  const protectedInDelete = PROTECTED_IDS.filter((id) => deleteSet.has(id));
  if (protectedInDelete.length) abort("protected IDs in deletion set", protectedInDelete);

  const uncertainInDelete = uncertainIds.filter((id) => deleteSet.has(id));
  if (uncertainInDelete.length) abort("uncertain IDs in deletion set", uncertainInDelete);

  const keepInDelete = keepIds.filter((id) => deleteSet.has(id));
  if (keepInDelete.length) abort("keep IDs in deletion set", keepInDelete);

  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const db = mongoose.connection.db;

  const collectionsBefore = {};
  const collectionNames = (await db.listCollections().toArray()).map((c) => c.name).sort();
  for (const name of collectionNames) {
    collectionsBefore[name] = await db.collection(name).countDocuments();
  }

  const beforeCount = await LeaveRequest.countDocuments();
  if (beforeCount !== 730) abort("live leave count != 730", { beforeCount });

  const objectIds = deleteIds.map((id) => new mongoose.Types.ObjectId(id));
  const existing = await LeaveRequest.find({ _id: { $in: objectIds } }).select("_id").lean();
  const existingIds = new Set(existing.map((d) => String(d._id)));
  const missingLive = deleteIds.filter((id) => !existingIds.has(id));
  if (missingLive.length) abort("some delete IDs missing live", missingLive);
  if (existing.length !== 479) abort("live matching docs != 479", { n: existing.length });

  const protectedLiveBefore = await LeaveRequest.find({
    _id: { $in: PROTECTED_IDS.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("_id")
    .lean();
  if (protectedLiveBefore.length !== 3) {
    abort("protected records missing before delete", {
      found: protectedLiveBefore.map((d) => String(d._id)),
    });
  }

  const uncertainLiveBefore = await LeaveRequest.countDocuments({
    _id: { $in: uncertainIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });
  if (uncertainLiveBefore !== 69) {
    abort("uncertain live count != 69 before delete", { uncertainLiveBefore });
  }

  const keepLiveBefore = await LeaveRequest.countDocuments({
    _id: { $in: keepIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });
  if (keepLiveBefore !== 182) {
    abort("keep live count != 182 before delete", { keepLiveBefore });
  }

  // DELETE ONLY by exact verified ObjectId list
  const deleteResult = await LeaveRequest.deleteMany({ _id: { $in: objectIds } });

  const afterCount = await LeaveRequest.countDocuments();
  const stillPresentDeleteIds = await LeaveRequest.find({ _id: { $in: objectIds } })
    .select("_id")
    .lean();
  const unexpectedlyNotDeleted = stillPresentDeleteIds.map((d) => String(d._id));

  const protectedLiveAfter = await LeaveRequest.find({
    _id: { $in: PROTECTED_IDS.map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("_id employeeName leaveType reason startDate endDate")
    .lean();

  const uncertainLiveAfter = await LeaveRequest.countDocuments({
    _id: { $in: uncertainIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });
  const keepLiveAfter = await LeaveRequest.countDocuments({
    _id: { $in: keepIds.map((id) => new mongoose.Types.ObjectId(id)) },
  });

  const collectionsAfter = {};
  for (const name of collectionNames) {
    collectionsAfter[name] = await db.collection(name).countDocuments();
  }
  const otherCollectionDeltas = collectionNames
    .filter((name) => name !== "leaverequests")
    .map((name) => ({
      name,
      before: collectionsBefore[name],
      after: collectionsAfter[name],
      delta: collectionsAfter[name] - collectionsBefore[name],
    }))
    .filter((row) => row.delta !== 0);

  const leaveCollectionName = collectionNames.find((n) => n.toLowerCase() === "leaverequests");
  const leaveDelta = leaveCollectionName
    ? collectionsAfter[leaveCollectionName] - collectionsBefore[leaveCollectionName]
    : afterCount - beforeCount;

  const report = {
    performedAt: new Date().toISOString(),
    recordsBeforeDeletion: beforeCount,
    recordsDeleted: deleteResult.deletedCount,
    deleteManyAcknowledged: deleteResult.acknowledged,
    recordsRemaining: afterCount,
    math: `${beforeCount} - ${deleteResult.deletedCount} = ${afterCount}`,
    expected: { before: 730, deleted: 479, remaining: 251, keep: 182, uncertain: 69 },
    keepStillPresent: keepLiveAfter,
    uncertainStillPresent: uncertainLiveAfter,
    protectedStillPresent: protectedLiveAfter.map((d) => ({
      id: String(d._id),
      employeeName: d.employeeName,
      leaveType: d.leaveType,
      reason: d.reason,
      startDate: d.startDate,
      endDate: d.endDate,
    })),
    protectedMissing: PROTECTED_IDS.filter(
      (id) => !protectedLiveAfter.some((d) => String(d._id) === id)
    ),
    unexpectedlyNotDeleted,
    otherCollectionDeltas,
    leaveCollectionDelta: leaveDelta,
    success:
      deleteResult.deletedCount === 479 &&
      afterCount === 251 &&
      keepLiveAfter === 182 &&
      uncertainLiveAfter === 69 &&
      protectedLiveAfter.length === 3 &&
      unexpectedlyNotDeleted.length === 0 &&
      otherCollectionDeltas.length === 0 &&
      beforeCount === 730,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await mongoose.disconnect();
  if (!report.success) process.exit(2);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
