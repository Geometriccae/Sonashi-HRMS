/**
 * Shared corporate black-and-white PDF layout for HRMS report downloads.
 * Layout/formatting only — callers own data selection and calculations.
 */

const COMPANY = {
  name: "JOINT VEN TRADING CO. LLC.",
  address: "P.O. Box: 15683, Dubai, UAE.",
  contact: "Tel-Off: +971 4 221 1461 | Tel-Main: +971 4 226 4228 | Fax: +971 4 229 6950",
  emailWeb: "Email: accounts@sonashi.ae | Web: www.sonashiuae.com",
};

const COLORS = {
  black: [0, 0, 0],
  text: [33, 33, 33],
  muted: [90, 90, 90],
  headerBg: [235, 235, 235],
  line: [160, 160, 160],
  softLine: [200, 200, 200],
  altRow: [250, 250, 250],
};

const HEADER_CANDIDATES = [
  "/payslip_company_header.png",
  "/letterhead_header.png",
  "/letterhead.png",
  "/sonashi_logo_updated.png",
  "/sonashi_logo.png",
];

let cachedHeaderImage = null;

export const loadJsPdf = async () => {
  const [jspdfMod, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const jsPDF =
    jspdfMod.jsPDF ||
    jspdfMod.default?.jsPDF ||
    jspdfMod.default;
  const autoTable = autoTableMod.default || autoTableMod;
  if (typeof jsPDF !== "function") {
    throw new Error("jsPDF failed to load");
  }
  return { jsPDF, autoTable };
};

function imageSize(doc, img) {
  try {
    return doc.getImageProperties(img);
  } catch {
    return {
      width: Number(img?.width) || 1000,
      height: Number(img?.height) || 200,
    };
  }
}

function imageSource(img) {
  if (!img) return null;
  if (typeof img === "string") return img;
  if (img._dataUrl) return img._dataUrl;
  return img;
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });

const getHeaderImage = async () => {
  if (cachedHeaderImage) return cachedHeaderImage;
  for (const src of HEADER_CANDIDATES) {
    try {
      cachedHeaderImage = await loadImage(src);
      return cachedHeaderImage;
    } catch {
      /* try next */
    }
  }
  return null;
};

export const formatAed = (val) => {
  const n = Number(val || 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatGeneratedDate = (dateVal = new Date()) => {
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
};

function drawTextCompanyHeader(doc, margin, startY) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cx = pageWidth / 2;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.black);
  doc.text(COMPANY.name, cx, y + 3.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(COMPANY.address, cx, y + 8, { align: "center" });
  doc.text(COMPANY.contact, cx, y + 12, { align: "center" });
  doc.text(COMPANY.emailWeb, cx, y + 16, { align: "center" });

  return y + 19;
}

export async function renderCompanyHeader(doc, margin, maxHeightMm = 22) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  // Keep header near the top of the page
  let y = Math.min(margin, 4);
  // Inner padding so logo/text are not flush against the header border
  const pad = 4;

  const headerImg = await getHeaderImage();
  if (headerImg) {
    try {
      const src = imageSource(headerImg);
      const props = imageSize(doc, src || headerImg);
      let drawW = contentWidth - pad * 2;
      let drawH = (props.height * drawW) / props.width;
      if (drawH > maxHeightMm) {
        drawH = maxHeightMm;
        drawW = (props.width * drawH) / props.height;
      }

      const boxH = drawH + pad * 2;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...COLORS.black);
      doc.setLineWidth(0.35);
      doc.rect(margin, y, contentWidth, boxH, "FD");

      const imgX = margin + (contentWidth - drawW) / 2;
      const imgY = y + pad;
      doc.addImage(src || headerImg, "PNG", imgX, imgY, drawW, drawH, undefined, "MEDIUM");
      y += boxH + 3;
    } catch {
      y = drawTextCompanyHeader(doc, margin, y + pad) + pad;
    }
  } else {
    const boxH = 22 + pad * 2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.35);
    doc.rect(margin, y, contentWidth, boxH, "FD");
    drawTextCompanyHeader(doc, margin, y + pad + 2);
    y += boxH + 3;
  }

  // Single divider under the header block
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.45);
  doc.line(margin, y, pageWidth - margin, y);

  // Clear gap under the line before the report title (~0.35 inch)
  return y + 10;
}

export function drawReportTitle(doc, margin, startY, title, metaLines = []) {
  const pageWidth = doc.internal.pageSize.getWidth();
  // Extra breathing room under the header divider before the title
  let y = startY + 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.black);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  metaLines.filter(Boolean).forEach((line) => {
    doc.text(String(line), pageWidth / 2, y, { align: "center" });
    y += 4;
  });

  return y + 3;
}

