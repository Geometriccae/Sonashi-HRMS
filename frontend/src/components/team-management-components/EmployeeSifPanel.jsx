import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import sifService from "../../services/SifService";
import { formatAed } from "../../utils/currency";
import styles from "./EmployeeSifPanel.module.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

const getBankAccount = (emp) => {
  const sal = emp?.salaryDetails || {};
  const iban = String(sal.ibanNumber || "").trim();
  const account = String(sal.accountNumber || "").trim();
  if (iban) return iban.replace(/\s+/g, "");
  return account.replace(/\s+/g, "");
};

const getFixedIncome = (emp) => {
  const sal = emp?.salaryDetails || {};
  if (sal.totalSalary != null && Number(sal.totalSalary) > 0) {
    return Number(sal.totalSalary);
  }
  const basic = Number(sal.basicSalary) || 0;
  const house = Number(sal.houseRent) || 0;
  const travel = Number(sal.travelExp) || 0;
  const other = Number(sal.other) || 0;
  const allowance = Number(sal.totalAllowance) || house + travel + other;
  const deduction = Number(sal.deduction) || 0;
  return Math.max(0, basic + allowance - deduction);
};

const buildYearOptions = () => {
  const y = new Date().getFullYear();
  const years = [];
  for (let i = y - 5; i <= y + 2; i += 1) years.push(String(i));
  return years;
};

const formatPersonLabel = (row) => {
  const name = row?.empName || row?.employeeName || "";
  const staff = row?.staffId || row?.employeeId || "";
  if (name && staff) return `${name} (${staff})`;
  if (name) return name;
  if (staff) return `Staff ${staff}`;
  if (row?.empId) return `EMPID ${row.empId}`;
  return "Employee";
};

const formatSkipLine = (row) => {
  const reason = row?.reason || (Array.isArray(row?.missing) ? row.missing.join("; ") : "Incomplete");
  return `${formatPersonLabel(row)} — ${reason}`;
};

/**
 * SIF (WPS) Import / Export panel for Employee Management.
 * Uses CompanySifSettings + existing /api/sif routes.
 */
