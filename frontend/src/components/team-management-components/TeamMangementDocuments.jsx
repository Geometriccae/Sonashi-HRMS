import React, { useEffect, useRef, useState } from "react";
import styles from "./TeamManagementDocuments.module.css";
import DataTable from "../DataTable";
import DocumentsService from "../../services/EmployeeDocumentService";
import config from "../../config/config";

const DOC_TYPE_OPTIONS = [
  "Passport", "Emirates ID", "Visa", "Labour Card", "Work Permit",
  "Offer Letter", "Contract", "Bank Details", "Medical", "Insurance",
  "Certificate", "Extra", "Other"
];

/* ─────────────────────────────────────────────
   Edit Document Modal — requires a new file upload
───────────────────────────────────────────── */
function EditDocumentModal({ item, onClose, onSave }) {
  const [type, setType] = useState(item?.type || "Extra");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError("Please select a new file to upload."); return; }
    setSaving(true);
    try {
      await onSave(item.id, file, type);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to replace document");
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
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>Replace Document</h3>
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
              onChange={(e) => setType(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8,
                border: "1.5px solid #e2e8f0", fontSize: 14,
                background: "#fff", cursor: "pointer", outline: "none", boxSizing: "border-box"
              }}
            >
              {DOC_TYPE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
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
              type="submit"
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
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageName, setPreviewImageName] = useState("");
  const [editItem, setEditItem] = useState(null);
  const apiHost = (config.API_BASE_URL || "").replace(/\/api\/?$/, "");
  const userRole = localStorage.getItem("role") || "";
  const isAdmin = userRole === "admin" || userRole === "hod";

  const buildDocumentUrl = (path) => {
    if (!path) return "";
    const cleaned = String(path).replace(
      /\/uploads\/employeedocuments\/employeedocuments\//g,
      "/uploads/employeedocuments/"
    );
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
      filePath: buildDocumentUrl(d.filePath),
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
              filePath: buildDocumentUrl(updated.filePath),
              uploadedDate: updated.uploadedDate
                ? new Date(updated.uploadedDate).toLocaleDateString() : d.uploadedDate,
            }
          : d
      )
    );
  };

  if (loading) return <div className="documents-loading">Loading documents...</div>;
  if (error) return <div className="documents-error">{error}</div>;

  return (
    <div className={styles.container}>
      <section className={styles["documents-table-section"]}>
        <DataTable
          data={documents}
          onOpen={(item) => {
            if (!item?.filePath) return;
            const isImage =
              String(item.filetype || "").toLowerCase().startsWith("image/") ||
              /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(item.fileName || "");
            if (isImage) {
              setPreviewImageUrl(item.filePath);
              setPreviewImageName(item.fileName || "Image");
              return;
            }
            window.open(item.filePath, "_blank", "noopener,noreferrer");
          }}
          onEdit={isAdmin ? (item) => setEditItem(item) : undefined}
          onDelete={isAdmin ? async (docId) => {
            await DocumentsService.remove(docId);
            setDocuments(prev => prev.filter(d => d.id !== docId));
          } : undefined}
        />
      </section>

      {/* Image Preview */}
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl("")}
          style={{
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.72)",
            zIndex: 4500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative", maxWidth: "92vw", maxHeight: "92vh",
              background: "#fff", borderRadius: 12, overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewImageUrl("")}
              aria-label="Close preview"
              style={{
                position: "absolute", top: 8, right: 8, border: "none",
                background: "rgba(0,0,0,0.65)", color: "#fff",
                borderRadius: 8, width: 32, height: 32,
                cursor: "pointer", fontSize: 18, lineHeight: 1,
              }}
            >×</button>
            <img
              src={previewImageUrl}
              alt={previewImageName || "Document preview"}
              style={{ display: "block", maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain" }}
            />
          </div>
        </div>
      )}

      {/* Replace Document Modal */}
      {editItem && (
        <EditDocumentModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleReplace}
        />
      )}
    </div>
  );
}

export default TeamManagementDocuments;
