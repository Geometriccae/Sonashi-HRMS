/**
 * Offline sample generator for Salary Report PDF layout review.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const publicDir = path.join(frontendRoot, "public");
const outDir = path.join(__dirname, "pdf-samples", "salary-report");

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
  resources: "usable",
  pretendToBeVisual: true,
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLImageElement = dom.window.HTMLImageElement;
global.btoa = (s) => Buffer.from(s, "binary").toString("base64");
global.atob = (s) => Buffer.from(s, "base64").toString("binary");

global.Image = class NodeImage {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.onload = null;
    this.onerror = null;
    this._src = "";
  }
  set src(value) {
    this._src = value;
    const rel = String(value || "").replace(/^\//, "").split("?")[0];
    const filePath = path.join(publicDir, rel);
    if (!fs.existsSync(filePath)) {
      queueMicrotask(() => this.onerror && this.onerror(new Error(`missing ${filePath}`)));
      return;
    }
    const buf = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    if (mime === "image/png" && buf.length > 24) {
      this.width = buf.readUInt32BE(16);
      this.height = buf.readUInt32BE(20);
    } else {
      this.width = 1000;
      this.height = 200;
    }
    this._dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    this._src = this._dataUrl;
    queueMicrotask(() => this.onload && this.onload());
  }
  get src() {
    return this._src;
  }
};

const pdfMod = await import(
  pathToFileURL(path.join(frontendRoot, "src/utils/corporateReportPdf.js")).href
);
const { buildCorporateTablePdf, buildSalaryReportPdfRows } = pdfMod;

const longName = "RAHUL ARIMBOOTH RAMANAN ARIMBOOTH";
const sampleRows = Array.from({ length: 55 }, (_, i) => ({
  "Employee ID": `IDMM-${200 + i}`,
  Name: i === 0 ? longName : `Employee Name ${i + 1}`,
  Status: i % 7 === 0 ? "Provision Period" : "Active",
  Department: i % 2 === 0 ? "PROMOTERS" : "WAREHOUSE",
  Role: i % 3 === 0 ? "PROMOTER" : "LABOUR",
  Company: "JOINT VEN TRADING CO LLC",
  "Company Code": "0000000172509",
  "Basic Salary": 500 + (i % 5) * 100,
  "House Rent Allowance": 700 + (i % 4) * 50,
  "Travel Allowance": 400 + (i % 3) * 100,
  "Other Allowance": i % 2 === 0 ? 300 : 0,
  "Total Allowance": 1400 + (i % 6) * 100,
  Deduction: i % 11 === 0 ? 300 : 0,
  "Total / Net Salary": 2200 + (i % 8) * 100,
  "Bank Name": "RAK BANK",
  "Account Number": `0000000094501356${String(i).padStart(4, "0")}`,
  IBAN: `AE91097300213067005367${String(i).padStart(2, "0")}`,
  "Sort Code": "740810000",
}));

const built = buildSalaryReportPdfRows(sampleRows);
const { doc, fileName } = await buildCorporateTablePdf({
  title: "SALARY REPORT",
  fileName: "Salary_Report_SAMPLE.pdf",
  metaLines: [
    `Generated on: ${new Date().toLocaleDateString("en-GB")}  |  Total Records: ${sampleRows.length}`,
    "Period: November 2026  |  Employees: All Employees",
  ],
  headers: built.headers,
  rows: built.rows,
  columnStyles: built.columnStyles,
  moneyColIndexes: built.moneyColIndexes,
  orientation: "landscape",
  summaryItems: built.summaryItems,
});

fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, fileName);
fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log("Wrote", outPath, `(${fs.statSync(outPath).size} bytes, pages=${doc.getNumberOfPages()})`);