export function applyFooters(doc, margin, generatedLabel) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const y = pageHeight - 8;
    doc.setDrawColor(...COLORS.softLine);
    doc.setLineWidth(0.2);
    doc.line(margin, y - 3.5, pageWidth - margin, y - 3.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text(COMPANY.name, margin, y);
    doc.text(`Generated: ${generatedLabel}`, pageWidth / 2, y, { align: "center" });
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, y, { align: "right" });
  }
}

const MONEY_HEADER_RE =
  /salary|allowance|deduction|amount|basic|hra|travel|other|net|total|rent/i;

/**
 * Build a professional multi-page landscape/portrait report table PDF.
 * Uses fixed mm column widths so text never collapses into vertical characters.
 */
export async function buildCorporateTablePdf({
  title,
  fileName,
  metaLines = [],
  headers,
  rows,
  columnStyles = {},
  moneyColIndexes = [],
  orientation = "landscape",
  summaryItems = null,
}) {
  const { jsPDF, autoTable } = await loadJsPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = orientation === "landscape" ? 10 : 14;
  const generatedLabel = formatGeneratedDate(new Date());

  let y = await renderCompanyHeader(doc, margin, orientation === "landscape" ? 18 : 24);
  y = drawReportTitle(doc, margin, y, title, metaLines);

  const head = [headers];
  const body = rows.map((row) =>
    row.map((cell) => (cell == null || cell === "" ? "—" : String(cell)))
  );

  const fixedWidthSum = Object.values(columnStyles || {}).reduce((acc, style) => {
    const w = Number(style?.cellWidth);
    return Number.isFinite(w) ? acc + w : acc;
  }, 0);
  const contentWidth = pageWidth - margin * 2;
  const tableWidth =
    fixedWidthSum > 0 ? Math.min(fixedWidthSum, contentWidth) : contentWidth;
  // Center the table horizontally when it is narrower than the page content area
  const tableLeft = Math.max(margin, (pageWidth - tableWidth) / 2);
  const tableRight = Math.max(margin, pageWidth - tableLeft - tableWidth);

  autoTable(doc, {
    startY: y,
    margin: { left: tableLeft, right: tableRight, top: 14, bottom: 14 },
    head,
    body,
    theme: "grid",
    tableWidth,
    styles: {
      font: "helvetica",
      fontSize: orientation === "landscape" ? 6.5 : 8,
      textColor: COLORS.text,
      cellPadding: { top: 1.6, right: 1.2, bottom: 1.6, left: 1.2 },
      lineColor: COLORS.line,
      lineWidth: 0.15,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 5.5,
    },
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.black,
      fontStyle: "bold",
      fontSize: orientation === "landscape" ? 6.5 : 8,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: COLORS.altRow,
    },
    columnStyles,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (moneyColIndexes.includes(data.column.index)) {
        data.cell.styles.halign = "right";
      }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.black);
        doc.text(`${title} (continued)`, pageWidth / 2, 9, { align: "center" });
      }
    },
  });

  if (Array.isArray(summaryItems) && summaryItems.length > 0) {
    let summaryY = doc.lastAutoTable.finalY + 5;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (summaryY > pageHeight - 28) {
      doc.addPage();
      summaryY = 16;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.black);
    doc.text("Report Summary", tableLeft, summaryY);
    summaryY += 3;

    autoTable(doc, {
      startY: summaryY,
      margin: { left: tableLeft, right: tableRight },
      tableWidth,
      head: [summaryItems.map((item) => item.label)],
      body: [summaryItems.map((item) => item.value)],
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 8,
        textColor: COLORS.text,
        cellPadding: 2.5,
        lineColor: COLORS.line,
        lineWidth: 0.2,
        halign: "center",
        valign: "middle",
      },
      headStyles: {
        fillColor: COLORS.headerBg,
        textColor: COLORS.black,
        fontStyle: "bold",
        fontSize: 7.5,
      },
      bodyStyles: {
        fontStyle: "bold",
      },
    });
  }

  applyFooters(doc, margin, generatedLabel);

  return { doc, fileName };
}

/**
 * Map raw Salary Report rows into a printable landscape layout.
 * Keeps salary figures intact; trims redundant columns that caused vertical wrap.
 */
