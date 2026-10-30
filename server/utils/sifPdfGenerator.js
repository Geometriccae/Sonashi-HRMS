const { jsPDF } = require("jspdf");
const autoTableMod = require("jspdf-autotable");
const autoTable = autoTableMod.default || autoTableMod;

const {
  formatMoney,
  getAgentCode,
  getBankAccount,
  getFixedIncome,
  digitsOnly,
} = require("./sifUtils");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `AED ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generate a supporting PDF document containing Section A (Employee Details)
 * and Section B (SIF Summary) matching the exact SIF dataset.
 */
function generateSifPdf({
  employees = [],
  employerId = "",
  companyCode = "",
  companyName = "",
  defaultAgentRoutingCode = "",
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
  generatedDate = new Date(),
  isIndividual = false,
  skipped = [],
  excludedByCompany = 0,
  fileRef = "",
  fileName = "",
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const monthName = MONTH_NAMES[Number(month) - 1] || `Month ${month}`;
  const periodText = `${monthName} ${year}`;
  const genDateStr = generatedDate instanceof Date
    ? generatedDate.toLocaleString("en-GB", { timeZone: "Asia/Dubai" })
    : String(generatedDate);

  // Compute totals across included employees
  let totalBasic = 0;
  let totalHra = 0;
  let totalAllowances = 0;
  let totalDeductions = 0;
  let totalNetSalary = 0;

  const employeeRows = employees.map((emp, idx) => {
    const sal = emp.salaryDetails || {};
    const basic = Number(sal.basicSalary) || 0;
    const hra = Number(sal.houseRent) || 0;
    const travel = Number(sal.travelExp) || 0;
    const other = Number(sal.other) || 0;
    const totalAllow = Number(sal.totalAllowance) || (travel + other);
    const deduction = Number(sal.deduction) || 0;
    const net = getFixedIncome(emp);

    totalBasic += basic;
    totalHra += hra;
    totalAllowances += totalAllow;
    totalDeductions += deduction;
    totalNetSalary += net;

    const agent = getAgentCode(emp);
    const bank = getBankAccount(emp);
    const personCode = String(emp.workPermitNo || "").trim() || String(emp.labourCardNumber || "").trim();

    return [
      idx + 1,
      emp.employeeId || "—",
      emp.employeeName || "—",
      `${emp.department || "—"}\n${emp.designation || ""}`.trim(),
      personCode || "—",
      agent || "—",
      bank || "—",
      basic.toFixed(2),
      hra.toFixed(2),
      totalAllow.toFixed(2),
      deduction.toFixed(2),
      net.toFixed(2),
    ];
  });

  const totalExcludedCount = (skipped?.length || 0) + (Number(excludedByCompany) || 0);

  // ── Header Banner ────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("SONASHI HRMS — SIF SUPPORTING REPORT & EMPLOYEE DETAILS", 14, 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Wages Protection System (WPS) Supporting Document | Scope: ${isIndividual ? "Individual Employee Export" : "Company-Wide Export"}`,
    14,
    18
  );

  // ── Section B: SIF Summary & Metadata (Top Cards) ────────────────────────
  let currentY = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text("SECTION B — SIF PAYROLL & COMPANY SUMMARY", 14, currentY);

  currentY += 4;

  const cardWidth = (pageWidth - 28 - 8) / 3;
  const cardHeight = 28;

  // Card 1: Company Details
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("COMPANY INFORMATION", 18, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Company Name: ${companyName || "Sonashi General Trading LLC"}`, 18, currentY + 12);
  doc.text(`Company Code: ${companyCode || "—"}`, 18, currentY + 17);
  doc.text(`Employer ID (MOL 13-digit): ${employerId || "—"}`, 18, currentY + 22);

  // Card 2: Period & Routing Info
  const card2X = 14 + cardWidth + 4;
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text("PAYROLL PERIOD & ROUTING", card2X + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Payroll Period: ${periodText}`, card2X + 4, currentY + 12);
  doc.text(`Generated On: ${genDateStr}`, card2X + 4, currentY + 17);
  const routingDisplay = isIndividual && employees[0]
    ? getAgentCode(employees[0]) || defaultAgentRoutingCode || "—"
    : defaultAgentRoutingCode || "—";
  doc.text(`Agent Routing Code (SCR): ${routingDisplay}`, card2X + 4, currentY + 22);

  // Card 3: Financial Totals & Validation
  const card3X = card2X + cardWidth + 4;
  doc.setFillColor(240, 253, 244); // light green
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(21, 128, 61); // green-700
  doc.text("FINANCIAL TOTALS & VALIDATION", card3X + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Employees Included: ${employees.length}`, card3X + 4, currentY + 12);
  doc.text(`Total Deductions: ${formatCurrency(totalDeductions)}`, card3X + 4, currentY + 17);
  doc.setFont("helvetica", "bold");
  doc.text(`Final Net SIF Payable: ${formatCurrency(totalNetSalary)}`, card3X + 4, currentY + 22);

  currentY += cardHeight + 8;

  // Validation note banner
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  if (totalExcludedCount > 0) {
    doc.setTextColor(194, 65, 12); // amber
    doc.text(
      `* Validation Note: ${employees.length} record(s) valid and included in SIF. ${totalExcludedCount} record(s) excluded/skipped due to missing data or company mismatch.`,
      14,
      currentY
    );
  } else {
    doc.setTextColor(22, 101, 52); // green
    doc.text(
      `* Validation Status: All ${employees.length} record(s) verified against authoritative database records and eligible for SIF export.`,
      14,
      currentY
    );
  }

  currentY += 4;

  // ── Section A: Employee Details Table ────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("SECTION A — EMPLOYEE DETAILS & SALARY BREAKDOWN", 14, currentY + 4);

  const tableHeaders = [
    [
      "#",
      "Emp ID",
      "Employee Name",
      "Dept / Designation",
      "Labour Card",
      "Agent Code",
      "IBAN / Account",
      "Basic",
      "HRA",
      "Allowances",
      "Deduction",
      "Net Pay",
    ],
  ];

  // Footer summary row
  const tableFoot = [
    [
      "",
      "Total",
      `${employees.length} Employee(s)`,
      "",
      "",
      "",
      "",
      totalBasic.toFixed(2),
      totalHra.toFixed(2),
      totalAllowances.toFixed(2),
      totalDeductions.toFixed(2),
      totalNetSalary.toFixed(2),
    ],
  ];

  autoTable(doc, {
    startY: currentY + 6,
    head: tableHeaders,
    body: employeeRows,
    foot: tableFoot,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { cellWidth: "auto" },
      4: { cellWidth: 26, halign: "center" },
      5: { cellWidth: 22, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 42 },
      7: { cellWidth: 16, halign: "right" },
      8: { cellWidth: 16, halign: "right" },
      9: { cellWidth: 16, halign: "right" },
      10: { cellWidth: 16, halign: "right" },
      11: { cellWidth: 20, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    tableWidth: 269,
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Page numbering footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Sonashi HRMS SIF Supporting Documentation — ${periodText} | SIF Ref: ${fileRef || "WPS-EXPORT"}`,
        14,
        pageHeight - 8
      );
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - 25,
        pageHeight - 8
      );
    },
  });

  // If there are skipped records, add a small excluded records table on a new page or below
  if (skipped && skipped.length > 0) {
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY;
    if (finalY + 40 > pageHeight) {
      doc.addPage();
      currentY = 20;
    } else {
      currentY = finalY + 10;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(185, 28, 28); // red-700
    doc.text("EXCLUDED / SKIPPED RECORDS SUMMARY", 14, currentY);

    const skippedHeaders = [["#", "Staff ID", "Employee Name", "EMPID / Work Permit", "Reason for Exclusion"]];
    const skippedBody = skipped.map((s, idx) => [
      idx + 1,
      s.staffId || "—",
      s.empName || "—",
      s.empId || "—",
      s.reason || "Missing mandatory data",
    ]);

    autoTable(doc, {
      startY: currentY + 3,
      head: skippedHeaders,
      body: skippedBody,
      theme: "grid",
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [185, 28, 28],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 25, halign: "center" },
        2: { cellWidth: 50 },
        3: { cellWidth: 40, halign: "center" },
        4: { cellWidth: "auto" },
      },
      tableWidth: 269,
      margin: { left: 14, right: 14 },
    });
  }

  return Buffer.from(doc.output("arraybuffer"));
}

module.exports = {
  generateSifPdf,
  formatCurrency,
};
