/**
 * READ-ONLY Leave Management audit. No inserts, updates, or deletes.
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

function scriptReasonClass(reason) {
  const r = String(reason || "").trim();
  if (/^Imported from Excel \d{4}/i.test(r)) return "importExcelLeaveMaster.js";
  if (/^Imported from \d{4}(\s|$)/i.test(r) && !/^Imported from Excel /i.test(r)) {
    return "syncLeaveFromExcel.js";
  }
  return "";
}

function dayDiff(a, b) {
  if (!a || !b) return 999;
  const x = new Date(`${a}T00:00:00`);
  const y = new Date(`${b}T00:00:00`);
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime())) return 999;
  return Math.abs(Math.round((x - y) / 86400000));
}

function ownerKeys(r) {
  const keys = [];
  const id = String(r.employeeId || "").trim().toLowerCase();
  const name = String(r.employeeName || "").trim().toLowerCase();
  if (id) keys.push(`id:${id}`);
  if (name) keys.push(`name:${name}`);
  return keys;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const countBefore = await LeaveRequest.countDocuments();
  const [leaves, users] = await Promise.all([
    LeaveRequest.find({}).lean(),
    User.find({}).select("_id username role").lean(),
  ]);
  if (leaves.length !== countBefore) {
    throw new Error("Count mismatch while reading");
  }

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const clientRoles = new Set(["admin", "hr", "hod", "authorize_user"]);
  const clientUsernames = new Set(
    users.filter((u) => clientRoles.has(String(u.role || "").toLowerCase()))
      .map((u) => String(u.username || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const clientUserIds = new Set(
    users.filter((u) => clientRoles.has(String(u.role || "").toLowerCase()))
      .map((u) => String(u._id))
  );

  function userLabel(id) {
    if (!id) return "";
    const u = userById.get(String(id));
    return u ? `${u.username} (${u.role})` : String(id);
  }

  function actorNames(row) {
    const names = [];
    if (row.changedBy) names.push(String(row.changedBy).trim().toLowerCase());
    (row.statusChangeHistory || []).forEach((h) => {
      if (h.changedBy) names.push(String(h.changedBy).trim().toLowerCase());
    });
    return names.filter(Boolean);
  }

  function actorUserIds(row) {
    const ids = [];
    if (row.changedByUser) ids.push(String(row.changedByUser));
    if (row.adminApprovedBy) ids.push(String(row.adminApprovedBy));
    if (row.hodApprovedBy) ids.push(String(row.hodApprovedBy));
    if (row.cancelledBy) ids.push(String(row.cancelledBy));
    (row.statusChangeHistory || []).forEach((h) => {
      if (h.changedByUser) ids.push(String(h.changedByUser));
    });
    return ids;
  }

  function clientManaged(row) {
    const names = actorNames(row);
    if (names.some((n) => clientUsernames.has(n))) {
      return {
        yes: true,
        how: `changedBy/history includes client/admin user: ${[...new Set(names.filter((n) => clientUsernames.has(n)))].join(", ")}`,
      };
    }
    const ids = actorUserIds(row);
    const matched = ids.filter((id) => clientUserIds.has(id));
    if (matched.length) {
      return {
        yes: true,
        how: `linked user id belongs to client/admin account: ${matched.map(userLabel).join(", ")}`,
      };
    }
    return { yes: false, how: "" };
  }

  const rows = leaves.map((l) => {
    const managed = clientManaged(l);
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
      adminApprovedBy: userLabel(l.adminApprovedBy),
      changedBy: l.changedBy || "",
      changedByUser: userLabel(l.changedByUser),
      appliedOn: l.appliedOn || "",
      createdAt: l.createdAt || "",
      updatedAt: l.updatedAt || "",
      changeStatus: l.changeStatus || "",
      changeRemarks: l.changeRemarks || "",
      isPastLeave: !!l.isPastLeave,
      requesterRole: l.requesterRole || "",
      scriptSource: scriptReasonClass(l.reason),
      clientManaged: managed.yes,
      clientEvidence: managed.how,
      statusChangeHistory: (l.statusChangeHistory || []).map((h) => ({
        changeStatus: h.changeStatus,
        changedBy: h.changedBy || "",
        changedByUser: userLabel(h.changedByUser),
        changedOn: h.changedOn || "",
        remarks: h.remarks || "",
      })),
    };
  });

  const keep = [];
  const rest = [];
  rows.forEach((r) => {
    if (r.clientManaged) keep.push(r);
    else rest.push(r);
  });

  const keepIndex = new Map();
  keep.forEach((r) => {
    ownerKeys(r).forEach((k) => {
      if (!keepIndex.has(k)) keepIndex.set(k, []);
      keepIndex.get(k).push(r);
    });
  });
  const liveNonScript = rows.filter((r) => !r.scriptSource);
  const liveIndex = new Map();
  liveNonScript.forEach((r) => {
    ownerKeys(r).forEach((k) => {
      if (!liveIndex.has(k)) liveIndex.set(k, []);
      liveIndex.get(k).push(r);
    });
  });

  function findNear(r, index) {
    const seen = new Set();
    const matches = [];
    ownerKeys(r).forEach((k) => {
      (index.get(k) || []).forEach((other) => {
        if (other.id === r.id || seen.has(other.id)) return;
        const startDiff = dayDiff(r.startDate, other.startDate);
        const endDiff = dayDiff(r.endDate, other.endDate);
        if (startDiff <= 1 && endDiff <= 1) {
          seen.add(other.id);
          matches.push({ other, startDiff, endDiff, exact: startDiff === 0 && endDiff === 0 });
        }
      });
    });
    return matches;
  }

  function findOverlap(r, index) {
    const seen = new Set();
    const matches = [];
    const rs = new Date(`${r.startDate}T00:00:00`);
    const re = new Date(`${r.endDate || r.startDate}T00:00:00`);
    if (Number.isNaN(rs.getTime()) || Number.isNaN(re.getTime())) return matches;
    ownerKeys(r).forEach((k) => {
      (index.get(k) || []).forEach((other) => {
        if (other.id === r.id || seen.has(other.id)) return;
        const os = new Date(`${other.startDate}T00:00:00`);
        const oe = new Date(`${other.endDate || other.startDate}T00:00:00`);
        if (Number.isNaN(os.getTime()) || Number.isNaN(oe.getTime())) return;
        if (rs <= oe && os <= re) {
          seen.add(other.id);
          matches.push(other);
        }
      });
    });
    return matches;
  }

  const safeDelete = [];
  const uncertain = [];

  rest.forEach((r) => {
    if (r.scriptSource) {
      const nearKeep = findNear(r, keepIndex);
      const nearLive = findNear(r, liveIndex).filter((m) => m.other.id !== r.id);
      const match = nearKeep[0] || nearLive[0];
      if (match) {
        safeDelete.push({
          ...r,
          evidence: `reason was written by ${r.scriptSource}`,
          matchingGenuineId: match.other.id,
          matchingGenuine: `${match.other.employeeName} ${match.other.startDate} → ${match.other.endDate} (${match.other.reason || match.other.leaveType})`,
          whySafe: `Our import script created this row, and a genuine Leave Management record already exists for the same employee with start±${match.startDiff} day and end±${match.endDiff} day. Deleting the import would not remove the genuine record.`,
          exactDuplicate: match.exact,
        });
        return;
      }
      uncertain.push({
        ...r,
        whyUncertain: "Created by our Excel import script, but it is the only copy of this date span in Leave Management. It may be genuine client historical leave loaded from Excel, not test data.",
        neededEvidence: "Written confirmation that Excel-imported history should be removed from Leave Management, or a matching live admin-created record for the same dates.",
      });
      return;
    }

    uncertain.push({
      ...r,
      whyUncertain: r.importSource === "excel-master-tracker"
        ? "importSource is excel-master-tracker, but that tag is not reliable (leftover tagging of live records exists). No script-generated reason and no Melvin/admin/HR/Authorize User actor on the record."
        : "No script-generated reason and no Melvin/admin/HR/Authorize User actor. Creator cannot be proven.",
      neededEvidence: "createdBy/statusChangeHistory naming a client user, or a script-written reason proving our import.",
    });
  });

  const allClassified = keep.length + safeDelete.length + uncertain.length;
  if (allClassified !== rows.length) {
    throw new Error(`Classification incomplete: ${allClassified} vs ${rows.length}`);
  }

  const exactDupes = safeDelete.filter((r) => r.exactDuplicate).length;
  const nearDupes = safeDelete.filter((r) => !r.exactDuplicate).length;

  const empMap = new Map();
  const bump = (name, bucket) => {
    const key = name || "(blank name)";
    if (!empMap.has(key)) empMap.set(key, { employee: key, our: 0, keep: 0, uncertain: 0 });
    empMap.get(key)[bucket] += 1;
  };
  safeDelete.forEach((r) => bump(r.employeeName, "our"));
  keep.forEach((r) => bump(r.employeeName, "keep"));
  uncertain.forEach((r) => bump(r.employeeName, "uncertain"));
  const employeeWise = [...empMap.values()].sort((a, b) => a.employee.localeCompare(b.employee));

  const isMelvin = (r) =>
    /melvin/i.test(r.employeeName || "") || /^idmo-178$/i.test(r.employeeId || "");
  const isMehtab = (r) =>
    /mehtab/i.test(r.employeeName || "") || /^idml-084$/i.test(r.employeeId || "");

  const countAfter = await LeaveRequest.countDocuments();
  const integrity = {
    leaveCountBeforeRead: countBefore,
    leaveCountAfterRead: countAfter,
    recordsRead: rows.length,
    unchanged: countBefore === countAfter && countAfter === rows.length,
    writesPerformed: 0,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    integrity,
    users: users.map((u) => ({ username: u.username, role: u.role, id: String(u._id) })),
    clientUsernames: [...clientUsernames],
    counts: {
      total: rows.length,
      safeToDelete: safeDelete.length,
      keep: keep.length,
      uncertain: uncertain.length,
      exactDuplicates: exactDupes,
      possibleDuplicates: nearDupes,
    },
    safeToDelete: safeDelete,
    keep,
    uncertain,
    employeeWise,
    melvin: {
      keep: keep.filter(isMelvin),
      safeToDelete: safeDelete.filter(isMelvin),
      uncertain: uncertain.filter(isMelvin),
    },
    mehtab: {
      keep: keep.filter(isMehtab),
      safeToDelete: safeDelete.filter(isMehtab),
      uncertain: uncertain.filter(isMehtab),
    },
  };

  const dir = __dirname;
  fs.writeFileSync(path.join(dir, "leaveAuditFull.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(dir, "leaveAuditCanvasData.json"), JSON.stringify({
    generatedAt: report.generatedAt,
    integrity: report.integrity,
    counts: report.counts,
    clientUsernames: report.clientUsernames,
    users: report.users,
    safeToDelete: safeDelete,
    keep: keep.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      leaveType: r.leaveType,
      startDate: r.startDate,
      endDate: r.endDate,
      leaveDays: r.leaveDays,
      status: r.status,
      reason: r.reason,
      importSource: r.importSource,
      createdBy: r.createdBy,
      createdByUser: r.createdByUser,
      adminApprovedBy: r.adminApprovedBy,
      changedBy: r.changedBy,
      changedByUser: r.changedByUser,
      clientEvidence: r.clientEvidence,
      createdAt: r.createdAt,
    })),
    uncertain: uncertain.map((r) => ({
      id: r.id,
      employeeName: r.employeeName,
      employeeId: r.employeeId,
      startDate: r.startDate,
      endDate: r.endDate,
      leaveType: r.leaveType,
      reason: r.reason,
      importSource: r.importSource,
      createdBy: r.createdBy,
      scriptSource: r.scriptSource,
      whyUncertain: r.whyUncertain,
      neededEvidence: r.neededEvidence,
    })),
    employeeWise,
    melvin: report.melvin,
    mehtab: report.mehtab,
  }, null, 2));

  console.log(JSON.stringify({
    integrity: report.integrity,
    counts: report.counts,
    clientUsernames: report.clientUsernames,
    safeToDelete: safeDelete.length,
    melvin: {
      keep: report.melvin.keep.length,
      safeToDelete: report.melvin.safeToDelete.length,
      uncertain: report.melvin.uncertain.length,
    },
    mehtab: {
      keep: report.mehtab.keep.length,
      safeToDelete: report.mehtab.safeToDelete.length,
      uncertain: report.mehtab.uncertain.length,
    },
    employeeRows: employeeWise.length,
  }, null, 2));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
