const fs = require("fs");
const path = require("path");
const ExcelJS = require("../../frontend/node_modules/exceljs");

const SRC =
  process.argv[2] ||
  "C:/Users/Digi Ideacentre/Downloads/Staff Leave Report_Master tracker_August_2026.xlsx";
const OUT = path.resolve(__dirname, "../../frontend/src/data/masterTrackerLeaveSlots.json");

function cellText(cell) {
  const v = cell?.value;
  if (v == null || v === "") return "";
  if (v instanceof Date) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((p) => p.text || "").join("").trim();
    if (v.text != null) return String(v.text).trim();
    if (v.result != null && !(v.result instanceof Date)) return String(v.result).trim();
    return "";
  }
  return String(v).trim();
}

function cellDate(cell) {
  const v = cell?.value;
  if (!v) return null;
  const d = v instanceof Date ? v : v.result instanceof Date ? v.result : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isStaffId(value) {
  return /^id[a-z]{2,4}-\d+/i.test(String(value || "").trim());
}

function compactName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function nameTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function levenshtein(a, b) {
  const s = String(a || "");
  const t = String(b || "");
  const rows = s.length + 1;
  const cols = t.length + 1;
  const m = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) m[i][0] = i;
  for (let j = 0; j < cols; j += 1) m[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[s.length][t.length];
}

function tokensClose(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const aliases = {
    mohd: "mohammed",
    muhd: "muhammad",
    mohammed: "mohammed",
    muhammad: "muhammad",
    muhammed: "muhammad",
  };
  const na = aliases[a] || a;
  const nb = aliases[b] || b;
  if (na === nb) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  return Math.abs(a.length - b.length) <= 2 && levenshtein(a, b) <= 2;
}

function namesLikelySame(excelName, dbName) {
  const a = compactName(excelName);
  const b = compactName(dbName);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 14 && longer.includes(shorter)) return true;

  const ta = nameTokens(excelName);
  const tb = nameTokens(dbName);
  if (!ta.length || !tb.length) return false;
  if (!tokensClose(ta[0], tb[0])) return false;
  const lastA = ta[ta.length - 1];
  const lastB = tb[tb.length - 1];
  if (tokensClose(lastA, lastB) && !GENERIC_NAME_TOKENS.has(lastA)) return true;
  const [shortToks, longToks] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (shortToks.length >= 2 && shortToks.every((t) => longToks.some((u) => tokensClose(t, u)))) {
    return true;
  }
  return false;
}

const GENERIC_NAME_TOKENS = new Set([
  "kumar", "khan", "singh", "das", "ram", "dev", "ali", "ahmed",
  "muhammad", "mohammed", "muhammed", "mohd", "muhd",
]);

