import ExcelJS from "exceljs";
import {
  calculateLeaveDays,
  computeExcelLeaveCalculation,
  getApprovedLeavesForEmployee,
  getLeaveTillDate,
  lastFiveLeaveYears,
  toLeaveCalendarDate,
} from "./leaveCalculator";

const MIN_LEAVE_SLOTS = 3;
/** Client master tracker includes yearly sheets from 2010 onward. */
const MASTER_TRACKER_START_YEAR = 2010;

/** Same yellow as Staff Leave Report_Master tracker (ticket booked by company). */
const YELLOW_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFF00" },
};

const HEADER_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFBDD7EE" },
};

const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FFB0B0B0" } },
  left: { style: "thin", color: { argb: "FFB0B0B0" } },
  bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
  right: { style: "thin", color: { argb: "FFB0B0B0" } },
};

const applyYellow = (cell) => {
  if (cell) cell.fill = YELLOW_FILL;
};

const parseDate = (val) => toLeaveCalendarDate(val);

const formatJoinMonthYear = (d) => {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};

const colLetter = (c1based) => {
  let n = c1based;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

/**
 * Group approved leaves by calendar year of startDate.
 * Each leave: { start, end, days, remarks, requestAirfare }
 * Only current DB-approved leaves — deleted/cancelled never appear.
 */
const groupLeavesByYear = (leaves) => {
  const byYear = {};
  leaves.forEach((req) => {
    const start = parseDate(req.startDate);
    const end = parseDate(req.endDate) || start;
    if (!start) return;
    const year = start.getFullYear();
    // Inclusive days — same rule as Leave Management / leaveCalculator
    const days = calculateLeaveDays(start, end) || 0;
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push({
      start,
      end,
      days,
      remarks: [
        req.reason || req.changeRemarks || "",
        req.requestAirfare ? "Ticket booked by company" : "",
      ]
        .filter(Boolean)
        .join(" | "),
      requestAirfare: !!req.requestAirfare,
    });
  });
  Object.keys(byYear).forEach((y) => {
    byYear[y].sort((a, b) => a.start - b.start);
  });
  return byYear;
};

/**
 * Years from 2010 through TILL year, plus one future year so staff can add ahead.
 * Also includes any later leave years present in data.
 */
const buildYearRange = (employees, leaveRequests, tillDate) => {
  const tillYear = tillDate.getFullYear();
  const currentYear = new Date().getFullYear();
  let maxYear = Math.max(tillYear, currentYear);

  (leaveRequests || []).forEach((req) => {
    const s = parseDate(req.startDate);
    if (s) maxYear = Math.max(maxYear, s.getFullYear());
  });
  employees.forEach((emp) => {
    const doj = parseDate(emp.doj);
    if (doj) maxYear = Math.max(maxYear, doj.getFullYear());
  });

  const years = [];
  for (let y = MASTER_TRACKER_START_YEAR; y <= maxYear; y += 1) years.push(y);
  return years;
};

const ordinal = (n) => {
  const labels = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH", "9TH", "10TH"];
  if (n <= labels.length) return `${labels[n - 1]} LEAVE`;
  return `${n}TH LEAVE`;
};

/**
 * Build summary + per-year sheet data for Staff Leave Report Master tracker format.
 * Input must be the latest employees + leave requests from the database.
 */
export function buildLeaveMasterTrackerData({
  employees = [],
  leaveRequests = [],
  tillDate = null,
} = {}) {
  const till = toLeaveCalendarDate(tillDate) || getLeaveTillDate();

  const years = buildYearRange(employees, leaveRequests, till);
  const last5Years = lastFiveLeaveYears(till).filter((y) => years.includes(y));

  const employeeRows = employees.map((emp, idx) => {
    const calc = computeExcelLeaveCalculation(emp, leaveRequests, till);
    const leavesByYear = groupLeavesByYear(
      getApprovedLeavesForEmployee(emp, leaveRequests)
    );

    const yearTotals = {};
    const yearHasCompanyTicket = {};
    years.forEach((y) => {
      const list = leavesByYear[y] || [];
      // Prefer live leave slots for year totals (keeps sheet TOTAL in sync with leave rows)
      const slotTotal = list.reduce((sum, l) => sum + (l.days || 0), 0);
      yearTotals[y] = slotTotal > 0 ? slotTotal : (calc.yearTotals[y] || 0);
      yearHasCompanyTicket[y] = list.some((l) => l.requestAirfare);
    });

    return {
      sno: idx + 1,
      employeeId: emp.employeeId || "",
      staffName: emp.employeeName || emp.name || "",
      salesman: "",
      joiningDate: calc.joiningDate,
      calculateLeave: calc.calculateLeaveDate,
      yearTotals,
      yearHasCompanyTicket,
      leavesByYear,
      last5Taken: calc.totalTaken,
      avrg: calc.averageLeave,
      leaveDue: calc.leaveDue,
      last5WindowDays: calc.workingDays,
      yrs: calc.workingYears,
      workingYrs: calc.workingYears,
      till,
    };
  });

  let maxSlots = MIN_LEAVE_SLOTS;
  employeeRows.forEach((row) => {
    Object.values(row.leavesByYear).forEach((list) => {
      maxSlots = Math.max(maxSlots, list.length);
    });
  });

  return { years, last5Years, maxSlots, till, employeeRows };
}

/** Flat summary rows for preview / PDF (calculation-friendly). */
export function buildLeaveMasterTrackerSummaryRows(trackerData) {
  const { years, employeeRows } = trackerData;
  return employeeRows.map((row) => {
    const out = {
      "S.NO.": row.sno,
      "Employee ID": row.employeeId,
      "STAFF NAME": row.staffName,
      Salesman: row.salesman,
      "JOINING DATE": formatJoinMonthYear(row.joiningDate),
      "CALCULATE LEAVE": formatJoinMonthYear(row.calculateLeave),
    };
    years.forEach((y) => {
      out[String(y)] = row.yearTotals[y] || 0;
    });
    out["last 5 years leave taken"] = Number(Number(row.last5Taken).toFixed(2));
    out.Avrg = Number(Number(row.avrg).toFixed(2));
    out["LEAVE DUE"] = Number(Number(row.leaveDue).toFixed(2));
    out["last 5 years"] = row.last5WindowDays;
    out.yrs = Number(Number(row.yrs).toFixed(2));
    out["working yrs"] = Number(Number(row.workingYrs).toFixed(2));
    out.TILL = row.till.toLocaleDateString("en-US");
    return out;
  });
}

/**
 * Build an ExcelJS workbook matching Staff Leave Report_Master tracker.xlsx
 * Yellow cells = ticket booked by the company (requestAirfare), data-driven.
 */
export function buildLeaveMasterTrackerWorkbook(trackerData) {
  const { years, last5Years, maxSlots, employeeRows } = trackerData;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sonashi HRMS";

  // ── Summary sheet (named "Sheet" like the master file) ──
  const wsSummary = wb.addWorksheet("Sheet");

  const noteCell = wsSummary.getCell(1, 4);
  noteCell.value = "MARKED IN YELLOW IS TICKET BOOKED BY THE COMPANY";
  noteCell.font = { bold: true };
  applyYellow(noteCell);
  wsSummary.mergeCells(1, 4, 1, 4 + Math.max(years.length, 1));

  const header = [
    "S.NO.",
    "Employee ID",
    "STAFF NAME",
    "Salesman",
    "",
    "JOINING DATE",
    "CALCULATE LEAVE",
    ...years.map(String),
    "last 5 years leave taken",
    "Avrg",
    "LEAVE DUE",
    "last 5 years",
    "yrs",
    "working yrs",
    "TILL",
  ];
  const headerRow = wsSummary.getRow(2);
  header.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
  });

  const firstYearCol = 8; // 1-based Excel column of first year
  const last5StartIdx = years.indexOf(last5Years[0]);
  const last5EndIdx = years.indexOf(last5Years[last5Years.length - 1]);
  const colLast5Taken = firstYearCol + years.length;
  const colAvrg = colLast5Taken + 1;
  const colLeaveDue = colAvrg + 1;
  const colLast5Days = colLeaveDue + 1;
  const colYrs = colLast5Days + 1;
  const colWorkingYrs = colYrs + 1;
  const colTill = colWorkingYrs + 1;

  // Year-sheet TOTAL column index (1-based): after SI/NAME/JOIN + 2*slots dates + slots day cols
  const yearTotalColIndex = 3 + maxSlots * 2 + maxSlots + 1;
  const yearTotalColLetter = colLetter(yearTotalColIndex);

  employeeRows.forEach((row, i) => {
    const excelRow = i + 3;
    const yearSheetRow = i + 2; // year sheets start data at row 2
    const r = wsSummary.getRow(excelRow);
    r.getCell(1).value = row.sno;
    r.getCell(2).value = row.employeeId;
    r.getCell(3).value = row.staffName;
    r.getCell(4).value = row.salesman;
    r.getCell(6).value = row.joiningDate || null;
    if (row.joiningDate) r.getCell(6).numFmt = "mmm-yy";
    r.getCell(7).value = row.calculateLeave || null;
    if (row.calculateLeave) r.getCell(7).numFmt = "mmm-yy";

    years.forEach((y, yi) => {
      const cell = r.getCell(firstYearCol + yi);
      // Cross-sheet TOTAL like the client master: ='2026'!M2
      cell.value = {
        formula: `='${y}'!${yearTotalColLetter}${yearSheetRow}`,
        result: row.yearTotals[y] || 0,
      };
      if (row.yearHasCompanyTicket?.[y]) applyYellow(cell);
      cell.border = THIN_BORDER;
    });

    const last5Cell = r.getCell(colLast5Taken);
    const avrgCell = r.getCell(colAvrg);
    const dueCell = r.getCell(colLeaveDue);

    if (last5Years.length > 0 && last5StartIdx >= 0 && last5EndIdx >= 0) {
      const startCol = firstYearCol + last5StartIdx;
      const endCol = firstYearCol + last5EndIdx;
      last5Cell.value = {
        formula: `SUM(${colLetter(startCol)}${excelRow}:${colLetter(endCol)}${excelRow})`,
        result: row.last5Taken,
      };
    } else {
      last5Cell.value = row.last5Taken;
    }

    // Avrg = Working Years capped at 5 (matches leaveCalculator averageLeave)
    avrgCell.value = {
      formula: `ROUND(MIN(${colLetter(colLast5Days)}${excelRow}/365,5),2)`,
      result: row.avrg,
    };
    avrgCell.numFmt = "0.00";

    r.getCell(colLast5Days).value = row.last5WindowDays;

    const yrsCell = r.getCell(colYrs);
    yrsCell.value = {
      formula: `ROUND(${colLetter(colLast5Days)}${excelRow}/365,2)`,
      result: row.yrs,
    };
    yrsCell.numFmt = "0.00";

    // LEAVE DUE = (Average Leave × 30) − Leave Taken
    dueCell.value = {
      formula: `ROUND(${colLetter(colAvrg)}${excelRow}*30-${colLetter(colLast5Taken)}${excelRow},2)`,
      result: row.leaveDue,
    };
    dueCell.numFmt = "0.00";

    r.getCell(colWorkingYrs).value = row.workingYrs;
    r.getCell(colWorkingYrs).numFmt = "0.00";
    r.getCell(colTill).value = row.till;
    r.getCell(colTill).numFmt = "m/d/yyyy";
    last5Cell.numFmt = "0.00";
  });

  wsSummary.views = [{ state: "frozen", ySplit: 2 }];
  wsSummary.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2 + employeeRows.length, column: header.length },
  };

  // ── Per-year sheets (newest first, like master file) ──
  [...years].reverse().forEach((year) => {
    const ws = wb.addWorksheet(String(year));

    // Header row — merge each leave label across start/end columns (client format)
    const headerYr = ws.getRow(1);
    headerYr.getCell(1).value = "SI NO";
    headerYr.getCell(2).value = "STAFF NAME";
    headerYr.getCell(3).value = "JOINING DATE";

    const dateStartCol = 4;
    for (let s = 1; s <= maxSlots; s += 1) {
      const startCol = dateStartCol + (s - 1) * 2;
      const endCol = startCol + 1;
      headerYr.getCell(startCol).value = ordinal(s);
      try {
        ws.mergeCells(1, startCol, 1, endCol);
      } catch (_) {
        /* already merged */
      }
    }

    const daysStartCol = dateStartCol + maxSlots * 2;
    for (let s = 1; s <= maxSlots; s += 1) {
      headerYr.getCell(daysStartCol + s - 1).value = String(s);
    }
    const totalCol = daysStartCol + maxSlots;
    headerYr.getCell(totalCol).value = "TOTAL";
    headerYr.getCell(totalCol + 1).value = "Remarks";

    for (let c = 1; c <= totalCol + 1; c += 1) {
      const cell = headerYr.getCell(c);
      cell.font = { bold: true };
      cell.fill = HEADER_FILL;
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }

    employeeRows.forEach((row, idx) => {
      const leaves = row.leavesByYear[year] || [];
      const excelRow = idx + 2;
      const r = ws.getRow(excelRow);
      // Client format: SI NO is serial number (not employee ID)
      r.getCell(1).value = row.sno;
      r.getCell(2).value = row.staffName;
      r.getCell(3).value = row.joiningDate || null;
      if (row.joiningDate) r.getCell(3).numFmt = "mmm-yy";

      for (let s = 0; s < maxSlots; s += 1) {
        const leave = leaves[s];
        const startCell = r.getCell(dateStartCol + s * 2);
        const endCell = r.getCell(dateStartCol + s * 2 + 1);
        if (leave) {
          startCell.value = leave.start;
          endCell.value = leave.end;
          startCell.numFmt = "m/d/yy";
          endCell.numFmt = "m/d/yy";
          // Yellow = company ticket (requestAirfare) — data-driven, never hardcoded
          if (leave.requestAirfare) {
            applyYellow(startCell);
            applyYellow(endCell);
          }
        }
        startCell.border = THIN_BORDER;
        endCell.border = THIN_BORDER;
      }

      for (let s = 0; s < maxSlots; s += 1) {
        const leave = leaves[s];
        const dayCell = r.getCell(daysStartCol + s);
        const startRef = `${colLetter(dateStartCol + s * 2)}${excelRow}`;
        const endRef = `${colLetter(dateStartCol + s * 2 + 1)}${excelRow}`;
        // Inclusive days (same as Leave Management): end − start + 1
        dayCell.value = {
          formula: `IF(OR(${startRef}="",${endRef}=""),0,${endRef}-${startRef}+1)`,
          result: leave ? leave.days : 0,
        };
        if (leave?.requestAirfare) applyYellow(dayCell);
        dayCell.border = THIN_BORDER;
      }

      const firstDayRef = `${colLetter(daysStartCol)}${excelRow}`;
      const lastDayRef = `${colLetter(daysStartCol + maxSlots - 1)}${excelRow}`;
      const total = leaves.reduce((sum, l) => sum + (l.days || 0), 0);
      const remarks = leaves
        .filter((l) => l.remarks)
        .map((l) => l.remarks)
        .join("; ");

      const totalCell = r.getCell(totalCol);
      totalCell.value = {
        formula: `SUM(${firstDayRef}:${lastDayRef})`,
        result: total,
      };
      totalCell.border = THIN_BORDER;
      r.getCell(totalCol + 1).value = remarks;
      r.getCell(totalCol + 1).border = THIN_BORDER;

      if (leaves.some((l) => l.requestAirfare)) {
        applyYellow(totalCell);
      }
    });

    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1 + employeeRows.length, column: totalCol + 1 },
    };
  });

  return wb;
}

export async function downloadLeaveMasterTrackerWorkbook(wb, fileName, saveAsFn) {
  const buffer = await wb.xlsx.writeBuffer();
  const dataBlob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const name = `${fileName || "Staff_Leave_Report_Master_tracker"}_${new Date().toISOString().split("T")[0]}.xlsx`;
  if (typeof saveAsFn === "function") {
    saveAsFn(dataBlob, name);
  } else {
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
}
