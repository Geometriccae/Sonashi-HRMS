const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const authMiddleware = require("../middleware/authMiddleware");
const { blockViewerWrites } = require("../middleware/permissionsMiddleware");
const Employee = require("../models/Employee");
const CompanyDocument = require("../models/CompanyDocument");
const CompanySifSettings = require("../models/CompanySifSettings");
const { workingStatusFilter } = require("../utils/employeeStatus");
const {
  generateSifContent,
  parseSifContent,
  digitsOnly,
  normalizeEmiratesId,
  validateEmployerId,
  validateAgentCode,
  getBankAccount,
  getFixedIncome,
  excelHeaders,
  RED_HEADERS,
  employeeToExcelRow,
  normalizeExcelHeader,
  HEADER_ALIASES,
} = require("../utils/sifUtils");
const {
  loadCompanyEmployerMap,
  applyCompanyEmployerMapping,
  normalizeEmployerId,
  isEmployerId,
} = require("../utils/sifCompanyMapping");

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

/**
 * SIF assignment source of truth: Employee.companyCode resolved through the
 * matching company record's configured Employer ID. This is also used by audit.
 */
async function loadEmployeesWithSifMappings() {
  const [employees, companyEmployerMap] = await Promise.all([
    loadActiveEmployees(),
    loadCompanyEmployerMap(),
  ]);
  return employees.map((employee) =>
    applyCompanyEmployerMapping(employee, companyEmployerMap)
  );
}

/**
 * Load employees for a SIF export scoped to one Employer ID.
 * WPS requires one employer per SIF file — do not mix companies.
 */
async function loadEmployeesForEmployerExport(employerId) {
  const employees = await loadEmployeesWithSifMappings();
  const target = normalizeEmployerId(employerId);
  const matched = [];
  const excluded = [];

  employees.forEach((employee) => {
    const mappedEmployerId = normalizeEmployerId(employee.sifEmployerId);
    if (target && mappedEmployerId === target) {
      matched.push(employee);
      return;
    }
    excluded.push({
      staffId: employee.employeeId || "",
      empName: employee.employeeName || "",
      companyCode: employee.companyCode || "",
      employerId: mappedEmployerId,
      reason: !mappedEmployerId
        ? (employee.sifCompanyMapping?.issues || ["Missing company assignment"]).join("; ")
        : `Assigned Employer ID ${mappedEmployerId} does not match selected Employer ID ${target}`,
    });
  });

  return { matched, excluded, targetEmployerId: target };
}

async function loadSingleEmployeeForExport(employeeId, requestedEmployerId) {
  const employees = await loadEmployeesWithSifMappings();
  const targetId = String(employeeId || "").trim();
  const employee = employees.find(
    (e) => String(e._id) === targetId || String(e.employeeId).trim() === targetId
  );

  if (!employee) {
    return {
      error: `Employee "${targetId}" not found or not active.`,
      matched: [],
      excluded: [],
      targetEmployerId: "",
    };
  }

  const mappedEmployerId = normalizeEmployerId(employee.sifEmployerId);
  const target = normalizeEmployerId(requestedEmployerId) || mappedEmployerId;

  if (requestedEmployerId && mappedEmployerId && normalizeEmployerId(requestedEmployerId) !== mappedEmployerId) {
    return {
      error: `Selected employee belongs to Employer ID ${mappedEmployerId}, but export was requested for Employer ID ${requestedEmployerId}.`,
      matched: [],
      excluded: [{
        staffId: employee.employeeId || "",
        empName: employee.employeeName || "",
        companyCode: employee.companyCode || "",
        employerId: mappedEmployerId,
        reason: `Assigned Employer ID ${mappedEmployerId} does not match selected Employer ID ${requestedEmployerId}`,
      }],
      targetEmployerId: target,
    };
  }

  if (!target) {
    return {
      error: (employee.sifCompanyMapping?.issues || ["Missing company assignment"]).join("; "),
      matched: [],
      excluded: [{
        staffId: employee.employeeId || "",
        empName: employee.employeeName || "",
        companyCode: employee.companyCode || "",
        employerId: "",
        reason: (employee.sifCompanyMapping?.issues || ["Missing company assignment"]).join("; "),
      }],
      targetEmployerId: "",
    };
  }

  return { matched: [employee], excluded: [], targetEmployerId: target, employee };
}

