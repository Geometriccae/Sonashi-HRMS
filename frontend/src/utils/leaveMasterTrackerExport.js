import ExcelJS from "exceljs";
import { calculateLeaveDays } from "./leaveCalculator";

const APPROVED = new Set(["Approved", "HOD Approved"]);
const MIN_LEAVE_SLOTS = 3;
/** Master tracker year columns/sheets start from 2015 (per requirement). */
const MASTER_TRACKER_START_YEAR = 2015;

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

const applyYellow = (cell) => {
  if (cell) cell.fill = YELLOW_FILL;
};

const excelSerialFromDate = (d) => {
  if (!d || isNaN(d.getTime())) return null;
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
};

const parseDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const formatJoinMonthYear = (d) => {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};

const formatSheetDate = (d) => {
  if (!d) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = String(d.getFullYear()).slice(-2);
  return `${m}/${day}/${y}`;
};

const nameKey = (name) => String(name || "").toLowerCase().trim();

const matchesEmployee = (req, emp) => {
  const reqName = nameKey(req.employeeName);
  const empName = nameKey(emp.employeeName || emp.name);
  if (reqName && empName && reqName === empName) return true;

  const empMongoId = String(emp._id || "").toLowerCase();
  const empCode = String(emp.employeeId || "").toLowerCase();
  const linked = req.employee;
  if (linked) {
    const linkedId = String(
      linked.employeeId?._id || linked._id || linked.employeeId || linked || ""
    ).toLowerCase();
    if (linkedId && (linkedId === empMongoId || linkedId === empCode)) return true;
  }
  if (req.employeeId && empCode && String(req.employeeId).toLowerCase() === empCode) {
    return true;
  }
  return false;
};

const getApprovedLeavesForEmployee = (emp, leaveRequests) =>
  (leaveRequests || []).filter(
    (req) => APPROVED.has(req.status) && matchesEmployee(req, emp)
  );

/**
 * Group approved leaves by calendar year of startDate.
 * Each leave: { start, end, days, remarks, requestAirfare }
 */