function cleanPersonName(value) {
  return String(value || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstToken(value) {
  return nameTokens(cleanPersonName(value))[0] || "";
}

function lastToken(value) {
  const toks = nameTokens(cleanPersonName(value));
  return toks[toks.length - 1] || "";
}

function scoreName(excelName, rosterName) {
  const a = cleanPersonName(excelName);
  const b = cleanPersonName(rosterName);
  const ca = compactName(a);
  const cb = compactName(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 1000;
  const shorter = ca.length <= cb.length ? ca : cb;
  const longer = ca.length <= cb.length ? cb : ca;
  if (shorter.length >= 10 && longer.includes(shorter)) return 500 + shorter.length;

  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.length || !tb.length || !tokensClose(ta[0], tb[0])) return 0;

  const excelLast = ta[ta.length - 1];
  if (
    ta.length >= 2 &&
    !GENERIC_NAME_TOKENS.has(excelLast) &&
    !tb.some((u) => tokensClose(u, excelLast))
  ) {
    return 0;
  }

  let overlap = 0;
  ta.forEach((t) => {
    if (tb.some((u) => tokensClose(t, u))) overlap += 1;
  });
  return overlap * 20 + (tokensClose(excelLast, lastToken(b)) && !GENERIC_NAME_TOKENS.has(excelLast) ? 40 : 0);
}

function bestRosterHit(name, roster) {
  const scored = roster
    .map((p) => ({ p, score: Math.max(scoreName(name, p.name), namesLikelySame(cleanPersonName(name), p.name) ? 30 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length === 1) return scored[0].score >= 30 ? scored[0].p : null;
  if (scored[0].score >= scored[1].score + 25) return scored[0].p;
  return null;
}

function resolveRosterId(col1, name, roster, bySno, firstIndex) {
  if (isStaffId(col1)) return String(col1).trim();
  const exact = roster.filter((p) => compactName(p.name) === compactName(cleanPersonName(name)));
  if (exact.length === 1) return exact[0].id;
  if (/pavan|jihad|faryad/i.test(name)) {
    const scored = roster
      .map((p) => ({ id: p.id, name: p.name, exact: compactName(p.name) === compactName(cleanPersonName(name)), score: Math.max(scoreName(name, p.name), namesLikelySame(cleanPersonName(name), p.name) ? 30 : 0) }))
      .filter((x) => x.score > 0 || x.exact || /pavan|jihad|faryad/i.test(x.name))
      .slice(0, 8);
    console.log("DEBUG resolve", JSON.stringify({ name, col1, exactCount: exact.length, compact: compactName(name), hits: scored.slice(0, 6) }));
  }
  const best = bestRosterHit(name, roster);
  if (best) return best.id;
  const sno = Number(col1);
  if (Number.isFinite(sno) && sno > 0) {
    const row = bySno.get(sno);
    if (row && isStaffId(row.id) && tokensClose(firstToken(row.name), firstToken(name))) {
      return row.id;
    }
  }
  const first = firstToken(name);
  const toks = nameTokens(cleanPersonName(name));
  if (first && toks.length === 1) {
    const exactUniq = firstIndex.get(first) || [];
    if (exactUniq.length === 1) return exactUniq[0].id;
    const closeHits = roster.filter((p) => tokensClose(firstToken(p.name), first));
    if (closeHits.length === 1) return closeHits[0].id;
  }
  return "";
}

(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SRC);

  const byId = new Map();
  const addRoster = (id, name, sno) => {
    if (!isStaffId(id) || !name) return;
    const key = String(id).trim();
    const prev = byId.get(key.toLowerCase());
    if (!prev || name.length > prev.name.length) {
      byId.set(key.toLowerCase(), { sno: sno || prev?.sno || 0, id: key, name });
    } else if (sno && !prev.sno) {
      prev.sno = sno;
    }
  };

  const sheet = wb.getWorksheet("Sheet") || wb.worksheets[0];
  const bySno = new Map();
  for (let r = 3; r <= sheet.rowCount; r += 1) {
    const sno = Number(cellText(sheet.getCell(r, 1)));
    addRoster(cellText(sheet.getCell(r, 2)), cellText(sheet.getCell(r, 3)), sno);
  }

  for (const ws of wb.worksheets) {
    const year = Number(ws.name);
    if (!Number.isFinite(year) || year < 2010 || year > 2100) continue;
    for (let r = 2; r <= ws.rowCount; r += 1) {
      const col1 = cellText(ws.getCell(r, 1));
      const name = cellText(ws.getCell(r, 2));
      if (!name || /staff\s*name/i.test(name)) continue;
      if (isStaffId(col1)) addRoster(col1, name, 0);
    }
  }

  const roster = [...byId.values()];
  roster.forEach((p) => {
    if (p.sno) bySno.set(p.sno, p);
  });
  const firstIndex = new Map();
  roster.forEach((p) => {
    const first = firstToken(p.name);
    if (!first) return;
    if (!firstIndex.has(first)) firstIndex.set(first, []);
    const arr = firstIndex.get(first);
    if (!arr.includes(p)) arr.push(p);
  });

  const slots = [];
  const seen = new Set();
  let stamped = 0;
  let stillBlank = 0;

  for (const ws of wb.worksheets) {
    const year = Number(ws.name);
    if (!Number.isFinite(year) || year < 2010 || year > 2100) continue;

    for (let r = 2; r <= ws.rowCount; r += 1) {
      const col1 = cellText(ws.getCell(r, 1));
      const name = cellText(ws.getCell(r, 2));
      if (!name || /staff\s*name/i.test(name)) continue;
      const employeeId = resolveRosterId(col1, name, roster, bySno, firstIndex);
      if (employeeId) stamped += 1;
      else stillBlank += 1;

      for (let pair = 0; pair < 8; pair += 1) {
        const start = cellDate(ws.getCell(r, 4 + pair * 2));
        const end = cellDate(ws.getCell(r, 5 + pair * 2)) || start;
        if (!start) continue;
        const startYear = Number(start.slice(0, 4));
        if (startYear !== year) continue;
        const key = `${employeeId}|${name}|${start}|${end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        slots.push({ employeeId, name, start, end });
      }
    }
  }

  const byYear = {};
  slots.forEach((s) => {
    const y = s.start.slice(0, 4);
    if (!byYear[y]) byYear[y] = { total: 0, withId: 0, noId: 0 };
    byYear[y].total += 1;
    if (s.employeeId) byYear[y].withId += 1;
    else byYear[y].noId += 1;
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(slots));
  console.log("wrote", slots.length, "slots to", OUT);
  console.log("roster", roster.length, "rowStamp withId", stamped, "rowStamp blank", stillBlank);
  console.log("slots by year", byYear);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
