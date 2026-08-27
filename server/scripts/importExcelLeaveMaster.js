/**
 * Import Staff Leave Report Master tracker into MongoDB.
 *
 * Usage:
 *   node scripts/importExcelLeaveMaster.js [--apply] [path-to-xlsx]
 *
 * Default is dry-run. Pass --apply to write employees + leave requests.
 */
require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "192.168.1.1"]);
} catch (_) {
  /* ignore */
}
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const ExcelJS = require("../../frontend/node_modules/exceljs");
const Employee = require("../models/Employee");
const User = require("../models/User");
const LeaveRequest = require("../models/LeaveRequest");
const {
  parseLeaveMasterWorkbook,
  compactName,
  ymd,
  namesLikelySame,
} = require("../utils/excelLeaveWorkbook");
const {
  matchEmployeeFromExcel,
  identityFieldsFromEmployee,
} = require("../utils/leaveEmployeeIdentity");

const APPLY = process.argv.includes("--apply");
const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const SRC =
  positional[0] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

const REPORT_PATH = path.resolve(__dirname, "../scratch/leaveReconciliation.json");

function calYmd(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function localYmd(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sameCalendarDay(a, b) {
  const x = calYmd(a) || localYmd(a);
  const y = calYmd(b) || localYmd(b);
  return Boolean(x && y && x === y);
}

function utcDate(ymdStr) {
  const [y, m, d] = String(ymdStr).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function yearlyMapFromMaster(emp) {
  const out = {};
  Object.entries(emp.years || {}).forEach(([key, val]) => {
    if (!/^\d{4}$/.test(String(key))) return;
    if (val == null || val === "") return;
    const n = Number(val);
    if (Number.isFinite(n)) out[String(key)] = n;
  });
  return out;
}

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in server/.env");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const parsed = await parseLeaveMasterWorkbook(wb);

  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const employees = await Employee.find({}).lean();
  const users = await User.find({}).select("_id employeeId").lean();
  const userByEmp = new Map();
  users.forEach((u) => {
    if (u.employeeId) userByEmp.set(String(u.employeeId), u);
  });

  const softwareById = new Map();
  employees.forEach((e) => {
    if (e.employeeId) softwareById.set(String(e.employeeId).toLowerCase(), e);
  });

  const reconciliation = {
    file: SRC,
    applied: APPLY,
    generatedAt: new Date().toISOString(),
    excelEmployees: parsed.master.employees.length,
    excelLeaveSlots: parsed.leaves.length,
    softwareEmployees: employees.length,
    rows: [],
    missingInSoftware: [],
    missingInExcel: [],
    unmatchedLeaveSlots: [],
    counts: { created: 0, updated: 0, skipped: 0, dojUpdated: 0, idUpdated: 0 },
  };

  const excelIds = new Set();
  const matchedSoftwareIds = new Set();

  for (const excelEmp of parsed.master.employees) {
    const matched = matchEmployeeFromExcel(employees, excelEmp.employeeId, excelEmp.staffName);
    const excelDoj = excelEmp.joiningDate ? ymd(excelEmp.joiningDate) : "";
    const softwareDoj = matched?.doj ? localYmd(matched.doj) || calYmd(matched.doj) : "";
    const statusParts = [];
    if (!matched) statusParts.push("MISSING IN SOFTWARE");
    else {
      statusParts.push("MATCHED");
      matchedSoftwareIds.add(String(matched._id));
      if (
        excelEmp.employeeId &&
        matched.employeeId &&
        excelEmp.employeeId.toLowerCase() !== String(matched.employeeId).toLowerCase()
      ) {
        statusParts.push("EMPLOYEE ID MISMATCH");
      }
      if (
        compactName(excelEmp.staffName) &&
        compactName(matched.employeeName) &&
        compactName(excelEmp.staffName) !== compactName(matched.employeeName) &&
        !namesLikelySame(excelEmp.staffName, matched.employeeName)
      ) {
        statusParts.push("NAME MISMATCH");
      }
      if (excelDoj && softwareDoj && excelDoj !== softwareDoj) {
        statusParts.push("DOJ MISMATCH");
      }
    }
    if (excelEmp.employeeId) excelIds.add(excelEmp.employeeId.toLowerCase());

    const yearly = yearlyMapFromMaster(excelEmp);
    reconciliation.rows.push({
      status: statusParts.join(" + "),
      excelId: excelEmp.employeeId || "",
      excelName: excelEmp.staffName,
      excelDoj,
      softwareId: matched?.employeeId || "",
      softwareName: matched?.employeeName || "",
      softwareDoj,
      yearly,
      last5Taken: excelEmp.last5Taken,
      avrg: excelEmp.avrg,
      leaveDue: excelEmp.leaveDue,
      workingYrs: excelEmp.workingYrs,
    });

    if (!matched) {
      reconciliation.missingInSoftware.push({
        employeeId: excelEmp.employeeId,
        staffName: excelEmp.staffName,
        doj: excelDoj,
      });
      continue;
    }

    if (APPLY) {
      const update = {
        excelLeaveYearTaken: yearly,
        excelLeaveImportedAt: new Date(),
      };
      if (!matched.doj && excelEmp.joiningDate && excelDoj) {
        update.doj = utcDate(excelDoj);
        reconciliation.counts.dojUpdated += 1;
      }
      const excelCode = String(excelEmp.employeeId || "").trim();
      const softwareCode = String(matched.employeeId || "").trim();
      if (
        /^id[a-z]{2,4}-\d+/i.test(excelCode) &&
        softwareCode &&
        !/^id[a-z]{2,4}-\d+/i.test(softwareCode)
      ) {
        const clash = employees.find(
          (e) =>
            String(e.employeeId || "").toLowerCase() === excelCode.toLowerCase() &&
            String(e._id) !== String(matched._id)
        );
        if (!clash) {
          update.employeeId = excelCode;
          reconciliation.counts.idUpdated = (reconciliation.counts.idUpdated || 0) + 1;
        }
      }
      await Employee.updateOne({ _id: matched._id }, { $set: update });
    }
  }

  employees.forEach((emp) => {
    const id = String(emp.employeeId || "").toLowerCase();
    if (id && !excelIds.has(id) && !matchedSoftwareIds.has(String(emp._id))) {
      const compact = compactName(emp.employeeName);
      const excelHit = parsed.master.employees.find(
        (e) => compactName(e.staffName) === compact || namesLikelySame(e.staffName, emp.employeeName)
      );
      if (!excelHit) {
        reconciliation.missingInExcel.push({
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          doj: emp.doj ? localYmd(emp.doj) : "",
        });
      }
    }
  });

  const existingLeaves = await LeaveRequest.find({
    status: { $in: ["Approved", "HOD Approved"] },
  }).lean();

  const leavesByOwner = new Map();
  existingLeaves.forEach((row) => {
    const keys = [
      row.employeeRecordId ? String(row.employeeRecordId) : "",
      row.employee ? String(row.employee) : "",
      row.employeeId ? String(row.employeeId).toLowerCase() : "",
    ].filter(Boolean);
    keys.forEach((k) => {
      if (!leavesByOwner.has(k)) leavesByOwner.set(k, []);
      leavesByOwner.get(k).push(row);
    });
  });

  const seenCreate = new Set();
  const importedEmployeeIds = new Set();

  for (const slot of parsed.leaves) {
    const matched = matchEmployeeFromExcel(employees, slot.employeeId, slot.staffName);
    if (!matched) {
      reconciliation.unmatchedLeaveSlots.push({
        year: slot.year,
        employeeId: slot.employeeId,
        staffName: slot.staffName,
        start: slot.start,
        end: slot.end,
        days: slot.days,
      });
      continue;
    }

    importedEmployeeIds.add(String(matched._id));
    const linkedUser = userByEmp.get(String(matched._id));
    const targetUserId = linkedUser ? linkedUser._id : matched._id;
    importedEmployeeIds.add(String(targetUserId));
    const ownerKeys = [String(matched._id), String(targetUserId), String(matched.employeeId || "").toLowerCase()];
    const candidates = [];
    ownerKeys.forEach((k) => {
      (leavesByOwner.get(k) || []).forEach((row) => candidates.push(row));
    });

    const existing = candidates.find((row) => sameCalendarDay(row.startDate, slot.start));
    const startDate = utcDate(slot.start);
    const endDate = utcDate(slot.end || slot.start);
    const leaveDays = Number.isFinite(Number(slot.excelDays != null ? slot.excelDays : slot.days))
      ? Number(slot.excelDays != null ? slot.excelDays : slot.days)
      : 0;
    const identity = identityFieldsFromEmployee(matched);

    if (existing) {
      const needs =
        !sameCalendarDay(existing.endDate, slot.end) ||
        Number(existing.leaveDays) !== leaveDays ||
        Boolean(existing.requestAirfare) !== Boolean(slot.requestAirfare) ||
        existing.importSource !== "excel-master-tracker";
      if (needs) {
        reconciliation.counts.updated += 1;
        if (APPLY) {
          await LeaveRequest.updateOne(
            { _id: existing._id },
            {
              $set: {
                endDate,
                leaveDays,
                requestAirfare: !!slot.requestAirfare,
                importSource: "excel-master-tracker",
                isPastLeave: true,
                status: "Approved",
                ...identity,
              },
            }
          );
        }
      } else {
        reconciliation.counts.skipped += 1;
      }
      continue;
    }

    const createKey = `${matched._id}|${slot.start}|${slot.end}`;
    if (seenCreate.has(createKey)) {
      reconciliation.counts.skipped += 1;
      continue;
    }
    seenCreate.add(createKey);
    reconciliation.counts.created += 1;
    if (APPLY) {
      await LeaveRequest.create({
        employee: targetUserId,
        employeeName: matched.employeeName,
        company: "Sonashi",
        department: matched.department || "",
        reportingManager: matched.reportingManager || "",
        leaveType: "Vacation",
        startDate,
        endDate,
        leaveDays,
        reason: `Imported from Excel ${slot.year}${slot.remarks ? ` | ${slot.remarks}` : ""}`,
        status: "Approved",
        isPastLeave: true,
        requestAirfare: !!slot.requestAirfare,
        importSource: "excel-master-tracker",
        ...identity,
      });
    }
  }

  if (APPLY && importedEmployeeIds.size) {
    const leftover = await LeaveRequest.updateMany(
      {
        status: { $in: ["Approved", "HOD Approved"] },
        isPastLeave: true,
        importSource: { $ne: "excel-master-tracker" },
        $or: [
          { employeeRecordId: { $in: [...importedEmployeeIds] } },
          { employee: { $in: [...importedEmployeeIds] } },
        ],
      },
      { $set: { importSource: "excel-master-tracker" } }
    );
    reconciliation.counts.leftoverTagged = leftover.modifiedCount || leftover.nModified || 0;
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(reconciliation, null, 2));
  console.log(
    JSON.stringify(
      {
        applied: APPLY,
        excelEmployees: reconciliation.excelEmployees,
        excelLeaveSlots: reconciliation.excelLeaveSlots,
        missingInSoftware: reconciliation.missingInSoftware.length,
        missingInExcel: reconciliation.missingInExcel.length,
        unmatchedLeaveSlots: reconciliation.unmatchedLeaveSlots.length,
        counts: reconciliation.counts,
        report: REPORT_PATH,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