const groupLeavesByYear = (leaves) => {
  const byYear = {};
  leaves.forEach((req) => {
    const start = parseDate(req.startDate);
    const end = parseDate(req.endDate) || start;
    if (!start) return;
    const year = start.getFullYear();
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
 * Years from 2015 through TILL year, plus one future year so staff can add ahead.
 * Also includes any later leave years present in data.
 */
const buildYearRange = (employees, leaveRequests, tillDate) => {
  const tillYear = tillDate.getFullYear();
  const currentYear = new Date().getFullYear();
  let maxYear = Math.max(tillYear, currentYear) + 1;

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

/** CALCULATE LEAVE date ≈ max(DOJ, TILL − 5 years), matching master tracker window. */
const getCalculateLeaveDate = (doj, tillDate) => {
  const fiveYearsAgo = new Date(tillDate);
  fiveYearsAgo.setFullYear(tillDate.getFullYear() - 5);
  if (!doj) return fiveYearsAgo;
  return doj > fiveYearsAgo ? doj : fiveYearsAgo;
};

const ordinal = (n) => {
  const labels = ["1ST", "2ND", "3RD", "4TH", "5TH", "6TH", "7TH", "8TH", "9TH", "10TH"];
  if (n <= labels.length) return `${labels[n - 1]} LEAVE`;
  return `${n}TH LEAVE`;
};

/**
 * Build summary + per-year sheet data for Staff Leave Report Master tracker format.
 */
export function buildLeaveMasterTrackerData({
  employees = [],
  leaveRequests = [],
  tillDate = null,
} = {}) {
  const till = tillDate ? new Date(tillDate) : new Date(new Date().getFullYear(), 11, 31);
  till.setHours(0, 0, 0, 0);

  const years = buildYearRange(employees, leaveRequests, till);
  // Last 5 calendar years up to TILL year (matches Excel SUM of those year columns)
  const tillYear = till.getFullYear();
  const last5Years = years.filter((y) => y >= tillYear - 4 && y <= tillYear);

  const employeeRows = employees.map((emp, idx) => {
    const doj = parseDate(emp.doj);
    const calcLeave = getCalculateLeaveDate(doj, till);
    const leavesByYear = groupLeavesByYear(
      getApprovedLeavesForEmployee(emp, leaveRequests)
    );

    const yearTotals = {};
    const yearHasCompanyTicket = {};
    years.forEach((y) => {
      const list = leavesByYear[y] || [];
      yearTotals[y] = list.reduce((sum, l) => sum + (l.days || 0), 0);
      yearHasCompanyTicket[y] = list.some((l) => l.requestAirfare);
    });

    const last5Taken = last5Years.reduce((sum, y) => sum + (yearTotals[y] || 0), 0);
    const avrg = last5Taken / 5;

    const tillSerialDays = excelSerialFromDate(till);
    const calcSerialDays = excelSerialFromDate(calcLeave);
    const joinSerialDays = excelSerialFromDate(doj);
    const last5WindowDays =
      tillSerialDays != null && calcSerialDays != null
        ? Math.max(0, tillSerialDays - calcSerialDays)
        : 0;
    const yrs = last5WindowDays / 365;
    const workingYrs =
      tillSerialDays != null && joinSerialDays != null
        ? Math.max(0, (tillSerialDays - joinSerialDays) / 365)
        : 0;
    // Master tracker: LEAVE DUE = (30 - Avrg) * yrs
    const leaveDue = (30 - avrg) * yrs;

    return {
      sno: idx + 1,
      employeeId: emp.employeeId || "",
      staffName: emp.employeeName || emp.name || "",
      salesman: "",
      joiningDate: doj,
      calculateLeave: calcLeave,
      yearTotals,
      yearHasCompanyTicket,
      leavesByYear,
      last5Taken,
      avrg,
      leaveDue,
      last5WindowDays,
      yrs,
      workingYrs,
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
    out["last 5 years leave taken"] = Number(row.last5Taken.toFixed(2));
    out.Avrg = Number(row.avrg.toFixed(2));
    out["LEAVE DUE"] = Number(row.leaveDue.toFixed(2));
    out["last 5 years"] = row.last5WindowDays;
    out.yrs = Number(row.yrs.toFixed(2));
    out["working yrs"] = Number(row.workingYrs.toFixed(2));
    out.TILL = row.till.toLocaleDateString("en-US");
    return out;
  });
}

/**
 * Build an ExcelJS workbook matching Staff Leave Report_Master tracker.xlsx
 * Yellow cells = ticket booked by the company (requestAirfare), same as master file.
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

  employeeRows.forEach((row, i) => {
    const excelRow = i + 3;
    const r = wsSummary.getRow(excelRow);
    r.getCell(1).value = row.sno;
    r.getCell(2).value = row.employeeId;
    r.getCell(3).value = row.staffName;
    r.getCell(4).value = row.salesman;
    r.getCell(6).value = row.joiningDate ? formatJoinMonthYear(row.joiningDate) : "";
    r.getCell(7).value = row.calculateLeave ? formatJoinMonthYear(row.calculateLeave) : "";

    years.forEach((y, yi) => {
      const cell = r.getCell(firstYearCol + yi);
      cell.value = row.yearTotals[y] || 0;
      // Master tracker: year total yellow when company booked ticket that year
      if (row.yearHasCompanyTicket?.[y]) applyYellow(cell);
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

    avrgCell.value = {
      formula: `${colLetter(colLast5Taken)}${excelRow}/5`,
      result: Number(row.avrg.toFixed(2)),
    };
    dueCell.value = {
      formula: `(30-${colLetter(colAvrg)}${excelRow})*${colLetter(colYrs)}${excelRow}`,
      result: Number(row.leaveDue.toFixed(2)),
    };

    r.getCell(colLast5Days).value = row.last5WindowDays;
    r.getCell(colYrs).value = Number(row.yrs.toFixed(2));
    r.getCell(colWorkingYrs).value = Number(row.workingYrs.toFixed(2));
    r.getCell(colTill).value = row.till.toLocaleDateString("en-US");
  });

  wsSummary.views = [{ state: "frozen", ySplit: 2 }];
  wsSummary.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2 + employeeRows.length, column: header.length },
  };

  // ── Per-year sheets (newest first, like master file) ──
  [...years].reverse().forEach((year) => {
    const ws = wb.addWorksheet(String(year));
    const leaveHeader = ["SI NO", "STAFF NAME", "JOINING DATE"];
    for (let s = 1; s <= maxSlots; s += 1) {
      leaveHeader.push(ordinal(s), "");
    }
    for (let s = 1; s <= maxSlots; s += 1) leaveHeader.push(String(s));
    leaveHeader.push("TOTAL", "Remarks");

    const headerYr = ws.getRow(1);
    leaveHeader.forEach((h, i) => {
      const cell = headerYr.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = HEADER_FILL;
    });

    employeeRows.forEach((row, idx) => {
      const leaves = row.leavesByYear[year] || [];
      const r = ws.getRow(idx + 2);
      r.getCell(1).value = row.employeeId || row.sno;
      r.getCell(2).value = row.staffName;
      r.getCell(3).value = formatJoinMonthYear(row.joiningDate);

      const dateStartCol = 4;
      for (let s = 0; s < maxSlots; s += 1) {
        const leave = leaves[s];
        const startCell = r.getCell(dateStartCol + s * 2);
        const endCell = r.getCell(dateStartCol + s * 2 + 1);
        if (leave) {
          startCell.value = formatSheetDate(leave.start);
          endCell.value = formatSheetDate(leave.end);
          if (leave.requestAirfare) {
            applyYellow(startCell);
            applyYellow(endCell);
          }
        }
      }

      const daysStartCol = dateStartCol + maxSlots * 2;
      for (let s = 0; s < maxSlots; s += 1) {
        const leave = leaves[s];
        const dayCell = r.getCell(daysStartCol + s);
        dayCell.value = leave ? leave.days : 0;
        if (leave?.requestAirfare) applyYellow(dayCell);
      }

      const total = leaves.reduce((sum, l) => sum + (l.days || 0), 0);
      const remarks = leaves
        .filter((l) => l.remarks)
        .map((l) => l.remarks)
        .join("; ");
      const totalCol = daysStartCol + maxSlots;
      r.getCell(totalCol).value = total;
      r.getCell(totalCol + 1).value = remarks;

      // If any leave in the year had company ticket, mark TOTAL yellow (matches summary cue)
      if (leaves.some((l) => l.requestAirfare)) {
        applyYellow(r.getCell(totalCol));
      }
    });

    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1 + employeeRows.length, column: leaveHeader.length },
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
