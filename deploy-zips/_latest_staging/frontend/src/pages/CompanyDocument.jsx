import React, { useState, useEffect } from "react";
import { writePersistedPath } from "../hooks/usePersistedListPage";
import styles from "./CompanyDocument.module.css";
import Side from "./sidebar/Sidebar";
import TopNavbar, { PageBody, pageLayoutStyles } from "../components/TopNavbar";
import DeleteModal from "../components/delete-modal/DeleteModal";
import UploadCompanyDocumentModal from "../components/UploadCompanyDocumentModal";
import CompanyDocumentService from "../services/CompanyDocumentService";
import { buildImageUrl } from "../config/config";
import { useToast } from "../context/ToastContext";
import { canEdit } from "../utils/permissions";

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
  const { showToast } = useToast();
  const canEditDocuments = canEdit();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [docToEdit, setDocToEdit] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
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
    writePersistedPath("company-document", "/company-document");
    fetchDocuments();
  }, []);

  const handleOpenAdd = () => {
    setDocToEdit(null);
    setIsUploadModalOpen(true);
  };

  const handleEditClick = (doc) => {
    setDocToEdit(doc);
    setIsUploadModalOpen(true);
  };

  const handleModalClose = () => {
    setIsUploadModalOpen(false);
    setDocToEdit(null);
  };

  const handleSubmit = async (formData) => {
    const isEdit = Boolean(formData.documentId);

    if (isEdit) {
      await CompanyDocumentService.update(formData.documentId, formData.file, {
        particulars: formData.particulars,
        docNumber: formData.docNumber,
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate,
      });
      showToast("Document updated successfully.", "success");
    } else {
      await CompanyDocumentService.upload(formData.file, {
        particulars: formData.particulars,
        docNumber: formData.docNumber,
        issueDate: formData.issueDate,
        expiryDate: formData.expiryDate,
        uploadedBy: localStorage.getItem("username") || "",
        userRole: localStorage.getItem("role") || "",
      });
      showToast("Document added successfully.", "success");
    }

    await fetchDocuments();
    handleModalClose();
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
    <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
      <div className={styles["desktop-sidebar"]}>
        <Side />
      </div>
      <main className={pageLayoutStyles.pageMain}>
        <TopNavbar title="Company Document" breadcrumb="Company Document" />

        <PageBody className={styles.container}>
          <div className={styles.header}>
            <h1>Company Document</h1>
            {canEditDocuments && (
              <button
                className={styles.uploadButton}
                onClick={handleOpenAdd}
              >
                +Add
              </button>
            )}
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
                  <th>{canEditDocuments ? "Actions" : "View"}</th>
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
                        {canEditDocuments && (
                          <>
                            <button
                              className={styles.editButton}
                              onClick={() => handleEditClick(doc)}
                            >
                              Edit
                            </button>
                            <button
                              className={styles.deleteButton}
                              onClick={() => handleDeleteClick(doc)}
                            >
                              Delete
                            </button>
                          </>
                        )}
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
            onClose={handleModalClose}
            onSubmit={handleSubmit}
            documentToEdit={docToEdit}
          />
        </PageBody>
      </main>
    </div>
  );
};

export default CompanyDocument;
