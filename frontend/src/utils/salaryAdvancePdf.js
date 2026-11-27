/**
 * Salary Advance & Off-Cycle Payment PDF Generator
 *
 * Layout-only module: professional A4 corporate black-and-white reports.
 * Business logic, amounts, statuses and selection remain caller-owned.
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
};

const HEADER_CANDIDATES = [
  "/payslip_company_header.png",
  "/letterhead_header.png",
  "/letterhead.png",
  "/sonashi_logo_updated.png",
  "/sonashi_logo.png",
];

let cachedHeaderImage = null;

const loadJsPdf = async () => {
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

/** Prefer natural image aspect; fall back to element width/height. */
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

const formatAed = (val) => {
  const n = Number(val || 0);
  return `AED ${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (dateVal) => {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateTime = (dateVal = new Date()) => {
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const displayStatus = (status) =>
  String(status || "active")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bSif\b/g, "SIF");

const isPaidStatus = (status) => {
  const s = String(status || "").toLowerCase();
  return ["sif_generated", "processed", "fully_recovered"].includes(s);
};

const isApprovedStatus = (status) => {
  const s = String(status || "").toLowerCase();
  return s !== "cancelled";
};

const recordAmount = (item) =>
  Number(item?.originalAmount != null ? item.originalAmount : item?.amount || 0);

/**
 * Draw company header with HD letterhead (aspect-preserved, not stretched).
 * Returns Y position below the header.
 */
async function renderCompanyHeader(doc, margin, maxHeightMm = 28) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const headerImg = await getHeaderImage();
  if (headerImg) {
    try {
      const src = imageSource(headerImg);
      const props = imageSize(doc, src || headerImg);
      let drawW = contentWidth;
      let drawH = (props.height * drawW) / props.width;
      if (drawH > maxHeightMm) {
        drawH = maxHeightMm;
        drawW = (props.width * drawH) / props.height;
      }
      const x = margin + (contentWidth - drawW) / 2;
      // MEDIUM keeps letterhead sharp without the heavy pixelation of FAST
      doc.addImage(src || headerImg, "PNG", x, y, drawW, drawH, undefined, "MEDIUM");
      y += drawH + 3;
    } catch (err) {
      console.warn("Letterhead render failed, using text header:", err);
      y = drawTextCompanyHeader(doc, margin, y);
    }
  } else {
    y = drawTextCompanyHeader(doc, margin, y);
  }

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.45);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setDrawColor(...COLORS.softLine);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 1.2, pageWidth - margin, y + 1.2);

  return y + 5;
}

function drawTextCompanyHeader(doc, margin, startY) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cx = pageWidth / 2;
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.black);
  doc.text(COMPANY.name, cx, y + 4, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(COMPANY.address, cx, y + 9, { align: "center" });
  doc.text(COMPANY.contact, cx, y + 13.5, { align: "center" });
  doc.text(COMPANY.emailWeb, cx, y + 18, { align: "center" });

  return y + 22;
}

function drawReportTitle(doc, margin, startY, title, metaLines = []) {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.black);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  metaLines.filter(Boolean).forEach((line) => {
    doc.text(line, pageWidth / 2, y, { align: "center" });
    y += 4.2;
  });

  return y + 2;
}

function drawSectionHeading(doc, margin, y, label) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.black);
  doc.text(label, margin, y);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.25);
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.line(margin, y + 1.5, pageWidth - margin, y + 1.5);
  return y + 5;
}

function drawKeyValueGrid(doc, autoTable, margin, startY, pairs) {
  const rows = [];
  for (let i = 0; i < pairs.length; i += 2) {
    rows.push([pairs[i], pairs[i + 1] || null]);
  }

  const body = rows.map(([left, right]) => {
    const cells = [
      {
        content: left?.label || "",
        styles: { fontStyle: "bold", fillColor: COLORS.headerBg, textColor: COLORS.black },
      },
      {
        content: String(left?.value ?? "—"),
        styles: { textColor: COLORS.text },
      },
    ];
    if (right) {
      cells.push({
        content: right.label || "",
        styles: { fontStyle: "bold", fillColor: COLORS.headerBg, textColor: COLORS.black },
      });
      cells.push({
        content: String(right.value ?? "—"),
        styles: { textColor: COLORS.text },
      });
    } else {
      cells.push({ content: "", styles: { fillColor: COLORS.headerBg } });
      cells.push({ content: "" });
    }
    return cells;
  });

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: { top: 2.8, right: 3, bottom: 2.8, left: 3 },
      lineColor: COLORS.line,
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 7.5,
    },
    columnStyles: {
      0: { cellWidth: "18%" },
      1: { cellWidth: "32%" },
      2: { cellWidth: "18%" },
      3: { cellWidth: "32%" },
    },
  });

  return doc.lastAutoTable.finalY + 6;
}

function drawSummaryBox(doc, autoTable, margin, startY, summaryItems) {
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [summaryItems.map((item) => item.label)],
    body: [summaryItems.map((item) => item.value)],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: COLORS.text,
      cellPadding: { top: 3.2, right: 3, bottom: 3.2, left: 3 },
      lineColor: COLORS.line,
      lineWidth: 0.25,
      halign: "center",
      valign: "middle",
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.black,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      fontStyle: "bold",
      textColor: COLORS.black,
    },
  });

  return doc.lastAutoTable.finalY + 4;
}

function applyFooters(doc, margin, generatedAt) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const footerY = pageHeight - 8;

    doc.setDrawColor(...COLORS.softLine);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(COMPANY.name, margin, footerY);
    doc.text(`Generated: ${generatedAt}`, pageWidth / 2, footerY, { align: "center" });
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY, { align: "right" });
  }
}

function resolveEmployeeFields(record, employeeDetails = null) {
  return {
    empName: record.employeeName || employeeDetails?.employeeName || "—",
    empStaffId: record.employeeId || employeeDetails?.employeeId || "—",
    personCode:
      employeeDetails?.workPermitNo ||
      employeeDetails?.personCode ||
      record.workPermitNo ||
      record.personCode ||
      "—",
    department: record.department || employeeDetails?.department || "—",
    designation:
      record.designation ||
      employeeDetails?.designation ||
      employeeDetails?.role ||
      "—",
    company: record.company || employeeDetails?.company || employeeDetails?.office || "—",
  };
}

function buildAdvanceTableRows(items) {
  return (items || []).map((item, idx) => {
    const amount = recordAmount(item);
    return [
      String(idx + 1),
      item.employeeName || "—",
      item.employeeId || "—",
      formatDate(item.advanceDate || item.createdAt),
      formatAed(amount),
      displayStatus(item.status),
    ];
  });
}

function summarizeItems(items) {
  const list = Array.isArray(items) ? items : [];
  const totalEmployees = new Set(
    list.map((i) => String(i.employeeId || i.employee || i._id || i.employeeName || "")).filter(Boolean)
  ).size;
  let approved = 0;
  let paid = 0;
  let totalAmount = 0;
  list.forEach((item) => {
    totalAmount += recordAmount(item);
    if (isApprovedStatus(item.status)) approved += 1;
    if (isPaidStatus(item.status)) paid += 1;
  });
  return {
    totalEmployees: totalEmployees || list.length,
    totalApproved: approved,
    totalPaid: paid,
    totalAmount,
  };
}

/**
 * 1. Individual Salary Advance / Commission PDF (A4 portrait)
 */
export async function buildIndividualAdvancePdf(record, employeeDetails = null) {
  const { jsPDF, autoTable } = await loadJsPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const generatedAt = formatDateTime(new Date());

  const isAdv = (record.type || "advance") === "advance";
  const reportTitle = isAdv ? "SALARY ADVANCE REPORT" : "COMMISSION PAYOUT REPORT";
  const fields = resolveEmployeeFields(record, employeeDetails);
  const originalAmt = recordAmount(record);
  const recoveredAmt = Number(record.recoveredAmount || 0);
  const balanceAmt = Number(
    record.outstandingBalance != null ? record.outstandingBalance : originalAmt
  );
  const statusStr = displayStatus(record.status || "active");
  const advanceDateStr = formatDate(record.advanceDate || record.createdAt || new Date());
  const period = record.period || advanceDateStr;
  const remarksStr = record.remarks || record.paymentReference || "—";

  let y = await renderCompanyHeader(doc, margin, 26);
  y = drawReportTitle(doc, margin, y, reportTitle, [
    `Generated: ${generatedAt}`,
    `Payment Period: ${period}   |   Employee: ${fields.empName} (${fields.empStaffId})`,
    record.batchId ? `Batch / Ref: ${record.batchId}` : null,
  ]);

  y = drawSectionHeading(doc, margin, y + 1, "Employee Details");
  y = drawKeyValueGrid(doc, autoTable, margin, y, [
    { label: "Employee Name", value: fields.empName },
    { label: "Employee ID", value: fields.empStaffId },
    { label: "Person Code", value: fields.personCode },
    { label: "Department", value: fields.department },
    { label: "Designation", value: fields.designation },
    { label: "Company / Office", value: fields.company },
  ]);

  y = drawSectionHeading(doc, margin, y, "Advance Details");

  const detailHead = [["S.No", "Employee Name", "Employee ID", "Advance Date", "Advance Amount", "Status"]];
  const detailBody = [
    [
      "1",
      fields.empName,
      fields.empStaffId,
      advanceDateStr,
      formatAed(originalAmt),
      statusStr,
    ],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 18 },
    head: detailHead,
    body: detailBody,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: COLORS.text,
      cellPadding: { top: 3, right: 2.5, bottom: 3, left: 2.5 },
      lineColor: COLORS.line,
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.black,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: "6%", halign: "center" },
      1: { cellWidth: "28%" },
      2: { cellWidth: "15%", halign: "center" },
      3: { cellWidth: "15%", halign: "center" },
      4: { cellWidth: "20%", halign: "right" },
      5: { cellWidth: "16%", halign: "center" },
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  if (isAdv) {
    y = drawSectionHeading(doc, margin, y, "Recovery Summary");
    y = drawKeyValueGrid(doc, autoTable, margin, y, [
      { label: "Advance Amount", value: formatAed(originalAmt) },
      { label: "Status", value: statusStr },
      { label: "Recovered", value: formatAed(recoveredAmt) },
      { label: "Outstanding", value: formatAed(balanceAmt) },
    ]);
  } else {
    y = drawSectionHeading(doc, margin, y, "Payment Summary");
    y = drawKeyValueGrid(doc, autoTable, margin, y, [
      { label: "Payable Amount", value: formatAed(originalAmt) },
      { label: "Status", value: statusStr },
    ]);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.black);
  doc.text("Remarks / Notes", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.text);
  const remarkLines = doc.splitTextToSize(String(remarksStr), pageWidth - margin * 2);
  doc.text(remarkLines, margin, y);
  y += remarkLines.length * 4 + 10;

  const sigY = Math.max(y + 8, pageHeight - 42);
  const sigW = 48;
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);

  doc.line(margin, sigY, margin + sigW, sigY);
  doc.text("Prepared By", margin + 10, sigY + 5);

  const midX = pageWidth / 2 - sigW / 2;
  doc.line(midX, sigY, midX + sigW, sigY);
  doc.text("Approved By", midX + 11, sigY + 5);

  const rightX = pageWidth - margin - sigW;
  doc.line(rightX, sigY, rightX + sigW, sigY);
  doc.text("Employee Signature", rightX + 6, sigY + 5);

  applyFooters(doc, margin, generatedAt);

  const fileName = `${fields.empStaffId}_${isAdv ? "Advance" : "Commission"}_${advanceDateStr.replace(/\//g, "-")}.pdf`;
  return { doc, fileName };
}

export async function downloadIndividualAdvancePdf(record, employeeDetails = null) {
  const { doc, fileName } = await buildIndividualAdvancePdf(record, employeeDetails);
  doc.save(fileName);
  return { ok: true, fileName };
}

/**
 * 2. Bulk Batch Salary Advance / Commission Statement PDF (A4 landscape)
 */
export async function buildBatchAdvancePdf(batch, employeeList = []) {
  const { jsPDF, autoTable } = await loadJsPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const generatedAt = formatDateTime(new Date());

  const isAdv = (batch.type || "advance") === "advance";
  const reportTitle = isAdv ? "SALARY ADVANCE REPORT" : "COMMISSION PAYOUT REPORT";

  const items = Array.isArray(batch.items) ? batch.items : [];
  const empMap = new Map();
  if (Array.isArray(employeeList)) {
    employeeList.forEach((e) => {
      if (e._id) empMap.set(String(e._id), e);
      if (e.employeeId) empMap.set(String(e.employeeId).trim().toLowerCase(), e);
    });
  }

  const enrichedItems = items.map((item) => {
    const empIdKey = item.employeeId || item.employee?._id || item.employee;
    const empDoc =
      empMap.get(String(empIdKey)) ||
      (item.employeeId ? empMap.get(String(item.employeeId).trim().toLowerCase()) : null) ||
      (typeof item.employee === "object" ? item.employee : {}) ||
      {};
    return {
      ...item,
      employeeName: item.employeeName || empDoc.employeeName || "—",
      employeeId: item.employeeId || empDoc.employeeId || "—",
      department: item.department || empDoc.department || "—",
      designation: item.designation || empDoc.designation || empDoc.role || "—",
      advanceDate: item.advanceDate || batch.paymentDate || batch.advanceDate || batch.createdAt,
      status: item.status || batch.status || "active",
    };
  });

  const paymentDateStr = formatDate(batch.paymentDate || batch.advanceDate || batch.createdAt);
  const period = batch.period || paymentDateStr;
  const totals = summarizeItems(enrichedItems);
  const totalAmt =
    Number(batch.totalAmount) > 0 ? Number(batch.totalAmount) : totals.totalAmount;

  let y = await renderCompanyHeader(doc, margin, 22);
  y = drawReportTitle(doc, margin, y, reportTitle, [
    `Generated: ${generatedAt}`,
    `Payment Period: ${period}   |   Employees: All Selected (${enrichedItems.length})`,
    `Batch ID: ${batch.batchId || "—"}   |   Disbursement Date: ${paymentDateStr}`,
  ]);

  y = drawSectionHeading(doc, margin, y + 1, "Salary Advance Details");

  const headers = [["S.No", "Employee Name", "Employee ID", "Advance Date", "Advance Amount", "Status"]];
  const body = buildAdvanceTableRows(enrichedItems);

  // Content width ~273mm on landscape A4 with 12mm margins
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: 18, bottom: 16 },
    head: headers,
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: COLORS.text,
      cellPadding: { top: 2.8, right: 2.5, bottom: 2.8, left: 2.5 },
      lineColor: COLORS.line,
      lineWidth: 0.2,
      valign: "middle",
      overflow: "linebreak",
      minCellHeight: 7.5,
    },
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.black,
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles: {
      0: { cellWidth: "5%", halign: "center" },
      1: { cellWidth: "32%" },
      2: { cellWidth: "14%", halign: "center" },
      3: { cellWidth: "14%", halign: "center" },
      4: { cellWidth: "18%", halign: "right" },
      5: { cellWidth: "17%", halign: "center" },
    },
    showHead: "everyPage",
    rowPageBreak: "avoid",
    didDrawPage: (data) => {
      // Compact continuation header on pages after the first
      if (data.pageNumber > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.black);
        doc.text(`${reportTitle} (continued)`, pageWidth / 2, 10, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...COLORS.muted);
        doc.text(`Batch: ${batch.batchId || "—"}`, pageWidth / 2, 14, { align: "center" });
      }
    },
  });

  let summaryY = doc.lastAutoTable.finalY + 6;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (summaryY > pageHeight - 36) {
    doc.addPage();
    summaryY = 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.black);
    doc.text(`${reportTitle} — Summary`, pageWidth / 2, 12, { align: "center" });
  }

  drawSectionHeading(doc, margin, summaryY, "Report Summary");
  summaryY += 5;
  drawSummaryBox(doc, autoTable, margin, summaryY, [
    { label: "Total Employees", value: String(totals.totalEmployees) },
    { label: "Total Approved Advances", value: String(totals.totalApproved) },
    { label: "Total Paid Advances", value: String(totals.totalPaid) },
    { label: "Total Advance Amount", value: formatAed(totalAmt) },
  ]);

  applyFooters(doc, margin, generatedAt);

  const fileName = `${batch.batchId || "SalaryAdvance"}_Statement.pdf`;
  return { doc, fileName };
}

export async function downloadBatchAdvancePdf(batch, employeeList = []) {
  const { doc, fileName } = await buildBatchAdvancePdf(batch, employeeList);
  doc.save(fileName);
  return { ok: true, fileName };
}
