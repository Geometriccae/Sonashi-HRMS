/**
 * One-off READ+SYNC: align linked LeaveRequest dates with Employee Master for
 * employees whose leaveEndDate/travellingDate already differ from leave.
 * Safe to re-run. Does not change schema or unrelated collections.
 */
require("dns").setDefaultResultOrder("ipv4first");
try {
  require("dns").setServers(["8.8.8.8", "1.1.1.1", "192.168.1.1"]);
} catch (_) {}
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const { syncLinkedLeaveDatesFromEmployee } = require("../utils/syncLeaveDatesFromEmployee");
const { invalidateListCache } = require("../utils/employeeListCache");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const filter = process.argv[2]
    ? { employeeName: new RegExp(process.argv[2], "i") }
    : {
        $or: [
          { leaveEndDate: { $ne: null } },
          { travellingDate: { $ne: null } },
        ],
      };

  const employees = await Employee.find(filter).limit(500);
  const results = [];
  for (const emp of employees) {
    if (!emp.leaveEndDate && !emp.travellingDate) continue;
    const before = {
      id: String(emp._id),
      name: emp.employeeName,
      leaveEndDate: emp.leaveEndDate,
      travellingDate: emp.travellingDate,
    };
    const updated = await syncLinkedLeaveDatesFromEmployee(emp, {
      travellingDate: emp.travellingDate,
      leaveEndDate: emp.leaveEndDate,
      actor: "System",
    });
    results.push({
      ...before,
      leaveSynced: Boolean(updated),
      leaveId: updated ? String(updated._id) : null,
      leaveEndAfter: updated?.endDate || null,
      leaveStartAfter: updated?.startDate || null,
    });
  }
  invalidateListCache();
  console.log(JSON.stringify({ count: results.length, results }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
