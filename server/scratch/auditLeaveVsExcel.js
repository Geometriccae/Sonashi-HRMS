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
const OUT = path.join(__dirname, 'leaveExcelAudit.json');
const TOL = 0.05;

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
  if (x == null && y == null) return true;
  if (x == null || y == null) return false;
  return Math.abs(x - y) <= TOL;
}

function calYmd(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function excelYmd(value) {
  if (!value) return '';
  return ymd(value) || calYmd(value);
}

function sumExcelYears(years, yearList) {
  let total = 0;
  let any = false;
  yearList.forEach((year) => {
    const n = num(years?.[year] ?? years?.[String(year)]);
    if (n != null) {
      total += n;
      any = true;
    }
  });
  return any ? round2(total) : null;
}

(async () => {
  const { computeExcelLeaveCalculation, lastFiveLeaveYears } = await import(
    pathToFileURL(path.join(__dirname, '../../frontend/src/utils/leaveCalculator.js')).href
  );

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  const parsed = await parseLeaveMasterWorkbook(wb);
  const excelEmployees = parsed.master.employees.filter((e) => e.staffName || e.employeeId);

  await mongoose.connect(process.env.MONGO_URI);
  const softwareEmployees = await Employee.find({})
    .select('employeeId employeeName doj excelLeaveYearTaken employeeStatus totalYearsExperience')
    .lean();
  const leaves = await LeaveRequest.find({})
    .select('employee employeeRecordId employeeId employeeName linkedEmployeeCode leaveType startDate endDate leaveDays status importSource changeRemarks excludeFromBalance')
    .lean();

  const byCode = new Map();
  softwareEmployees.forEach((e) => {
    const id = String(e.employeeId || '').trim().toLowerCase();
    if (id) byCode.set(id, e);
  });

  const tillDates = excelEmployees.map((e) => excelYmd(e.till)).filter(Boolean);
  const tillMode = tillDates.sort()[Math.floor(tillDates.length / 2)] || '2026-08-22';
  const tillDate = new Date(`${tillMode}T00:00:00`);
  const last5Years = lastFiveLeaveYears(tillDate);

  const mismatches = [];
  const rows = [];
  let matched = 0;
  let unmatchedExcel = 0;
  let passEmployees = 0;

  const pushMismatch = (row, field, excel, software, reason) => {
    const ex = excel == null || excel === '' ? null : excel;
    const sw = software == null || software === '' ? null : software;
    mismatches.push({
      employeeId: row.employeeId,
      employee: row.employeeName,
      field,
      excel: ex,
      software: sw,
      difference: typeof ex === 'number' && typeof sw === 'number' ? round2(sw - ex) : null,
      status: 'FAIL',
      reason,
    });
  };

  excelEmployees.forEach((ex) => {
    const code = String(ex.employeeId || '').trim();
    if (!code) {
      unmatchedExcel += 1;
      rows.push({
        employeeId: ex.rawId || '',
        employeeName: ex.staffName,
        match: 'NO_ID',
        status: 'UNMATCHED',
      });
      mismatches.push({
        employeeId: ex.rawId || '(blank)',
        employee: ex.staffName,
        field: 'Employee ID',
        excel: ex.rawId || '',
        software: null,
        difference: null,
        status: 'FAIL',
        reason: 'Excel row has no staff ID (IDFO/IDMO/IDMS). Not matched.',
      });
      return;
    }

    const sw = byCode.get(code.toLowerCase());
    if (!sw) {
      unmatchedExcel += 1;
      rows.push({ employeeId: code, employeeName: ex.staffName, match: 'MISSING_IN_SOFTWARE', status: 'UNMATCHED' });
      mismatches.push({
        employeeId: code,
        employee: ex.staffName,
        field: 'Employee ID',
        excel: code,
        software: null,
        difference: null,
        status: 'FAIL',
        reason: 'No HRMS employee with this Employee ID.',
      });
      return;
    }

    matched += 1;
    const calc = computeExcelLeaveCalculation(sw, leaves, tillDate);
    const excelYears = ex.years || {};
    const excelLast5 = num(ex.last5Taken) != null ? round2(ex.last5Taken) : sumExcelYears(excelYears, last5Years);
    const excelYrs = num(ex.yrs) != null ? round2(ex.yrs) : (num(ex.last5Days) != null ? round2(ex.last5Days / 365) : round2(calc.workingYears));
    const excelAvrg = num(ex.avrg);
    const excelDue = num(ex.leaveDue);
    const excelWorkingYrs = num(ex.workingYrs);
    const excelDoj = excelYmd(ex.joiningDate);
    const swDoj = calYmd(sw.doj);
    const excelCalcLeave = excelYmd(ex.calculateLeave);
    const swCalcLeave = calYmd(calc.calculateLeaveDate);
    const excelImpliedEntitlement = excelYrs != null ? Math.min(round2(excelYrs * 30), 150) : null;
    const excelImpliedAvailable = excelImpliedEntitlement != null && excelLast5 != null
      ? round2(excelImpliedEntitlement - excelLast5)
      : null;

    const employeeMismatchesBefore = mismatches.length;

    if (excelDoj && swDoj && excelDoj !== swDoj) {
      pushMismatch({ employeeId: code, employeeName: sw.employeeName }, 'DOJ', excelDoj, swDoj, 'Stored joining date differs from Excel JOINING DATE.');
    }
    if (excelCalcLeave && swCalcLeave && excelCalcLeave !== swCalcLeave) {
      pushMismatch(
        { employeeId: code, employeeName: sw.employeeName },
        'CALCULATE LEAVE',
        excelCalcLeave,
        swCalcLeave,
        'Excel CALCULATE LEAVE is not always 1 Jan of (year-5) or DOJ; some rows use a later date (often after joining). Software uses MAX(DOJ, 1 Jan of calculation year − 5).'
      );
    }
    if (excelLast5 != null && !close(excelLast5, calc.totalTaken)) {
      const yearDiffs = last5Years
        .map((y) => {
          const ev = num(excelYears[y] ?? excelYears[String(y)]);
          const sv = num(calc.yearTotals?.[y] ?? calc.historicalYearTotals?.[y]);
          if (ev == null && (sv == null || sv === 0)) return null;
          if (close(ev || 0, sv || 0)) return null;
          return `${y}: Excel ${ev ?? 0} vs SW ${sv ?? 0}`;
        })
        .filter(Boolean);
      pushMismatch(
        { employeeId: code, employeeName: sw.employeeName },
        'Taken (last 5 years)',
        excelLast5,
        round2(calc.totalTaken),
        yearDiffs.length
          ? `Year totals differ (${yearDiffs.slice(0, 4).join('; ')}). Excel last-5 SUM ranges also vary by row.`
          : 'Window or eligible-leave filter differs from Excel last-5 SUM.'
      );
    }
    if (excelDue != null && !close(excelDue, calc.leaveDue)) {
      pushMismatch(
        { employeeId: code, employeeName: sw.employeeName },
        'LEAVE DUE / Available',
        round2(excelDue),
        round2(calc.leaveDue),
        'LEAVE DUE still differs after aligning to Excel (30 − Avrg) × yrs. Usually driven by Taken, yrs, or CALCULATE LEAVE, not a leftover entitlement−taken formula.'
      );
    }
    if (excelYrs != null && !close(excelYrs, calc.workingYears)) {
      pushMismatch(
        { employeeId: code, employeeName: sw.employeeName },
        'yrs (window years)',
        excelYrs,
        round2(calc.workingYears),
        'Excel yrs = (TILL − CALCULATE LEAVE) / 365. Software uses the same formula from its CALCULATE LEAVE date, so a CALCULATE LEAVE mismatch drives this.'
      );
    }
    if (excelWorkingYrs != null && !close(excelWorkingYrs, calc.totalWorkingDays / 365)) {
      pushMismatch(
        { employeeId: code, employeeName: sw.employeeName },
        'working yrs',
        round2(excelWorkingYrs),
        round2(calc.totalWorkingDays / 365),
        'Excel working yrs = (TILL − JOINING DATE) / 365. Difference is DOJ or TILL date.'
      );
    }
    if (excelImpliedEntitlement != null && !close(excelImpliedEntitlement, calc.entitlement)) {
      pushMismatch(
        { employeeId: code, employeeName: sw.employeeName },
        'Entitlement (derived)',
        excelImpliedEntitlement,
        round2(calc.entitlement),
        'Excel has no Entitlement column. Derived as min(yrs×30, 150) from Excel yrs. Differs when CALCULATE LEAVE / yrs differ.'
      );
    }

    last5Years.forEach((year) => {
      const ev = num(excelYears[year] ?? excelYears[String(year)]);
      const sv = num(calc.yearTotals?.[year] ?? calc.historicalYearTotals?.[year]) || 0;
      if (ev == null) return;
      if (!close(ev, sv)) {
        pushMismatch(
          { employeeId: code, employeeName: sw.employeeName },
          `Year ${year}`,
          ev,
          round2(sv),
          'Yearly total differs. Excel cell is often a cross-sheet TOTAL; software uses excelLeaveYearTaken plus live approved (non-imported) leave.'
        );
      }
    });

    const newFails = mismatches.length - employeeMismatchesBefore;
    if (newFails === 0) passEmployees += 1;
    rows.push({
      employeeId: code,
      employeeName: sw.employeeName,
      excelName: ex.staffName,
      status: newFails === 0 ? 'PASS' : 'FAIL',
      failCount: newFails,
      excelDue: excelDue,
      swDue: round2(calc.leaveDue),
      excelTaken: excelLast5,
      swTaken: round2(calc.totalTaken),
      swEntitlement: round2(calc.entitlement),
      swExpired: round2(calc.expiredDays),
      excelImpliedEntitlement,
    });
  });

  const excelIds = new Set(excelEmployees.map((e) => String(e.employeeId || '').trim().toLowerCase()).filter(Boolean));
  const extraSoftware = softwareEmployees.filter((e) => {
    const id = String(e.employeeId || '').trim().toLowerCase();
    return id && !excelIds.has(id);
  }).length;

  const fieldCounts = {};
  mismatches.forEach((m) => {
    fieldCounts[m.field] = (fieldCounts[m.field] || 0) + 1;
  });

  const report = {
    source: SRC,
    tillDate: tillMode,
    last5Years,
    excelEmployees: excelEmployees.length,
    softwareEmployees: softwareEmployees.length,
    matched,
    unmatchedExcel,
    extraSoftwareNotInExcel: extraSoftware,
    passEmployees,
    failEmployees: matched - passEmployees,
    mismatchCount: mismatches.length,
    fieldCounts,
    mismatches,
    employeeSummary: rows,
  };

  require('fs').writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    tillDate: tillMode,
    last5Years,
    excelEmployees: report.excelEmployees,
    matched,
    unmatchedExcel,
    extraSoftwareNotInExcel: extraSoftware,
    passEmployees,
    failEmployees: report.failEmployees,
    mismatchCount: mismatches.length,
    fieldCounts,
  }, null, 2));
  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
