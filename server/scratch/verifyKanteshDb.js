require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
try { dns.setServers(["8.8.8.8", "1.1.1.1", "192.168.1.1"]); } catch (_) {}
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const LeaveRequest = require("../models/LeaveRequest");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const emp = await Employee.findOne({
    $or: [
      { employeeId: /idfo-000/i },
      { employeeName: /kantesh/i },
    ],
  }).lean();
  console.log({
    id: emp?.employeeId,
    name: emp?.employeeName,
    doj: emp?.doj,
    excelLeaveYearTaken: emp?.excelLeaveYearTaken,
  });
  const last5 = [2021, 2022, 2023, 2024, 2025, 2026].reduce(
    (s, y) => s + Number(emp?.excelLeaveYearTaken?.[y] ?? emp?.excelLeaveYearTaken?.[String(y)] ?? 0),
    0
  );
  console.log("excel last5", last5);

  const leaves = await LeaveRequest.find({
    status: { $in: ["Approved", "HOD Approved"] },
    $or: [
      { employeeRecordId: emp._id },
      { employeeId: emp.employeeId },
      { employeeName: /kantesh/i },
    ],
  })
    .select("startDate endDate leaveDays importSource requestAirfare reason changeRemarks employeeId")
    .sort({ startDate: 1 })
    .lean();

  const byYear = {};
  leaves.forEach((l) => {
    const y = new Date(l.startDate).getUTCFullYear();
    const days =
      l.leaveDays != null
        ? Number(l.leaveDays)
        : Math.round((new Date(l.endDate) - new Date(l.startDate)) / 86400000);
    byYear[y] = (byYear[y] || 0) + days;
  });
  console.log("records", leaves.length, "year totals from records", byYear);
  console.log(
    "sample 2025-2026",
    leaves
      .filter((l) => {
        const y = new Date(l.startDate).getUTCFullYear();
        return y >= 2025;
      })
      .map((l) => ({
        start: String(l.startDate).slice(0, 10),
        end: String(l.endDate).slice(0, 10),
        leaveDays: l.leaveDays,
        src: l.importSource,
        air: l.requestAirfare,
        remarks: l.changeRemarks,
      }))
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
