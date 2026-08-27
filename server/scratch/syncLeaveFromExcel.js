require("dotenv").config();
const mongoose = require("mongoose");
const ExcelJS = require("../../frontend/node_modules/exceljs");
const Employee = require("../models/Employee");
const User = require("../models/User");
const LeaveRequest = require("../models/LeaveRequest");
const {
  matchEmployeeFromExcel,
  identityFieldsFromEmployee,
} = require("../utils/leaveEmployeeIdentity");

const PATH =
  process.argv[2] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

function cellDate(cell) {
  const v = cell?.value;
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === "object" && v.result instanceof Date) {
    const d = v.result;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return null;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const employees = await Employee.find({}).lean();
  const users = await User.find({}).lean();
  const userByEmp = {};
  users.forEach((u) => {
    if (u.employeeId) userByEmp[String(u.employeeId)] = u;
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PATH);

  let created = 0;
  let updated = 0;
  let unmatched = 0;
  const unmatchedNames = [];

  for (const ws of wb.worksheets) {
    const year = Number(ws.name);
    if (!Number.isFinite(year) || year < 2010 || year > 2100) continue;

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const idCell = String(ws.getCell(r, 1).value || "").trim();
      const name = String(ws.getCell(r, 2).value || "").trim();
      if (!name || name.toUpperCase().includes("STAFF")) continue;

      const empId = /^id[a-z]{2,4}-\d+/i.test(idCell) ? idCell : "";
      const matched = matchEmployeeFromExcel(employees, empId, name);
      if (!matched) {
        unmatched += 1;
        if (unmatchedNames.length < 20) unmatchedNames.push(`${ws.name} R${r} ${name}`);
        continue;
      }
      const linkedUser = userByEmp[String(matched._id)];
      const targetUserId = linkedUser ? linkedUser._id : matched._id;

      for (let pair = 0; pair < 8; pair += 1) {
        const start = cellDate(ws.getCell(r, 4 + pair * 2));
        const endRaw = cellDate(ws.getCell(r, 5 + pair * 2));
        if (!start || start.getUTCFullYear() !== year) continue;
        const end = endRaw && endRaw >= start ? endRaw : start;

        const y = start.getUTCFullYear();
        const mo = start.getUTCMonth();
        const da = start.getUTCDate();
        const windowStart = new Date(Date.UTC(y, mo, da - 1));
        const windowEnd = new Date(Date.UTC(y, mo, da + 2));
        const candidates = await LeaveRequest.find({
          status: { $in: ["Approved", "HOD Approved"] },
          startDate: { $gte: windowStart, $lt: windowEnd },
          $or: [
            { employeeRecordId: matched._id },
            { employee: targetUserId },
            { employeeId: matched.employeeId },
          ],
        });
        const existing = candidates.find((l) => {
          const x = new Date(l.startDate);
          return (
            (x.getUTCFullYear() === y && x.getUTCMonth() === mo && x.getUTCDate() === da) ||
            (x.getFullYear() === start.getFullYear() &&
              x.getMonth() === start.getMonth() &&
              x.getDate() === start.getDate())
          );
        });

        if (existing) {
          existing.endDate = end;
          existing.isPastLeave = true;
          existing.status = "Approved";
          existing.changeRemarks = `End date restored from Excel (${ws.name})`;
          Object.assign(existing, identityFieldsFromEmployee(matched));
          await existing.save();
          updated += 1;
        } else {
          await LeaveRequest.create({
            employee: targetUserId,
            employeeName: matched.employeeName,
            company: "Sonashi",
            department: matched.department || "",
            reportingManager: matched.reportingManager || "",
            leaveType: "Vacation",
            startDate: start,
            endDate: end,
            reason: `Imported from ${ws.name}`,
            status: "Approved",
            isPastLeave: true,
            requestAirfare: false,
            ...identityFieldsFromEmployee(matched),
          });
          created += 1;
        }
      }
    }
  }

  console.log(JSON.stringify({ created, updated, unmatched, unmatchedNames }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
