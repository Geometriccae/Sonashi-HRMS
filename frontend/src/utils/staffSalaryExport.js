import ExcelJS from "exceljs";

const MASTER_START_YEAR = 2008;

/** Red bold — matches Staff Salary report.xls (JOINING / IN years / dates / dept headers). */
const RED_BOLD = {
  color: { argb: "FFFF0000" },
  bold: true,
};
const RED_FONT = {
  color: { argb: "FFFF0000" },
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const parseDate = (val) => {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatJoinDate = (d) => {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const daysInMonth = (month1to12, year) => {
  if (!month1to12 || !year) return 30;
  return new Date(year, month1to12, 0).getDate();
};

const titleFromName = (name) => {
  const n = String(name || "").trim();
  if (/^mrs\.?\b/i.test(n)) return "MRS.";
  if (/^(ms|miss)\.?\b/i.test(n)) return "MS.";
  return "MR.";
};

const cleanName = (name) => {
  return String(name || "")
    .replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, "")
    .trim();
};

const isSaneYear = (y) => Number.isFinite(y) && y >= 1990 && y <= 2100;

/**
 * Group increments by calendar year.
 * One cell pair per year: amount (sum if multiple) + latest date.
 * Skips corrupt years (e.g. ISO +020012 → 20012) so they never create columns.
 */
const incrementsByYear = (increments = []) => {
  const map = {};
  (increments || []).forEach((inc) => {
    const d = parseDate(inc.date);
    if (!d) return;
    const y = d.getFullYear();
    if (!isSaneYear(y)) return;
    const amount =
      toNum(inc.incrementAmount) ||
      toNum(inc.basicSalaryIncrement) +
        toNum(inc.houseRentIncrement) +
        toNum(inc.travelExpIncrement) +
        toNum(inc.otherIncrement);
    if (!map[y]) {
      map[y] = { amount: 0, date: d };
    }
    map[y].amount += amount;
    if (d > map[y].date) map[y].date = d;
  });
  return map;
};

/**
 * Year columns match Staff Salary master sheet: IN {max} … IN 2008.
 * Do not expand from employee dates (corrupt years like 20012 blow past Excel’s 16384-col limit).
 */
const buildYearList = (_employees, tillYear) => {
  const nowY = new Date().getFullYear();
  let maxYear = Math.max(Number(tillYear) || nowY, nowY);
  if (!Number.isFinite(maxYear) || maxYear > nowY + 1) maxYear = nowY;
  if (maxYear < MASTER_START_YEAR) maxYear = MASTER_START_YEAR;

  const years = [];
  for (let y = maxYear; y >= MASTER_START_YEAR; y -= 1) years.push(y);
  return years;
};

/**
 * Flat preview rows (one employee per row) — calculation-friendly.
 */
export function buildStaffSalarySummaryRows(employees, options = {}) {
  const { days = 30 } = options;
  const dayFactor = Math.max(0, Number(days) || 30);

  return (employees || []).map((e, idx) => {
    const sal = e.salaryDetails || {};
    const basic = toNum(sal.basicSalary);
    const lunch = toNum(sal.travelExp);
    const misc = toNum(sal.other);
    const rent = toNum(sal.houseRent);
    const basicAdj = (basic / 30) * dayFactor;
    const rentAdj = (rent / 30) * dayFactor;
    const lunchAdj = (lunch / 30) * dayFactor;
    const miscAdj = (misc / 30) * dayFactor;
    const total =
      toNum(sal.totalSalary) > 0
        ? toNum(sal.totalSalary)
        : basicAdj + lunchAdj + miscAdj + rentAdj;

    const byYear = incrementsByYear(e.increments);
    const out = {
      SL: idx + 1,
      Title: titleFromName(e.employeeName),
      Name: cleanName(e.employeeName) || e.employeeName || "",
      Department: e.department || "",
      "BASIC SALARY": Number(basicAdj.toFixed(2)),
      "LUNCH EXPS": Number(lunchAdj.toFixed(2)),
      "MISC EXPS": Number(miscAdj.toFixed(2)),
      "RENT EXPS": Number(rentAdj.toFixed(2)),
      "TOTAL SALARY": Number(total.toFixed(2)),
      "JOINING DATE": formatJoinDate(parseDate(e.doj)),
    };

    Object.keys(byYear)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((y) => {
        out[`IN ${y} Amt`] = Number(byYear[y].amount.toFixed(2));
        out[`IN ${y} Date`] = formatJoinDate(byYear[y].date);
      });

    return out;
  });
}

/**
 * Build Staff Salary report workbook matching Staff Salary report.xls
 * Sheet name: SALARY
 * Layout: dept headers + salary components + yearly increment pairs + Excel formulas
 */
export function buildStaffSalaryWorkbook(employees, options = {}) {
  const {
    days = 30,
    tillYear = new Date().getFullYear(),
  } = options;

  const dayFactor = Math.max(0, Number(days) || 30);
  const years = buildYearList(employees, tillYear);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sonashi HRMS";
  const ws = wb.addWorksheet("SALARY");

  const paintRed = (cell, bold = true) => {
    if (!cell) return;
    cell.font = bold ? { ...RED_BOLD } : { ...RED_FONT };
  };

  // Row 1 headers
  const header1 = [
    "SL",
    "NAME",
    "",
    "BASIC",
    "LUNCH",
    "MISC.",
    "RENT",
    "TOTAL",
    "JOINING",
  ];
  years.forEach((y) => {
    header1.push(`IN ${y}`, "");
  });

  // Row 2 sub-headers
  const header2 = [
    "",
    "",
    "",
    "SALARY",
    "EXPS",
    "EXPS.",
    "EXPS.",
    "SALARY",
    "DATE",
  ];
  years.forEach(() => {
    header2.push("", "");
  });

  const r1 = ws.addRow(header1);
  const r2 = ws.addRow(header2);
  r1.font = { bold: true };
  r2.font = { bold: true };
  r1.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFBDD7EE" },
    };
  });
  r2.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFBDD7EE" },
    };
  });

  // Reference: JOINING + all IN YYYY headers + DATE sub-header are red bold
  paintRed(r1.getCell(9), true);
  years.forEach((_, yi) => {
    paintRed(r1.getCell(10 + yi * 2), true);
  });
  paintRed(r2.getCell(9), true);

  // Group by department (blank dept last)
  const groups = new Map();
  (employees || []).forEach((e) => {
    const dept = String(e.department || "OTHER").trim() || "OTHER";
    if (!groups.has(dept)) groups.set(dept, []);
    groups.get(dept).push(e);
  });

  const sortedDepts = [...groups.keys()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

  let sl = 0;
  const colLetter = (c1) => {
    let n = c1;
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  sortedDepts.forEach((dept) => {
    const list = groups.get(dept) || [];
    list.sort((a, b) =>
      String(a.employeeName || "").localeCompare(String(b.employeeName || ""))
    );

    const deptRow = ws.addRow([
      "",
      `${dept.toUpperCase()} DEPARTMENT`,
      ...Array(7 + years.length * 2).fill(""),
    ]);
    // Reference: department title in red (not gray fill)
    paintRed(deptRow.getCell(2), false);

    list.forEach((e) => {
      sl += 1;
      const sal = e.salaryDetails || {};
      const basic = toNum(sal.basicSalary);
      const lunch = toNum(sal.travelExp);
      const misc = toNum(sal.other);
      const rent = toNum(sal.houseRent);
      const byYear = incrementsByYear(e.increments);
      const doj = parseDate(e.doj);
      const joinYear = doj ? doj.getFullYear() : null;

      const rowValues = [
        sl,
        titleFromName(e.employeeName),
        cleanName(e.employeeName) || e.employeeName || "",
        null, // BASIC formula
        null, // LUNCH formula / blank
        null, // MISC formula / blank
        null, // RENT formula
        null, // TOTAL formula
        null, // JOINING DATE
      ];

      years.forEach((y) => {
        if (byYear[y] && byYear[y].amount) {
          rowValues.push(Number(byYear[y].amount.toFixed(2)));
          rowValues.push(byYear[y].date);
        } else if (joinYear === y && isSaneYear(y)) {
          // Reference: "JOIN IN YYYY" in that year's amount column
          rowValues.push(`JOIN IN ${y}`);
          rowValues.push("");
        } else {
          rowValues.push("");
          rowValues.push("");
        }
      });

      const row = ws.addRow(rowValues);
      const excelRow = row.number;

      // BASIC = basic/30*days  (same pattern as master sheet)
      row.getCell(4).value = {
        formula: `${basic}/30*${dayFactor}`,
        result: Number(((basic / 30) * dayFactor).toFixed(2)),
      };
      row.getCell(4).numFmt = "#,##0.00";

      // LUNCH / MISC — formulas when present (master often blank)
      if (lunch > 0) {
        row.getCell(5).value = {
          formula: `${lunch}/30*${dayFactor}`,
          result: Number(((lunch / 30) * dayFactor).toFixed(2)),
        };
        row.getCell(5).numFmt = "#,##0.00";
      }
      if (misc > 0) {
        row.getCell(6).value = {
          formula: `${misc}/30*${dayFactor}`,
          result: Number(((misc / 30) * dayFactor).toFixed(2)),
        };
        row.getCell(6).numFmt = "#,##0.00";
      }

      // RENT
      row.getCell(7).value = {
        formula: `${rent}/30*${dayFactor}`,
        result: Number(((rent / 30) * dayFactor).toFixed(2)),
      };
      row.getCell(7).numFmt = "#,##0.00";

      // TOTAL = SUM(D:G) — exact master formula
      row.getCell(8).value = {
        formula: `SUM(${colLetter(4)}${excelRow}:${colLetter(7)}${excelRow})`,
        result: Number(
          (
            (basic / 30) * dayFactor +
            (lunch / 30) * dayFactor +
            (misc / 30) * dayFactor +
            (rent / 30) * dayFactor
          ).toFixed(2)
        ),
      };
      row.getCell(8).numFmt = "#,##0.00";

      if (doj) {
        row.getCell(9).value = doj;
        row.getCell(9).numFmt = "dd/mm/yy";
      }
      // Reference: joining date column always red bold
      paintRed(row.getCell(9), true);

      // Format year amount + date columns; date cols red bold (reference)
      years.forEach((y, yi) => {
        const amtCol = 10 + yi * 2;
        const dateCol = amtCol + 1;
        const amtCell = row.getCell(amtCol);
        const dateCell = row.getCell(dateCol);
        if (typeof amtCell.value === "number") {
          amtCell.numFmt = "#,##0.00";
        } else if (typeof amtCell.value === "string" && String(amtCell.value).startsWith("JOIN IN")) {
          paintRed(amtCell, true);
        }
        if (dateCell.value instanceof Date) {
          dateCell.numFmt = "dd/mm/yy";
        }
        paintRed(dateCell, true);
      });
    });
  });

  ws.views = [{ state: "frozen", ySplit: 2 }];
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 6;
  ws.getColumn(3).width = 36;
  for (let c = 4; c <= 8; c += 1) ws.getColumn(c).width = 12;
  ws.getColumn(9).width = 12;
  for (let c = 10; c <= 9 + years.length * 2; c += 1) ws.getColumn(c).width = 10;

  return wb;
}

export async function downloadStaffSalaryWorkbook(wb, fileName, saveAsFn) {
  const buffer = await wb.xlsx.writeBuffer();
  const dataBlob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const name = `${fileName || "Staff_Salary_Report"}_${new Date().toISOString().split("T")[0]}.xlsx`;
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

export function getSalaryReportDays(filterMonth, filterYear) {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  if (filterMonth && filterMonth !== "All") {
    const m = monthNames.indexOf(filterMonth) + 1;
    const y =
      filterYear && filterYear !== "All"
        ? Number(filterYear)
        : new Date().getFullYear();
    if (m > 0) return daysInMonth(m, y);
  }
  return 30;
}