function getEmployerRoutingCodes(settings) {
  const routes = new Map();
  (settings?.employerRoutingCodes || []).forEach((entry) => {
    const employerId = digitsOnly(entry?.employerId);
    const agentRoutingCode = digitsOnly(entry?.agentRoutingCode);
    if (employerId.length === 13 && agentRoutingCode.length === 9) {
      routes.set(employerId, agentRoutingCode);
    }
  });
  const defaultEmployer = digitsOnly(settings?.employerId);
  const defaultRouting = digitsOnly(settings?.defaultAgentRoutingCode);
  if (defaultEmployer.length === 13 && defaultRouting.length === 9 && !routes.has(defaultEmployer)) {
    routes.set(defaultEmployer, defaultRouting);
  }
  return routes;
}

function resolveExportAgentRouting(settings, employerId) {
  const companyRouting = getEmployerRoutingCodes(settings).get(digitsOnly(employerId));
  if (companyRouting) return companyRouting;
  if (digitsOnly(settings?.employerId) === digitsOnly(employerId)) {
    const defaultRouting = digitsOnly(settings?.defaultAgentRoutingCode);
    return defaultRouting.length === 9 ? defaultRouting : "";
  }
  return "";
}

/** Employer picker data must use the exact same active population and company mapping as export. */
async function employersWithRouting(settings) {
  const employees = await loadEmployeesWithSifMappings();
  const counts = new Map();
  employees.forEach((employee) => {
    const employerId = normalizeEmployerId(employee.sifEmployerId);
    if (isEmployerId(employerId)) {
      counts.set(employerId, (counts.get(employerId) || 0) + 1);
    }
  });
  const routes = getEmployerRoutingCodes(settings);
  const companies = await CompanyDocument.find({
    recordType: "company",
    employerId: { $exists: true, $nin: [null, ""] },
  }).select("particulars docNumber employerId").lean();
  const configured = new Map();
  companies.forEach((company) => {
    const employerId = digitsOnly(company.employerId);
    if (employerId.length === 13 && !configured.has(employerId)) {
      configured.set(employerId, company);
    }
  });
  return Array.from(configured.entries())
    .map(([employerId, company]) => ({
      employerId,
      companyCode: company.docNumber || "",
      companyName: company.particulars || "",
      employeeCount: counts.get(employerId) || 0,
      agentRoutingCode: routes.get(employerId) || "",
    }))
    .sort((a, b) => b.employeeCount - a.employeeCount || a.employerId.localeCompare(b.employerId));
}

