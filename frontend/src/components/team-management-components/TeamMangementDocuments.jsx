// import React from "react";
// import styles from "./TeamManagementDocuments.module.css";
// import Sidebar from "../../pages/sidebar/Sidebar";
// import DataTable from "../DataTable";

// function TeamManagementDocuments() {
//   return (
//     <div className="">
//       <section className={styles["documents-table-section"]}>
//         <DataTable data={documentsData} />
//       </section>
//     </div>
//   );
// }

// export default TeamManagementDocuments;

import React, { useEffect, useState } from "react";
import styles from "./TeamManagementDocuments.module.css";
import DataTable from "../DataTable";
import DocumentsService from "../../services/EmployeeDocumentService";
import config from "../../config/config";

function TeamManagementDocuments({ employeeId, refreshKey }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const [previewImageName, setPreviewImageName] = useState("");
  const apiHost = (config.API_BASE_URL || "").replace(/\/api\/?$/, "");

  const buildDocumentUrl = (path) => {
    if (!path) return "";
    const cleaned = String(path).replace(
      /\/uploads\/employeedocuments\/employeedocuments\//g,
      "/uploads/employeedocuments/"
    );
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    return `${apiHost}${cleaned}`;
  };
  

 useEffect(() => {
    if (!employeeId) return;
    const fetchDocs = async () => {
      try {
        setLoading(true);
        const docs = await DocumentsService.listByEmployee(employeeId);
        const mapped = docs.map(d => ({
          id: d._id,
          fileName: d.fileName,
          fileSize: `${Math.max(1, Math.round((d.fileSize || 0) / 1024))} KB`,
          fileType: (d.fileType || '').includes('image') ? 'image' : (d.fileType || '').includes('video') ? 'video' : 'document',
          type: d.type || 'Extra',
          uploadedBy: d.uploadedBy || 'Unknown',
          userRole: d.userRole || '',
          filetype: d.fileType || '',
          uploadedDate: d.uploadedDate ? new Date(d.uploadedDate).toLocaleDateString() : '',
          filePath: buildDocumentUrl(d.filePath),
        }));
        setDocuments(mapped);
        setError(null);
      } catch (e) {
        setError(e.message || 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [employeeId, refreshKey]);

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
          onDelete={async (docId) => {
            await DocumentsService.remove(docId);
            // Refresh list locally
            setDocuments(prev => prev.filter(d => d.id !== docId));
          }}
          // You can add additional props for employee-specific actions
        />
      </section>
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl("")}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.72)",
            zIndex: 4500,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              maxWidth: "92vw",
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewImageUrl("")}
              aria-label="Close preview"
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                border: "none",
                background: "rgba(0,0,0,0.65)",
                color: "#fff",
                borderRadius: 8,
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <img
              src={previewImageUrl}
              alt={previewImageName || "Document preview"}
              style={{ display: "block", maxWidth: "92vw", maxHeight: "92vh", objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamManagementDocuments;