function EmployeeSifPanel({ employee, canManage = false, showToast }) {
  const now = new Date();
  const [employerId, setEmployerId] = useState("");
  const [agentRouting, setAgentRouting] = useState("");
  const [employers, setEmployers] = useState([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [settingsError, setSettingsError] = useState("");
  const sifInputRef = useRef(null);
  const excelInputRef = useRef(null);

  const toast = useCallback(
    (msg, type = "info") => {
      if (typeof showToast === "function") showToast(msg, type);
      else if (type === "error") console.error(msg);
      else console.log(msg);
    },
    [showToast]
  );

  const employeeCompanyCode = useMemo(
    () => String(employee?.companyCode || "").trim().toUpperCase(),
    [employee?.companyCode]
  );

  const resolveEmployerForEmployee = useCallback((emp, employersList = [], defaultEmployer = "") => {
    if (!emp) return "";

    const empCompanyCode = String(emp.companyCode || "").trim().toUpperCase();
    const empOffice = String(emp.office || "").trim().toLowerCase();
    const empSifEmployerId = String(emp.sifEmployerId || emp.employerId || "").replace(/\D/g, "");

    // 1. If employee object has sifEmployerId/employerId of 13 digits
    if (empSifEmployerId.length === 13) return empSifEmployerId;

    // 2. Look in employersList
    const matched = (employersList || []).find((entry) => {
      const entryEmployerId = String(entry.employerId || "").replace(/\D/g, "");
      const entryCompanyCode = String(entry.companyCode || "").trim().toUpperCase();
      const entryCompanyName = String(entry.companyName || "").trim().toLowerCase();

      if (entryEmployerId && empCompanyCode && entryEmployerId === empCompanyCode) return true;
      if (entryCompanyCode && empCompanyCode && entryCompanyCode === empCompanyCode) return true;
      if (entryCompanyName && empOffice && entryCompanyName === empOffice) return true;
      return false;
    });

    if (matched?.employerId) return String(matched.employerId).replace(/\D/g, "");

    // 3. If employee.companyCode itself is a 13-digit Employer ID
    const digitsCompanyCode = empCompanyCode.replace(/\D/g, "");
    if (digitsCompanyCode.length === 13) return digitsCompanyCode;

    // 4. Fall back to defaultEmployer from settings
    const digitsDefault = String(defaultEmployer || "").replace(/\D/g, "");
    if (digitsDefault.length === 13) return digitsDefault;

    // 5. Built-in default
    return "0000000172509";
  }, []);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const s = await sifService.getSettings();
      const loadedEmployers = Array.isArray(s.employers) ? s.employers : [];
      const selectedEmployer = resolveEmployerForEmployee(employee, loadedEmployers, s.employerId);
      const selectedRouting = loadedEmployers.find(
      const companyRouting = loadedEmployers.find(
        (entry) => entry.employerId === selectedEmployer
      )?.agentRoutingCode || (selectedEmployer === s.employerId ? s.defaultAgentRoutingCode : "");

      const empAgent = String(
        employee?.salaryDetails?.agentCode ||
        employee?.salaryDetails?.bankSortCode ||
        employee?.agentCode ||
        employee?.bankSortCode ||
        employee?.salaryDetails?.cif ||
        employee?.salaryDetails?.cifNumber ||
        employee?.cif ||
        employee?.cifNumber ||
        ""
      ).trim().replace(/[^A-Za-z0-9]/g, "");

      // For an employee in Team Management, fetch Agent Code from the employee's details in basic info.
      // If the employee does not have an Agent Code saved, fall back to company routing.
      const routingToUse = empAgent || companyRouting || "";
      setEmployerId(selectedEmployer);
      setAgentRouting(selectedRouting || "");
      setAgentRouting(routingToUse);
      setEmployers(loadedEmployers);
    } catch (err) {
      toast(err.message || "Failed to load SIF settings", "error");
    } finally {
      setLoadingSettings(false);
    }
  }, [toast, employee, resolveEmployerForEmployee]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const employerDigits = digitsOnly(employerId);
  const agentDigits = digitsOnly(agentRouting);
  const agentDigits = String(agentRouting || "").trim().replace(/[^A-Za-z0-9]/g, "");
  const settingsReady = employerDigits.length === 13 && agentDigits.length === 9;

  const employeePreview = useMemo(() => {
    if (!employee) return null;
    const agent = String(
      employee.salaryDetails?.agentCode ||
      employee.salaryDetails?.bankSortCode ||
      employee.agentCode ||
      employee.bankSortCode ||
      ""
    ).trim().replace(/[^A-Za-z0-9]/g, "");
    const bank = getBankAccount(employee);
    const pay = getFixedIncome(employee);
    const labourCard = String(employee.workPermitNo || "").replace(/[\s-]+/g, "");
    const employer = resolveEmployerForEmployee(employee, employers, employerId);
    const missing = [];
    if (!/^\d{14}$/.test(labourCard)) missing.push("Staff ID / Labour Card No. (Person Code, 14 digits)");
    if (agent.length !== 9) missing.push("AGENTCODE (9-digit Bank Routing Code)");
    if (!bank) missing.push("Bank account / IBAN");
    if (!/^\d{13}$/.test(employer)) missing.push("Company Code (13-digit Employer ID)");
    return {
      employeeId: employee.employeeId || "—",
      labourCard: labourCard || "—",
      employerId: employer || "—",
      agentCode: agent || "—",
      bankAccount: bank || "—",
      netPay: pay,
      ready: missing.length === 0,
      missing,
    };
  }, [employee, employers, employerId, resolveEmployerForEmployee]);

  const validateSettingsLocal = () => {
    if (employerDigits.length !== 13) {
      return "EMPLOYERID must be exactly 13 digits before export.";
    }
    if (agentDigits.length !== 9) {
      return "Default agent routing must be exactly 9 digits before export.";
    }
    return null;
  };

  const handleSaveSettings = async () => {
    setSettingsError("");
    if (employerDigits.length !== 13) {
      const msg = "EMPLOYERID must be exactly 13 digits";
      setSettingsError(msg);
      toast(msg, "error");
      return;
    }
    if (agentDigits.length !== 9) {
      const msg = "Default agent routing must be exactly 9 digits";
      setSettingsError(msg);
      toast(msg, "error");
      return;
    }
    setSaving(true);
    try {
      const saved = await sifService.saveSettings({
        companyCode: employeeCompanyCode,
        employerId: employerDigits,
        defaultAgentRoutingCode: agentDigits,
      });
      setEmployerId(saved.selectedEmployerId || "");
      setAgentRouting(saved.selectedAgentRoutingCode || "");
      setEmployers(Array.isArray(saved.employers) ? saved.employers : employers);
      window.dispatchEvent(new Event("companies-changed"));
      toast("SIF settings saved.", "success");
    } catch (err) {
      const msg = err.message || "Failed to save SIF settings";
      setSettingsError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSettings = async () => {
    if (!employeeCompanyCode || !employerDigits) return;
    if (!window.confirm("Delete this company's SIF configuration? Employee and payroll records will not be deleted.")) return;
    setSaving(true);
    setSettingsError("");
    try {
      const saved = await sifService.deleteCompanySettings(employeeCompanyCode);
      setEmployerId("");
      setAgentRouting("");
      setEmployers(Array.isArray(saved.employers) ? saved.employers : []);
      window.dispatchEvent(new Event("companies-changed"));
      toast("Company SIF configuration deleted.", "success");
    } catch (err) {
      const msg = err.message || "Failed to delete Company SIF configuration";
      setSettingsError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!employee) {
      toast("No employee loaded", "error");
      return;
    }
    const empId = String(employee.employeeId || employee._id || "").trim();
    if (!empId) {
      toast("Cannot preview: Selected employee has no valid employee ID.", "error");
      return;
    }
    setBusy("preview");
    setPreview(null);
    setImportResult(null);
    try {
      const result = await sifService.previewExport(month, year, {
        employerId: employerDigits,
        employeeId: empId,
        mode: "individual",
      });
      setPreview(result);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast(
          `Preview: ${result.edrCount} valid, ${result.skippedCount || result.skipped?.length || 0} skipped.`,
          "success"
        );
      }
    } catch (err) {
      toast(err.message || "Preview failed", "error");
    } finally {
      setBusy("");
    }
  };

  const handleExportIndividualSif = async () => {
    if (!employee) {
      toast("No employee loaded", "error");
      return;
    }
    const empId = String(employee.employeeId || employee._id || "").trim();
    if (!empId) {
      toast("Cannot export individual SIF: Selected employee has no valid employee ID.", "error");
      return;
    }
    const agent = String(
      employee.salaryDetails?.agentCode ||
      employee.salaryDetails?.bankSortCode ||
      employee.agentCode ||
      employee.bankSortCode ||
      ""
    ).trim().replace(/[^A-Za-z0-9]/g, "");
    if (agent.length !== 9) {
      toast(`Cannot export individual SIF: Employee's Agent Code must be exactly 9 digits (current: "${agent || "missing"}").`, "error");
      return;
    }
    setBusy("individualSif");
    setImportResult(null);
    try {
      const result = await sifService.exportSif(month, year, {
        employerId: employerDigits,
        employeeId: empId,
        mode: "individual",
      });
      setPreview({
        edrCount: result.edrCount,
        skipped: result.skipped || [],
        skippedCount: result.skippedCount || 0,
        fileName: result.fileName,
        totalSalary: result.totalSalary,
        error: null,
      });
      toast(
        `Individual SIF downloaded for ${employee.employeeName || "employee"} (${result.fileName}) using employee's Agent Code: ${agent}.`,
        "success"
      );
    } catch (err) {
      toast(err.message || "Individual SIF export failed", "error");
    } finally {
      setBusy("");
    }
  };

  const handleExportCompanySif = async () => {
    const settingsMsg = validateSettingsLocal();
    if (settingsMsg) {
      setSettingsError(settingsMsg);
      toast(settingsMsg, "error");
      return;
    }
    setBusy("companySif");
    setImportResult(null);
    try {
      const result = await sifService.exportSif(month, year, { employerId: employerDigits });
      const skipped = result.skippedCount || 0;
      setPreview({
        edrCount: result.edrCount,
        skipped: result.skipped || [],
        skippedCount: skipped,
        fileName: result.fileName,
        totalSalary: result.totalSalary,
        error: null,
      });
      toast(
        skipped > 0
          ? `Company SIF downloaded (${result.edrCount} valid). ${skipped} incomplete employee(s) excluded — review the list below.`
          : `Company SIF downloaded (${result.edrCount} records): ${result.fileName}`,
        "success"
      );
    } catch (err) {
      toast(err.message || "SIF export failed", "error");
    } finally {
      setBusy("");
    }
  };

  const handleExportExcel = async () => {
    setBusy("excel");
    setImportResult(null);
    try {
      const result = await sifService.exportExcel(month, year);
      toast(`Excel exported (${result.rowCount} rows).`, "success");
    } catch (err) {
      toast(err.message || "Excel export failed", "error");
    } finally {
      setBusy("");
    }
  };

  const handleImportFile = async (file, kind) => {
    if (!file) return;
    setBusy(kind);
    setImportResult(null);
    try {
      const result =
        kind === "importSif"
          ? await sifService.importSif(file)
          : await sifService.importExcel(file);
      const skipped = Array.isArray(result.skipped) ? result.skipped : [];
      const errors = Array.isArray(result.errors) ? result.errors : [];
      setImportResult({
        updated: result.updated || 0,
        skipped,
        errors,
        kind: kind === "importSif" ? "SIF" : "Excel",
      });
      toast(
        `Import done. Updated ${result.updated || 0}, skipped ${skipped.length}, errors ${errors.length}.`,
        errors.length ? "error" : "success"
      );
      await loadSettings();
    } catch (err) {
      toast(err.message || "Import failed", "error");
    } finally {
      setBusy("");
    }
  };

  if (loadingSettings) {
    return <div className={styles.loading}>Loading SIF settings…</div>;
  }

  const skippedRows = Array.isArray(preview?.skipped) ? preview.skipped : [];
  const validCount = preview?.edrCount || 0;
  const skippedCount = preview?.skippedCount ?? skippedRows.length;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>SIF (WPS) Import / Export</h3>
        <p className={styles.subtitle}>
          Red Excel columns denote required WPS fields. Export builds one EDR row per employee of the
          selected EMPLOYERID (Company Code) from that month&apos;s generated salary slip — labour card,
          AGENTCODE, IBAN, days and net salary — then an SCR totals line. EMPID / Emirates ID is not exported.
        </p>
      </div>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>This employee (preview)</h4>
        {employeePreview ? (
          <>
            <div className={styles.previewGrid}>
              <div>
                <span className={styles.label}>EMPLOYEE ID</span>
                <span className={styles.value}>{employeePreview.employeeId}</span>
              </div>
              <div>
                <span className={styles.label}>LABOUR CARD NO.</span>
                <span className={styles.value}>{employeePreview.labourCard}</span>
              </div>
              <div>
                <span className={styles.label}>EMPLOYERID</span>
                <span className={styles.value}>{employeePreview.employerId}</span>
              </div>
              <div>
                <span className={styles.label}>AGENTCODE</span>
                <span className={styles.value}>{employeePreview.agentCode}</span>
              </div>
              <div>
                <span className={styles.label}>BANKACCOUNT / IBAN</span>
                <span className={styles.value}>{employeePreview.bankAccount}</span>
              </div>
              <div>
                <span className={styles.label}>NET / FIXED PAY</span>
                <span className={styles.value}>{formatAed(employeePreview.netPay)}</span>
              </div>
            </div>
            <p className={styles.hint}>
              Edit AGENTCODE / BANKACCOUNT on Salary Details (Bank SORT Code / IBAN); labour card
              is the employee&apos;s Person Code and EMPLOYERID is the Company Code.
              {!employeePreview.ready && (
                <span className={styles.warn}>
                  {" "}
                  Missing for EDR: {employeePreview.missing.join(", ")}.
                </span>
              )}
            </p>
          </>
        ) : (
          <p className={styles.hint}>No employee loaded.</p>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Company SIF settings</h4>
        <div className={styles.settingsRow}>
          <label className={styles.field}>
            <span>EMPLOYERID (13 DIGITS)</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={13}
              list="employee-sif-employer-options"
              value={employerId}
              onChange={(e) => {
                setSettingsError("");
                const nextEmployer = digitsOnly(e.target.value).slice(0, 13);
                setEmployerId(nextEmployer);
                setAgentRouting(
                  employers.find((entry) => entry.employerId === nextEmployer)?.agentRoutingCode || ""
                );
              }}
              disabled={!canManage || saving}
              className={styles.input}
              placeholder="0000000000000"
            />
            <datalist id="employee-sif-employer-options">
              {employers.map((emp) => (
                <option key={emp.employerId} value={emp.employerId}>
                  {`${emp.employeeCount} employee(s)${emp.agentRoutingCode ? "" : " — SCR routing not configured"}`}
                </option>
              ))}
            </datalist>
            {employerDigits.length > 0 && employerDigits.length !== 13 && (
              <span className={styles.fieldError}>Must be exactly 13 digits ({employerDigits.length}/13)</span>
            )}
          </label>
          <label className={styles.field}>
            <span>DEFAULT AGENT ROUTING (9 DIGITS, SCR)</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={9}
              value={agentRouting}
              onChange={(e) => {
                setSettingsError("");
                setAgentRouting(String(e.target.value || '').trim().replace(/[^A-Za-z0-9]/g, '').slice(0, 9));
              }}
              disabled={!canManage || saving}
              className={styles.input}
              placeholder="000000000"
            />
            {agentDigits.length > 0 && agentDigits.length !== 9 && (
              <span className={styles.fieldError}>Must be exactly 9 digits ({agentDigits.length}/9)</span>
            )}
          </label>
          {canManage && (
            <>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={handleSaveSettings}
                disabled={saving || Boolean(busy) || !employeeCompanyCode}
              >
                {saving ? "Saving…" : "Save Settings"}
              </button>
              {employerDigits && (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={handleDeleteSettings}
                  disabled={saving || Boolean(busy)}
                >
                  Delete Configuration
                </button>
              )}
            </>
          )}
        </div>
        {settingsError && <p className={styles.warnBlock}>{settingsError}</p>}
        {!settingsReady && !settingsError && (
          <p className={styles.hint}>
            Configure EMPLOYERID (13 digits) and Default Agent Routing (9 digits) before exporting a SIF file.
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Pay period &amp; actions</h4>
        <div className={styles.actionsRow}>
          <label className={styles.fieldInline}>
            <span>MONTH</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className={styles.select}
              disabled={Boolean(busy)}
            >
              {MONTHS.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldInline}>
            <span>YEAR</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={styles.select}
              disabled={Boolean(busy)}
            >
              {buildYearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handlePreview}
            disabled={Boolean(busy)}
          >
            {busy === "preview" ? "Previewing…" : "Preview Export"}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleExportIndividualSif}
            disabled={Boolean(busy)}
            title="Export SIF for this individual employee using their own Agent Code"
          >
            {busy === "individualSif" ? "Exporting…" : "Export Employee .SIF"}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleExportCompanySif}
            disabled={Boolean(busy)}
            title="Export company-wide SIF for all employees matching this Employer ID"
          >
            {busy === "companySif" ? "Exporting…" : "Export Company .SIF"}
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleExportExcel}
            disabled={Boolean(busy)}
          >
            {busy === "excel" ? "Exporting…" : "Export Excel"}
          </button>

          {canManage && (
            <>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => sifInputRef.current?.click()}
                disabled={Boolean(busy)}
              >
                {busy === "importSif" ? "Importing…" : "Import .SIF"}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => excelInputRef.current?.click()}
                disabled={Boolean(busy)}
              >
                {busy === "importExcel" ? "Importing…" : "Import Excel"}
              </button>
              <input
                ref={sifInputRef}
                type="file"
                accept=".sif,.SIF,.txt"
                className={styles.hiddenFile}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  handleImportFile(file, "importSif");
                }}
              />
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className={styles.hiddenFile}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  handleImportFile(file, "importExcel");
                }}
              />
            </>
          )}
        </div>

        {preview && (
          <div className={styles.previewResult}>
            {preview.error ? (
              <p className={styles.warn}>{preview.error}</p>
            ) : (
              <p className={styles.hint}>
                Valid employees: <strong>{validCount}</strong>
                {" · "}
                Skipped: <strong>{skippedCount}</strong>
                {preview.fileName ? ` · File: ${preview.fileName}` : ""}
                {preview.totalSalary != null
                  ? ` · Total: ${formatAed(preview.totalSalary)}`
                  : ""}
              </p>
            )}
            {skippedRows.length > 0 && (
              <div className={styles.skipList}>
                <div className={styles.skipTitle}>
                  Skipped / Incomplete Employees ({skippedRows.length})
                </div>
                <ul>
                  {skippedRows.slice(0, 50).map((row, idx) => (
                    <li key={`${row.staffId || row.empId || idx}-${idx}`}>
                      {formatSkipLine(row)}
                    </li>
                  ))}
                  {skippedRows.length > 50 && (
                    <li>…and {skippedRows.length - 50} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {importResult && (
          <div className={styles.importResult}>
            <div className={styles.importSummary}>
              <span>
                Updated: <strong>{importResult.updated}</strong>
              </span>
              <span>
                Skipped: <strong>{importResult.skipped.length}</strong>
              </span>
              <span>
                Errors: <strong>{importResult.errors.length}</strong>
              </span>
              <span className={styles.importKind}>{importResult.kind} import</span>
            </div>
            {importResult.skipped.length > 0 && (
              <div className={styles.skipList}>
                <div className={styles.skipTitle}>Skipped</div>
                <ul>
                  {importResult.skipped.slice(0, 40).map((row, idx) => (
                    <li key={`skip-${idx}`}>{formatSkipLine(row)}</li>
                  ))}
                  {importResult.skipped.length > 40 && (
                    <li>…and {importResult.skipped.length - 40} more</li>
                  )}
                </ul>
              </div>
            )}
            {importResult.errors.length > 0 && (
              <div className={`${styles.skipList} ${styles.errorList}`}>
                <div className={styles.errorTitle}>Errors</div>
                <ul>
                  {importResult.errors.slice(0, 40).map((row, idx) => (
                    <li key={`err-${idx}`}>{formatSkipLine(row)}</li>
                  ))}
                  {importResult.errors.length > 40 && (
                    <li>…and {importResult.errors.length - 40} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default EmployeeSifPanel;
