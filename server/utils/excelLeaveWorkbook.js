/**
 * Parse Staff Leave Report_Master tracker workbooks.
 * Layouts differ by year; dates and yellow fills are read from actual cells.
 * Leave days follow Excel: end - start (not inclusive +1).
 */

function cellText(cell) {
  const v = cell?.value;
  if (v == null || v === "") return "";
  if (v instanceof Date) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((p) => p.text || "").join("").trim();
    if (v.text != null) return String(v.text).trim();
    if (v.hyperlink && v.text) return String(v.text).trim();
    if (v.result != null && !(v.result instanceof Date)) return String(v.result).trim();
    return "";
  }
  return String(v).trim();
}

function cellDate(cell) {
  const v = cell?.value;
  if (!v && v !== 0) return null;
  let d = null;
  if (v instanceof Date) d = v;
  else if (typeof v === "object" && v.result instanceof Date) d = v.result;
  else if (typeof v === "number" && v > 20000 && v < 80000) {
    d = new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function cellNumber(cell) {
  const v = cell?.value;
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && v.result != null && typeof v.result === "number") return v.result;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isYellowFill(cell) {
  const fill = cell?.fill;
  if (!fill || fill.pattern === "none") return false;
  const fg = fill.fgColor || {};
  const argb = String(fg.argb || "").toUpperCase();
  if (argb.includes("FFFF00") || argb === "FFFFFF00" || argb.endsWith("FFFF00")) return true;
  if (fg.indexed === 5 || fg.theme === 6) return true;
  return false;
}

function isStaffId(value) {
  return /^id[a-z]{2,4}-\d+/i.test(String(value || "").trim());
}

function ymd(date) {
  if (!date) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function excelDateDiffDays(endDate, startDate) {
  if (!endDate || !startDate) return 0;
  const ms = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function compactName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isTitleOnlyName(value) {
  return /^(mr|mrs|ms|miss|mdm|dr)\.?$/i.test(String(value || "").trim());
}

function nameTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !isTitleOnlyName(t));
}

function tokensClose(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return Math.min(a.length, b.length) >= 5;
  if (Math.abs(a.length - b.length) > 2) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 2) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 2;
}

const COMMON_GIVEN_NAMES = new Set([
  "muhammad",
  "mohammed",
  "mohammad",
  "mohd",
  "ahmed",
  "ahmad",
  "abdul",
  "syed",
  "shaikh",
  "sheikh",
  "kumar",
  "singh",
]);

function namesLikelySame(a, b) {
  const ca = compactName(a);
  const cb = compactName(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.length >= 8 && cb.length >= 8 && (ca.startsWith(cb) || cb.startsWith(ca))) return true;
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length) return false;
  if (ta[0] !== tb[0]) return false;
  if (ta.length > 1 && tb.length > 1 && ta[1] === tb[1]) return true;
  if (COMMON_GIVEN_NAMES.has(ta[0])) return false;
  if (ta[0].length >= 5 && (ta.length === 1 || tb.length === 1)) return true;
  return tokensClose(ta[ta.length - 1], tb[tb.length - 1]);
}

