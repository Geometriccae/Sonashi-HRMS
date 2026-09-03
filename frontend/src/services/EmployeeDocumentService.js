import config from "../config/config";

const apiRoot = (config.API_BASE_URL || "").replace(/\/$/, "");
const baseUrl = `${apiRoot}/employeedocuments`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Stable viewer URL — uses API file route from frontend/.env (REACT_APP_API_URL). */
const getFileUrl = (docId) => {
  if (!docId) return "";
  return `${baseUrl}/file/${docId}`;
};

const listByEmployee = async (employeeId) => {
  const response = await fetch(`${baseUrl}/${employeeId}`);
  if (!response.ok) throw new Error("Failed to fetch documents");
  return response.json();
};

const uploadForEmployee = async (employeeId, file, { type } = {}) => {
  const formData = new FormData();
  // Type must be appended before file so multer can select the destination.
  // Uploader identity is derived by the server from the bearer token.
  if (type) formData.append("type", type);
  formData.append("file", file);

  const response = await fetch(`${baseUrl}/${employeeId}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload document");
  return response.json();
};

const remove = async (docId) => {
  const response = await fetch(`${baseUrl}/${docId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete document");
  return response.json();
};

const removeAll = async (employeeId) => {
  const response = await fetch(`${baseUrl}/all/${employeeId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete all documents");
  return response.json();
};

const replace = async (docId, file, type) => {
  const formData = new FormData();
  formData.append("file", file);
  if (type) formData.append("type", type);
  const response = await fetch(`${baseUrl}/${docId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to replace document");
  return response.json();
};

const updateType = async (docId, type) => {
  const response = await fetch(`${baseUrl}/${docId}/type`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });
  if (!response.ok) throw new Error("Failed to update document type");
  return response.json();
};

const DocumentsService = {
  listByEmployee,
  uploadForEmployee,
  remove,
  removeAll,
  replace,
  updateType,
  getFileUrl,
};

export default DocumentsService;


