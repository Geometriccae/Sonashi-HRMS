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
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });

/**
 * Embed an image at high fidelity for PDF (avoids jsPDF re-compressing a low-res asset).
 * Upscales via canvas when the source is below ~150 DPI for the target print size.
 */
async function addHighQualityImage(doc, src, x, y, destW, destH, formatHint = "JPEG") {
  const img = await loadImage(src);
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;
  // Target ~200 DPI at the printed size (mm → inches → pixels).
  const needW = Math.ceil((destW / 25.4) * 200);
  const needH = Math.ceil((destH / 25.4) * 200);
  const scale = Math.max(1, Math.min(3, Math.max(needW / natW, needH / natH)));

  let dataUrl;
  let format = formatHint;
  if (scale > 1.05 && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(natW * scale);
    canvas.height = Math.round(natH * scale);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    format = "JPEG";
  } else {
    // Prefer original bytes when already large enough
    const canvas = document.createElement("canvas");
    canvas.width = natW;
    canvas.height = natH;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    format = "JPEG";
  }

  doc.addImage(dataUrl, format, x, y, destW, destH, undefined, "NONE");
}

/**
 * Build a payslip PDF document from a stored salary slip (+ optional employee details).
 * Uses the Joint Ven full letterhead template (header + watermark + footer logo).
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
  const salaryAdvanceDeductionRaw = slip.salaryAdvanceDeduction || 0;

  const basicPayAed = Number(basicPay) || 0;
  const hraAed = Number(hra) || 0;
  const conveyanceAllowanceAed = Number(conveyanceAllowance) || 0;
  const otherAllowanceAed = Number(otherAllowance) || 0;
  let advanceAed = Number(advance) || 0;
  const leaveAed = Number(leave) || 0;
  const staffLoanAed = Number(staffLoan) || 0;
  const salaryAdvanceDeductionAed = Number(salaryAdvanceDeductionRaw) || 0;

  const hasBreakdown = advanceAed + leaveAed + staffLoanAed + salaryAdvanceDeductionAed > 0;
  const legacyDeduction = Number(slip.deductionsPFTax || slip.totalDeduction || 0);
  if (!hasBreakdown && legacyDeduction > 0) {
    advanceAed = legacyDeduction;
  }

  const grossSalary =
    slip.grossSalary || (basicPayAed + hraAed + conveyanceAllowanceAed + otherAllowanceAed);

  // Exclude Income Tax and Professional Tax from deductions per statutory requirement
  const totalDeduction = advanceAed + leaveAed + staffLoanAed + salaryAdvanceDeductionAed;
  const netSalary = Math.max(0, grossSalary - totalDeduction);

  // ─── Header: HD-Quality Company Letterhead (Arabic + Logo + English) ─────────
  let headerBottom = 12;
  const headerWidth = pageWidth - margin * 2;
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
  } catch (error) {
    console.warn("Letterhead image failed to load, falling back to text banner:", error);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("SONASHI GENERAL TRADING LLC", pageWidth / 2, 18, { align: "center" });
    headerBottom = 22;
  }

  // Clean black divider line under letterhead
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(margin, headerBottom + 3, pageWidth - margin, headerBottom + 3);

  // ─── Title: Clean Black & White ──────────────────────────────────────────────
  let currentY = headerBottom + 11;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text("SALARY SLIP", pageWidth / 2, currentY, { align: "center" });

  currentY += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`For the Month of: ${slip.month} ${slip.year}`, pageWidth / 2, currentY, {
    align: "center",
  });

  currentY += 8;
  const employeeDetails = slipEmployeeDetails || payslipEmployeeFallback(slip);

  const infoRowHeight = 5.2;
  const infoBoxHeight = PAYSLIP_EMPLOYEE_ROWS.length * infoRowHeight + 3;
  const photoStripWidth = 24;

  // Clean Black & White employee info box
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, currentY, pageWidth - margin * 2, infoBoxHeight, "D");

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

  doc.setTextColor(0, 0, 0);
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

  // ─── Earnings & Deductions Table: Clean Black & White ────────────────────────
  currentY = infoBoxTop + infoBoxHeight + 6;
  const halfWidth = (pageWidth - margin * 2) / 2;

  // Header band
  doc.setFillColor(240, 240, 240);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, halfWidth, 9, "FD");
  doc.rect(margin + halfWidth, currentY, halfWidth, 9, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Earnings", margin + 5, currentY + 6.2);
  doc.text("Deductions", margin + halfWidth + 5, currentY + 6.2);

  currentY += 9;
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, currentY, halfWidth / 2 + 10, 7.5, "FD");
  doc.rect(margin + halfWidth / 2 + 10, currentY, halfWidth / 2 - 10, 7.5, "FD");
  doc.rect(margin + halfWidth, currentY, halfWidth / 2 + 10, 7.5, "FD");
  doc.rect(margin + halfWidth + halfWidth / 2 + 10, currentY, halfWidth / 2 - 10, 7.5, "FD");

    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text("Description", margin + 5, currentY + 5.2);
    doc.text("Amount (AED)", margin + halfWidth - 5, currentY + 5.2, { align: "right" });
    doc.text("Description", margin + halfWidth + 5, currentY + 5.2);
    doc.text("Amount (AED)", margin + halfWidth * 2 - 5, currentY + 5.2, {
      align: "right",
    });

    const earningsData = [
      ["Basic Pay", basicPayAed.toFixed(2)],
      ["HRA", hraAed.toFixed(2)],
      ["Conveyance Allowance", conveyanceAllowanceAed.toFixed(2)],
      ["Other Allowance", otherAllowanceAed.toFixed(2)],
    ];

    // Income Tax and Professional Tax REMOVED from deductions
    const deductionsData = [
      ["Advance", advanceAed.toFixed(2)],
      ["Leave", leaveAed.toFixed(2)],
      ["Staff Loan", staffLoanAed.toFixed(2)],
      ...(salaryAdvanceDeductionAed > 0 ? [["Salary Advance", salaryAdvanceDeductionAed.toFixed(2)]] : []),
    ];

    const maxRows = Math.max(earningsData.length, deductionsData.length);
    const rowHeight = 7.5;
    currentY += 7.5;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    for(let i = 0; i<maxRows; i++) {
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.25);
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
        doc.text(earningsData[i][0], margin + 4, currentY + 5.2);
        doc.text(earningsData[i][1], margin + halfWidth - 4, currentY + 5.2, {
          align: "right",
        });
      }

    if (deductionsData[i]) {
          doc.text(deductionsData[i][0], margin + halfWidth + 4, currentY + 5.2);
          doc.text(deductionsData[i][1], margin + halfWidth * 2 - 4, currentY + 5.2, {
            align: "right",
          });
        }

    currentY += rowHeight;
      }

      // Gross Salary & Total Deductions Summary Row
      doc.setLineWidth(0.4);
      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(245, 245, 245);

      doc.rect(margin, currentY, halfWidth / 2 + 10, 9, "FD");
      doc.rect(margin + halfWidth / 2 + 10, currentY, halfWidth / 2 - 10, 9, "FD");
      doc.rect(margin + halfWidth, currentY, halfWidth / 2 + 10, 9, "FD");
      doc.rect(
        margin + halfWidth + halfWidth / 2 + 10,
        currentY,
        halfWidth / 2 - 10,
        9,
        "FD"
      );

      doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(0, 0, 0);
        doc.text("Gross Salary", margin + 4, currentY + 6.2);
        doc.text(Number(grossSalary).toFixed(2), margin + halfWidth - 4, currentY + 6.2, {
          align: "right",
        });

          doc.text("Total Deductions", margin + halfWidth + 4, currentY + 6.2);
          doc.text(Number(totalDeduction).toFixed(2), margin + halfWidth * 2 - 4, currentY + 6.2, {
            align: "right",
          });

          // Net Payable Box
          currentY += 14;
          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.6);
          doc.rect(margin, currentY, pageWidth - margin * 2, 12, "FD");

          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text("Net Payable:", margin + halfWidth + 5, currentY + 8);
            doc.text(`AED ${Number(netSalary).toFixed(2)}`, pageWidth - margin - 6, currentY + 8, {
              align: "right",
            });

            // Footer: System generated note
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(90, 90, 90);
            doc.text(
              "This is a system generated payslip, Signature not required",
              pageWidth / 2,
              pageHeight - 20,
              { align: "center" }
            );

            const fileName = `Payslip_${String(slip.employeeName || "Unknown").replace(/[^a-zA-Z0-9]/g, "_")}_${slip.month}_${slip.year}.pdf`;
            return { doc, fileName };
          }

/** Fetch employee details then build PDF (same path as individual download). */
export async function buildPayslipPdfForSlip(slip) {
          let slipEmployeeDetails = null;
          try {
            slipEmployeeDetails = await salarySlipService.getPayslipEmployeeDetails(slip._id);
          } catch(detailsError) {
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
