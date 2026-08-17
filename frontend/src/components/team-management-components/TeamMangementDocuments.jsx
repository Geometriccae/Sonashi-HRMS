import React, { useEffect, useRef, useState } from "react";
import styles from "./TeamManagementDocuments.module.css";
import DataTable from "../DataTable";
import DocumentsService from "../../services/EmployeeDocumentService";
import config from "../../config/config";

export const DOC_TYPE_OPTIONS = [
  "Passport", "Emirates ID", "Visa", "Labour Card", "Work Permit",
  "Offer Letter", "Contract", "Bank Details", "Medical", "Insurance",
  "Certificate", "Extra", "Other"
];

/* ─────────────────────────────────────────────
   Edit Document Modal — requires a new file upload
───────────────────────────────────────────── */
function EditDocumentModal({ item, onClose, onSave, onAdd }) {
  const [type, setType] = useState(item?.type || "Extra");
  const [isCustomType, setIsCustomType] = useState(false);
  const [customType, setCustomType] = useState("");
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const picked = e.target.files?.[0];
    if (picked) { setFile(picked); setError(""); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) { setFile(dropped); setError(""); }
  };

  const handleSubmit = async (e, actionType) => {
    e.preventDefault();
    const finalType = isCustomType ? customType : type;
    if (!file) { setError("Please select a new file to upload."); return; }
    if (!finalType) { setError("Please specify the document type."); return; }
    
    setSaving(true);
    try {
      if (actionType === "replace") {
        await onSave(item.id, file, finalType);
      } else if (actionType === "add") {
        await onAdd(file, finalType);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Failed to process document");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
        zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 18, padding: "32px 28px",
          width: "100%", maxWidth: 460,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)"
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Edit Document</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              Current: <span style={{ fontWeight: 600, color: "#334155" }}>{item?.fileName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}
            aria-label="Close"
          >×</button>
        </div>

        <form style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "#2563eb" : file ? "#22c55e" : "#cbd5e1"}`,
              borderRadius: 12,
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "#eff6ff" : file ? "#f0fdf4" : "#f8fafc",
              transition: "all 0.2s"
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            {file ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                <div style={{ fontWeight: 700, color: "#15803d", fontSize: 14, marginBottom: 4 }}>
                  {file.name}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {(file.size / 1024).toFixed(1)} KB — click to change
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📁</div>
                <div style={{ fontWeight: 600, color: "#334155", fontSize: 14, marginBottom: 4 }}>
                  Click or drag & drop to upload new file
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  The old document will be replaced
                </div>
              </>
            )}
          </div>

          {/* Type */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
              Document Type
            </label>
            <select
              value={type}
              onChange={(e) => {
                if (e.target.value === "ADD_CUSTOM") {
                  setIsCustomType(true);
                  setType("ADD_CUSTOM");
                } else {
                  setIsCustomType(false);
                  setType(e.target.value);
                }
              }}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                border: "1.5px solid #e2e8f0", fontSize: 14,
                background: "#fff", cursor: "pointer", outline: "none", boxSizing: "border-box"
              }}
            >
              {DOC_TYPE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              <option value="ADD_CUSTOM">+ Add Custom Type</option>
            </select>
            
            {isCustomType && (
              <input
                type="text"
                placeholder="Enter custom document type"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  border: "1.5px solid #e2e8f0", fontSize: 14,
                  marginTop: 8, boxSizing: "border-box", outline: "none"
                }}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              color: "#dc2626", fontSize: 13, fontWeight: 600,
              background: "#fef2f2", padding: "10px 14px",
              borderRadius: 8, border: "1px solid #fecaca"
            }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "11px", borderRadius: 8,
                border: "1.5px solid #e2e8f0", background: "#f8fafc",
                color: "#475569", fontWeight: 600, cursor: "pointer", fontSize: 14
              }}
            >Cancel</button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, "add")}
              disabled={saving || !file}
              style={{
                flex: 2, padding: "11px", borderRadius: 8, border: "none",
                background: saving || !file ? "#86efac" : "#16a34a",
                color: "#fff", fontWeight: 700,
                cursor: saving || !file ? "not-allowed" : "pointer", fontSize: 14,
                transition: "background 0.15s"
              }}
            >{saving ? "Uploading..." : "Add as New Doc"}</button>
            <button
              type="button"
              onClick={(e) => handleSubmit(e, "replace")}
              disabled={saving || !file}
              style={{
                flex: 2, padding: "11px", borderRadius: 8, border: "none",
                background: saving || !file ? "#93c5fd" : "#2563eb",
                color: "#fff", fontWeight: 700,
                cursor: saving || !file ? "not-allowed" : "pointer", fontSize: 14,
                transition: "background 0.15s"
              }}
            >{saving ? "Uploading..." : "Upload & Replace"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Documents Component
───────────────────────────────────────────── */
function TeamManagementDocuments({ employeeId, refreshKey }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [setTypeValue, setSetTypeValue] = useState("");
  const [setTypeSaving, setSetTypeSaving] = useState(false);
  const [setTypeMsg, setSetTypeMsg] = useState("");
  const [editItem, setEditItem] = useState(null);
  const apiHost = (config.API_BASE_URL || "").replace(/\/api\/?$/, "");
  const userRole = localStorage.getItem("role") || "";
  const isAdmin = userRole !== "viewer" && (userRole === "admin" || userRole === "hod");
  const isLocalHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  /** Prefer local API file route; on localhost fall back to production if disk file is missing. */
  const getDocumentFetchUrls = (item) => {
    const urls = [];
    if (item?.filePath) urls.push(item.filePath);
    if (item?.id && isLocalHost) {
      const prod = `https://backend.sonashi.in/api/employeedocuments/file/${item.id}`;
      if (!urls.includes(prod)) urls.push(prod);
    }
    return urls;
  };

  const fetchDocumentResponse = async (item) => {
    const urls = getDocumentFetchUrls(item);
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { method: "GET" });
        if (response.ok) return response;
        const msg = await response.text().catch(() => "");
        lastError = new Error(msg || `HTTP ${response.status}`);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error("File missing");
  };

  const buildDocumentUrl = (path, docId) => {
    // Prefer API file route so server can resolve server/uploads vs ../uploads
    if (docId) return DocumentsService.getFileUrl(docId);
    if (!path) return "";
    const cleaned = String(path).replace(
      /\/uploads\/employeedocuments\/employeedocuments\//g,
      "/uploads/employeeDocuments/"
    )
    .replace(/\/uploads\/employeedocuments\//gi, "/uploads/employeeDocuments/");
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    const host = apiHost.replace(/\/$/, "");
    const relativePath = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
    return `${host}${relativePath}`;
  };

  useEffect(() => {
    if (!employeeId) return;
    const fetchDocs = async () => {
      try {
        setLoading(true);
        const docs = await DocumentsService.listByEmployee(employeeId);
        setDocuments(mapDocs(docs));
        setError(null);
      } catch (e) {
        setError(e.message || "Failed to load documents");
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [employeeId, refreshKey]);

  const mapDocs = (docs) =>
    docs.map(d => ({
      id: d._id,
      fileName: d.fileName,
      fileSize: `${Math.max(1, Math.round((d.fileSize || 0) / 1024))} KB`,
      fileType: (d.fileType || "").includes("image") ? "image"
        : (d.fileType || "").includes("video") ? "video" : "document",
      type: d.type || "Extra",
      uploadedBy: d.uploadedBy || "Unknown",
      userRole: d.userRole || "",
      filetype: d.fileType || "",
      uploadedDate: d.uploadedDate ? new Date(d.uploadedDate).toLocaleDateString() : "",
      filePath: buildDocumentUrl(d.filePath, d._id),
    }));

  const handleReplace = async (docId, file, type) => {
    const updated = await DocumentsService.replace(docId, file, type);
    setDocuments(prev =>
      prev.map(d =>
        d.id === docId
          ? {
              ...d,
              fileName: updated.fileName,
              fileSize: `${Math.max(1, Math.round((updated.fileSize || 0) / 1024))} KB`,
              fileType: (updated.fileType || "").includes("image") ? "image"
                : (updated.fileType || "").includes("video") ? "video" : "document",
              filetype: updated.fileType || "",
              type: updated.type || d.type,
              filePath: buildDocumentUrl(updated.filePath, updated._id || docId),
              uploadedDate: updated.uploadedDate
                ? new Date(updated.uploadedDate).toLocaleDateString() : d.uploadedDate,
            }
          : d
      )
    );
  };

  const handleAddFromEdit = async (file, type) => {
    const newDoc = await DocumentsService.uploadForEmployee(employeeId, file, { 
      type, 
      uploadedBy: "Current User", 
      userRole: "Sales Executive" 
    });
    const mapped = mapDocs([newDoc]);
    setDocuments(prev => [...prev, ...mapped]);
  };

  const closePreview = () => {
    if (previewDoc?._blobUrl) {
      try {
        URL.revokeObjectURL(previewDoc._blobUrl);
      } catch (_) {
        /* ignore */
      }
    }
    setPreviewDoc(null);
    setSetTypeMsg("");
  };

  const downloadDocument = async (doc, { saveAs = false } = {}) => {
    if (!doc?.filePath && !doc?.id) return;
    try {
      const response = await fetchDocumentResponse(doc);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = doc.fileName || (saveAs ? "document-save" : "document");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      alert(
        err?.message?.includes("missing") || err?.message?.includes("not found")
          ? `File missing on server for "${doc.fileName || "document"}". Please re-upload this document.`
          : `Unable to open "${doc.fileName || "document"}". Please re-upload if the file is missing.`
      );
    }
  };

  const handleSetDocumentType = async () => {
    if (!previewDoc?.id || !setTypeValue) return;
    setSetTypeSaving(true);
    setSetTypeMsg("");
    try {
      const updated = await DocumentsService.updateType(previewDoc.id, setTypeValue);
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === previewDoc.id ? { ...d, type: updated.type || setTypeValue } : d
        )
      );
      setPreviewDoc((prev) => (prev ? { ...prev, type: updated.type || setTypeValue } : prev));
      setSetTypeMsg("Document type updated");
    } catch (err) {
      setSetTypeMsg(err.message || "Failed to set type");
    } finally {
      setSetTypeSaving(false);
    }
  };

  if (loading) return <div className="documents-loading">Loading documents...</div>;
  if (error) return <div className="documents-error">{error}</div>;

  return (
    <div className={styles.container}>
      <section className={styles["documents-table-section"]}>
        <DataTable
          data={documents}
          onOpen={async (item) => {
            if (!item?.filePath) return;
            const isImage =
              String(item.filetype || "").toLowerCase().startsWith("image/") ||
              /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(item.fileName || "");
            try {
              const response = await fetchDocumentResponse(item);
              if (isImage) {
                // Use blob URL so preview works whether local or production fallback served the bytes
                const blob = await response.blob();
                const objectUrl = URL.createObjectURL(blob);
                setPreviewDoc({ ...item, filePath: objectUrl, _blobUrl: objectUrl });
                setSetTypeValue(item.type || "Extra");
                setSetTypeMsg("");
                return;
              }
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              window.open(objectUrl, "_blank", "noopener,noreferrer");
              setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
            } catch (err) {
              alert(
                `File missing on server for "${item.fileName || "document"}".\n\nThe upload record exists, but the file is not on disk.\nPlease re-upload this document.\n\nTip: when redeploying backend, keep the outer "uploads" folder.`
              );
            }
          }}
          onEdit={isAdmin ? (item) => setEditItem(item) : undefined}
          onDelete={isAdmin ? async (docId) => {
            await DocumentsService.remove(docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
          } : undefined}
        />
      </section>

      {/* Image Preview with Save / Download / Set */}
      {previewDoc && (
        <div
          onClick={closePreview}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.72)",
            zIndex: 4500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "92vw",
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderBottom: "1px solid #e2e8f0",
                background: "linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "42vw" }}>
                  {previewDoc.fileName || "Document"}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  Type: <strong style={{ color: "#0057b5" }}>{previewDoc.type || "Extra"}</strong>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => downloadDocument(previewDoc, { saveAs: true })}
                  style={{
                    border: "1px solid #c5ddf0", background: "#fff", color: "#004494",
                    borderRadius: 8, padding: "8px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => downloadDocument(previewDoc)}
                  style={{
                    border: "none",
                    background: "linear-gradient(135deg, #0078e7, #0057b5)",
                    color: "#fff",
                    borderRadius: 8, padding: "8px 12px", fontWeight: 600, fontSize: 13, cursor: "pointer",
                    boxShadow: "0 2px 8px rgba(0,87,181,0.28)",
                  }}
                >
                  Download
                </button>

                {isAdmin && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <select
                      value={setTypeValue}
                      onChange={(e) => setSetTypeValue(e.target.value)}
                      style={{
                        border: "1px solid #c5ddf0", borderRadius: 8, padding: "7px 10px",
                        fontSize: 13, color: "#0f172a", background: "#fff",
                      }}
                      aria-label="Set document type"
                    >
                      {DOC_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleSetDocumentType}
                      disabled={setTypeSaving || !setTypeValue || setTypeValue === previewDoc.type}
                      style={{
                        border: "1px solid #0057b5",
                        background: setTypeSaving ? "#94a3b8" : "#e8f2fc",
                        color: "#004494",
                        borderRadius: 8, padding: "8px 12px", fontWeight: 700, fontSize: 13,
                        cursor: setTypeSaving || setTypeValue === previewDoc.type ? "not-allowed" : "pointer",
                        opacity: setTypeValue === previewDoc.type ? 0.65 : 1,
                      }}
                    >
                      {setTypeSaving ? "Setting..." : "Set"}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={closePreview}
                  aria-label="Close preview"
                  style={{
                    border: "none",
                    background: "rgba(15,23,42,0.75)", color: "#fff",
                    borderRadius: 8, width: 32, height: 32,
                    cursor: "pointer", fontSize: 18, lineHeight: 1,
                  }}
                >×</button>
              </div>
            </div>

            {setTypeMsg && (
              <div style={{
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                color: setTypeMsg.includes("Failed") ? "#b91c1c" : "#065f46",
                background: setTypeMsg.includes("Failed") ? "#fef2f2" : "#ecfdf5",
              }}>
                {setTypeMsg}
              </div>
            )}

            <div style={{ overflow: "auto", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img
                src={previewDoc.filePath}
                alt={previewDoc.fileName || "Document preview"}
                style={{ display: "block", maxWidth: "92vw", maxHeight: "78vh", objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Replace Document Modal */}
      {editItem && (
        <EditDocumentModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleReplace}
          onAdd={handleAddFromEdit}
        />
      )}
    </div>
  );
}

export default TeamManagementDocuments;
