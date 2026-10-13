import config from "../config/config";

// API_BASE_URL already includes /api; append /documents
const apiRoot = (config.API_BASE_URL || "").replace(/\/$/, "");
const baseUrl = apiRoot.endsWith("/api")
  ? `${apiRoot}/documents`
  : `${apiRoot}/api/documents`;

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const listByClient = async (clientId) => {
  const response = await fetch(`${baseUrl}/${clientId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch documents");
  return response.json();
};

const uploadForClient = async (clientId, file, { type } = {}) => {
  const formData = new FormData();
  formData.append("file", file);
  if (type) formData.append("type", type);
  // Uploader identity is derived by the server from the bearer token.

  const response = await fetch(`${baseUrl}/${clientId}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload document");
  return response.json();
};

const remove = async (docId) => {
  const response = await fetch(`${baseUrl}/${docId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to delete document");
  return response.json();
};

const DocumentsService = { listByClient, uploadForClient, remove };
export default DocumentsService;
