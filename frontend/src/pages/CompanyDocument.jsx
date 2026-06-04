import React, { useState, useEffect } from "react";
import styles from "./CompanyDocument.module.css";
import Side from "./sidebar/Sidebar";
import ProfileAvatar from "../components/ProfileAvatar";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import NotificationBell from "../components/NotificationBell";
import DeleteModal from "../components/delete-modal/DeleteModal";
import UploadCompanyDocumentModal from "../components/UploadCompanyDocumentModal";
import CompanyDocumentService from "../services/CompanyDocumentService";
import { buildImageUrl } from "../config/config";

const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const CompanyDocument = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setRole(localStorage.getItem("role") || "");
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const data = await CompanyDocumentService.getAll();
      setDocuments(data);
      setError(null);
    } catch (err) {
      setError("Failed to fetch company documents");
      console.error("Error fetching company documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleUpload = async (formData) => {
    await CompanyDocumentService.upload(formData.file, {
      particulars: formData.particulars,
      docNumber: formData.docNumber,
      issueDate: formData.issueDate,
      expiryDate: formData.expiryDate,
      uploadedBy: localStorage.getItem("username") || "",
      userRole: localStorage.getItem("role") || "",
    });
    await fetchDocuments();
    setIsUploadModalOpen(false);
  };

  const handleDeleteClick = (doc) => {
    setDocToDelete(doc);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!docToDelete) return;
    try {
      await CompanyDocumentService.remove(docToDelete._id);
      await fetchDocuments();
    } catch (err) {
      console.error("Error deleting document:", err);
      alert(err?.message || "Failed to delete document");
    } finally {
      setIsDeleteModalOpen(false);
      setDocToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false);
    setDocToDelete(null);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading company documents...</div>
      </div>
    );
  }

  return (
    <div className={styles["dashboard-layout"]}>
      <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Company Document</div>
            <div className={styles["dashboard-profile"]}>
              <NotificationBell />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username?.toUpperCase()}</div>
                    <div className={styles["profile-type"]}>{role || ""}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>CompanyDocument</div>
          </div>
        </section>

        <div className={styles.container}>
          <div className={styles.header}>
            <h1>Company Document</h1>
            <button
              className={styles.uploadButton}
              onClick={() => setIsUploadModalOpen(true)}
            >
              Upload
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Sl. No</th>
                  <th>Particulars</th>
                  <th>Number</th>
                  <th>Issue Date</th>
                  <th>Expiry Till</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles.noData}>
                      No company documents found
                    </td>
                  </tr>
                ) : (
                  documents.map((doc, index) => (
                    <tr key={doc._id}>
                      <td>{index + 1}</td>
                      <td>{doc.particulars}</td>
                      <td>{doc.docNumber || "-"}</td>
                      <td>{formatDate(doc.issueDate)}</td>
                      <td>{formatDate(doc.expiryDate)}</td>
                      <td>
                        {doc.filePath && (
                          <a
                            href={buildImageUrl(doc.filePath)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.viewButton}
                          >
                            View
                          </a>
                        )}
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDeleteClick(doc)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <DeleteModal
            isOpen={isDeleteModalOpen}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
            title={docToDelete ? `Delete ${docToDelete.particulars}?` : "Delete document?"}
            description={
              docToDelete
                ? `Are you sure you want to delete "${docToDelete.particulars}"? This action cannot be undone.`
                : "Are you sure you want to delete this document?"
            }
          />

          <UploadCompanyDocumentModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onSubmit={handleUpload}
          />
        </div>
      </main>
    </div>
  );
};

export default CompanyDocument;
