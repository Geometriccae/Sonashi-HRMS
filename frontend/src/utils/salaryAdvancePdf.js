/**
 * Salary Advance & Off-Cycle Payment PDF Generator
 * Complies with UAE client requirements:
 * - High-definition company letterhead (/letterhead.png / /letterhead_header.png)
 * - Professional black-and-white theme
 * - Supports both Individual Advance Voucher and Bulk Batch Statement
 * - Accurate Person ID (workPermitNo), Employee ID, Department, Amounts, and Status
 */

const loadJsPdf = async () => {
  const [{ default: jsPDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF };
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });

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
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Render standard HD company letterhead banner on the document.
 */
async function renderHeader(doc, margin = 14) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerWidth = pageWidth - margin * 2;
  let headerBottom = 12;

  try {
    let headerImg = null;
    try {
      headerImg = await loadImage("/letterhead.png");
    } catch {
      headerImg = await loadImage("/letterhead_header.png");
    }

    if (headerImg) {
      const imgProps = doc.getImageProperties(headerImg);
      const imgHeight = (imgProps.height * headerWidth) / imgProps.width;
      doc.addImage(headerImg, "PNG", margin, 10, headerWidth, imgHeight, undefined, "FAST");
      headerBottom = 10 + imgHeight;
    }
  } catch (err) {
    console.warn("Letterhead image failed to load, falling back to text banner:", err);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("SONASHI GENERAL TRADING LLC", pageWidth / 2, 18, { align: "center" });
    headerBottom = 22;
  }

  // Black divider line under letterhead
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, headerBottom + 3, pageWidth - margin, headerBottom + 3);

  return headerBottom + 7;
}

/**
 * 1. Download Individual Salary Advance / Commission Voucher PDF
 */