function colLetter(c1based) {
  let n = c1based;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function findHeaderRow(ws, maxScan = 8) {
  for (let r = 1; r <= Math.min(maxScan, ws.rowCount || 1); r += 1) {
    const texts = [];
    for (let c = 1; c <= Math.min(ws.columnCount || 20, 20); c += 1) {
      texts.push(cellText(ws.getCell(r, c)).toUpperCase().replace(/[\s_.-]/g, ""));
    }
    const joined = texts.join("|");
    if (joined.includes("STAFFNAME") || joined.includes("EMPLOYEENAME")) return r;
    if (joined.includes("SNO") && joined.includes("NAME")) return r;
  }
  return 1;
}

function findJoiningDateCol(ws, headerRow) {
  for (let c = 1; c <= Math.min(ws.columnCount || 20, 20); c += 1) {
    const h = cellText(ws.getCell(headerRow, c)).toUpperCase();
    if (h.includes("JOIN")) return c;
  }
  const c3 = cellText(ws.getCell(headerRow, 3)).toUpperCase();
  const c4 = cellText(ws.getCell(headerRow, 4)).toUpperCase();
  if (!c3 && c4.includes("LEAVE")) return 3;
  return null;
}

function findRemarksCol(ws, headerRow) {
  for (let c = 1; c <= (ws.columnCount || 20); c += 1) {
    const h = cellText(ws.getCell(headerRow, c)).toUpperCase();
    if (h.includes("REMARK")) return c;
  }
  return null;
}

function daysFromFormulaCell(cell, startCol, endCol) {
  const n = cellNumber(cell);
  if (n == null) return null;
  const formula = String(cell?.value?.formula || cell?.value?.sharedFormula || "").toUpperCase();
  if (!formula) return n;
  const startL = colLetter(startCol);
  const endL = colLetter(endCol);
  if (formula.includes(startL) && formula.includes(endL)) return n;
  if (/^[A-Z]+\d+-[A-Z]+\d+/.test(formula) || formula.includes("-")) return n;
  return n;
}

function extractDatePairs(ws, rowNumber, sheetYear, skipCols) {
  const skip = new Set(skipCols || []);
  const dates = [];
  const numericCols = [];
  const colCount = ws.columnCount || 30;
  for (let c = 1; c <= colCount; c += 1) {
    if (skip.has(c)) continue;
    const cell = ws.getCell(rowNumber, c);
    const d = cellDate(cell);
    if (d) {
      const y = d.getUTCFullYear();
      if (y >= sheetYear - 1 && y <= sheetYear + 1) {
        dates.push({ col: c, date: d, yellow: isYellowFill(cell) });
        continue;
      }
    }
    const n = cellNumber(cell);
    const formula = cell?.value && typeof cell.value === "object" ? cell.value.formula : null;
    if (n != null && (formula || n > 0) && !d) {
      numericCols.push({ col: c, days: n, formula: String(formula || ""), yellow: isYellowFill(cell) });
    }
  }

  const pairs = [];
  for (let i = 0; i < dates.length; i += 1) {
    const start = dates[i];
    const next = dates[i + 1];
    if (next && next.col === start.col + 1) {
      const end = next.date >= start.date ? next.date : start.date;
      pairs.push({
        start: start.date,
        end,
        startCol: start.col,
        endCol: next.col,
        yellow: start.yellow || next.yellow,
        days: excelDateDiffDays(end, start.date),
      });
      i += 1;
    } else if (start.date.getUTCFullYear() === sheetYear) {
      pairs.push({
        start: start.date,
        end: start.date,
        startCol: start.col,
        endCol: start.col,
        yellow: start.yellow,
        days: 0,
      });
    }
  }

  const dayCols = numericCols.filter((c) => !dates.some((d) => d.col === c.col));
  pairs.forEach((pair) => {
    const startL = colLetter(pair.startCol);
    const endL = colLetter(pair.endCol);
    const named = dayCols.find((c) => {
      const f = c.formula.toUpperCase().replace(/\$/g, "");
      if (!f || !f.includes(startL) || !f.includes(endL)) return false;
      const cols = f.match(/[A-Z]+/g) || [];
      return cols.every((col) => col === startL || col === endL);
    });
    if (named && Number.isFinite(named.days)) {
      pair.excelDays = named.days;
      pair.days = named.days;
      if (named.yellow) pair.yellow = true;
    }
  });

  return pairs.filter(
    (p) => p.start.getUTCFullYear() === sheetYear || p.end.getUTCFullYear() === sheetYear
  );
}

function rowStaffName(ws, r) {
  const a = cellText(ws.getCell(r, 2));
  const b = cellText(ws.getCell(r, 3));
  if (isTitleOnlyName(a) && b) return b;
  if (/staff\s*name/i.test(a) && b && !/staff\s*name/i.test(b)) return b;
  if (b && compactName(b).length > compactName(a).length + 2 && !cellDate(ws.getCell(r, 3))) {
    return b;
  }
  return a || b;
}

function parseMasterSheet(wb) {
  const ws = wb.getWorksheet("Sheet") || wb.worksheets[0];
  const headerRow = 2;
  const yearCols = {};
  for (let c = 1; c <= (ws.columnCount || 32); c += 1) {
    const h = cellText(ws.getCell(headerRow, c));
    const year = Number(h);
    if (year >= 2010 && year <= 2100) yearCols[year] = c;
  }

  const employees = [];
  for (let r = 3; r <= (ws.rowCount || 0); r += 1) {
    const employeeId = cellText(ws.getCell(r, 2));
    const staffName = cellText(ws.getCell(r, 3));
    if (!staffName && !employeeId) continue;
    if (/staff\s*name/i.test(staffName)) continue;

    const years = {};
    const yearCompanyTicket = {};
    Object.entries(yearCols).forEach(([year, col]) => {
      const cell = ws.getCell(r, col);
      if (cellDate(cell)) {
        years[`${year}_note`] = ymd(cellDate(cell));
        years[year] = null;
        return;
      }
      const n = cellNumber(cell);
      const raw = cellText(cell);
      years[year] = n != null && Math.abs(n) < 10000 ? n : null;
      yearCompanyTicket[year] = isYellowFill(cell);
      if (years[year] == null && raw && !/^\d+(\.\d+)?$/.test(raw)) {
        years[`${year}_note`] = raw;
      }
    });

    employees.push({
      excelRow: r,
      sno: cellNumber(ws.getCell(r, 1)),
      employeeId: isStaffId(employeeId) ? employeeId.trim() : "",
      rawId: employeeId,
      staffName,
      salesman: cellText(ws.getCell(r, 4)),
      joiningDate: cellDate(ws.getCell(r, 6)),
      calculateLeave: cellDate(ws.getCell(r, 7)),
      years,
      yearCompanyTicket,
      last5Taken: cellNumber(ws.getCell(r, 25)),
      avrg: cellNumber(ws.getCell(r, 26)),
      leaveDue: cellNumber(ws.getCell(r, 27)),
      last5Days: cellNumber(ws.getCell(r, 28)),
      yrs: cellNumber(ws.getCell(r, 29)),
      workingYrs: cellNumber(ws.getCell(r, 30)),
      till: cellDate(ws.getCell(r, 31)),
    });
  }

  return { sheetName: ws.name, yearCols, employees };
}

function parseYearSheet(ws) {
  const year = Number(ws.name);
  if (!Number.isFinite(year) || year < 1990 || year > 2100) return null;

  const headerRow = findHeaderRow(ws);
  const joiningCol = findJoiningDateCol(ws, headerRow);
  const remarksCol = findRemarksCol(ws, headerRow);
  const skipCols = new Set([1, 2]);
  if (joiningCol) skipCols.add(joiningCol);

  const rows = [];
  for (let r = headerRow + 1; r <= (ws.rowCount || 0); r += 1) {
    const col1 = cellText(ws.getCell(r, 1));
    const name = rowStaffName(ws, r);
    if (!name && !col1) continue;
    if (/staff\s*name/i.test(name) || /staff\s*name/i.test(col1)) continue;
    if (/^s\.?\s*no/i.test(col1)) continue;

    const slots = extractDatePairs(ws, r, year, skipCols);
    const remarks = remarksCol ? cellText(ws.getCell(r, remarksCol)) : "";
    rows.push({
      excelRow: r,
      year,
      serialOrId: col1,
      employeeId: isStaffId(col1) ? col1.trim() : "",
      staffName: name,
      joiningDate: joiningCol ? cellDate(ws.getCell(r, joiningCol)) : null,
      slots,
      slotDays: slots.reduce((sum, s) => sum + (s.days || 0), 0),
      hasCompanyTicket: slots.some((s) => s.yellow),
      remarks,
    });
  }

  return { year, headerRow, joiningCol, remarksCol, rows };
}

async function parseLeaveMasterWorkbook(workbook) {
  const master = parseMasterSheet(workbook);
  const yearSheets = {};
  for (const ws of workbook.worksheets) {
    const parsed = parseYearSheet(ws);
    if (parsed) yearSheets[parsed.year] = parsed;
  }

  const leaves = [];
  const seen = new Set();
  Object.values(yearSheets).forEach((sheet) => {
    sheet.rows.forEach((row) => {
      row.slots.forEach((slot) => {
        const key = `${row.employeeId}|${compactName(row.staffName)}|${ymd(slot.start)}|${ymd(slot.end)}`;
        if (seen.has(key)) return;
        seen.add(key);
        leaves.push({
          year: sheet.year,
          excelRow: row.excelRow,
          employeeId: row.employeeId,
          staffName: row.staffName,
          start: ymd(slot.start),
          end: ymd(slot.end),
          days: slot.days,
          excelDays: slot.excelDays != null ? slot.excelDays : slot.days,
          requestAirfare: !!slot.yellow,
          remarks: row.remarks,
        });
      });
    });
  });

  const byId = new Map();
  master.employees.forEach((emp) => {
    if (emp.employeeId) byId.set(emp.employeeId.toLowerCase(), emp);
  });

  const firstNameIndex = new Map();
  master.employees.forEach((emp) => {
    const first = nameTokens(emp.staffName)[0];
    if (!first) return;
    if (!firstNameIndex.has(first)) firstNameIndex.set(first, []);
    firstNameIndex.get(first).push(emp);
  });

  const firstNameByYear = new Map();
  Object.values(yearSheets).forEach((sheet) => {
    const map = new Map();
    sheet.rows.forEach((row) => {
      const first = nameTokens(row.staffName)[0];
      if (!first) return;
      if (!map.has(first)) map.set(first, []);
      map.get(first).push(row);
    });
    firstNameByYear.set(sheet.year, map);
  });

  const stampMasterId = (leave) => {
    if (leave.employeeId && byId.has(leave.employeeId.toLowerCase())) {
      return byId.get(leave.employeeId.toLowerCase());
    }
    const compact = compactName(leave.staffName);
    if (compact) {
      const exact = master.employees.filter((emp) => compactName(emp.staffName) === compact);
      if (exact.length === 1) return exact[0];
    }
    const tokens = nameTokens(leave.staffName);
    if (tokens.length >= 2) {
      const two = master.employees.filter((emp) => {
        const tb = nameTokens(emp.staffName);
        return tb.length >= 2 && tb[0] === tokens[0] && tb[1] === tokens[1];
      });
      if (two.length === 1) return two[0];
    }
    const hits = master.employees.filter((emp) => namesLikelySame(emp.staffName, leave.staffName));
    if (hits.length === 1) return hits[0];
    const idHits = hits.filter((emp) => emp.employeeId);
    if (idHits.length === 1) return idHits[0];
    const first = tokens[0];
    if (first && first.length >= 5 && !COMMON_GIVEN_NAMES.has(first)) {
      const masterFirst = firstNameIndex.get(first) || [];
      const yearFirst = firstNameByYear.get(leave.year)?.get(first) || [];
      if (masterFirst.length === 1 && yearFirst.length === 1) return masterFirst[0];
    }
    return null;
  };

  leaves.forEach((leave) => {
    const masterEmp = stampMasterId(leave);
    if (masterEmp?.employeeId && !leave.employeeId) {
      leave.employeeId = masterEmp.employeeId;
      leave.staffName = masterEmp.staffName;
    }
    if (masterEmp?.yearCompanyTicket?.[leave.year]) {
      leave.requestAirfare = true;
    }
  });

  return { master, yearSheets, leaves };
}

module.exports = {
  cellText,
  cellDate,
  cellNumber,
  isYellowFill,
  isStaffId,
  ymd,
  excelDateDiffDays,
  compactName,
  namesLikelySame,
  parseMasterSheet,
  parseYearSheet,
  parseLeaveMasterWorkbook,
};
