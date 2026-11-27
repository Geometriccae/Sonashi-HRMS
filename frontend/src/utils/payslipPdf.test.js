if (typeof TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

import {
  formatAedInWords,
  numberToWords,
  payslipEmployeeFallback,
  buildPayslipPdfDoc,
} from "./payslipPdf";

describe("Payslip PDF Single-Page Template & Formatters", () => {
  describe("numberToWords & formatAedInWords", () => {
    test("converts round numbers properly", () => {
      expect(numberToWords(3000)).toBe("Three Thousand");
      expect(formatAedInWords(3000)).toBe("(AED Three Thousand & 00/100 Only)");
    });

    test("converts compound numbers with fils properly", () => {
      expect(numberToWords(4250)).toBe("Four Thousand Two Hundred Fifty");
      expect(formatAedInWords(4250.50)).toBe(
        "(AED Four Thousand Two Hundred Fifty & 50/100 Only)"
      );
    });

    test("handles zero gracefully", () => {
      expect(numberToWords(0)).toBe("Zero");
      expect(formatAedInWords(0)).toBe("(AED Zero & 00/100 Only)");
    });

    test("converts millions and irregular numbers properly", () => {
      expect(numberToWords(1015)).toBe("One Thousand Fifteen");
      expect(formatAedInWords(1015.75)).toBe("(AED One Thousand Fifteen & 75/100 Only)");
    });
  });

  describe("payslipEmployeeFallback", () => {
    test("populates employee details from slip fields without throwing", () => {
      const slip = {
        employeeId: "IDMO-178",
        employeeName: "MELVIN ABRAHAM THOMAS",
        payableDays: 30,
        presentDays: 28,
        department: "OFFICE STAFF",
        designation: "LOGISTICS EXECUTIVE",
        dateOfJoining: "2024-05-20",
        emailId: "melvin@sonashi.ae",
        emiratesId: "784-1995-9727483-8",
      };

      const fallback = payslipEmployeeFallback(slip);
      expect(fallback.empId).toBe("IDMO-178");
      expect(fallback.employeeName).toBe("MELVIN ABRAHAM THOMAS");
      expect(fallback.payableDays).toBe("30");
      expect(fallback.presentDays).toBe("28");
      expect(fallback.emailId).toBe("melvin@sonashi.ae");
      expect(fallback.modeOfPay).toBe("Bank Transfer");
    });
  });

  describe("buildPayslipPdfDoc single-page guarantee", () => {
    test("generates strictly 1 page PDF without spilling to page 2", async () => {
      const slip = {
        _id: "slip123",
        employeeId: "IDMO-178",
        employeeName: "MELVIN ABRAHAM THOMAS",
        month: "October",
        year: 2026,
        basicPay: 2000,
        hra: 500,
        conveyanceAllowance: 300,
        otherAllowance: 200,
        advance: 100,
        leave: 50,
        staffLoan: 0,
        salaryAdvanceDeduction: 150,
        grossSalary: 3000,
        payableDays: 30,
        presentDays: 30,
        dateOfJoining: "2024-05-20",
        department: "OFFICE STAFF",
        designation: "LOGISTICS EXECUTIVE",
        emailId: "melvin@sonashi.ae",
      };

      const employeeDetails = {
        empId: "IDMO-178",
        employeeName: "MELVIN ABRAHAM THOMAS",
        payableDays: "30",
        presentDays: "30",
        department: "OFFICE STAFF",
        designation: "LOGISTICS EXECUTIVE",
        bankAccNo: "00123456789",
        ibanNumber: "AE250330000000001234567",
        modeOfPay: "Bank Transfer",
        doj: "2024-05-20",
        emailId: "melvin@sonashi.ae",
        emiratesId: "784-1995-9727483-8",
      };

      const { doc, fileName } = await buildPayslipPdfDoc(slip, employeeDetails);
      expect(doc).toBeDefined();
      expect(doc.internal.getNumberOfPages()).toBe(1);
      expect(fileName).toBe("Payslip_MELVIN_ABRAHAM_THOMAS_October_2026.pdf");
    });
  });
});
