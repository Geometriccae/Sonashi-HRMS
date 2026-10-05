const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const authMiddleware = require("../middleware/authMiddleware");
const { blockViewerWrites } = require("../middleware/permissionsMiddleware");
const Employee = require("../models/Employee");
const CompanySifSettings = require("../models/CompanySifSettings");
const { workingStatusFilter } = require("../utils/employeeStatus");
const { loadSalaryReportRows } = require("../utils/sifSalaryReportRows");
const {
  MONTH_NAMES,
  generateSifContent,
  parseSifContent,
  digitsOnly,
  normalizeEmiratesId,
  getEmployeeEmployerId,
  excelHeaders,
  RED_HEADERS,
  employeeToExcelRow,
  normalizeExcelHeader,
  HEADER_ALIASES,
} = require("../utils/sifUtils");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const requireAdminOrHod = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "admin" || role === "hod") return next();
  return res.status(403).json({ message: "Admin or HOD access required" });
};

async function getOrCreateSettings() {
  let doc = await CompanySifSettings.findOne({ key: "default" });
  if (!doc) {
    doc = await CompanySifSettings.create({ key: "default" });
  }
  return doc;
}

function parseMonthYear(req) {
  const month = Number(req.query.month || req.body?.month);
  const year = Number(req.query.year || req.body?.year);
  if (!month || month < 1 || month > 12) {
    return { error: "Valid month (1–12) is required" };
  }
  if (!year || year < 2000 || year > 2100) {
    return { error: "Valid year is required" };
  }
  return { month, year };
}

async function loadActiveEmployees() {
  return Employee.find(workingStatusFilter()).lean();
}