async function applyEdrUpdates(edrs, { updateSalary = true } = {}) {
  const results = { updated: 0, skipped: [], errors: [] };

  const allWithId = await Employee.find({
    $or: [
      { emiratesId: { $exists: true, $nin: [null, ""] } },
      { employeeId: { $exists: true, $nin: [null, ""] } },
    ],
  }).select("_id emiratesId employeeId employeeName salaryDetails");

  const byEmpid = new Map();
  const byStaff = new Map();
  allWithId.forEach((e) => {
    const eid = normalizeEmiratesId(e.emiratesId);
    if (eid) byEmpid.set(eid, e);
    if (e.employeeId) byStaff.set(String(e.employeeId).trim(), e);
  });

  for (const edr of edrs) {
    const empId = normalizeEmiratesId(edr.empId);
    if (!empId && !edr.staffId) {
      results.skipped.push({ empId: edr.empId, reason: "Missing EMPID and StaffID" });
      continue;
    }

    let empDoc = empId ? byEmpid.get(empId) : null;
    if (!empDoc && edr.staffId) {
      empDoc = byStaff.get(String(edr.staffId).trim()) || null;
    }

    if (!empDoc) {
      results.skipped.push({
        empId,
        staffId: edr.staffId || "",
        reason: "No matching employee (EMPID / StaffID)",
      });
      continue;
    }

    try {
      const emp = await Employee.findById(empDoc._id);
      if (!emp) {
        results.skipped.push({ empId, reason: "Employee record not found" });
        continue;
      }

      if (empId) emp.emiratesId = empId;
      if (!emp.salaryDetails) emp.salaryDetails = {};
      if (edr.agentCode) {
        const code = digitsOnly(edr.agentCode);
        emp.salaryDetails.bankSortCode = code;
        emp.salaryDetails.agentCode = code;
      }

      const bank = String(edr.bankAccount || "").trim();
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

      if (edr.basic != null) emp.salaryDetails.basicSalary = Number(edr.basic) || 0;
      if (edr.hra != null) emp.salaryDetails.houseRent = Number(edr.hra) || 0;
      if (edr.transport != null) emp.salaryDetails.travelExp = Number(edr.transport) || 0;
      if (edr.other != null) emp.salaryDetails.other = Number(edr.other) || 0;
      if (edr.deduction != null) emp.salaryDetails.deduction = Number(edr.deduction) || 0;

      emp.markModified("salaryDetails");
      await emp.save();
      results.updated += 1;

      // keep maps warm for duplicate rows
      if (empId) byEmpid.set(empId, emp);
      if (emp.employeeId) byStaff.set(String(emp.employeeId).trim(), emp);
    } catch (err) {
      results.errors.push({
        empId,
        employeeId: empDoc.employeeId,
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
      employers: await employersWithRouting(doc),
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
    const companyCode = normalizeEmployerId(req.body.companyCode);

    if (employerId && employerId.length !== 13) {
      return res.status(400).json({ message: "Employer ID must be exactly 13 digits" });
    }
    if (defaultAgentRoutingCode && defaultAgentRoutingCode.length !== 9) {
      return res.status(400).json({ message: "Default agent routing code must be exactly 9 digits" });
    }

    const doc = await getOrCreateSettings();
    if (companyCode) {
      const company = await CompanyDocument.findOne({ recordType: "company", docNumber: companyCode });
      if (!company) return res.status(404).json({ message: "Company configuration not found" });

      const duplicateEmployer = employerId
        ? await CompanyDocument.exists({
            recordType: "company",
            employerId,
            _id: { $ne: company._id },
          })
        : null;
      if (duplicateEmployer) {
        return res.status(409).json({ message: "Employer ID is already configured for another company" });
      }

      const previousEmployerId = digitsOnly(company.employerId);
      company.employerId = employerId;
      await company.save();

      const routes = Array.from(doc.employerRoutingCodes || []).filter((entry) => {
        const routeEmployerId = digitsOnly(entry.employerId);
        return routeEmployerId !== employerId && routeEmployerId !== previousEmployerId;
      });
      if (employerId && defaultAgentRoutingCode) {
        routes.push({ employerId, agentRoutingCode: defaultAgentRoutingCode });
      }
      doc.employerRoutingCodes = routes;
    } else {
      if (req.body.employerId !== undefined) doc.employerId = employerId;
      if (req.body.defaultAgentRoutingCode !== undefined) {
        doc.defaultAgentRoutingCode = defaultAgentRoutingCode;
      }
    }
    await doc.save();

    res.json({
      employerId: doc.employerId || "",
      defaultAgentRoutingCode: doc.defaultAgentRoutingCode || "",
      selectedEmployerId: companyCode ? employerId : (doc.employerId || ""),
      selectedAgentRoutingCode: companyCode ? defaultAgentRoutingCode : (doc.defaultAgentRoutingCode || ""),
      employers: await employersWithRouting(doc),
    });
  } catch (err) {
    console.error("SIF settings PUT error:", err);
    res.status(500).json({ message: "Failed to save SIF settings" });
  }
});

router.delete("/settings/company/:companyCode", authMiddleware, blockViewerWrites, requireAdminOrHod, async (req, res) => {
  try {
    const companyCode = normalizeEmployerId(req.params.companyCode);
    const company = await CompanyDocument.findOne({ recordType: "company", docNumber: companyCode });
    if (!company) return res.status(404).json({ message: "Company configuration not found" });

    const employerId = digitsOnly(company.employerId);
    company.employerId = "";
    await company.save();

    const doc = await getOrCreateSettings();
    if (employerId) {
      doc.employerRoutingCodes = Array.from(doc.employerRoutingCodes || []).filter(
        (entry) => digitsOnly(entry.employerId) !== employerId
      );
      if (digitsOnly(doc.employerId) === employerId) {
        doc.employerId = "";
        doc.defaultAgentRoutingCode = "";
      }
      await doc.save();
    }

    res.json({
      message: "Company SIF configuration deleted successfully",
      employerId: doc.employerId || "",
      defaultAgentRoutingCode: doc.defaultAgentRoutingCode || "",
      employers: await employersWithRouting(doc),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete Company SIF configuration" });
  }
});

// ── Export SIF ─────────────────────────────────────────────────────────────

router.get("/export/sif", authMiddleware, async (req, res) => {
  try {
    const parsed = parseMonthYear(req);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const settings = await getOrCreateSettings();
    const selectedEmployeeId = String(req.query.employeeId || "").trim();
    const isIndividual = Boolean(selectedEmployeeId);

    let matched = [];
    let excluded = [];
    let employerId = "";

    if (isIndividual) {
      const loadRes = await loadSingleEmployeeForExport(selectedEmployeeId, req.query.employerId);
      if (loadRes.error) {
        return res.status(400).json({
          message: loadRes.error,
          skipped: loadRes.excluded,
        });
      }
      matched = loadRes.matched;
      excluded = loadRes.excluded;
      employerId = loadRes.targetEmployerId;
    } else {
      const selectedEmployerId = digitsOnly(req.query.employerId);
      employerId = selectedEmployerId || digitsOnly(settings.employerId) || "";
      const employerErr = validateEmployerId(employerId);
      if (employerErr) {
        return res.status(400).json({ message: employerErr });
      }

      const loadRes = await loadEmployeesForEmployerExport(employerId);
      matched = loadRes.matched;
      excluded = loadRes.excluded;
      if (matched.length === 0) {
        return res.status(400).json({
          message:
            "No employees found with company code matching the selected Employer ID.",
          skipped: excluded.slice(0, 100),
          excludedByCompany: excluded.length,
        });
      }
    }

    const employerErr = validateEmployerId(employerId);
    if (employerErr) {
      return res.status(400).json({ message: employerErr });
    }

    const result = generateSifContent({
      employees: matched,
      employerId,
      defaultAgentRoutingCode: resolveExportAgentRouting(settings, employerId),
      year: parsed.year,
      month: parsed.month,
      isIndividual,
    });

    if (result.error) {
      return res.status(400).json({
        message: result.error,
        skipped: result.skipped || [],
        excludedByCompany: excluded.length,
      });
    }

    const allSkipped = [...(result.skipped || []), ...excluded];

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`
    );
    res.setHeader("X-SIF-Edr-Count", String(result.edrCount));
    res.setHeader("X-SIF-Skipped", String(allSkipped.length));
    res.setHeader("X-SIF-Excluded-Company", String(excluded.length));
    res.setHeader("X-SIF-Total", String(result.totalSalary));
    res.setHeader("X-SIF-Is-Individual", isIndividual ? "true" : "false");
    if (isIndividual && matched[0]) {
      res.setHeader("X-SIF-Employee-Id", String(matched[0].employeeId || ""));
      const empAgent = digitsOnly(matched[0].salaryDetails?.agentCode || matched[0].salaryDetails?.bankSortCode);
      if (empAgent) res.setHeader("X-SIF-Agent-Code", empAgent);
    }
    // Expose skip summary via custom header (JSON) for UI — keep body as pure SIF
    if (allSkipped.length) {
      res.setHeader(
        "X-SIF-Skip-Summary",
        Buffer.from(JSON.stringify(allSkipped.slice(0, 50))).toString("base64")
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
<<<<<<< HEAD
    const selectedEmployeeId = String(req.query.employeeId || "").trim();
    const isIndividual = Boolean(selectedEmployeeId);

    let matched = [];
    let excluded = [];
    let employerId = "";

    if (isIndividual) {
      const loadRes = await loadSingleEmployeeForExport(selectedEmployeeId, req.query.employerId);
      if (loadRes.error) {
        return res.status(400).json({
          message: loadRes.error,
          skipped: loadRes.excluded,
        });
      }
      matched = loadRes.matched;
      excluded = loadRes.excluded;
      employerId = loadRes.targetEmployerId;
    } else {
      const selectedEmployerId = digitsOnly(req.query.employerId);
      employerId =
        selectedEmployerId || digitsOnly(settings.employerId) || "0000000000000";
      const loadRes = await loadEmployeesForEmployerExport(employerId);
      matched = loadRes.matched;
      excluded = loadRes.excluded;
    }

=======
    const selectedEmployerId = digitsOnly(req.query.employerId);
    const employerId = selectedEmployerId || digitsOnly(settings.employerId);
    const { matched, excluded } = await loadEmployeesForEmployerExport(employerId);
>>>>>>> c545bc2b2c1aa818a1495fe2b7f0bb64302d85a7
    const result = generateSifContent({
      employees: matched,
      employerId,
      defaultAgentRoutingCode: resolveExportAgentRouting(settings, employerId),
      year: parsed.year,
      month: parsed.month,
      isIndividual,
    });

    res.json({
      employerId: employerId || "",
      isIndividual,
      employeeId: isIndividual && matched[0] ? matched[0].employeeId : undefined,
      employeeName: isIndividual && matched[0] ? matched[0].employeeName : undefined,
      agentCode: isIndividual && matched[0] ? digitsOnly(matched[0].salaryDetails?.agentCode || matched[0].salaryDetails?.bankSortCode) : undefined,
      edrCount: result.edrCount || 0,
      totalSalary: result.totalSalary || 0,
      skipped: [...(result.skipped || []), ...excluded],
      excludedByCompany: excluded.length,
      matchedCount: matched.length,
      fileName: result.fileName || null,
      error: result.error || null,
    });
  } catch (err) {
    console.error("SIF preview error:", err);
    res.status(500).json({ message: "Failed to preview SIF export" });
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

      // Preserve routing by employer; never let one imported company's SCR
      // silently become the routing code for every other company.
      if (scr?.employerId) {
        const settings = await getOrCreateSettings();
        const employerId = digitsOnly(scr.employerId);
        const agentRoutingCode = digitsOnly(scr.agentRouting);
        const routes = Array.from(settings.employerRoutingCodes || []);
        const hasRoute = routes.some((entry) => digitsOnly(entry.employerId) === employerId);
        if (!hasRoute && employerId.length === 13 && agentRoutingCode.length === 9) {
          routes.push({ employerId, agentRoutingCode });
          settings.employerRoutingCodes = routes;
        }
        if (!settings.employerId && employerId.length === 13) {
          settings.employerId = scr.employerId;
          if (scr.agentRouting) settings.defaultAgentRoutingCode = scr.agentRouting;
        }
        if (settings.isModified()) await settings.save();
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
    const selectedEmployerId = digitsOnly(req.query.employerId);
    let employees = await loadEmployeesWithSifMappings();
    if (selectedEmployerId) {
      const { matched } = filterEmployeesForEmployer(employees, selectedEmployerId);
      employees = matched;
    }
    const rows = employees.map((e) => employeeToExcelRow(e));

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
    const selectedEmployerId = digitsOnly(req.query.employerId);
    let employees = await loadEmployeesWithSifMappings();
    if (selectedEmployerId) {
      const { matched } = filterEmployeesForEmployer(employees, selectedEmployerId);
      employees = matched;
    }
    const rows = employees.map((e) => employeeToExcelRow(e));
    res.json({
      headers: excelHeaders,
      redHeaders: Array.from(RED_HEADERS),
      rows,
      employerId: selectedEmployerId || settings.employerId || "",
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
      const employerIdsFromFile = new Set();
      let agentCodeFromFile = "";

      const edrs = json.map((row) => {
        const mapped = {};
        Object.keys(row).forEach((key) => {
          const norm = normalizeExcelHeader(key);
          const canonical = HEADER_ALIASES[norm];
          if (canonical) mapped[canonical] = row[key];
        });

        if (mapped.EMPLOYERID) {
          const eid = digitsOnly(mapped.EMPLOYERID);
          if (eid.length === 13) employerIdsFromFile.add(eid);
        }
        if (mapped.AGENTCODE && !agentCodeFromFile) {
          agentCodeFromFile = digitsOnly(mapped.AGENTCODE);
        }

        return {
          staffId: String(mapped.StaffID || "").trim(),
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

      // Do not overwrite existing SIF Settings from mixed Excel files.
      // Only fill empty settings when the file has a single unambiguous Employer ID.
      let settingsChanged = false;
      if (!settings.employerId && employerIdsFromFile.size === 1) {
        settings.employerId = [...employerIdsFromFile][0];
        settingsChanged = true;
      }
      if (
        !settings.defaultAgentRoutingCode &&
        agentCodeFromFile &&
        agentCodeFromFile.length === 9
      ) {
        settings.defaultAgentRoutingCode = agentCodeFromFile;
        settingsChanged = true;
      }
      if (settingsChanged) {
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

// ── Read-only mapping audit (all eligible employees) ───────────────────────

router.get("/audit", authMiddleware, requireAdminOrHod, async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    const settingsEmployerId = digitsOnly(settings.employerId);
    const employees = await loadEmployeesWithSifMappings();

    const byEmployer = {};
    const rows = [];
    let pass = 0;
    let missingData = 0;
    let mismatch = 0;
    let agentOk = 0;
    let agentMissing = 0;
    let agentInvalid = 0;

    employees.forEach((emp) => {
      const employerId = normalizeEmployerId(emp.sifEmployerId);
      const storedCode = String(emp.companyCode || "").trim();
      const agentRaw = digitsOnly(emp.salaryDetails?.agentCode || emp.salaryDetails?.bankSortCode);
      const agentErr = agentRaw ? validateAgentCode(agentRaw) : "AGENTCODE missing";
      const bank = getBankAccount(emp) || "";
      const empid = digitsOnly(emp.workPermitNo);
      const salary = getFixedIncome(emp);

      const issues = [];
      if (!employerId) issues.push("Missing Employer ID / company code");
      else if (employerId.length !== 13) {
        issues.push(`Employer ID / company code must be 13 digits (got ${employerId.length})`);
      }
      if (!empid || empid.length < 14 || empid.length > 15) {
        issues.push("Missing/invalid Labour Card / Person Code");
      }
      if (!bank) issues.push("Missing IBAN / bank account");
      if (agentErr) issues.push(agentErr);
      if (settingsEmployerId && employerId && settingsEmployerId !== employerId) {
        // Multi-company is valid; informational only for review against settings default
        issues.push(
          `Assigned to Employer ID ${employerId} (SIF Settings default is ${settingsEmployerId})`
        );
      }

      const hardMissing =
        !employerId ||
        !empid ||
        empid.length < 14 ||
        empid.length > 15 ||
        !bank;
      const hardMismatch = Boolean(employerId && employerId.length !== 13);

      let validation = "Pass";
      if (hardMissing) validation = "Missing Data";
      else if (hardMismatch) validation = "Mismatch";

      const agentIssue = Boolean(agentErr);
      if (!agentRaw) agentMissing += 1;
      else if (agentErr) agentInvalid += 1;
      else agentOk += 1;

      const key = employerId || "(empty)";
      byEmployer[key] = (byEmployer[key] || 0) + 1;

      rows.push({
        employeeId: emp.employeeId || "",
        employeeName: emp.employeeName || "",
        employeeStatus: emp.employeeStatus || "",
        office: emp.office || "",
        companyCode: storedCode,
        employerId,
        agentCode: agentRaw,
        labourCard: emp.labourCardNumber || "",
        emiratesId: empid,
        iban: bank,
        salary,
        validation,
        issues,
        agentIssue,
      });
    });

    pass = rows.filter((r) => r.validation === "Pass").length;
    missingData = rows.filter((r) => r.validation === "Missing Data").length;
    mismatch = rows.filter((r) => r.validation === "Mismatch").length;

    // Flag for human review: missing/invalid mapping data or agent code problems
    const unresolved = rows.filter(
      (r) => r.validation !== "Pass" || r.agentIssue
    );

    res.json({
      auditedAt: new Date().toISOString(),
      totalEligible: employees.length,
      sifSettings: {
        employerId: settings.employerId || "",
        defaultAgentRoutingCode: settings.defaultAgentRoutingCode || "",
      },
      summary: {
        pass,
        missingData,
        mismatch,
        unresolvedForReview: unresolved.length,
      },
      agentCode: {
        ok9Digits: agentOk,
        missing: agentMissing,
        invalidLength: agentInvalid,
      },
      byEmployerId: byEmployer,
      // Full population for review (may be large)
      employees: rows,
      unresolved: unresolved.map((r) => ({
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        employerId: r.employerId,
        companyCode: r.companyCode,
        agentCode: r.agentCode,
        validation: r.validation,
        issues: r.issues,
      })),
    });
  } catch (err) {
    console.error("SIF audit error:", err);
    res.status(500).json({ message: "Failed to run SIF mapping audit" });
  }
});

module.exports = router;
