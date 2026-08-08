import React, { useState, useEffect } from "react";
import styles from "./AddUserModal.module.css";
import DateInput from "./DateInput";

const initialForm = {
  particulars: "",
  docNumber: "",
  issueDate: "",
  expiryDate: "",
};

const toInputDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const UploadCompanyDocumentModal = ({ isOpen, onClose, onSubmit, documentToEdit = null }) => {
  const isEditMode = Boolean(documentToEdit);
  const [formData, setFormData] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (documentToEdit) {
        setFormData({
          particulars: documentToEdit.particulars || "",
          docNumber: documentToEdit.docNumber || "",
          issueDate: toInputDate(documentToEdit.issueDate),
          expiryDate: toInputDate(documentToEdit.expiryDate),
        });
      } else {
        setFormData(initialForm);
      }
      setFile(null);
      setError("");
    }
  }, [isOpen, documentToEdit]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!formData.particulars.trim()) {
        throw new Error("Particulars is required");
      }
      if (!isEditMode && !file) {
        throw new Error("Please select a file to upload");
      }

      await onSubmit({ ...formData, file, documentId: documentToEdit?._id });
      setFormData(initialForm);
      setFile(null);
    } catch (err) {
      setError(err.message || (isEditMode ? "Failed to update document" : "Failed to upload document"));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData(initialForm);
      setFile(null);
      setError("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>{isEditMode ? "Edit Company Document" : "Add Company Document"}</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            disabled={loading}
            type="button"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.formGroup}>
            <label htmlFor="particulars">Particulars *</label>
            <input
              type="text"
              id="particulars"
              name="particulars"
              value={formData.particulars}
              onChange={handleInputChange}
              required
              disabled={loading}
              placeholder="e.g. Trade License Joint Ven Trading Main"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="docNumber">Doc Number</label>
            <input
              type="text"
              id="docNumber"
              name="docNumber"
              value={formData.docNumber}
              onChange={handleInputChange}
              disabled={loading}
              placeholder="Enter document number"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="issueDate">Doc Issue Date</label>
            <DateInput
              id="issueDate"
              name="issueDate"
              value={formData.issueDate}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="expiryDate">Doc Expiry Date</label>
            <DateInput
              id="expiryDate"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="file">
              {isEditMode ? "Replace File (optional)" : "Upload File *"}
            </label>
            <input
              type="file"
              id="file"
              name="file"
              onChange={handleFileChange}
              disabled={loading}
              accept="*/*"
            />
            {file && (
              <small style={{ display: "block", marginTop: "6px", color: "#666" }}>
                Selected: {file.name}
              </small>
            )}
            {isEditMode && documentToEdit?.fileName && !file && (
              <small style={{ display: "block", marginTop: "6px", color: "#666" }}>
                Current file: {documentToEdit.fileName}
              </small>
            )}
          </div>

          <div className={styles.formActions}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? (isEditMode ? "Saving..." : "Uploading...") : isEditMode ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadCompanyDocumentModal;
