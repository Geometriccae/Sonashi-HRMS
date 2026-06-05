import config from "../config/config";

const apiRoot = (config.API_BASE_URL || "").replace(/\/$/, "");
const baseUrl = `${apiRoot}/employeedocuments`;

const listByEmployee = async (employeeId) => {
  const response = await fetch(`${baseUrl}/${employeeId}`);
  if (!response.ok) throw new Error("Failed to fetch documents");
  return response.json();
};

const uploadForEmployee = async (employeeId, file, { uploadedBy, userRole, type } = {}) => {
  const formData = new FormData();
  // IMPORTANT: type, uploadedBy, userRole must be appended BEFORE file
  // so that req.body.type is available in multer's destination callback
  if (type) formData.append("type", type);
  if (uploadedBy) formData.append("uploadedBy", uploadedBy);
  if (userRole) formData.append("userRole", userRole);
  formData.append("file", file);

  const response = await fetch(`${baseUrl}/${employeeId}`, {
    method: "POST",
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
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to replace document");
  return response.json();
};

const DocumentsService = { listByEmployee, uploadForEmployee, remove, removeAll, replace };

export default DocumentsService;


