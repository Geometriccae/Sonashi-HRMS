/**
 * Shared Salary Slip PDF builder — exact single-page template for every employee.
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
    ["Name", "employeeName"],
    ["Mode of Pay", "modeOfPay"],
  ],
  [
    ["Emp ID", "empId"],
    ["Bank Acc No", "bankAccNo"],
  ],
  [
    ["Date of Joining", "doj"],
    ["IBAN No", "ibanNumber"],
  ],
  [
    ["Designation", "designation"],
    ["Emirates ID", "emiratesId"],
  ],
  [
    ["Department", "department"],
    ["Payable Days", "payableDays"],
  ],
  [
    ["Email ID", "emailId"],
    ["Present Days", "presentDays"],
  ],
];

export const dayCountText = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.round(n * 100) / 100);
};

/** Used only if the employee record cannot be loaded; never borrows another employee's data. */
export const payslipEmployeeFallback = (slip) => ({
  empId: slip.employeeId || slip.empId || "",
  employeeName: slip.employeeName || "",
  payableDays: dayCountText(slip.payableDays),
  presentDays: dayCountText(slip.presentDays),
  department: slip.department || "",
  designation: slip.designation || "",
  bankAccNo: slip.bankAccNo || "",
  ibanNumber: slip.ibanNumber || "",
  personCode: slip.personCode || "",
  modeOfPay: slip.modeOfPay || "Bank Transfer",
  doj: slip.dateOfJoining || "",
  emailId: isPlaceholderEmployeeEmail(slip.emailId) ? "" : String(slip.emailId).trim(),
  emiratesId: slip.emiratesId || "",
  unifiedId: slip.unifiedId || "",
});

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    if (
      typeof Image === "undefined" ||
      (typeof window !== "undefined" &&
        window.navigator &&
        window.navigator.userAgent &&
        window.navigator.userAgent.includes("jsdom"))
    ) {
      return reject(new Error("Image DOM not available in this environment"));
    }
    const img = new Image();
    const timer = setTimeout(() => {
      reject(new Error(`Timeout loading ${src}`));
    }, 2500);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Failed to load ${src}`));
    };
    img.src = src;
  });

// In-memory cache for the company letterhead header image to accelerate bulk ZIP generation
let cachedHeaderImage = null;

const getHeaderImage = async () => {
  if (cachedHeaderImage) return cachedHeaderImage;
  try {
    cachedHeaderImage = await loadImage("/payslip_company_header.png");
    return cachedHeaderImage;
  } catch (e1) {
    try {
      cachedHeaderImage = await loadImage("/letterhead_header.png");
      return cachedHeaderImage;
    } catch (e2) {
      try {
        cachedHeaderImage = await loadImage("/sonashi_logo.png");
        return cachedHeaderImage;
      } catch (e3) {
        return null;
      }
    }
  }
};

/** Convert positive integer number into words */
export function numberToWords(amount) {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  function convertGroup(n) {
    let out = "";
    if (n >= 100) {
      out += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      out += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      out += ones[n] + " ";
    }
    return out.trim();
  }

  const num = Math.floor(Math.abs(Number(amount) || 0));
  if (num === 0) return "Zero";

  const billions = Math.floor(num / 1000000000);
  const millions = Math.floor((num % 1000000000) / 1000000);
  const thousands = Math.floor((num % 1000000) / 1000);
  const remainder = num % 1000;

  let result = "";
  if (billions) result += convertGroup(billions) + " Billion ";
  if (millions) result += convertGroup(millions) + " Million ";
  if (thousands) result += convertGroup(thousands) + " Thousand ";
  if (remainder) result += convertGroup(remainder);

  return result.trim();
}

/** Formats AED amount in words: (AED Three Thousand & 00/100 Only) */
export function formatAedInWords(amount) {
  const n = Number(amount) || 0;
  const whole = Math.floor(n);
  const fils = Math.round((n - whole) * 100);
  const filsStr = String(fils).padStart(2, "0");
  const words = numberToWords(whole);
  return `(AED ${words} & ${filsStr}/100 Only)`;
}

const drawFittedText = (doc, text, x, maxWidth, y, initialSize = 9.5, minSize = 7) => {
  doc.setFont("helvetica", "normal");
  let size = initialSize;
  doc.setFontSize(size);
  const str = String(text ?? "").trim() || "-";
  while (size > minSize && doc.getTextWidth(str) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  doc.text(str, x, y);
  doc.setFontSize(initialSize);
};

/**
 * Build a payslip PDF document from a stored salary slip (+ optional employee details).
 * Uses the exact single-page template matching Sonashi_Payslip_Template.pdf.
 * @returns {{ doc: import('jspdf').jsPDF, fileName: string }}
 */
export async function buildPayslipPdfDoc(slip, slipEmployeeDetails = null) {
  const { jsPDF } = await loadJsPdf();
  // Standard A4 portrait in points (595.28 x 841.89 pt)
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const boxX = 51.375;
  const boxY = 51.375;
  const boxW = 492.75;
  const boxH = 343.5;
  const rightX = boxX + boxW; // 544.125
  const midX = 297.0;

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

  // Exclude Income Tax and Professional Tax per client requirement
  const totalDeduction = advanceAed + leaveAed + staffLoanAed + salaryAdvanceDeductionAed;
  const netSalary = Math.max(0, grossSalary - totalDeduction);

  const employeeDetails = slipEmployeeDetails || payslipEmployeeFallback(slip);

  // ─── 1. Outer Border Box ───────────────────────────────────────────────────
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.75);
  doc.rect(boxX, boxY, boxW, boxH);

  // ─── 2. Header Section (y: 51.375 to 153.0) ────────────────────────────────
  const headerImg = await getHeaderImage();
  if (headerImg) {
    try {
      doc.addImage(
        headerImg,
        "PNG",
        boxX + 0.5,
        boxY + 0.5,
        boxW - 1,
        76.5,
        undefined,
        "FAST"
      );
    } catch (imgErr) {
      console.warn("Failed to render header image, using text header:", imgErr);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text("JOINT VEN TRADING CO. LLC.", midX, boxY + 20, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text("P.O. Box: 15683, Dubai, UAE.", midX, boxY + 34, { align: "center" });
      doc.text(
        "Tel-Off: +971 4 221 1461 | Tel-Main: +971 4 226 4228 | Fax: +971 4 229 6950",
        midX,
        boxY + 46,
        { align: "center" }
      );
      doc.text("Email: accounts@sonashi.ae | Web: www.sonashiuae.com", midX, boxY + 58, {
        align: "center",
      });
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("JOINT VEN TRADING CO. LLC.", midX, boxY + 20, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("P.O. Box: 15683, Dubai, UAE.", midX, boxY + 34, { align: "center" });
    doc.text(
      "Tel-Off: +971 4 221 1461 | Tel-Main: +971 4 226 4228 | Fax: +971 4 229 6950",
      midX,
      boxY + 46,
      { align: "center" }
    );
    doc.text("Email: accounts@sonashi.ae | Web: www.sonashiuae.com", midX, boxY + 58, {
      align: "center",
    });
  }

  // Title: "Payslip for the month of [Month Year]"
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const titleMonth = slip.month || "October";
  const titleYear = slip.year || new Date().getFullYear();
  doc.text(`Payslip for the month of ${titleMonth} ${titleYear}`, midX, 142.5, {
    align: "center",
  });

  // Divider 1: Horizontal line between Header and Employee Details
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.75);
  doc.line(boxX, 153.0, rightX, 153.0);

  // ─── 3. Employee Information Section (y: 153.0 to 246.0) ───────────────────
  // Vertical dividing line
  doc.line(midX, 153.0, midX, 246.0);

  const leftFields = [
    { label: "Name:", value: employeeDetails.employeeName || slip.employeeName || "" },
    { label: "Emp ID:", value: employeeDetails.empId || slip.employeeId || slip.empId || "" },
    { label: "Date of Joining:", value: employeeDetails.doj || slip.dateOfJoining || "" },
    { label: "Designation:", value: employeeDetails.designation || slip.designation || "" },
    { label: "Department:", value: employeeDetails.department || slip.department || "" },
    { label: "Email ID:", value: employeeDetails.emailId || slip.emailId || "" },
  ];

  const rightFields = [
    { label: "Mode of Pay:", value: employeeDetails.modeOfPay || slip.modeOfPay || "Bank Transfer" },
    { label: "Bank Acc No:", value: employeeDetails.bankAccNo || slip.bankAccNo || "" },
    { label: "IBAN No:", value: employeeDetails.ibanNumber || slip.ibanNumber || "" },
    { label: "Emirates ID:", value: employeeDetails.emiratesId || slip.emiratesId || "" },
    { label: "Payable Days:", value: dayCountText(employeeDetails.payableDays || slip.payableDays) || "0" },
    { label: "Present Days:", value: dayCountText(employeeDetails.presentDays || slip.presentDays) || "0" },
  ];

  const leftLabelX = 57.8;
  const leftValueX = 138.0;
  const leftMaxW = midX - leftValueX - 6;

  const rightLabelX = 303.6;
  const rightValueX = 378.0;
  const rightMaxW = rightX - rightValueX - 6;

  const employeeRowYs = [168.0, 182.0, 195.5, 209.5, 223.5, 237.0];

  employeeRowYs.forEach((y, i) => {
    // Left Column
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);
    doc.text(leftFields[i].label, leftLabelX, y);
    drawFittedText(doc, leftFields[i].value, leftValueX, leftMaxW, y);

    // Right Column
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(rightFields[i].label, rightLabelX, y);
    drawFittedText(doc, rightFields[i].value, rightValueX, rightMaxW, y);
  });

  // Divider 2: Horizontal line between Employee Details and Table Header
  doc.line(boxX, 246.0, rightX, 246.0);

  // ─── 4. Earnings & Deductions Table Header (y: 246.0 to 265.5) ─────────────
  doc.line(midX, 246.0, midX, 265.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);

  doc.text("Earnings", 57.8, 258.0);
  doc.text("Amount (AED)", midX - 7, 258.0, { align: "right" });

  doc.text("Deductions", 303.6, 258.0);
  doc.text("Amount (AED)", rightX - 7, 258.0, { align: "right" });

  // Divider 3: Horizontal line between Table Header and Table Body
  doc.line(boxX, 265.5, rightX, 265.5);

  // ─── 5. Earnings & Deductions Table Body (y: 265.5 to 333.75) ──────────────
  doc.line(midX, 265.5, midX, 333.75);

  const earnings = [
    { label: "Basic Pay", val: basicPayAed.toFixed(2) },
    { label: "HRA", val: hraAed.toFixed(2) },
    { label: "Conveyance Allowance", val: conveyanceAllowanceAed.toFixed(2) },
    { label: "Other Allowance", val: otherAllowanceAed.toFixed(2) },
  ];

  const deductions = [
    { label: "Advance", val: advanceAed.toFixed(2) },
    { label: "Leave", val: leaveAed.toFixed(2) },
    { label: "Staff Loan", val: staffLoanAed.toFixed(2) },
    {
      label: salaryAdvanceDeductionAed > 0 ? "Salary Advance" : "",
      val: salaryAdvanceDeductionAed > 0 ? salaryAdvanceDeductionAed.toFixed(2) : "",
    },
  ];

  const bodyRowYs = [279.5, 293.5, 307.5, 321.5];
  bodyRowYs.forEach((y, i) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(0, 0, 0);

    // Earnings item
    if (earnings[i]) {
      doc.text(earnings[i].label, 57.8, y);
      doc.text(earnings[i].val, midX - 7, y, { align: "right" });
    }

    // Deductions item
    if (deductions[i] && deductions[i].label) {
      doc.text(deductions[i].label, 303.6, y);
      doc.text(deductions[i].val, rightX - 7, y, { align: "right" });
    }
  });

  // Divider 4: Horizontal line between Table Body and Totals
  doc.line(boxX, 333.75, rightX, 333.75);

  // ─── 6. Totals Row (y: 333.75 to 353.25) ───────────────────────────────────
  doc.line(midX, 333.75, midX, 353.25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);

  doc.text("Total Earnings: AED.", 57.8, 346.0);
  doc.text(Number(grossSalary).toFixed(2), midX - 7, 346.0, { align: "right" });

  doc.text("Total Deductions: AED.", 303.6, 346.0);
  doc.text(Number(totalDeduction).toFixed(2), rightX - 7, 346.0, { align: "right" });

  // Divider 5: Horizontal line between Totals and Net Pay
  doc.line(boxX, 353.25, rightX, 353.25);

  // ─── 7. Net Pay Section (y: 353.25 to 394.875) ─────────────────────────────
  // Net Pay amount line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(0, 0, 0);
  doc.text(
    "Net Pay for the month ( Total Earnings - Total Deductions):",
    57.8,
    368.0
  );
  doc.text(`AED. ${Number(netSalary).toFixed(2)}`, rightX - 7, 368.0, {
    align: "right",
  });

  // Net Pay in words line: (AED [Words] & [Fils]/100 Only)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(formatAedInWords(netSalary), 57.8, 384.5);

  const safeEmpName = String(slip.employeeName || "Unknown").replace(/[^a-zA-Z0-9]/g, "_");
  const fileName = `Payslip_${safeEmpName}_${titleMonth}_${titleYear}.pdf`;
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
