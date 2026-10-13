/**
 * READ-ONLY Leave Management our-side vs client audit.
 * No inserts, updates, or deletes.
 *
 * DELETE (HIGH) = script-written reason from importExcelLeaveMaster.js
 *   or syncLeaveFromExcel.js, AND never subsequently acted on by a
 *   leave-workflow user provisioned in the database (email @sonashi.local).
 * Workflow-user activity is treated as client/admin business activity.
 * Seed admin (admin@sonashi.com) is NOT assumed to be ours or the client's.
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

function ymd(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function scriptSource(reason) {
  const r = String(reason || "").trim();
  if (/^Imported from Excel \d{4}/i.test(r)) return "importExcelLeaveMaster.js";
  if (/^Imported from \d{4}(\s|$)/i.test(r) && !/^Imported from Excel /i.test(r)) {
    return "syncLeaveFromExcel.js";
  }
  return "";
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const countBefore = await LeaveRequest.countDocuments();
  const [leaves, users] = await Promise.all([
    LeaveRequest.find({}).lean(),
    User.find({}).select("_id username role emailId createdAt").lean(),
  ]);

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const workflowUsers = users.filter((u) => {
    const role = String(u.role || "").toLowerCase();
    const email = String(u.emailId || "").trim().toLowerCase();
    if (email === "admin@sonashi.com") return false;
    return role === "admin" || role === "authorize_user" || role === "hr" || role === "hod";
  });
  const seedAdmins = users.filter((u) =>
    /^admin@sonashi\.com$/i.test(String(u.emailId || ""))
  );
  const workflowNames = new Set(workflowUsers.map((u) => String(u.username || "").trim().toLowerCase()));
  const workflowIds = new Set(workflowUsers.map((u) => String(u._id)));
  const seedNames = new Set(seedAdmins.map((u) => String(u.username || "").trim().toLowerCase()));
  const seedIds = new Set(seedAdmins.map((u) => String(u._id)));

  function userLabel(id) {
    if (!id) return "";
    const u = userById.get(String(id));
    return u ? `${u.username} (${u.role})` : String(id);
  }

  function collectActors(row) {
    const names = [];
    const ids = [];
    if (row.changedBy) names.push(String(row.changedBy).trim().toLowerCase());
    if (row.changedByUser) ids.push(String(row.changedByUser));
    if (row.adminApprovedBy) ids.push(String(row.adminApprovedBy));
    if (row.hodApprovedBy) ids.push(String(row.hodApprovedBy));
    if (row.cancelledBy) ids.push(String(row.cancelledBy));
    (row.statusChangeHistory || []).forEach((h) => {
      if (h.changedBy) names.push(String(h.changedBy).trim().toLowerCase());
      if (h.changedByUser) ids.push(String(h.changedByUser));
    });
    return { names: names.filter(Boolean), ids: ids.filter(Boolean) };
  }

  function touchedBy(actors, nameSet, idSet) {
    return actors.names.some((n) => nameSet.has(n)) || actors.ids.some((id) => idSet.has(id));
  }

  const forcedKeepKeys = new Set([
    "personal|2026-01-31|2026-02-15",
    "annual leave|2026-06-20|2026-08-05",
    "vacation|2026-06-20|2026-08-05",
    "vacation|2026-05-04|2026-07-06",
    "annual leave|2026-05-04|2026-07-06",
  ]);

  function forcedKeep(row) {
    const type = String(row.leaveType || "").trim().toLowerCase();
    const key = `${type}|${row.startDate}|${row.endDate}`;
    const reason = String(row.reason || "").trim().toLowerCase();
    if (forcedKeepKeys.has(key)) return true;
    if (reason === "annual vacation" && row.startDate === "2026-06-20" && row.endDate === "2026-08-05") return true;
    if (reason === "annual vacation" && row.startDate === "2026-05-04" && row.endDate === "2026-07-06") return true;
    if (reason === "personal" && row.startDate === "2026-01-31" && row.endDate === "2026-02-15") return true;
    return false;
  }

  const rows = leaves.map((l) => {
    const actors = collectActors(l);
    const src = scriptSource(l.reason);
    const workflow = touchedBy(actors, workflowNames, workflowIds);
    const seed = touchedBy(actors, seedNames, seedIds);
    return {
      id: String(l._id),
      employeeId: l.employeeId || "",
      employeeName: l.employeeName || "",
      leaveType: l.leaveType || "",
      startDate: ymd(l.startDate),
      endDate: ymd(l.endDate),
      leaveDays: l.leaveDays == null ? "" : l.leaveDays,
      status: l.status || "",
      reason: l.reason || "",
      importSource: l.importSource || "",
      createdBy: l.changedBy || "",
      createdByUser: userLabel(l.changedByUser),
      changedBy: l.changedBy || "",
      changedByUser: userLabel(l.changedByUser),
      adminApprovedBy: userLabel(l.adminApprovedBy),
      appliedOn: l.appliedOn || "",
      createdAt: l.createdAt || "",
      updatedAt: l.updatedAt || "",
      changeStatus: l.changeStatus || "",
      changeRemarks: l.changeRemarks || "",
      scriptSource: src,
      workflowTouched: workflow,
      seedAdminTouched: seed,
      statusChangeHistory: (l.statusChangeHistory || []).map((h) => ({
        changeStatus: h.changeStatus,
        changedBy: h.changedBy || "",
        changedByUser: userLabel(h.changedByUser),
        changedOn: h.changedOn || "",
        remarks: h.remarks || "",
      })),
    };
  });

  const del = [];
  const keep = [];
  const uncertain = [];

  rows.forEach((r) => {
    if (forcedKeep(r) && !r.scriptSource) {
      keep.push({
        ...r,
        bucket: "KEEP",
        confidence: "HIGH",
        evidence: "Matches a live Leave Management span that has no script-generated reason. Treated as genuine client/admin leave (including the Melvin Personal, Melvin Annual Vacation, and Mehtab Annual Vacation records requested for special check).",
        whyNotClient: "",
        whyKeep: "No import-script reason string. Must be kept as client/admin Leave Management data.",
      });
      return;
    }

    if (r.workflowTouched) {
      keep.push({
        ...r,
        bucket: "KEEP",
        confidence: "HIGH",
        evidence: `A User with role admin, HR, HOD, or authorize_user (excluding the seed account whose email is admin@sonashi.com) appears in changedBy/history/approval: ${r.changedBy || r.changedByUser || "history"}. That is treated as live Leave Management operator activity, not as proof the row is disposable import data.`,
        whyKeep: "Client/admin workflow user created or subsequently managed this record.",
        whyNotClient: "",
      });
      return;
    }

    if (r.scriptSource && !r.seedAdminTouched) {
      del.push({
        ...r,
        bucket: "DELETE",
        confidence: "HIGH",
        evidence: `reason was written by ${r.scriptSource} ("${r.reason}"). No admin/HR/HOD/authorize_user account (other than the seed bootstrap admin) appears in changedBy, changedByUser, adminApprovedBy, or statusChangeHistory.`,
        whyNotClient: "This MongoDB document was inserted by our Excel import/sync script. It was never subsequently edited/approved in history by a live leave-operator account. importSource was not used as the sole proof. Seed admin is excluded from this delete rule because that account is not assumed to be ours or the client's.",
        whyKeep: "",
      });
      return;
    }

    if (r.scriptSource && r.seedAdminTouched) {
      uncertain.push({
        ...r,
        bucket: "UNCERTAIN",
        confidence: "MEDIUM",
        whyUncertain: `Created by ${r.scriptSource}, but later history includes the seed admin account (email admin@sonashi.com). That account is the bootstrap admin and must not be assumed to be either our-side-only or genuine client Admin activity.`,
        neededEvidence: "Confirmation whether the seed admin account was used by the development team or by the client for this change.",
      });
      return;
    }

    uncertain.push({
      ...r,
      bucket: "UNCERTAIN",
      confidence: "LOW",
      whyUncertain: r.importSource === "excel-master-tracker"
        ? "No script-generated reason and no leave-workflow user on the record. importSource=excel-master-tracker is not reliable (leftover tagging of live records exists)."
        : "No script-generated reason and no leave-workflow user on the record. Creator cannot be proven from audit fields.",
      neededEvidence: "statusChangeHistory/changedBy naming a workflow user, or a script-written Imported from … reason.",
    });
  });

  if (del.length + keep.length + uncertain.length !== rows.length) {
    throw new Error("Unclassified records remain");
  }

  const empMap = new Map();
  const bump = (name, key) => {
    const k = name || "(blank)";
    if (!empMap.has(k)) empMap.set(k, { employee: k, del: 0, keep: 0, uncertain: 0 });
    empMap.get(k)[key] += 1;
  };
  del.forEach((r) => bump(r.employeeName, "del"));
  keep.forEach((r) => bump(r.employeeName, "keep"));
  uncertain.forEach((r) => bump(r.employeeName, "uncertain"));

  const isMelvin = (r) => /melvin/i.test(r.employeeName || "") || /^idmo-178$/i.test(r.employeeId || "");
  const isMehtab = (r) => /mehtab|mahtab/i.test(r.employeeName || "") || /^idml-084$/i.test(r.employeeId || "");

  const countAfter = await LeaveRequest.countDocuments();
  const report = {
    generatedAt: new Date().toISOString(),
    integrity: {
      leaveCountBeforeRead: countBefore,
      leaveCountAfterRead: countAfter,
      recordsRead: rows.length,
      writesPerformed: 0,
      unchanged: countBefore === countAfter && countAfter === rows.length,
    },
    users: users.map((u) => ({
      id: String(u._id),
      username: u.username,
      role: u.role,
      emailId: u.emailId || "",
      createdAt: u.createdAt || "",
      class:
        /@sonashi\.local$/i.test(String(u.emailId || ""))
          ? "leave-workflow user (email @sonashi.local)"
          : /^admin@sonashi\.com$/i.test(String(u.emailId || ""))
            ? "seed bootstrap admin (not assumed ours or client)"
            : ["admin", "authorize_user", "hr", "hod"].includes(String(u.role || "").toLowerCase()) &&
                String(u.emailId || "").trim().toLowerCase() !== "admin@sonashi.com"
              ? "leave-workflow role (admin/HR/HOD/authorize_user, not seed admin)"
              : "other application user",
    })),
    workflowUsers: workflowUsers.map((u) => u.username),
    seedAdmins: seedAdmins.map((u) => u.username),
    counts: {
      total: rows.length,
      delete: del.length,
      keep: keep.length,
      uncertain: uncertain.length,
    },
    delete: del,
    keep,
    uncertain,
    employeeWise: [...empMap.values()].sort((a, b) => a.employee.localeCompare(b.employee)),
    melvin: {
      delete: del.filter(isMelvin),
      keep: keep.filter(isMelvin),
      uncertain: uncertain.filter(isMelvin),
    },
    mehtab: {
      delete: del.filter(isMehtab),
      keep: keep.filter(isMehtab),
      uncertain: uncertain.filter(isMehtab),
    },
  };

  fs.writeFileSync(path.join(__dirname, "leaveOurSideAudit.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    integrity: report.integrity,
    counts: report.counts,
    workflowUsers: report.workflowUsers,
    seedAdmins: report.seedAdmins,
    users: report.users,
    melvin: {
      delete: report.melvin.delete.length,
      keep: report.melvin.keep.length,
      uncertain: report.melvin.uncertain.length,
      keepIds: report.melvin.keep.map((r) => r.id),
      deleteIds: report.melvin.delete.map((r) => r.id),
      uncertainIds: report.melvin.uncertain.map((r) => r.id),
    },
    mehtab: {
      delete: report.mehtab.delete.length,
      keep: report.mehtab.keep.length,
      uncertain: report.mehtab.uncertain.length,
      keepIds: report.mehtab.keep.map((r) => r.id),
      deleteIds: report.mehtab.delete.map((r) => r.id),
    },
    deleteByScript: del.reduce((acc, r) => {
      acc[r.scriptSource] = (acc[r.scriptSource] || 0) + 1;
      return acc;
    }, {}),
    specialForced: keep.filter((r) => /2026-01-31|2026-06-20|2026-05-04/.test(r.startDate)).map((r) => ({
      id: r.id, name: r.employeeName, type: r.leaveType, start: r.startDate, end: r.endDate, reason: r.reason, bucket: r.bucket,
    })),
  }, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
