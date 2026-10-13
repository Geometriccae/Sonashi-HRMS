const ExcelJS = require("../../frontend/node_modules/exceljs");

const SRC =
  process.argv[2] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";

function formulaOf(cell) {
  const v = cell?.value;
  if (v && typeof v === "object" && v.formula) {
    return { formula: v.formula, result: v.result, sharedFormula: v.sharedFormula };
  }
  return v;
}

function fillOf(cell) {
  const f = cell?.fill;
  if (!f) return null;
  const fg = f.fgColor?.argb || f.fgColor?.theme || f.fgColor?.indexed;
  const bg = f.bgColor?.argb || f.bgColor?.theme;
  const pat = f.pattern;
  if (!fg && !bg && !pat) return null;
  return { pat, fg, bg, type: f.type };
}

function isYellow(fill) {
  if (!fill) return false;
  const fg = String(fill.fg || "").toUpperCase();
  return (
    fg.includes("FFFF00") ||
    fg === "FFFFFF00" ||
    fg === "FFFF00" ||
    fg.endsWith("FFFF00") ||
    fg === "5" // Excel indexed yellow
  );
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);
  console.log("file", SRC);
  console.log(
    "sheets",
    wb.worksheets.map((w) => `${w.name}[${w.rowCount}x${w.columnCount}]`).join(" | ")
  );

  const master = wb.worksheets[0];
  console.log("\n===== MASTER SHEET:", master.name, "=====");
  for (let r = 1; r <= 4; r += 1) {
    const cells = [];
    for (let c = 1; c <= Math.min(master.columnCount, 32); c += 1) {
      const cell = master.getCell(r, c);
      const v = formulaOf(cell);
      const fill = fillOf(cell);
      cells.push({
        col: c,
        addr: cell.address,
        v: typeof v === "object" ? v : String(v ?? "").slice(0, 80),
        fill,
      });
    }
    console.log("ROW", r, JSON.stringify(cells, null, 0).slice(0, 4000));
  }

  console.log("\n===== MASTER HEADER ROW 2 =====");
  const headers = [];
  for (let c = 1; c <= master.columnCount; c += 1) {
    const v = master.getCell(2, c).value;
    if (v) headers.push({ c, v: String(v) });
  }
  console.log(JSON.stringify(headers, null, 2));

  console.log("\n===== MASTER ROW 3 (first employee) full =====");
  const row3 = [];
  for (let c = 1; c <= master.columnCount; c += 1) {
    const cell = master.getCell(3, c);
    row3.push({
      c,
      header: String(master.getCell(2, c).value || ""),
      value: formulaOf(cell),
      fill: fillOf(cell),
      numFmt: cell.numFmt,
    });
  }
  console.log(JSON.stringify(row3, null, 2));

  console.log("\n===== MASTER employee count / last rows =====");
  let lastData = 0;
  const names = [];
  for (let r = 3; r <= master.rowCount; r += 1) {
    const name = String(master.getCell(r, 3).value || "").trim();
    const id = String(master.getCell(r, 2).value || "").trim();
    if (name || id) {
      lastData = r;
      names.push({ r, id, name });
    }
  }
  console.log("dataRows", names.length, "lastRow", lastData);
  console.log("first5", names.slice(0, 5));
  console.log("last5", names.slice(-5));

  console.log("\n===== YEAR SHEET HEADERS =====");
  for (const ws of wb.worksheets) {
    const year = Number(ws.name);
    if (!Number.isFinite(year)) continue;
    const header = [];
    for (let c = 1; c <= Math.min(ws.columnCount, 40); c += 1) {
      const v = ws.getCell(1, c).value;
      if (v != null && v !== "") header.push({ c, v: String(v).slice(0, 40) });
    }
    const row2formulas = [];
    for (let c = 1; c <= Math.min(ws.columnCount, 25); c += 1) {
      const cell = ws.getCell(2, c);
      const v = formulaOf(cell);
      if (v && typeof v === "object" && v.formula) {
        row2formulas.push({ c, formula: v.formula, result: v.result, fill: fillOf(cell) });
      }
    }
    console.log(
      `\n--- ${ws.name} header ---`,
      JSON.stringify(header)
    );
    console.log("row2 formulas", JSON.stringify(row2formulas));
    console.log(
      "row2 dates",
      JSON.stringify(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => {
          const cell = ws.getCell(2, c);
          return { c, v: formulaOf(cell), fill: fillOf(cell) };
        })
      )
    );
  }

  console.log("\n===== YELLOW CELLS (sample + counts) =====");
  for (const ws of wb.worksheets) {
    let yellow = 0;
    const samples = [];
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        const fill = fillOf(cell);
        if (!isYellow(fill) && fill?.fg) {
          const fg = String(fill.fg).toUpperCase();
          if (fg.includes("FF") && (fg.includes("F4") || fg.includes("FF0") || fg.includes("YELLOW"))) {
            yellow += 1;
            if (samples.length < 3) samples.push({ r, c, addr: cell.address, fill, v: String(cell.value).slice(0, 40) });
          }
        }
        if (isYellow(fill)) {
          yellow += 1;
          if (samples.length < 8) {
            samples.push({ r, c, addr: cell.address, fill, v: String(cell.text || cell.value || "").slice(0, 40) });
          }
        }
      });
    });
    if (yellow || samples.length) console.log(ws.name, "yellowish", yellow, "samples", JSON.stringify(samples));
  }

  console.log("\n===== UNIQUE FILL COLORS =====");
  const fills = new Map();
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const fill = fillOf(cell);
        if (!fill) return;
        const key = JSON.stringify(fill);
        fills.set(key, (fills.get(key) || 0) + 1);
      });
    });
  }
  console.log([...fills.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