export function buildSalaryReportPdfRows(rawRows = []) {
  const headers = [
    "S.No",
    "Emp ID",
    "Employee Name",
    "Dept",
    "Role",
    "Basic",
    "HRA",
    "Travel",
    "Other",
    "Tot Allow",
    "Deduction",
    "Net Salary",
    "Bank",
  ];

  let totalBasic = 0;
  let totalAllow = 0;
  let totalDed = 0;
  let totalNet = 0;

  const rows = (rawRows || []).map((item, idx) => {
    const basic = Number(item["Basic Salary"]) || 0;
    const hra = Number(item["House Rent Allowance"]) || 0;
    const travel = Number(item["Travel Allowance"]) || 0;
    const other = Number(item["Other Allowance"]) || 0;
    const totAllow = Number(item["Total Allowance"]) || 0;
    const ded = Number(item["Deduction"]) || 0;
    const net = Number(item["Total / Net Salary"]) || 0;

    totalBasic += basic;
    totalAllow += totAllow;
    totalDed += ded;
    totalNet += net;

    const bank =
      [item["Bank Name"], item["IBAN"] || item["Account Number"]]
        .filter(Boolean)
        .join(" / ") || "—";

    return [
      String(idx + 1),
      item["Employee ID"] || "—",
      item.Name || item["Employee Name"] || "—",
      item.Department || "—",
      item.Role || "—",
      formatAed(basic),
      formatAed(hra),
      formatAed(travel),
      formatAed(other),
      formatAed(totAllow),
      formatAed(ded),
      formatAed(net),
      bank,
    ];
  });

  // Landscape A4 usable ~277mm (10mm margins) — keep sum ≤ 255 to allow cell padding
  const columnStyles = {
    0: { cellWidth: 8, halign: "center" },
    1: { cellWidth: 15, halign: "center" },
    2: { cellWidth: 32, halign: "left" },
    3: { cellWidth: 18, halign: "left" },
    4: { cellWidth: 18, halign: "left" },
    5: { cellWidth: 15, halign: "right" },
    6: { cellWidth: 13, halign: "right" },
    7: { cellWidth: 13, halign: "right" },
    8: { cellWidth: 13, halign: "right" },
    9: { cellWidth: 15, halign: "right" },
    10: { cellWidth: 14, halign: "right" },
    11: { cellWidth: 16, halign: "right" },
    12: { cellWidth: 32, halign: "left" },
  };

  const summaryItems = [
    { label: "Total Employees", value: String(rows.length) },
    { label: "Total Basic", value: `AED ${formatAed(totalBasic)}` },
    { label: "Total Allowances", value: `AED ${formatAed(totalAllow)}` },
    { label: "Total Deductions", value: `AED ${formatAed(totalDed)}` },
    { label: "Total Net Salary", value: `AED ${formatAed(totalNet)}` },
  ];

  return {
    headers,
    rows,
    columnStyles,
    moneyColIndexes: [5, 6, 7, 8, 9, 10, 11],
    summaryItems,
  };
}

/**
 * Employees Master Data — curated landscape columns so the table stays readable
 * and centered (full 40+ column dump caused vertical text / right shift).
 */
export function buildEmployeeMasterPdfRows(rawRows = []) {
  const headers = [
    "S.No",
    "Emp ID",
    "Employee Name",
    "Dept",
    "Role",
    "Status",
    "DOJ",
    "Nationality",
    "Passport No",
    "Passport Exp",
    "Labour Card No",
    "Labour Card Exp",
    "Visa Exp",
    "Emirates ID",
  ];

  const rows = (rawRows || []).map((item, idx) => [
    String(idx + 1),
    item["Employee ID"] || "—",
    item["Employee Name"] || item.Name || "—",
    item.Department || "—",
    item.Role || item.Designation || "—",
    item["Employment Status"] || item.Status || "—",
    item["Joining Date"] || item["Date of Joining"] || "—",
    item.Nationality || "—",
    item["Passport No"] || "—",
    item["Passport Expiry"] || "—",
    item["Labour Card Number"] || "—",
    item["Labour Card Expiry"] || "—",
    item["Visa Expiry"] || "—",
    item["Emirates ID"] || "—",
  ]);

  const columnStyles = {
    0: { cellWidth: 8, halign: "center" },
    1: { cellWidth: 14, halign: "center" },
    2: { cellWidth: 30, halign: "left" },
    3: { cellWidth: 18, halign: "left" },
    4: { cellWidth: 18, halign: "left" },
    5: { cellWidth: 16, halign: "center" },
    6: { cellWidth: 16, halign: "center" },
    7: { cellWidth: 14, halign: "left" },
    8: { cellWidth: 18, halign: "left" },
    9: { cellWidth: 16, halign: "center" },
    10: { cellWidth: 18, halign: "left" },
    11: { cellWidth: 16, halign: "center" },
    12: { cellWidth: 16, halign: "center" },
    13: { cellWidth: 18, halign: "left" },
  };

  return {
    headers,
    rows,
    columnStyles,
    moneyColIndexes: [],
    summaryItems: [
      { label: "Total Employees", value: String(rows.length) },
    ],
  };
}

