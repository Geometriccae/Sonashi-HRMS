/**
 * Bulk ZIP of salary-slip PDFs using the existing payslip template.
 */
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { buildPayslipPdfBlob } from "./payslipPdf";
import { periodZipLabel, safePayslipFileName } from "./salarySlipPeriodFilter";

/**
 * @param {object[]} slips - filtered salary slip records
 * @param {{ period?: string, customFrom?: string, customTo?: string, onProgress?: (done: number, total: number) => void }} options
 */
export async function downloadSalarySlipsZip(slips, options = {}) {
  const list = Array.isArray(slips) ? slips : [];
  if (list.length === 0) {
    throw new Error("No salary slips found for the selected period.");
  }

  const { period = "this_month", customFrom, customTo, onProgress } = options;
  const zip = new JSZip();
  const usedNames = new Set();
  const total = list.length;

  for (let i = 0; i < list.length; i += 1) {
    const slip = list[i];
    const { blob } = await buildPayslipPdfBlob(slip);
    const fileName = safePayslipFileName(slip, usedNames);
    zip.file(fileName, blob);
    if (typeof onProgress === "function") onProgress(i + 1, total);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const label = periodZipLabel(period, customFrom, customTo);
  const zipName = `Salary_Slips_${label}.zip`;
  saveAs(zipBlob, zipName);
  return { count: total, zipName };
}
