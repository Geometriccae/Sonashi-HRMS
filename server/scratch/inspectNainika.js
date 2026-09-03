require('dns').setDefaultResultOrder('ipv4first');
try {
  require('dns').setServers(['8.8.8.8', '1.1.1.1', '192.168.1.1']);
} catch (_) {}
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  const emps = await Employee.find({
    $or: [
      { employeeName: /nainika/i },
      { employeeId: /IDMO-197/i },
      { employeeId: /IDMO-198/i },
    ],
  })
    .select('employeeId employeeName doj excelLeaveYearTaken excelLeaveImportedAt')
    .lean();
  console.log('EMPLOYEES', JSON.stringify(emps, null, 2));

  const { computeExcelLeaveCalculation, leaveRequestDays } = await import(
    pathToFileURL(path.join(__dirname, '../../frontend/src/utils/leaveCalculator.js')).href
  );

  for (const e of emps) {
    const leaves = await LeaveRequest.find({
      $or: [
        { employeeId: e.employeeId },
        { employeeId: new RegExp(`^${String(e.employeeId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        { employeeName: /nainika/i },
        { employeeRecordId: e._id },
      ],
    })
      .select('employeeId employeeName status startDate endDate leaveDays importSource leaveType employeeRecordId changeRemarks')
      .lean();
    console.log('\n====', e.employeeId, e.employeeName, 'leaves:', leaves.length);
    leaves.forEach((l) => {
      console.log({
        id: String(l._id),
        empId: l.employeeId,
        name: l.employeeName,
        status: l.status,
        start: l.startDate,
        end: l.endDate,
        days: l.leaveDays,
        calcDays: leaveRequestDays(l),
        src: l.importSource,
        type: l.leaveType,
      });
    });
    const calc = computeExcelLeaveCalculation(e, leaves, '2026-09-03');
    console.log('CALC', {
      entitlement: calc.entitlement,
      totalTaken: calc.totalTaken,
      available: calc.availableDays,
      yearTotals: calc.yearTotals,
      historicalYearTotals: calc.historicalYearTotals,
      excelMap: e.excelLeaveYearTaken,
    });
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