/** Employer IDs (company codes) of working employees, for the SIF employer picker. */
async function listEmployers() {
  const employees = await Employee.find(workingStatusFilter()).select("companyCode").lean();
  const counts = new Map();
  employees.forEach((emp) => {
    const id = getEmployeeEmployerId(emp);
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([employerId, employeeCount]) => ({ employerId, employeeCount }))
    .sort((a, b) => b.employeeCount - a.employeeCount);
}

/** 14-digit MOHRE person code; Emirates IDs are 15 digits starting with 784. */
const labourCardLooksLike = (value) => value.length === 14 && !value.startsWith("784");

async function applyEdrUpdates(edrs, { updateSalary = true } = {}) {
  const results = { updated: 0, skipped: [], errors: [] };
  const seenKeys = new Set();

  const allWithId = await Employee.find({
    $or: [
      { emiratesId: { $exists: true, $nin: [null, ""] } },
      { employeeId: { $exists: true, $nin: [null, ""] } },
      { workPermitNo: { $exists: true, $nin: [null, ""] } },
    ],
  }).select("_id emiratesId employeeId employeeName workPermitNo salaryDetails");

  const byEmpid = new Map();
  const byStaff = new Map();
  const byLabourCard = new Map();
  allWithId.forEach((e) => {
    const eid = normalizeEmiratesId(e.emiratesId);
    if (eid) byEmpid.set(eid, e);
    if (e.employeeId) byStaff.set(String(e.employeeId).trim(), e);
    const card = digitsOnly(e.workPermitNo);
    if (card) byLabourCard.set(card, e);
  });

  for (let rowIndex = 0; rowIndex < edrs.length; rowIndex += 1) {
    const edr = edrs[rowIndex];
    const empId = normalizeEmiratesId(edr.empId);
    const staffId = String(edr.staffId || "").trim();
    const labourCard = digitsOnly(edr.labourCard);
    const rowLabel = `Row ${rowIndex + 1}`;

    if (!empId && !staffId && !labourCard) {
      results.skipped.push({
        empId: "",
        staffId: "",
        empName: "",
        reason: "Missing EMPID",
      });
      continue;
    }

    if (empId && (empId.length < 14 || empId.length > 15)) {
      results.skipped.push({
        empId,
        staffId,
        empName: "",
        reason: "Invalid Emirates ID (must be 14–15 digits)",
      });
      continue;
    }

    const agentRaw = edr.agentCode != null && String(edr.agentCode).trim() !== ""
      ? digitsOnly(edr.agentCode)
      : "";
    if (agentRaw && agentRaw.length !== 9) {
      results.skipped.push({
        empId,
        staffId,
        empName: "",
        reason: "Invalid AGENTCODE (must be 9 digits)",
      });
      continue;
    }

    if (
      updateSalary &&
      edr.fixedIncome != null &&
      String(edr.fixedIncome).trim() !== "" &&
      Number.isNaN(Number(edr.fixedIncome))
    ) {
      results.errors.push({
        empId,
        staffId,
        employeeId: staffId,
        empName: "",
        reason: `${rowLabel} — Invalid salary format`,
      });
      continue;
    }

    const dedupeKey = empId || (labourCard ? `card:${labourCard}` : `staff:${staffId}`);
    if (seenKeys.has(dedupeKey)) {
      results.skipped.push({
        empId,
        staffId,
        empName: "",
        reason: "Duplicate row in import file",
      });
      continue;
    }
    seenKeys.add(dedupeKey);

    // The EDR employee ID is the labour card (person code) in the client's SIF
    // files; older files carried the Emirates ID in the same position.
    let matchedByLabourCard = false;
    let empDoc = null;
    if (labourCard && byLabourCard.has(labourCard)) {
      empDoc = byLabourCard.get(labourCard);
    } else if (empId && byLabourCard.has(empId)) {
      empDoc = byLabourCard.get(empId);
      matchedByLabourCard = true;
    }
    if (!empDoc && empId) empDoc = byEmpid.get(empId) || null;
    if (!empDoc && staffId) {
      empDoc = byStaff.get(staffId) || null;
    }

    if (!empDoc) {
      results.skipped.push({
        empId,
        staffId,
        empName: "",
        reason: "Employee not found",
      });
      continue;
    }

    try {
      const emp = await Employee.findById(empDoc._id);
      if (!emp) {
        results.skipped.push({
          empId,
          staffId: empDoc.employeeId || staffId,
          empName: empDoc.employeeName || "",
          reason: "Employee not found",
        });
        continue;
      }

      // Only update fields that are present and valid in the import row
      const empIdIsEmiratesId = empId.length === 15 && empId.startsWith("784");
      if (empId && !matchedByLabourCard && (empIdIsEmiratesId || !labourCardLooksLike(empId))) {
        emp.emiratesId = empId;
      }
      const cardToSave = labourCard || (!empIdIsEmiratesId && labourCardLooksLike(empId) ? empId : "");
      if (cardToSave.length === 14 && !digitsOnly(emp.workPermitNo)) {
        emp.workPermitNo = cardToSave;
      }
      if (!emp.salaryDetails) emp.salaryDetails = {};
      if (agentRaw) emp.salaryDetails.bankSortCode = agentRaw;

      const bank = String(edr.bankAccount || "").trim().replace(/\s+/g, "");
      if (bank) {
        if (/^AE/i.test(bank)) {
          emp.salaryDetails.ibanNumber = bank.toUpperCase();
        } else {
          emp.salaryDetails.accountNumber = bank;
          if (!emp.salaryDetails.ibanNumber) {
            emp.salaryDetails.ibanNumber = bank;
          }
        }
      }

      if (updateSalary && edr.fixedIncome != null && !Number.isNaN(Number(edr.fixedIncome))) {
        emp.salaryDetails.totalSalary = Number(edr.fixedIncome);
      }

      if (edr.basic != null && !Number.isNaN(Number(edr.basic))) {
        emp.salaryDetails.basicSalary = Number(edr.basic) || 0;
      }
      if (edr.hra != null && !Number.isNaN(Number(edr.hra))) {
        emp.salaryDetails.houseRent = Number(edr.hra) || 0;
      }
      if (edr.transport != null && !Number.isNaN(Number(edr.transport))) {
        emp.salaryDetails.travelExp = Number(edr.transport) || 0;
      }
      if (edr.other != null && !Number.isNaN(Number(edr.other))) {
        emp.salaryDetails.other = Number(edr.other) || 0;
      }
      if (edr.deduction != null && !Number.isNaN(Number(edr.deduction))) {
        emp.salaryDetails.deduction = Number(edr.deduction) || 0;
      }

      emp.markModified("salaryDetails");
      await emp.save();
      results.updated += 1;

      if (empId && emp.emiratesId === empId) byEmpid.set(empId, emp);
      if (emp.employeeId) byStaff.set(String(emp.employeeId).trim(), emp);
      const savedCard = digitsOnly(emp.workPermitNo);
      if (savedCard) byLabourCard.set(savedCard, emp);
    } catch (err) {
      results.errors.push({
        empId,
        staffId: empDoc.employeeId || staffId,
        employeeId: empDoc.employeeId,
        empName: empDoc.employeeName || "",
        reason: err.message || "Update failed",
      });
    }
  }

  return results;
}

// ── Settings ───────────────────────────────────────────────────────────────

router.get("/settings", authMiddleware, async (req, res) => {
  try {
    const doc = await getOrCreateSettings();
    res.json({
      employerId: doc.employerId || "",
      defaultAgentRoutingCode: doc.defaultAgentRoutingCode || "",
      employers: await listEmployers(),
    });
  } catch (err) {
    console.error("SIF settings GET error:", err);
    res.status(500).json({ message: "Failed to load SIF settings" });
  }
});

router.put("/settings", authMiddleware, blockViewerWrites, requireAdminOrHod, async (req, res) => {
  try {
    const employerId = digitsOnly(req.body.employerId);
    const defaultAgentRoutingCode = digitsOnly(req.body.defaultAgentRoutingCode);

    if (employerId.length !== 13) {
      return res.status(400).json({ message: "EMPLOYERID must be exactly 13 digits" });
    }
    if (defaultAgentRoutingCode.length !== 9) {
      return res.status(400).json({ message: "Default agent routing must be exactly 9 digits" });
    }

    const doc = await getOrCreateSettings();
    doc.employerId = employerId;
    doc.defaultAgentRoutingCode = defaultAgentRoutingCode;
    await doc.save();

    res.json({
      employerId: doc.employerId || "",
      defaultAgentRoutingCode: doc.defaultAgentRoutingCode || "",
    });
  } catch (err) {
    console.error("SIF settings PUT error:", err);
    res.status(500).json({ message: "Failed to save SIF settings" });
  }
});

// ── Export SIF ─────────────────────────────────────────────────────────────

router.get("/export/sif", authMiddleware, async (req, res) => {
  try {
    const parsed = parseMonthYear(req);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const settings = await getOrCreateSettings();

    const rows = await loadSalaryReportRows({ month: parsed.month, year: parsed.year });
    const result = generateSifContent({
      rows,
      employerId: settings.employerId || "",
      defaultAgentRoutingCode: settings.defaultAgentRoutingCode || "",
      year: parsed.year,
      month: parsed.month,
    });

    if (result.error) {
      return res.status(400).json({
        message: result.error,
        skipped: result.skipped || [],
      });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    res.setHeader("X-SIF-Edr-Count", String(result.edrCount));
    res.setHeader("X-SIF-Skipped", String((result.skipped || []).length));
    res.setHeader("X-SIF-Total", String(result.totalSalary));
    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, X-SIF-Edr-Count, X-SIF-Skipped, X-SIF-Total, X-SIF-Skip-Summary"
    );
    // Expose skip summary via custom header (JSON) for UI — keep body as pure SIF
    if (result.skipped?.length) {
      res.setHeader(
        "X-SIF-Skip-Summary",
        Buffer.from(JSON.stringify(result.skipped.slice(0, 200))).toString("base64")
      );
    }
    res.send(result.content);
  } catch (err) {
    console.error("SIF export error:", err);
    res.status(500).json({ message: "Failed to export SIF file" });
  }
});

// Preview / dry-run export metadata (JSON)
router.get("/export/sif/preview", authMiddleware, async (req, res) => {
  try {
    const parsed = parseMonthYear(req);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const settings = await getOrCreateSettings();
    const rows = await loadSalaryReportRows({ month: parsed.month, year: parsed.year });
    const result = generateSifContent({
      rows,
      employerId: settings.employerId || "",
      defaultAgentRoutingCode: settings.defaultAgentRoutingCode || "",
      year: parsed.year,
      month: parsed.month,
    });

    res.json({
      employerId: settings.employerId || "",
      defaultAgentRoutingCode: settings.defaultAgentRoutingCode || "",
      edrCount: result.edrCount || 0,
      totalSalary: result.totalSalary || 0,
      skipped: result.skipped || [],
      skippedCount: (result.skipped || []).length,
      otherEmployerCount: result.otherEmployerCount || 0,
      edrRecords: result.edrRecords || [],
      fileName: result.fileName || null,
      error: result.error || null,
    });
  } catch (err) {
    console.error("SIF preview error:", err);
    res.status(500).json({ message: "Failed to preview SIF export" });
  }
});

// ── Salary Report rows (same rows the SIF is generated from) ─────────────────

router.get("/salary-report", authMiddleware, async (req, res) => {
  try {
    const parsed = parseMonthYear(req);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const rows = await loadSalaryReportRows({
      month: parsed.month,
      year: parsed.year,
      payrollEligibleOnly: false,
    });
    res.json({
      month: parsed.month,
      year: parsed.year,
      payrollMonth: `${MONTH_NAMES[parsed.month - 1]} ${parsed.year}`,
      rows,
    });
  } catch (err) {
    console.error("Salary report rows error:", err);
    res.status(500).json({ message: "Failed to load salary report payroll data" });
  }
});

// ── Import SIF ─────────────────────────────────────────────────────────────

router.post(
  "/import/sif",
  authMiddleware,
  blockViewerWrites,
  requireAdminOrHod,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "SIF file is required" });
      }

      const text = req.file.buffer.toString("utf8");
      const { edrs, scr } = parseSifContent(text);

      // If SCR has employer ID and settings empty, optionally save it
      if (scr?.employerId) {
        const settings = await getOrCreateSettings();
        if (!settings.employerId) {
          settings.employerId = scr.employerId;
          if (scr.agentRouting) settings.defaultAgentRoutingCode = scr.agentRouting;
          await settings.save();
        }
      }

      const results = await applyEdrUpdates(edrs, { updateSalary: true });

      res.json({
        message: `Updated ${results.updated} employee(s)`,
        ...results,
        scr: scr
          ? {
              employerId: scr.employerId,
              edrCount: scr.edrCount,
              totalSalary: scr.totalSalary,
              fileRef: scr.fileRef,
            }
          : null,
      });
    } catch (err) {
      console.error("SIF import error:", err);
      res.status(400).json({ message: err.message || "Failed to import SIF file" });
    }
  }
);

