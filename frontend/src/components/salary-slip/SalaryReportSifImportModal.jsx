import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "./SalaryReportSifImportModal.module.css";
import sifService from "../../services/SifService";
import { MONTH_NAMES } from "../../utils/salarySlipPeriodFilter";
import { buildYearList } from "../../utils/yearOptions";

function SalaryReportSifImportModal({
  isOpen,
  onClose,
  onSuccess,
  defaultMonth,
  defaultYear,
  canManage = true,
  showToast,
}) {
  const [activeTab, setActiveTab] = useState("upload");
  const [month, setMonth] = useState(defaultMonth || new Date().getMonth() + 1);
  const [year, setYear] = useState(defaultYear || new Date().getFullYear());
  const [employerId, setEmployerId] = useState("");
  const [employers, setEmployers] = useState([]);

  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionError, setActionError] = useState("");

  const [currentBatch, setCurrentBatch] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [rejectPromptOpen, setRejectPromptOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const fileInputRef = useRef(null);

  const notify = useCallback(
    (msg, type = "info") => {
      if (typeof showToast === "function") showToast(msg, type);
      else if (type === "error") alert(msg);
      else console.log(msg);
    },
    [showToast]
  );

  useEffect(() => {
    if (!isOpen) return;
    sifService
      .getSettings()
      .then((s) => {
        const list = Array.isArray(s.employers) ? s.employers : [];
        setEmployers(list);
        if (!employerId && s.employerId) {
          setEmployerId(s.employerId);
        }
      })
      .catch(() => {});
  }, [isOpen, employerId]);

  const loadHistory = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const data = await sifService.getImportBatches();
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      notify(err.message || "Failed to load import history", "error");
    } finally {
      setLoadingBatches(false);
    }
  }, [notify]);

  useEffect(() => {
    if (isOpen && activeTab === "history") {
      loadHistory();
    }
  }, [isOpen, activeTab, loadHistory]);

  if (!isOpen) return null;

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleProcessUpload(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleProcessUpload(file);
  };

  const handleProcessUpload = async (file) => {
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".sif") && !name.endsWith(".txt")) {
      notify("Please upload a valid .xlsx, .xls, or .sif file.", "error");
      return;
    }

    setIsUploading(true);
    setActionError("");
    try {
      const res = await sifService.uploadImportBatch(file, {
        month,
        year,
        employerId,
      });
      setCurrentBatch(res.batch);
      notify(
        `File staged: ${res.batch.summary?.totalRecords || 0} records evaluated. Review changes below before approving.`,
        "success"
      );
    } catch (err) {
      setActionError(err.message || "Failed to parse and stage file.");
      notify(err.message || "Failed to stage file.", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleApproveBatch = async () => {
    if (!currentBatch) return;
    if (!window.confirm("Approve and apply this salary import to employee records? This action will update employee salary details.")) {
      return;
    }

    setIsApproving(true);
    setActionError("");
    try {
      const res = await sifService.approveImportBatch(currentBatch.batchId);
      setCurrentBatch(res.batch);
      notify(`Approved! ${res.updatedCount || 0} employee records updated.`, "success");
      if (typeof onSuccess === "function") onSuccess();
    } catch (err) {
      setActionError(err.message || "Approval failed");
      notify(err.message || "Approval failed", "error");
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectBatch = async () => {
    if (!currentBatch) return;
    setIsRejecting(true);
    setActionError("");
    try {
      const res = await sifService.rejectImportBatch(currentBatch.batchId, rejectionReason);
      setCurrentBatch(res.batch);
      setRejectPromptOpen(false);
      setRejectionReason("");
      notify("Import batch rejected. No employee database records were modified.", "info");
    } catch (err) {
      setActionError(err.message || "Rejection failed");
      notify(err.message || "Rejection failed", "error");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleDownloadSif = async () => {
    if (!currentBatch) return;
    try {
      await sifService.downloadApprovedBatchSif(currentBatch.batchId);
      notify("SIF file downloaded.", "success");
    } catch (err) {
      notify(err.message || "Download failed", "error");
    }
  };

  const handleDownloadPdf = async () => {
    if (!currentBatch) return;
    try {
      await sifService.downloadApprovedBatchPdf(currentBatch.batchId);
      notify("Supporting PDF downloaded.", "success");
    } catch (err) {
      notify(err.message || "Download failed", "error");
    }
  };

  const handleViewHistoricalBatch = async (batchId) => {
    try {
      const full = await sifService.getImportBatch(batchId);
      setCurrentBatch(full);
      setActiveTab("upload");
    } catch (err) {
      notify(err.message || "Failed to load batch", "error");
    }
  };

  // Filter staged records
  const records = currentBatch?.records || [];
  const filteredRecords = records.filter((r) => {
    if (filter === "changed" && !r.isChanged) return false;
    if (filter === "warnings" && r.validationStatus !== "Warning") return false;
    if (filter === "invalid" && r.validationStatus !== "Invalid") return false;
    if (search) {
      const term = search.toLowerCase();
      const idMatch = (r.employeeId || "").toLowerCase().includes(term);
      const nameMatch = (r.empName || "").toLowerCase().includes(term);
      const agentMatch = (r.uploaded?.agentCode || "").toLowerCase().includes(term);
      if (!idMatch && !nameMatch && !agentMatch) return false;
    }
    return true;
  });

  const years = buildYearList(2020, 2035);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h3 className={styles.modalHeaderTitle}>Import Salary Report / SIF</h3>
            <p className={styles.modalHeaderSubtitle}>
              Upload edited Excel (.xlsx) or WPS SIF (.sif) files with staged preview, validation, and authorized approval.
            </p>
          </div>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNav}>
          <button
            className={`${styles.tabBtn} ${activeTab === "upload" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            {currentBatch ? `Review & Approve (${currentBatch.batchId})` : "Upload & Validate"}
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "history" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("history")}
          >
            Import History & Audit
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {actionError && (
            <div style={{ padding: "0.75rem 1rem", background: "#fee2e2", color: "#b91c1c", borderRadius: "8px", marginBottom: "1rem" }}>
              {actionError}
            </div>
          )}

          {activeTab === "upload" && (
            <>
              {/* If no batch loaded, show Upload area */}
              {!currentBatch ? (
                <div>
                  <div
                    className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      accept=".xlsx,.xls,.sif,.txt"
                      onChange={handleFileInputChange}
                    />
                    <div className={styles.dropzoneIcon}>📁</div>
                    <div className={styles.dropzoneTitle}>
                      {isUploading ? "Uploading & Validating File…" : "Drag & drop your Salary Report Excel or SIF file"}
                    </div>
                    <div className={styles.dropzoneHint}>
                      Supports .xlsx, .xls, and .sif files. No database records are modified upon upload.
                    </div>
                  </div>

                  {/* Target Parameters */}
                  <div className={styles.paramsRow}>
                    <label className={styles.paramField}>
                      <span>Payroll Month</span>
                      <select
                        className={styles.selectInput}
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={name} value={idx + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.paramField}>
                      <span>Payroll Year</span>
                      <select
                        className={styles.selectInput}
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                      >
                        {years.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={styles.paramField}>
                      <span>Target Employer ID (Optional)</span>
                      <select
                        className={styles.selectInput}
                        value={employerId}
                        onChange={(e) => setEmployerId(e.target.value)}
                      >
                        <option value="">All / Auto-detect from file</option>
                        {employers.map((emp) => (
                          <option key={emp.employerId} value={emp.employerId}>
                            {`${emp.companyName ? `${emp.companyName} — ` : ""}${emp.employerId}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              ) : (
                /* Staged Review Screen */
                <div>
                  {/* Status Banner */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Batch ID: </span>
                      <strong style={{ fontSize: "0.95rem", color: "#0f172a" }}>{currentBatch.batchId}</strong>
                      <span style={{ margin: "0 0.5rem", color: "#cbd5e1" }}>|</span>
                      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>File: </span>
                      <strong>{currentBatch.fileName}</strong>
                      <span style={{ margin: "0 0.5rem", color: "#cbd5e1" }}>|</span>
                      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>Period: </span>
                      <strong>{`${MONTH_NAMES[currentBatch.month - 1] || currentBatch.month} ${currentBatch.year}`}</strong>
                    </div>

                    <div>
                      <span
                        className={`${styles.badge} ${
                          currentBatch.status === "Approved" || currentBatch.status === "Applied"
                            ? styles.badgeApproved
                            : currentBatch.status === "Rejected"
                            ? styles.badgeRejected
                            : styles.badgePending
                        }`}
                      >
                        ● {currentBatch.status}
                      </span>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className={styles.summaryBanner}>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryCardLabel}>Total Records</span>
                      <span className={styles.summaryCardValue}>{currentBatch.summary?.totalRecords || 0}</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryCardLabel}>Valid Records</span>
                      <span className={styles.summaryCardValue} style={{ color: "#16a34a" }}>
                        {currentBatch.summary?.validCount || 0}
                      </span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryCardLabel}>Warnings / Discrepancies</span>
                      <span className={styles.summaryCardValue} style={{ color: "#d97706" }}>
                        {currentBatch.summary?.warningCount || 0}
                      </span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryCardLabel}>Invalid (Excluded)</span>
                      <span className={styles.summaryCardValue} style={{ color: "#dc2626" }}>
                        {currentBatch.summary?.invalidCount || 0}
                      </span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryCardLabel}>Changes Detected</span>
                      <span className={styles.summaryCardValue} style={{ color: "#2563eb" }}>
                        {currentBatch.summary?.changedCount || 0}
                      </span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryCardLabel}>Total SIF Net Pay</span>
                      <span className={styles.summaryCardValue}>
                        AED {(currentBatch.summary?.totalSalary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Filter and Search Controls */}
                  <div className={styles.filterRow}>
                    <div className={styles.filterPills}>
                      <button
                        className={`${styles.filterPill} ${filter === "all" ? styles.filterPillActive : ""}`}
                        onClick={() => setFilter("all")}
                      >
                        All ({records.length})
                      </button>
                      <button
                        className={`${styles.filterPill} ${filter === "changed" ? styles.filterPillActive : ""}`}
                        onClick={() => setFilter("changed")}
                      >
                        Changed Only ({currentBatch.summary?.changedCount || 0})
                      </button>
                      <button
                        className={`${styles.filterPill} ${filter === "warnings" ? styles.filterPillActive : ""}`}
                        onClick={() => setFilter("warnings")}
                      >
                        Warnings ({currentBatch.summary?.warningCount || 0})
                      </button>
                      <button
                        className={`${styles.filterPill} ${filter === "invalid" ? styles.filterPillActive : ""}`}
                        onClick={() => setFilter("invalid")}
                      >
                        Invalid ({currentBatch.summary?.invalidCount || 0})
                      </button>
                    </div>

                    <input
                      type="text"
                      className={styles.searchInput}
                      placeholder="Search Employee ID, Name, Agent Code…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  {/* Staged Comparison Table */}
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Emp ID</th>
                          <th>Employee Name</th>
                          <th>Basic Pay</th>
                          <th>HRA</th>
                          <th>Deduction</th>
                          <th>Net Pay</th>
                          <th>Agent Code</th>
                          <th>Bank Account / IBAN</th>
                          <th>Validation Notes & Changes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.length > 0 ? (
                          filteredRecords.map((r, idx) => {
                            const isChanged = r.isChanged;
                            const basicChanged = Math.abs(r.uploaded.basicSalary - r.existing.basicSalary) > 0.01;
                            const hraChanged = Math.abs(r.uploaded.houseRent - r.existing.houseRent) > 0.01;
                            const dedChanged = Math.abs(r.uploaded.deduction - r.existing.deduction) > 0.01;
                            const netChanged = Math.abs(r.uploaded.totalSalary - r.existing.totalSalary) > 0.01;
                            const agentChanged = r.uploaded.agentCode && r.existing.agentCode && r.uploaded.agentCode !== r.existing.agentCode;

                            return (
                              <tr key={idx}>
                                <td>
                                  <span
                                    className={`${styles.badge} ${
                                      r.validationStatus === "Valid"
                                        ? styles.badgeValid
                                        : r.validationStatus === "Warning"
                                        ? styles.badgeWarning
                                        : styles.badgeInvalid
                                    }`}
                                  >
                                    {r.validationStatus}
                                  </span>
                                </td>
                                <td><strong>{r.employeeId}</strong></td>
                                <td>{r.empName}</td>
                                <td>
                                  {basicChanged && <span className={styles.oldValue}>{r.existing.basicSalary.toFixed(2)}</span>}
                                  <span className={basicChanged ? styles.changedValue : ""}>
                                    {r.uploaded.basicSalary.toFixed(2)}
                                  </span>
                                </td>
                                <td>
                                  {hraChanged && <span className={styles.oldValue}>{r.existing.houseRent.toFixed(2)}</span>}
                                  <span className={hraChanged ? styles.changedValue : ""}>
                                    {r.uploaded.houseRent.toFixed(2)}
                                  </span>
                                </td>
                                <td>
                                  {dedChanged && <span className={styles.oldValue}>{r.existing.deduction.toFixed(2)}</span>}
                                  <span className={dedChanged ? styles.changedValue : ""}>
                                    {r.uploaded.deduction.toFixed(2)}
                                  </span>
                                </td>
                                <td>
                                  {netChanged && <span className={styles.oldValue}>{r.existing.totalSalary.toFixed(2)}</span>}
                                  <span className={netChanged ? styles.changedValue : ""} style={{ fontWeight: "700" }}>
                                    {r.uploaded.totalSalary.toFixed(2)}
                                  </span>
                                </td>
                                <td>
                                  {agentChanged && <span className={styles.oldValue}>{r.existing.agentCode}</span>}
                                  <span className={agentChanged ? styles.changedValue : ""}>
                                    {r.uploaded.agentCode || "—"}
                                  </span>
                                </td>
                                <td>{r.uploaded.bankAccount || r.existing.bankAccount || "—"}</td>
                                <td>
                                  {r.issues?.map((iss, i) => (
                                    <span key={i} className={r.validationStatus === "Invalid" ? styles.issueTag : styles.warningTag}>
                                      ⚠ {iss}
                                    </span>
                                  ))}
                                  {r.changes?.map((chg, i) => (
                                    <span key={i} style={{ display: "block", fontSize: "0.75rem", color: "#2563eb" }}>
                                      ✎ {chg}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={10} className={styles.emptyState}>
                              No records match the selected filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Rejection Prompt Box */}
                  {rejectPromptOpen && (
                    <div style={{ marginTop: "1rem", padding: "1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>
                      <label style={{ display: "block", fontWeight: "600", fontSize: "0.85rem", color: "#991b1b", marginBottom: "0.5rem" }}>
                        Specify reason for rejection:
                      </label>
                      <input
                        type="text"
                        style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", border: "1px solid #fca5a5", marginBottom: "0.75rem" }}
                        placeholder="e.g. Discrepancies in agent routing codes or invalid amounts"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className={styles.dangerBtn} onClick={handleRejectBatch} disabled={isRejecting}>
                          {isRejecting ? "Rejecting…" : "Confirm Rejection"}
                        </button>
                        <button className={styles.secondaryBtn} onClick={() => setRejectPromptOpen(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === "history" && (
            <div>
              {loadingBatches ? (
                <div className={styles.emptyState}>Loading import history…</div>
              ) : batches.length > 0 ? (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Batch ID</th>
                        <th>File Name & Type</th>
                        <th>Payroll Period</th>
                        <th>Uploaded By & Date</th>
                        <th>Summary</th>
                        <th>Status</th>
                        <th>Approved / Rejected By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.batchId}>
                          <td><strong>{b.batchId}</strong></td>
                          <td>
                            {b.fileName}
                            <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b" }}>
                              {b.fileType?.toUpperCase()}
                            </span>
                          </td>
                          <td>{`${MONTH_NAMES[b.month - 1] || b.month} ${b.year}`}</td>
                          <td>
                            {b.uploadedBy}
                            <span style={{ display: "block", fontSize: "0.7rem", color: "#64748b" }}>
                              {new Date(b.uploadedAt).toLocaleDateString("en-GB")}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.78rem" }}>
                              {`${b.summary?.totalRecords || 0} total (${b.summary?.validCount || 0} valid, ${b.summary?.warningCount || 0} warn, ${b.summary?.invalidCount || 0} inv)`}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`${styles.badge} ${
                                b.status === "Approved" || b.status === "Applied"
                                  ? styles.badgeApproved
                                  : b.status === "Rejected"
                                  ? styles.badgeRejected
                                  : styles.badgePending
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td>
                            {b.approvedBy ? (
                              <span style={{ color: "#15803d" }}>
                                Approved by {b.approvedBy} ({new Date(b.approvedAt).toLocaleDateString("en-GB")})
                              </span>
                            ) : b.rejectedBy ? (
                              <span style={{ color: "#b91c1c" }}>
                                Rejected by {b.rejectedBy} ({new Date(b.rejectedAt).toLocaleDateString("en-GB")})
                              </span>
                            ) : (
                              <span style={{ color: "#64748b" }}>Awaiting Review</span>
                            )}
                          </td>
                          <td>
                            <button
                              className={styles.secondaryBtn}
                              style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                              onClick={() => handleViewHistoricalBatch(b.batchId)}
                            >
                              View / Review
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={styles.emptyState}>No salary report imports found in history.</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <div>
            {currentBatch && (
              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  setCurrentBatch(null);
                  setRejectPromptOpen(false);
                }}
              >
                ← Upload Different File
              </button>
            )}
          </div>

          <div className={styles.footerActions}>
            {currentBatch && currentBatch.status === "Pending" && canManage && (
              <>
                <button
                  className={styles.dangerBtn}
                  onClick={() => setRejectPromptOpen(true)}
                  disabled={isApproving || isRejecting}
                >
                  Reject Import
                </button>
                <button
                  className={styles.successBtn}
                  onClick={handleApproveBatch}
                  disabled={isApproving || isRejecting || (currentBatch.summary?.validCount === 0 && currentBatch.summary?.warningCount === 0)}
                  title="Approve validated changes and update database records"
                >
                  {isApproving ? "Applying Changes…" : "Approve & Apply Changes"}
                </button>
              </>
            )}

            {currentBatch && (currentBatch.status === "Approved" || currentBatch.status === "Applied") && (
              <>
                <button className={styles.primaryBtn} onClick={handleDownloadSif}>
                  Download Approved SIF
                </button>
                <button className={styles.secondaryBtn} onClick={handleDownloadPdf}>
                  Download Supporting PDF
                </button>
              </>
            )}

            <button className={styles.secondaryBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalaryReportSifImportModal;

