/**
 * Shared Salary Slip PDF builder — same template as the individual download.
 * Uses stored slip amounts only (no payroll recalculation).
 */
import config from "../config/config";
import employeeService from "../services/EmployeeService";
import salarySlipService from "../services/SalarySlipService";
import { isPlaceholderEmployeeEmail } from "./employeeEmailDisplay";

const loadJsPdf = async () => {
  const [{ default: jsPDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF };
};

/** Payslip employee block: two fields per row, in the order printed on the slip. */
export const PAYSLIP_EMPLOYEE_ROWS = [
  [
    ["Emp ID", "empId"],
    ["Employee Name", "employeeName"],
  ],
  [
    ["Payable Days", "payableDays"],
    ["Present Days", "presentDays"],
  ],
  [
    ["Department", "department"],
    ["Designation", "designation"],
  ],
  [
    ["Bank Acc No", "bankAccNo"],
    ["IBAN Number", "ibanNumber"],
  ],
  [
    ["Person Code", "personCode"],
    ["Mode of Pay", "modeOfPay"],
  ],
  [
    ["DOJ", "doj"],
    ["Email ID", "emailId"],
  ],
  [
    ["Emirates ID", "emiratesId"],
    ["Unified ID", "unifiedId"],
  ],
];

const dayCountText = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.round(n * 100) / 100);
};

/** Used only if the employee record cannot be loaded; never borrows another employee's data. */
export const payslipEmployeeFallback = (slip) => ({
  empId: "",
  employeeName: slip.employeeName || "",
  payableDays: dayCountText(slip.payableDays),
  presentDays: dayCountText(slip.presentDays),
  department: slip.department || "",
  designation: slip.designation || "",
  bankAccNo: "",
  ibanNumber: "",
  personCode: "",
  modeOfPay: "",
  doj: slip.dateOfJoining || "",
  emailId: isPlaceholderEmployeeEmail(slip.emailId) ? "" : String(slip.emailId).trim(),
  emiratesId: "",
  unifiedId: "",
});

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });

/**
 * Build a payslip PDF document from a stored salary slip (+ optional employee details).
 * @returns {{ doc: import('jspdf').jsPDF, fileName: string }}
 */
