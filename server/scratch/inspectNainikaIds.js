/**
 * Inspect who owns Excel vs software IDs for Nainika case.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (_) {
  /* ignore */
}
const mongoose = require("mongoose");
const Employee = require("../models/Employee");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const rows = await Employee.find({
    $or: [
      { employeeId: /IDMO-197/i },
      { employeeId: /IDMO-198/i },
      { employeeName: /nainika/i },
      { employeeName: /conceita/i },
    ],
  })
    .select("employeeId employeeName doj excelLeaveYearTaken")
    .lean();
  console.log(JSON.stringify(rows, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