export async function downloadIndividualAdvancePdf(record, employeeDetails = null) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  const startY = await renderHeader(doc, margin);

  const isAdv = (record.type || "advance") === "advance";
  const voucherTitle = isAdv ? "SALARY ADVANCE VOUCHER" : "COMMISSION PAYOUT VOUCHER";

  // Document Title
  let currentY = startY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(voucherTitle, pageWidth / 2, currentY, { align: "center" });

  currentY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const voucherNo = record.batchId || record._id || "ADV-VOUCHER";
  const advanceDateStr = formatDate(record.advanceDate || record.createdAt || new Date());
  doc.text(`Voucher Ref: ${voucherNo}   |   Date: ${advanceDateStr}`, pageWidth / 2, currentY, {
    align: "center",
  });

  currentY += 8;

  // Employee Information Block
  const empName = record.employeeName || employeeDetails?.employeeName || "—";
  const empStaffId = record.employeeId || employeeDetails?.employeeId || "—";
  const personCode =
    employeeDetails?.workPermitNo ||
    employeeDetails?.personCode ||
    record.workPermitNo ||
    record.personCode ||
    "—";
  const department = record.department || employeeDetails?.department || "—";
  const designation = record.designation || employeeDetails?.designation || "—";
  const bankAcc =
    employeeDetails?.salaryDetails?.ibanNumber ||
    employeeDetails?.salaryDetails?.accountNumber ||
    employeeDetails?.bankAccount ||
    record.bankAccount ||
    "—";

  const originalAmt = Number(record.originalAmount != null ? record.originalAmount : (record.amount || 0));
  const recoveredAmt = Number(record.recoveredAmount || 0);
  const balanceAmt = Number(record.outstandingBalance != null ? record.outstandingBalance : originalAmt);
  const statusStr = String(record.status || "Approved").replace(/_/g, " ").toUpperCase();
  const remarksStr = record.remarks || record.paymentReference || "—";

  const infoRows = [
    [
      { content: "Employee Name", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
      { content: empName },
      { content: "Staff ID", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
      { content: empStaffId },
    ],
    [
      { content: "Person ID / Code", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
      { content: personCode },
      { content: "Department", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
      { content: department },
    ],
    [
      { content: "Designation", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
      { content: designation },
      { content: "Bank / IBAN", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } },
      { content: bankAcc },
    ],
  ];

  doc.autoTable({
    startY: currentY,
    margin: { left: margin, right: margin },
    body: infoRows,
    theme: "plain",
    styles: {
      fontSize: 9,
      textColor: [0, 0, 0],
      cellPadding: 3.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 55 },
      2: { cellWidth: 35 },
      3: { cellWidth: 57 },
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // Financial Summary Table
  const finHeaders = [["Item Description", "Details / Reference", "Amount (AED)"]];
  const finBody = [
    [
      isAdv ? "Approved Salary Advance Amount" : "Commission Payout Amount",
      `Disbursement Date: ${advanceDateStr}`,
      formatAed(originalAmt),
    ],
  ];

  if (isAdv) {
    finBody.push([
      "Recovered Amount to Date",
      "Deducted via monthly payroll",
      formatAed(recoveredAmt),
    ]);
    finBody.push([
      { content: "Outstanding Balance", styles: { fontStyle: "bold" } },
      { content: `Payment Status: ${statusStr}`, styles: { fontStyle: "bold" } },
      { content: formatAed(balanceAmt), styles: { fontStyle: "bold" } },
    ]);
  } else {
    finBody.push([
      { content: "Net Commission Payable", styles: { fontStyle: "bold" } },
      { content: `Payment Status: ${statusStr}`, styles: { fontStyle: "bold" } },
      { content: formatAed(originalAmt), styles: { fontStyle: "bold" } },
    ]);
  }

  doc.autoTable({
    startY: currentY,
    margin: { left: margin, right: margin },
    head: finHeaders,
    body: finBody,
    theme: "plain",
    styles: {
      fontSize: 9.5,
      textColor: [0, 0, 0],
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      fontStyle: "bold",
      textColor: [0, 0, 0],
      lineWidth: 0.35,
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 62 },
      2: { cellWidth: 40, halign: "right" },
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // Remarks section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text("Remarks / Notes:", margin, currentY);
  currentY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.text(remarksStr, margin, currentY, { maxWidth: pageWidth - margin * 2 });

  // Signatures at bottom
  const sigY = pageHeight - 45;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);

  const sigColWidth = 50;
  // Prepared by
  doc.line(margin, sigY, margin + sigColWidth, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Prepared By", margin + 12, sigY + 5);

  // Approved by
  const centerSigX = pageWidth / 2 - sigColWidth / 2;
  doc.line(centerSigX, sigY, centerSigX + sigColWidth, sigY);
  doc.text("Approved By", centerSigX + 13, sigY + 5);

  // Employee Signature
  const rightSigX = pageWidth - margin - sigColWidth;
  doc.line(rightSigX, sigY, rightSigX + sigColWidth, sigY);
  doc.text("Employee Signature", rightSigX + 8, sigY + 5);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const timeStamp = new Date().toLocaleString("en-GB");
  doc.text(`Generated on ${timeStamp} — Sonashi HRMS`, margin, pageHeight - 12);
  doc.text("Page 1 of 1", pageWidth - margin, pageHeight - 12, { align: "right" });

  const fileName = `${empStaffId}_${isAdv ? "Advance" : "Commission"}_${advanceDateStr.replace(/\//g, "-")}.pdf`;
  doc.save(fileName);
  return { ok: true, fileName };
}

/**
 * 2. Download Bulk Batch Salary Advance / Commission Statement PDF
 */
export async function downloadBatchAdvancePdf(batch, employeeList = []) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  const startY = await renderHeader(doc, margin);

  const isAdv = (batch.type || "advance") === "advance";
  const title = isAdv
    ? "SALARY ADVANCE BATCH STATEMENT"
    : "COMMISSION PAYOUT BATCH STATEMENT";

  // Document Title
  let currentY = startY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(title, pageWidth / 2, currentY, { align: "center" });

  currentY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(50, 50, 50);

  const paymentDateStr = formatDate(batch.paymentDate || batch.advanceDate || batch.createdAt);
  const items = Array.isArray(batch.items) ? batch.items : [];
  const empCount = items.length || batch.employeeCount || 0;
  const totalAmt = Number(batch.totalAmount || 0);

  doc.text(
    `Batch ID: ${batch.batchId}   |   Disbursement Date: ${paymentDateStr}   |   Employees: ${empCount}   |   Total: ${formatAed(totalAmt)}`,
    pageWidth / 2,
    currentY,
    { align: "center" }
  );

  currentY += 7;

  // Build Map of employees for Person ID / Department lookup
  const empMap = new Map();
  if (Array.isArray(employeeList)) {
    employeeList.forEach((e) => {
      if (e._id) empMap.set(String(e._id), e);
      if (e.employeeId) empMap.set(String(e.employeeId).trim().toLowerCase(), e);
    });
  }

  // Table Columns & Rows
  const headers = [
    [
      "S.No",
      "Employee Name",
      "Emp ID",
      "Person ID",
      "Department",
      "Amount (AED)",
      ...(isAdv ? ["Recovered", "Balance"] : []),
      "Status",
      "Remarks",
    ],
  ];

  let sumRecovered = 0;
  let sumBalance = 0;

  const body = items.map((item, idx) => {
    const empIdKey = item.employeeId || item.employee?._id || item.employee;
    const empDoc =
      empMap.get(String(empIdKey)) ||
      (item.employeeId ? empMap.get(String(item.employeeId).trim().toLowerCase()) : null) ||
      (typeof item.employee === "object" ? item.employee : {}) ||
      {};

    const name = item.employeeName || empDoc.employeeName || "—";
    const staffId = item.employeeId || empDoc.employeeId || "—";
    const personId =
      empDoc.workPermitNo ||
      empDoc.personCode ||
      item.workPermitNo ||
      item.personCode ||
      "—";
    const dept = item.department || empDoc.department || "—";
    const originalAmt = Number(item.originalAmount != null ? item.originalAmount : (item.amount || 0));
    const recAmt = Number(item.recoveredAmount || 0);
    const balAmt = Number(item.outstandingBalance != null ? item.outstandingBalance : originalAmt);
    const status = String(item.status || "active").replace(/_/g, " ");
    const remarks = item.remarks || "—";

    sumRecovered += recAmt;
    sumBalance += balAmt;

    const row = [
      idx + 1,
      name,
      staffId,
      personId,
      dept,
      Number(originalAmt).toFixed(2),
    ];
    if (isAdv) {
      row.push(Number(recAmt).toFixed(2));
      row.push(Number(balAmt).toFixed(2));
    }
    row.push(status);
    row.push(remarks);
    return row;
  });

  // Footer summary row
  const summaryRow = [
    { content: "Total", colSpan: 5, styles: { fontStyle: "bold", halign: "right" } },
    { content: totalAmt.toFixed(2), styles: { fontStyle: "bold", halign: "right" } },
  ];
  if (isAdv) {
    summaryRow.push({ content: sumRecovered.toFixed(2), styles: { fontStyle: "bold", halign: "right" } });
    summaryRow.push({ content: sumBalance.toFixed(2), styles: { fontStyle: "bold", halign: "right" } });
  }
  summaryRow.push({ content: "", colSpan: 2 });
  body.push(summaryRow);

  doc.autoTable({
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 15 },
    head: headers,
    body: body,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      textColor: [0, 0, 0],
      cellPadding: 2.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      fontStyle: "bold",
      textColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 48 },
      2: { cellWidth: 22 },
      3: { cellWidth: 32 },
      4: { cellWidth: 35 },
      5: { cellWidth: 26, halign: "right" },
      ...(isAdv
        ? {
            6: { cellWidth: 24, halign: "right" },
            7: { cellWidth: 24, halign: "right" },
            8: { cellWidth: 24 },
            9: { cellWidth: "auto" },
          }
        : {
            6: { cellWidth: 26 },
            7: { cellWidth: "auto" },
          }),
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const timeStamp = new Date().toLocaleString("en-GB");
      doc.text(`Generated on ${timeStamp} — Sonashi HRMS`, margin, pageHeight - 8);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - margin,
        pageHeight - 8,
        { align: "right" }
      );
    },
  });

  const fileName = `${batch.batchId}_Statement.pdf`;
  doc.save(fileName);
  return { ok: true, fileName };
}
