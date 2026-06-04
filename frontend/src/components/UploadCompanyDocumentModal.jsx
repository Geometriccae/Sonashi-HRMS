import React, { useState, useEffect } from "react";
import styles from "./AddUserModal.module.css";

const initialForm = {
  particulars: "",
  docNumber: "",
  issueDate: "",
  expiryDate: "",
};

const UploadCompanyDocumentModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setFormData(initialForm);
      setFile(null);
      setError("");
    }
  }, [isOpen]);

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
      if (!file) {
        throw new Error("Please select a file to upload");
      }

      await onSubmit({ ...formData, file });
      setFormData(initialForm);
      setFile(null);
    } catch (err) {
      setError(err.message || "Failed to upload document");
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
          <h2>Upload Company Document</h2>
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
            <input
              type="date"
              id="issueDate"
              name="issueDate"
              value={formData.issueDate}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="expiryDate">Doc Expiry Date</label>
            <input
              type="date"
              id="expiryDate"
              name="expiryDate"
              value={formData.expiryDate}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="file">Upload File *</label>
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
              {loading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadCompanyDocumentModal;