/**
 * Document Expiry — fixed columns with passport + labour card clearly visible.
 */
export function buildDocumentExpiryPdfRows(rawRows = []) {
  const headers = [
    "S.No",
    "Emp ID",
    "Name",
    "Dept",
    "Passport No",
    "Passport Exp",
    "Passport Status",
    "Visa Exp",
    "Visa Status",
    "Labour Card No",
    "Labour Card Exp",
    "Labour Status",
  ];

  const rows = (rawRows || []).map((item, idx) => [
    String(idx + 1),
    item["Employee ID"] || "—",
    item.Name || item["Employee Name"] || "—",
    item.Department || "—",
    item["Passport No"] || "—",
    item["Passport Expiry"] || "—",
    item["Passport Status"] || "—",
    item["Visa Expiry"] || "—",
    item["Visa Status"] || "—",
    item["Labour Card Number"] || "—",
    item["Labour Card Expiry"] || "—",
    item["Labour Card Status"] || "—",
  ]);

  const columnStyles = {
    0: { cellWidth: 8, halign: "center" },
    1: { cellWidth: 15, halign: "center" },
    2: { cellWidth: 32, halign: "left" },
    3: { cellWidth: 20, halign: "left" },
    4: { cellWidth: 20, halign: "left" },
    5: { cellWidth: 18, halign: "center" },
    6: { cellWidth: 22, halign: "center" },
    7: { cellWidth: 18, halign: "center" },
    8: { cellWidth: 20, halign: "center" },
    9: { cellWidth: 20, halign: "left" },
    10: { cellWidth: 18, halign: "center" },
    11: { cellWidth: 22, halign: "center" },
  };

  return {
    headers,
    rows,
    columnStyles,
    moneyColIndexes: [],
    summaryItems: [
      { label: "Total Employees", value: String(rows.length) },
    ],
  };
}

/**
 * Generic fallback for non-salary reports.
 * Assigns fixed mm column widths so autoTable never collapses into vertical text.
 */
export function buildGenericReportPdfRows(rawRows = [], usableWidthMm = 277) {
  if (!rawRows.length) {
    return { headers: [], rows: [], columnStyles: {}, moneyColIndexes: [] };
  }

  const rawHeaders = Object.keys(rawRows[0]);
  const headers = rawHeaders.map((h) =>
    String(h)
      .replace("House Rent Allowance", "HRA")
      .replace("Travel Allowance", "Travel")
      .replace("Other Allowance", "Other")
      .replace("Total Allowance", "Tot Allow")
      .replace("Total / Net Salary", "Net")
      .replace("Employee ID", "Emp ID")
      .replace("Company Code", "Co. Code")
      .replace("Account Number", "Acct No")
  );

  const moneyColIndexes = rawHeaders
    .map((h, i) => (MONEY_HEADER_RE.test(h) ? i : -1))
    .filter((i) => i >= 0);

  const rows = rawRows.map((item) =>
    rawHeaders.map((header, colIdx) => {
      const val = item[header];
      if (val == null || val === "") return "—";
      if (moneyColIndexes.includes(colIdx) && (typeof val === "number" || !Number.isNaN(Number(val)))) {
        const n = Number(val);
        if (Number.isFinite(n)) return formatAed(n);
      }
      const text = String(val);
      // Soft-cap very long cells so wrapping stays horizontal
      return text.length > 48 ? `${text.slice(0, 45)}…` : text;
    })
  );

  const colCount = Math.max(headers.length, 1);
  const base = usableWidthMm / colCount;
  const columnStyles = {};
  headers.forEach((_, i) => {
    let width = base;
    const h = String(rawHeaders[i] || "").toLowerCase();
    if (/name|employee name|remarks|reason|company|iban/.test(h)) width = base * 1.45;
    else if (/id|status|code|date|sno|s\.no|role|dept/.test(h)) width = base * 0.85;
    else if (moneyColIndexes.includes(i)) width = base * 0.9;
    columnStyles[i] = {
      cellWidth: Math.max(10, Math.min(42, width)),
      halign: moneyColIndexes.includes(i) ? "right" : "left",
      overflow: "linebreak",
    };
  });

  // Normalize so widths sum to usableWidthMm
  const sum = Object.values(columnStyles).reduce((acc, c) => acc + c.cellWidth, 0);
  if (sum > 0) {
    const scale = usableWidthMm / sum;
    Object.keys(columnStyles).forEach((k) => {
      columnStyles[k].cellWidth = Math.round(columnStyles[k].cellWidth * scale * 10) / 10;
    });
  }

  return { headers, rows, columnStyles, moneyColIndexes };
}
