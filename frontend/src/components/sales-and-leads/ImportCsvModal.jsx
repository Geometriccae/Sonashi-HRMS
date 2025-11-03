import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import clientService from "../../services/ClientService";
import "./ImportCsvModal.css";

function ImportCsvModal({ isOpen, onClose, onComplete }) {
  const [fileName, setFileName] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [successCount, setSuccessCount] = useState(0);
  const [previewRows, setPreviewRows] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  // Columns guidance
  const requiredColumns = [
    "Company Name", // maps to companyName
    "Email",        // maps to email
  ];
  const optionalColumns = [
    "Phone",
    "Type",
    "Relationship Status",
    "Lead Source",
    "Follow-up Status",
    "Address",
    "Country",
  ];

  useEffect(() => {
    if (isOpen) {
      console.log("ImportCsvModal opened");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parseCSVLine = (line) => {
    const parts = line.match(/([^",]+|"[^"]*")+/g) || [];
    return parts.map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setSelectedFile(file);
    setErrors([]);
    setSuccessCount(0);
    setIsReady(false);
    setPreviewRows([]);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setErrors(["CSV must contain a header and at least one data row"]);
        return;
      }
      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

      // Validate required columns (case-insensitive)
      const missing = requiredColumns.filter(req => !headers.includes(req.toLowerCase()));
      if (missing.length > 0) {
        setErrors([`Missing required columns: ${missing.join(", ")}`]);
        return;
      }

      const headersNormalized = headers; // already lowercased
      // Show basic preview (first 5 rows)
      const items = lines.slice(1).map((line) => {
        const cols = parseCSVLine(line);
        const row = {};
        headersNormalized.forEach((h, i) => {
          row[h] = cols[i] ?? "";
        });
        return row;
      });
      setRowCount(items.length);
      setPreviewRows(items.slice(0, 5));
      setIsReady(true);
    } catch (err) {
      setErrors([err.message || "Failed to read file"]);
    }
  };

  const mapRowToPayload = (row) => {
    return {
      companyName: row["company name"] || row["company"] || "",
      email: row["email"] || row["email id"] || "",
      phone: row["phone"] || row["mobile"] || "",
      type: row["type"] || "",
      relationshipStatus: row["relationship status"] || "",
      leadSource: row["lead source"] || "",
      followupStatus:
        row["follow-up status"] ||
        row["followup status"] ||
        row["follow status"] ||
        "",
      address: row["address"] || "",
      country: row["country"] || "",
      // createdBy/assignedTo are handled server-side
    };
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setErrors(["No file selected"]);
      return;
    }
    setIsImporting(true);
    setErrors([]);
    setSuccessCount(0);
    const successes = [];
    const errs = [];

    try {
      const text = await selectedFile.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
      const rows = lines.slice(1).map((line) => {
        const cols = parseCSVLine(line);
        const row = {};
        headers.forEach((h, i) => {
          row[h] = cols[i] ?? "";
        });
        return row;
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const payload = mapRowToPayload(row);
        // Minimal validation
        if (!payload.companyName || !payload.email) {
          errs.push({
            row: i + 2,
            reason: "Missing required company name or email",
            rowData: payload,
          });
          continue;
        }
        try {
          const saved = await clientService.createClient(payload);
          successes.push(saved);
        } catch (err) {
          errs.push({
            row: i + 2,
            reason: err?.message || "Server error saving row",
            rowData: payload,
          });
        }
      }

      setSuccessCount(successes.length);
      setErrors(errs);
      if (onComplete) onComplete(successes, errs);
    } catch (err) {
      setErrors([{ row: null, reason: err.message || "Import failed" }]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFileName("");
    setRowCount(0);
    setIsReady(false);
    setIsImporting(false);
    setErrors([]);
    setSuccessCount(0);
    setPreviewRows([]);
    setSelectedFile(null);
    onClose && onClose();
  };

  const downloadTemplate = () => {
    const headers = [...requiredColumns, ...optionalColumns];
    const csv = headers.map(h => `"${h}"`).join(",") + "\n";
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Modal content (class names updated to avoid collisions)
  const modalContent = (
    <div className="import-modal-backdrop" aria-hidden={!isOpen}>
      <div
        className="import-modal-container"
        role="dialog"
        aria-modal="true"
        aria-label="Import clients CSV"
      >
        {/* Columns guidance and template download */}
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Required columns</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {requiredColumns.map((c) => (
                <div key={c} style={{ background: '#fff1f0', color:'#b91c1c', padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
                  {c}
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 600, margin: '10px 0 6px' }}>Optional columns</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {optionalColumns.map((c) => (
                <div key={c} style={{ background: '#f3f4f6', color:'#374151', padding: '6px 8px', borderRadius: 6, fontSize: 13 }}>
                  {c}
                </div>
              ))}
            </div>
          </div>
          <div>
            <button type="button" onClick={downloadTemplate} className="primary-button" style={{ padding: '6px 10px' }}>
              Download CSV template
            </button>
          </div>
        </div>

        <div className="import-modal-header">
          <h3>Import Clients / Leads (CSV)</h3>
          <button onClick={handleClose} className="import-modal-close" aria-label="Close import modal">×</button>
        </div>

        <form onSubmit={(ev) => { ev.preventDefault(); }}>
          <div className="import-modal-file">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} />
          </div>

          {fileName && (
            <div className="import-modal-selected">
              Selected: <strong>{fileName}</strong> — {rowCount} rows
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="import-modal-preview">
              <div className="import-modal-preview-title">Preview (first {previewRows.length} rows):</div>
              <div className="import-modal-preview-table">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(previewRows[0]).slice(0,6).map((h) => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, idx) => (
                      <tr key={idx}>
                        {Object.keys(r).slice(0,6).map((k) => <td key={k}>{r[k]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="import-modal-actions">
            <button
              type="button"
              onClick={handleImport}
              disabled={!isReady || isImporting}
              className="primary-button"
            >
              {isImporting ? "Importing..." : "Start Import"}
            </button>
            <button type="button" onClick={handleClose} className="secondary-button" disabled={isImporting}>
              Cancel
            </button>
          </div>
        </form>

        <div className="import-modal-summary">
          <div><strong>Imported:</strong> {successCount}</div>
          <div><strong>Errors:</strong> {errors.length}</div>
          {errors.length > 0 && (
            <div className="import-modal-error-list">
              <ul>
                {errors.slice(0, 50).map((err, i) => (
                  <li key={i}>
                    {err.row ? `Row ${err.row}: ` : ""}{err.reason} {err.rowData ? ` — ${err.rowData.companyName || err.rowData.email || ''}` : ''}
                  </li>
                ))}
              </ul>
              {errors.length > 50 && <div className="import-modal-too-many">Showing first 50 errors...</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Use portal to ensure modal mounts at document body level
  return typeof document !== "undefined" ? ReactDOM.createPortal(modalContent, document.body) : modalContent;
}

export default ImportCsvModal;
