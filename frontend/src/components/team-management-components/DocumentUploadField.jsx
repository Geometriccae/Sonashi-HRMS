import React from "react";

function DocumentUploadField({
  label,
  field,
  file,
  existingDocument,
  hasError,
  onUpload,
  optional,
}) {
  const fileInputRef = React.useRef(null);
  const [previewImageUrl, setPreviewImageUrl] = React.useState("");

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      onUpload(field, selectedFile);
    }
  };

  const displayFileName = file?.name || existingDocument?.fileName || "Upload File";
  const hasAnyDocument = Boolean(file || existingDocument);
  const isExistingImage =
    Boolean(existingDocument?.fileType && String(existingDocument.fileType).toLowerCase().startsWith("image/")) ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(existingDocument?.fileName || "");

  const handleViewCurrent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!existingDocument?.filePath) return;
    if (isExistingImage) {
      setPreviewImageUrl(existingDocument.filePath);
      return;
    }
    window.open(existingDocument.filePath, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`document-upload-field ${hasError ? "has-error" : ""}`}>
      <label className="document-label">
        {label}{" "}
        {!optional && <span className="required-star">*</span>}
        {optional && (
          <span style={{ fontSize: 12, color: "#666", fontWeight: 400 }}>
            {" "}
            (optional)
          </span>
        )}
      </label>
      <div
        className={`document-upload-box ${hasAnyDocument ? "uploaded" : ""}`}
        onClick={handleUploadClick}
      >
        <div className="upload-box-content">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {hasAnyDocument ? (
              <path
                d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
                stroke="#48bb78"
              />
            ) : (
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            )}
            {hasAnyDocument && (
              <polyline
                points="22 4 12 14.01 9 11.01"
                stroke="#48bb78"
              />
            )}
          </svg>
          <span className="upload-box-text">
            {displayFileName}
          </span>
        </div>
      </div>
      {existingDocument?.filePath && !file && (
        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button
            type="button"
            onClick={handleViewCurrent}
            style={{
              background: "transparent",
              border: "none",
              color: "#2563eb",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            View current document
          </button>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Click box to replace</span>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        style={{ display: "none" }}
        accept=".pdf,.jpg,.jpeg,.png"
      />
      {previewImageUrl && (
        <div
          onClick={() => setPreviewImageUrl("")}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.72)",
            zIndex: 4000,
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
              maxWidth: "90vw",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
            }}
          >
            <button
              type="button"
              onClick={() => setPreviewImageUrl("")}
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
              aria-label="Close preview"
            >
              ×
            </button>
            <img
              src={previewImageUrl}
              alt={existingDocument?.fileName || "Uploaded document"}
              style={{ display: "block", maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentUploadField;
