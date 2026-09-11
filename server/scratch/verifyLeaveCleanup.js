require("dns").setDefaultResultOrder("ipv4first");
try {
  require("dns").setServers(["8.8.8.8", "1.1.1.1", "192.168.1.1"]);
} catch (_) {}
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const LeaveRequest = require("../models/LeaveRequest");
const Employee = require("../models/Employee");

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const [leaveCount, employeeCount, mehtab, deletedGone, salarySample] = await Promise.all([
    LeaveRequest.countDocuments(),
    Employee.countDocuments(),
    LeaveRequest.find({ employeeName: /mehtab/i }).select("employeeId employeeName leaveType startDate endDate reason status importSource changedBy createdAt").lean(),
    LeaveRequest.find({ _id: { $in: ["6a8e75581f4cff133424b3f2", "6a9a6bc8e31d52a8ca0bb8e8"] } }).select("_id").lean(),
    Employee.findOne({ employeeId: /IDMO-178/i }).select("employeeId employeeName basicPay houseRent travelExp otherAllowance monthlySalary").lean(),
  ]);
  console.log(JSON.stringify({
    leaveCount,
    employeeCount,
    deletedStillPresent: deletedGone.length,
    mehtab,
    melvinSalaryUnchangedSample: salarySample,
  }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
