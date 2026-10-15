/** READ-ONLY verify UMESH employee leaveEndDate vs linked leave endDate */
require("dns").setDefaultResultOrder("ipv4first");
try {
  require("dns").setServers(["8.8.8.8", "1.1.1.1", "192.168.1.1"]);
} catch (_) {}
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const LeaveRequest = require("../models/LeaveRequest");

function ymd(v) {
  if (!v) return null;
  const d = new Date(v);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} UTC / local ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const emp = await Employee.findOne({ employeeName: /UMESH PAYYAM VALAPPIL/i }).lean();
  if (!emp) {
    console.log(JSON.stringify({ error: "not found" }));
    process.exit(0);
  }
  const leave = await LeaveRequest.findById("6a955aefb22625b3720bf677").lean();
  console.log(
    JSON.stringify(
      {
        employee: {
          leaveEndDate: emp.leaveEndDate,
          leaveEndLocal: ymd(emp.leaveEndDate),
          travellingDate: emp.travellingDate,
          vacationStatus: emp.vacationStatus,
        },
        leave: leave
          ? {
              id: String(leave._id),
              startDate: leave.startDate,
              endDate: leave.endDate,
              endLocal: ymd(leave.endDate),
              leaveDays: leave.leaveDays,
            }
          : null,
        displayWouldShow: emp.leaveEndDate || leave?.endDate,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
