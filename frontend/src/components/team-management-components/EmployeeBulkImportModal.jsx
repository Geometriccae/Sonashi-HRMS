import React, { useState, useRef, useLayoutEffect } from "react";
import * as XLSX from "xlsx";
import employeeService from "../../services/EmployeeService";
import styles from "./EmployeeBulkImportModal.module.css";

/** First-row headers aligned with Add Employee / server import mapper */
export const EMPLOYEE_IMPORT_HEADERS = [
  "Person Code",
  "Employee ID",
  "Office",
  "Employee Name",
  "Reporting Manager",
  "Gender",
  "Mobile Number",
  "Email ID",
  "Emirates ID",
  "Nationality",
  "Role",
  "Designation",
  "DOJ",
  "Total Year of Experience",
  "Date of Birth",
  "Passport No.",
  "Passport Expiry Date",
  "Labour Card Expiry Date",
  "Visa Expiry Date",
  "Remarks",
  "Department",
  "Employee Status",
  "Attendance",
  "Life Insurance",
  "Medical Insurance",
  "Air Fare",
  "Bank Name",
  "Account Number",
  "IBAN Number",
  "Bank SORT Code",
  "Profile Photo",
];

const SAMPLE_ROW = [
  "",
  "EMP-1001",
  "Dubai HQ",
  "Sample Employee",
  "Jane Manager",
  "Male",
  "971500000000",
  "sample.employee@company.com",
  "",
  "AE",
  "Sales Executive",
  "Executive",
  "2024-01-15",
  "3",
  "1990-05-20",
  "X1234567",
  "2030-12-31",
  "2026-06-01",
  "2026-06-01",
  "",
  "Project Sales",
  "Active",
  "Onsite",
  "Yes",
  "Acme Bank",
  "7654321098",
  "AE123456789012345678901",
  "12-34-56",
  "",
];

function EmployeeBulkImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const errorListRef = useRef(null);

  useLayoutEffect(() => {
    if (result?.errors?.length > 0 && errorListRef.current) {
      errorListRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [result]);

  if (!isOpen) return null;

  const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([EMPLOYEE_IMPORT_HEADERS, SAMPLE_ROW]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Employees");
    XLSX.writeFile(wb, "employee_import_template.xlsx");
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setError("");
    setResult(null);
    e.target.value = "";
  };

  const handleImport = async () => {
    if (!file) {
      setError("Choose an Excel file first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await employeeService.importEmployeesFromExcel(file);
      setResult(res);
      if (onSuccess) onSuccess(res);
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Bulk import employees</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.body}>
          <p className={styles.hint}>
            Match headers to the template (or common aliases). Extra columns such as{" "}
            <strong>S.No</strong> are ignored.
          </p>
          <ul className={styles.requiredList}>
            <li>
              <strong>Required:</strong> Employee ID, Employee Name, Role, Department
            </li>
            <li>
              <strong>Optional:</strong> Mobile Number (digits only — spaces and + are removed) and
              Email ID. If Email ID is blank, the system stores a unique internal address so import
              works with all databases; the team list shows an empty dash until you add a real email in
              Edit employee.
            </li>
            <li>Dates: YYYY-MM-DD or standard Excel date cells</li>

            <li>Documents are not imported from Excel — add them under Edit employee</li>
          </ul>
          <div className={styles.toolbar}>
            <button type="button" className={styles.btnSecondary} onClick={downloadTemplate}>
              Download Excel template
            </button>
          </div>
          <div className={styles.uploadBlock}>
            <input
              id="employee-bulk-file"
              className={styles.hiddenInput}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
            />
            <label htmlFor="employee-bulk-file" className={styles.fileLabel}>
              <div className={styles.drop}>
                {file ? (
                  <>
                    Selected file
                    <br />
                    <strong>{file.name}</strong>
                  </>
                ) : (
                  <>
                    Click here to choose an <strong>.xlsx</strong> or <strong>.xls</strong> file
                  </>
                )}
              </div>
            </label>
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleImport}
                disabled={loading || !file}
              >
                {loading ? "Importing…" : "Import to database"}
              </button>
            </div>
          </div>
          {error && <div className={styles.errorBanner}>{error}</div>}
          {result && (
            <div
              className={
                (result.failed ?? 0) > 0 ? styles.resultPartial : styles.resultOk
              }
            >
              Created: {result.created ?? 0} · Failed: {result.failed ?? 0}
              {(result.failed ?? 0) > 0 ? (
                <p className={styles.resultHint}>
                  Failed rows are listed below. Fix the sheet and import again (duplicate Employee IDs
                  must be removed or renamed first).
                </p>
              ) : null}
            </div>
          )}
          {result?.errors?.length > 0 && (
            <div ref={errorListRef} className={styles.errorScroll}>
              <div className={styles.errorScrollTitle}>Row errors (full message)</div>
              {result.errors.map((err, i) => (
                <div key={i} className={styles.errorRow}>
                  <span className={styles.errorRowMeta}>Row {err.row}</span>
                  <span className={styles.errorRowMsg}>{err.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmployeeBulkImportModal;
