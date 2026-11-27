/**
 * Offline sample generator for Salary Advance PDF layout review.
 * Writes PDFs under scripts/pdf-samples/ (not used by the app at runtime).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const publicDir = path.join(frontendRoot, "public");
const outDir = path.join(__dirname, "pdf-samples");

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

const pdfMod = await import(pathToFileURL(path.join(frontendRoot, "src/utils/salaryAdvancePdf.js")).href);
const { buildIndividualAdvancePdf, buildBatchAdvancePdf } = pdfMod;

const writePdf = ({ doc, fileName }) => {
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
  console.log("Wrote", outPath, `(${fs.statSync(outPath).size} bytes)`);
};

const longName = "Muhammad Abdullah Bin Abdul Rahman Al-Hashimi";

const sampleEmployees = Array.from({ length: 55 }, (_, i) => ({
  _id: `emp${i + 1}`,
  employeeId: `IDJV-${1000 + i}`,
  employeeName: i === 0 ? longName : `Employee Name ${i + 1}`,
  department: i % 2 === 0 ? "WAREHOUSE" : "OFFICE STAFF",
  designation: i % 3 === 0 ? "Driver" : "Staff",
  workPermitNo: `WP-${2000 + i}`,
  company: "JOINT VEN TRADING CO LLC",
}));

const makeItem = (emp, idx, status = "active") => ({
  _id: `adv${idx}`,
  type: "advance",
  employee: emp._id,
  employeeId: emp.employeeId,
  employeeName: emp.employeeName,
  department: emp.department,
  designation: emp.designation,
  originalAmount: idx === 4 ? 125000.5 : 500 + idx * 125.25,
  amount: idx === 4 ? 125000.5 : 500 + idx * 125.25,
  advanceDate: "2026-11-20",
  status,
  recoveredAmount: status === "fully_recovered" ? 500 + idx * 125.25 : 0,
  outstandingBalance: status === "fully_recovered" ? 0 : 500 + idx * 125.25,
  remarks: idx % 7 === 0 ? "Urgent family advance approved by HR" : "",
  period: "November 2026",
  batchId: "ADV-BATCH-SAMPLE",
});

fs.mkdirSync(outDir, { recursive: true });

writePdf(await buildIndividualAdvancePdf(makeItem(sampleEmployees[0], 0, "active"), sampleEmployees[0]));

const five = sampleEmployees.slice(0, 5).map((e, i) => makeItem(e, i, i === 2 ? "sif_generated" : "active"));
writePdf(
  await buildBatchAdvancePdf(
    {
      batchId: "ADV-BATCH-5",
      type: "advance",
      paymentDate: "2026-11-20",
      period: "November 2026",
      totalAmount: five.reduce((s, r) => s + r.originalAmount, 0),
      items: five,
    },
    sampleEmployees.slice(0, 5)
  )
);

const many = sampleEmployees.map((e, i) =>
  makeItem(e, i, i % 11 === 0 ? "processed" : i % 9 === 0 ? "fully_recovered" : "active")
);
writePdf(
  await buildBatchAdvancePdf(
    {
      batchId: "ADV-BATCH-55",
      type: "advance",
      paymentDate: "2026-11-20",
      period: "November 2026",
      totalAmount: many.reduce((s, r) => s + r.originalAmount, 0),
      items: many,
    },
    sampleEmployees
  )
);

writePdf(
  await buildIndividualAdvancePdf(
    {
      type: "advance",
      employeeId: "IDJV-9999",
      employeeName: "Minimal Employee",
      originalAmount: 1000,
      advanceDate: "2026-11-15",
      status: "active",
    },
    null
  )
);

console.log("Done. Samples in", outDir);