// ── Export Excel ───────────────────────────────────────────────────────────

router.get("/export/excel", authMiddleware, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const employees = await loadActiveEmployees();
    const rows = employees.map((e) => employeeToExcelRow(e, settings.employerId));

    const sheetData = [excelHeaders, ...rows.map((r) => excelHeaders.map((h) => r[h]))];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Column widths
    ws["!cols"] = excelHeaders.map((h) => ({
      wch: Math.max(12, h.length + 2),
    }));

    XLSX.utils.book_append_sheet(wb, ws, "SIF");

    // Note: community xlsx has limited styling; red headers applied on frontend
    // when using ExcelJS client export. Server file still uses correct column order.
    // Attach meta about which headers are "red" for client consumers.
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const month = req.query.month || "";
    const year = req.query.year || "";
    const fileName = `SIF_Employees_${year || "all"}_${month || "all"}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("X-SIF-Red-Headers", Array.from(RED_HEADERS).join(","));
    res.send(buf);
  } catch (err) {
    console.error("SIF Excel export error:", err);
    res.status(500).json({ message: "Failed to export Excel" });
  }
});

// JSON rows for frontend ExcelJS red-header export
router.get("/export/excel-data", authMiddleware, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const employees = await loadActiveEmployees();
    const rows = employees.map((e) => employeeToExcelRow(e, settings.employerId));
    res.json({
      headers: excelHeaders,
      redHeaders: Array.from(RED_HEADERS),
      rows,
      employerId: settings.employerId || "",
    });
  } catch (err) {
    console.error("SIF excel-data error:", err);
    res.status(500).json({ message: "Failed to load Excel data" });
  }
});

// ── Import Excel ───────────────────────────────────────────────────────────

router.post(
  "/import/excel",
  authMiddleware,
  blockViewerWrites,
  requireAdminOrHod,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Excel file is required" });
      }

      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ message: "Excel file has no sheets" });
      }
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!json.length) {
        return res.status(400).json({ message: "Excel file has no data rows" });
      }

      const settings = await getOrCreateSettings();
      let employerFromFile = "";

      const edrs = json.map((row) => {
        const mapped = {};
        Object.keys(row).forEach((key) => {
          const norm = normalizeExcelHeader(key);
          const canonical = HEADER_ALIASES[norm];
          if (canonical) mapped[canonical] = row[key];
        });

        if (mapped.EMPLOYERID) {
          employerFromFile = digitsOnly(mapped.EMPLOYERID);
        }

        return {
          staffId: String(mapped.StaffID || "").trim(),
          labourCard: digitsOnly(mapped.LABOURCARD),
          empId: normalizeEmiratesId(mapped.EMPID),
          agentCode: digitsOnly(mapped.AGENTCODE),
          bankAccount: String(mapped.BANKACCOUNT || "").trim(),
          fixedIncome:
            mapped.TOTA !== "" && mapped.TOTA != null
              ? Number(mapped.TOTA)
              : undefined,
          basic: mapped.BASIC !== "" && mapped.BASIC != null ? Number(mapped.BASIC) : undefined,
          hra: mapped.HRA !== "" && mapped.HRA != null ? Number(mapped.HRA) : undefined,
          transport:
            mapped.TRANSPOR !== "" && mapped.TRANSPOR != null
              ? Number(mapped.TRANSPOR)
              : undefined,
          other:
            mapped.OTHERALLOV !== "" && mapped.OTHERALLOV != null
              ? Number(mapped.OTHERALLOV)
              : undefined,
          deduction:
            mapped.DEDUCTIO !== "" && mapped.DEDUCTIO != null
              ? Number(mapped.DEDUCTIO)
              : undefined,
        };
      });

      // Company EMPLOYERID only — do not overwrite SCR agent routing from employee AGENTCODE rows
      if (employerFromFile && employerFromFile.length === 13 && !settings.employerId) {
        settings.employerId = employerFromFile;
        await settings.save();
      }

      const results = await applyEdrUpdates(edrs, { updateSalary: true });
      res.json({
        message: `Updated ${results.updated} employee(s) from Excel`,
        ...results,
      });
    } catch (err) {
      console.error("SIF Excel import error:", err);
      res.status(400).json({ message: err.message || "Failed to import Excel" });
    }
  }
);

module.exports = router;