export async function buildPayslipPdfDoc(slip, slipEmployeeDetails = null) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const basicPay = slip.basicPay || 0;
  const hra = slip.hra || 0;
  const conveyanceAllowance = slip.conveyanceAllowance || 0;
  const otherAllowance = slip.otherAllowance || 0;
  let advance = slip.advance || 0;
  const leave = slip.leave || 0;
  const staffLoan = slip.staffLoan || 0;
  const profTax = slip.profTax || 0;
  const incomeTaxTDS = slip.incomeTaxTDS || 0;

  const hasBreakdown = advance + leave + staffLoan + profTax + incomeTaxTDS > 0;
  const legacyDeduction = slip.deductionsPFTax || slip.totalDeduction || 0;
  if (!hasBreakdown && legacyDeduction > 0) {
    advance = legacyDeduction;
  }

  const grossSalary =
    slip.grossSalary || basicPay + hra + conveyanceAllowance + otherAllowance;
  const totalDeduction =
    slip.totalDeduction ||
    advance + leave + staffLoan + profTax + incomeTaxTDS ||
    slip.deductionsPFTax ||
    0;
  const netSalary = slip.netSalary || grossSalary - totalDeduction;

  const basicPayAed = Number(basicPay) || 0;
  const hraAed = Number(hra) || 0;
  const conveyanceAllowanceAed = Number(conveyanceAllowance) || 0;
  const otherAllowanceAed = Number(otherAllowance) || 0;
  const advanceAed = Number(advance) || 0;
  const leaveAed = Number(leave) || 0;
  const staffLoanAed = Number(staffLoan) || 0;
  const profTaxAed = Number(profTax) || 0;
  const incomeTaxTDSAed = Number(incomeTaxTDS) || 0;

  try {
    const letterheadImg = await loadImage("/letterhead_header.png");
    const imgProps = doc.getImageProperties(letterheadImg);
    let imgWidth = pageWidth - 20;
    let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    doc.addImage(letterheadImg, "PNG", 10, 8, imgWidth, imgHeight);
  } catch (error) {
    console.error("Strict Mode Error: Failed to load letterhead header image.");
  }

  doc.setDrawColor(76, 175, 80);
  doc.setLineWidth(0.8);
  doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

  try {
    const logoImg = await loadImage("/sonashi_logo_updated.png");
    const logoProps = doc.getImageProperties(logoImg);
    const desiredLogoWidth = 45;
    const desiredLogoHeight = (logoProps.height * desiredLogoWidth) / logoProps.width;
    doc.addImage(
      logoImg,
      "PNG",
      pageWidth - desiredLogoWidth - 15,
      pageHeight - desiredLogoHeight - 15,
      desiredLogoWidth,
      desiredLogoHeight
    );
  } catch (error) {
    console.error("Strict Mode Error: Failed to load SONASHI logo image.");
  }

  let currentY = 75;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("SALARY SLIP", pageWidth / 2, currentY, { align: "center" });

  currentY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(`For the Month of: ${slip.month} ${slip.year}`, pageWidth / 2, currentY, {
    align: "center",
  });

  currentY += 12;
  const employeeDetails = slipEmployeeDetails || payslipEmployeeFallback(slip);

  const infoRowHeight = 5.4;
  const infoBoxHeight = PAYSLIP_EMPLOYEE_ROWS.length * infoRowHeight + 3;
  const photoStripWidth = 24;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, pageWidth - margin * 2, infoBoxHeight, "FD");

  const infoBoxTop = currentY;
  const fieldsWidth = pageWidth - margin * 2 - photoStripWidth;
  const columnWidth = fieldsWidth / 2;
  const labelOffset = 32;

  const drawFittedValue = (value, x, maxWidth, baseline) => {
    doc.setFont("helvetica", "normal");
    let size = 8;
    doc.setFontSize(size);
    while (size > 6 && doc.getTextWidth(value) > maxWidth) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    doc.text(value, x, baseline);
    doc.setFontSize(8);
  };

  doc.setTextColor(15, 23, 42);
  PAYSLIP_EMPLOYEE_ROWS.forEach((row, rowIndex) => {
    const baseline = infoBoxTop + 5 + rowIndex * infoRowHeight;
    row.forEach(([label, key], columnIndex) => {
      const columnStart = margin + 4 + columnIndex * columnWidth;
      const valueX = columnStart + labelOffset;
      const columnEnd =
        columnIndex === 0 ? margin + 4 + columnWidth : margin + 4 + fieldsWidth;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(`${label}:`, columnStart, baseline);

      const value = String(employeeDetails[key] ?? "").trim() || "N/A";
      drawFittedValue(value, valueX, columnEnd - valueX, baseline);
    });
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);

  const photoSize = 14;
  const photoX = pageWidth - margin - photoSize - 5;
  const photoY = currentY + 2;
  if (slip.emailId) {
    try {
      let apiBase = config.API_BASE_URL || "";
      if (!apiBase.endsWith("/api")) {
        apiBase = apiBase.endsWith("/") ? `${apiBase}api` : `${apiBase}/api`;
      }
      const imageUrl = `${apiBase}/employees/profile-photo-image?email=${encodeURIComponent(slip.emailId)}`;
      const token = employeeService.getAuthToken();
      const resp = await fetch(imageUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "image/*",
        },
      });
      if (resp.ok && resp.status === 200) {
        const blob = await resp.blob();
        if (blob && blob.size > 0) {
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(blob);
          });
          const imgFormat = (blob.type || "").includes("png")
            ? "PNG"
            : (blob.type || "").includes("gif")
              ? "GIF"
              : "JPEG";
          doc.addImage(dataUrl, imgFormat, photoX, photoY, photoSize, photoSize);
        }
      }
    } catch (err) {
      console.error("Profile photo not loaded for payslip:", err);
    }
  }

  currentY = infoBoxTop + infoBoxHeight + 6;
  const halfWidth = (pageWidth - margin * 2) / 2;

  doc.setFillColor(226, 232, 240);
  doc.rect(margin, currentY, halfWidth, 10, "FD");
  doc.rect(margin + halfWidth, currentY, halfWidth, 10, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Earnings", margin + 5, currentY + 7);
  doc.text("Deductions", margin + halfWidth + 5, currentY + 7);

  currentY += 10;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, halfWidth / 2 + 10, 8, "FD");
  doc.rect(margin + halfWidth / 2 + 10, currentY, halfWidth / 2 - 10, 8, "FD");
  doc.rect(margin + halfWidth, currentY, halfWidth / 2 + 10, 8, "FD");
  doc.rect(margin + halfWidth + halfWidth / 2 + 10, currentY, halfWidth / 2 - 10, 8, "FD");

  doc.setFontSize(9);
  doc.text("Description", margin + 5, currentY + 5.5);
  doc.text("Amount (AED)", margin + halfWidth - 5, currentY + 5.5, { align: "right" });
  doc.text("Description", margin + halfWidth + 5, currentY + 5.5);
  doc.text("Amount (AED)", margin + halfWidth * 2 - 5, currentY + 5.5, {
    align: "right",
  });

  const earningsData = [
    ["Basic Pay", basicPayAed.toFixed(2)],
    ["HRA", hraAed.toFixed(2)],
    ["Conveyance Allowance", conveyanceAllowanceAed.toFixed(2)],
    ["Other Allowance", otherAllowanceAed.toFixed(2)],
  ];

  const deductionsData = [
    ["Advance", advanceAed.toFixed(2)],
    ["Leave", leaveAed.toFixed(2)],
    ["Staff Loan", staffLoanAed.toFixed(2)],
    ["Prof. Tax", profTaxAed.toFixed(2)],
    ["Income Tax / TDS", incomeTaxTDSAed.toFixed(2)],
  ];

  const maxRows = Math.max(earningsData.length, deductionsData.length);
  const rowHeight = 8;
  currentY += 8;

  doc.setFont("helvetica", "normal");
  for (let i = 0; i < maxRows; i++) {
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, currentY, halfWidth / 2 + 10, rowHeight);
    doc.rect(margin + halfWidth / 2 + 10, currentY, halfWidth / 2 - 10, rowHeight);
    doc.rect(margin + halfWidth, currentY, halfWidth / 2 + 10, rowHeight);
    doc.rect(
      margin + halfWidth + halfWidth / 2 + 10,
      currentY,
      halfWidth / 2 - 10,
      rowHeight
    );

    if (earningsData[i]) {
      doc.text(earningsData[i][0], margin + 2, currentY + 5.5);
      doc.text(earningsData[i][1], margin + halfWidth - 3, currentY + 5.5, {
        align: "right",
      });
    }

    if (deductionsData[i]) {
      doc.text(deductionsData[i][0], margin + halfWidth + 2, currentY + 5.5);
      doc.text(deductionsData[i][1], margin + halfWidth * 2 - 3, currentY + 5.5, {
        align: "right",
      });
    }

    currentY += rowHeight;
  }

  doc.setLineWidth(0.5);
  doc.setFillColor(241, 245, 249);

  doc.rect(margin, currentY, halfWidth / 2 + 10, 10, "FD");
  doc.rect(margin + halfWidth / 2 + 10, currentY, halfWidth / 2 - 10, 10, "FD");
  doc.rect(margin + halfWidth, currentY, halfWidth / 2 + 10, 10, "FD");
  doc.rect(
    margin + halfWidth + halfWidth / 2 + 10,
    currentY,
    halfWidth / 2 - 10,
    10,
    "FD"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Gross Salary", margin + 5, currentY + 7);
  doc.text(Number(grossSalary).toFixed(2), margin + halfWidth - 3, currentY + 7, {
    align: "right",
  });

  doc.text("Total Deductions", margin + halfWidth + 5, currentY + 7);
  doc.text(Number(totalDeduction).toFixed(2), margin + halfWidth * 2 - 3, currentY + 7, {
    align: "right",
  });

  currentY += 14;
  doc.setFillColor(226, 232, 240);
  doc.setDrawColor(148, 163, 184);
  doc.rect(margin, currentY, pageWidth - margin * 2, 12, "FD");

  doc.setFontSize(12);
  doc.text("Net Payable:", margin + halfWidth + 5, currentY + 8);
  doc.text(`AED ${Number(netSalary).toFixed(2)}`, pageWidth - margin - 5, currentY + 8, {
    align: "right",
  });

  currentY += 30;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);

  doc.line(margin + 5, currentY, margin + 65, currentY);
  doc.text("Employee Signature", margin + 35, currentY + 6, { align: "center" });

  doc.line(pageWidth - margin - 65, currentY, pageWidth - margin - 5, currentY);
  doc.text("Employer / Authorized Signature", pageWidth - margin - 35, currentY + 6, {
    align: "center",
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text("System Generated Payslip", pageWidth / 2, pageHeight - 30, {
    align: "center",
  });

  const fileName = `Payslip_${String(slip.employeeName || "Unknown").replace(/[^a-zA-Z0-9]/g, "_")}_${slip.month}_${slip.year}.pdf`;
  return { doc, fileName };
}

/** Fetch employee details then build PDF (same path as individual download). */
export async function buildPayslipPdfForSlip(slip) {
  let slipEmployeeDetails = null;
  try {
    slipEmployeeDetails = await salarySlipService.getPayslipEmployeeDetails(slip._id);
  } catch (detailsError) {
    console.error("Payslip employee details not loaded:", detailsError);
  }
  return buildPayslipPdfDoc(slip, slipEmployeeDetails);
}

export async function downloadPayslipPdf(slip) {
  const { doc, fileName } = await buildPayslipPdfForSlip(slip);
  doc.save(fileName);
  return fileName;
}

/** PDF as Blob for ZIP packaging (same template as individual download). */
export async function buildPayslipPdfBlob(slip) {
  const { doc, fileName } = await buildPayslipPdfForSlip(slip);
  const blob = doc.output("blob");
  return { blob, fileName };
}
