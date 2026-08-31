require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '192.168.1.1']);
} catch (_) {
  /* ignore */
}
const path = require('path');
const { pathToFileURL } = require('url');
const ExcelJS = require('../../frontend/node_modules/exceljs');
const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const { parseLeaveMasterWorkbook, ymd } = require('../utils/excelLeaveWorkbook');

const SRC = 'C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx';
const AS_OF = '2026-08-31';
const TOL = 0.06;

function num(v) {
  if (v == null || v === '' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round2(v) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return Math.round(Number(v) * 100) / 100;
}
function close(a, b) {
  const x = num(a);
  const y = num(b);
  if (x == null && (y == null || y === 0)) return true;
  if ((x == null || x === 0) && (y == null || y === 0)) return true;
  if (x == null || y == null) return false;
  return Math.abs(x - y) <= TOL;
}
function codeOf(id) {
  return String(id || '').trim().toLowerCase();
}

(async () => {
  const { computeExcelLeaveCalculation, calculateEntitlementDays, lastFiveLeaveYears } =
    await import(pathToFileURL(path.join(__dirname, '../../frontend/src/utils/leaveCalculator.js')).href);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const parsed = await parseLeaveMasterWorkbook(wb);
  const excelEmployees = parsed.master.employees.filter((e) => e.staffName || e.employeeId);
  const tillYears = lastFiveLeaveYears(AS_OF);

  await mongoose.connect(process.env.MONGO_URI);
  const softwareEmployees = await Employee.find({})
    .select('employeeId employeeName doj excelLeaveYearTaken')
    .lean();
  const leaves = await LeaveRequest.find({ status: { $in: ['Approved', 'HOD Approved'] } }).lean();
  const byCode = new Map(softwareEmployees.map((e) => [codeOf(e.employeeId), e]));

  let matched = 0;
  let unmatched = 0;
  const fail = { entitlement: 0, taken: 0, year: 0, available: 0 };
  const samples = [];

  excelEmployees.forEach((ex) => {
    const code = codeOf(ex.employeeId);
    if (!code) return;
    const sw = byCode.get(code);
    if (!sw) {
      unmatched += 1;
      return;
    }
    matched += 1;
    const calc = computeExcelLeaveCalculation(sw, leaves, AS_OF);
    const excelDoj = ymd(ex.joiningDate);
    const expectedEnt = excelDoj ? calculateEntitlementDays(excelDoj, AS_OF) : calculateEntitlementDays(sw.doj, AS_OF);
    const excelYearSum = tillYears.reduce((s, y) => s + (num(ex.years?.[y]) || 0), 0);
    const excelTaken = num(ex.last5Taken) != null ? round2(ex.last5Taken) : round2(excelYearSum);
    const expectedAvail = round2(expectedEnt - (excelTaken || 0));

    const rowFails = [];
    if (!close(expectedEnt, calc.entitlement)) {
      fail.entitlement += 1;
      rowFails.push(`ENT excel-rule ${expectedEnt} vs sw ${calc.entitlement} (doj excel ${excelDoj} sw ${ymd(sw.doj)})`);
    }
    if (excelTaken != null && !close(excelTaken, calc.totalTaken)) {
      fail.taken += 1;
      const years = tillYears
        .filter((y) => !close(num(ex.years?.[y]) || 0, calc.yearTotals?.[y] || 0))
        .map((y) => `${y}:x${ex.years?.[y] ?? 0}/s${calc.yearTotals?.[y] ?? 0}`);
      rowFails.push(`TAKEN excel ${excelTaken} vs sw ${calc.totalTaken} ${years.slice(0, 4).join(',')}`);
    }
    tillYears.forEach((y) => {
      const ev = num(ex.years?.[y]);
      const sv = num(calc.yearTotals?.[y]);
      if (ev != null && !close(ev, sv || 0)) fail.year += 1;
    });
    if (expectedAvail != null && !close(expectedAvail, calc.availableDays)) {
      fail.available += 1;
      rowFails.push(`AVAIL ${expectedAvail} vs ${calc.availableDays}`);
    }
    if (rowFails.length && samples.length < 12) {
      samples.push(`${ex.employeeId} ${ex.staffName}: ${rowFails.join(' | ')}`);
    }
  });

  console.log(JSON.stringify({
    asOf: AS_OF,
    excelRows: excelEmployees.length,
    matched,
    unmatchedExcelIds: unmatched,
    failEntitlement: fail.entitlement,
    failTaken: fail.taken,
    failYearCells: fail.year,
    failAvailable: fail.available,
    samples,
  }, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
