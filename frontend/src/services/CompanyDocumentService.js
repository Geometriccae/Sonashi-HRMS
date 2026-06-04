import config from "../config/config";

const apiRoot = (config.API_BASE_URL || "").replace(/\/$/, "");
const baseUrl = `${apiRoot}/company-documents`;

const getAuthToken = () => localStorage.getItem("token");

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();

  if (!response.ok) {
    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text);
        throw new Error(json.error || json.message || "Request failed");
      } catch (e) {
        if (e.message !== "Request failed") throw e;
      }
    }
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  if (contentType.includes("application/json")) {
    return JSON.parse(text);
  }
  return text;
}

const getAll = async () => {
  const response = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  return parseResponse(response);
};

const upload = async (file, { particulars, docNumber, issueDate, expiryDate, uploadedBy, userRole } = {}) => {
  const formData = new FormData();
  formData.append("particulars", particulars || "");
  formData.append("docNumber", docNumber || "");
  if (issueDate) formData.append("issueDate", issueDate);
  if (expiryDate) formData.append("expiryDate", expiryDate);
  if (uploadedBy) formData.append("uploadedBy", uploadedBy);
  if (userRole) formData.append("userRole", userRole);
  formData.append("file", file);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: formData,
  });
  return parseResponse(response);
};

const remove = async (docId) => {
  const response = await fetch(`${baseUrl}/${docId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  return parseResponse(response);
};

const CompanyDocumentService = { getAll, upload, remove };
export default CompanyDocumentService;
