/**
 * Repair LeaveRequest rows where endDate is before startDate.
 * Those rows showed "—" in Days and could not match Excel exclusive days.
 */
const dns = require("dns");
try {
  const dnsServers = dns.getServers();
  if (dnsServers.length === 0 || dnsServers[0] === "127.0.0.1") {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
} catch (_) {}

require("dotenv").config();
const mongoose = require("mongoose");
const LeaveRequest = require("../models/LeaveRequest");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const inverted = await LeaveRequest.find({
    startDate: { $exists: true, $ne: null },
    endDate: { $exists: true, $ne: null },
    $expr: { $lt: ["$endDate", "$startDate"] },
  }).select("employeeName startDate endDate leaveType status");

  console.log("Inverted leave rows:", inverted.length);
  inverted.slice(0, 20).forEach((row) => {
    console.log(
      row.employeeName,
      row.startDate?.toISOString?.()?.slice(0, 10),
      "->",
      row.endDate?.toISOString?.()?.slice(0, 10),
      row.status
    );
  });

  for (const row of inverted) {
    const start = row.startDate;
    const end = row.endDate;
    row.startDate = end;
    row.endDate = start;
    await row.save();
  }

  console.log("Swapped", inverted.length, "leave date ranges");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
