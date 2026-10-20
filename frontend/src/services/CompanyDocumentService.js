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

const getCompanies = async () => {
  const response = await fetch(`${baseUrl}/companies`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  return parseResponse(response);
};

const createCompany = async ({ particulars, companyCode, employerId }) => {
  const response = await fetch(`${baseUrl}/companies`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ particulars, companyCode, employerId }),
  });
  const company = await parseResponse(response);
  window.dispatchEvent(new Event("companies-changed"));
  return company;
};

const deleteCompany = async (companyId) => {
  const response = await fetch(`${baseUrl}/companies/${companyId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
  const result = await parseResponse(response);
  window.dispatchEvent(new Event("companies-changed"));
  return result;
};

const upload = async (file, { particulars, docNumber, issueDate, expiryDate } = {}) => {
  const formData = new FormData();
  formData.append("particulars", particulars || "");
  formData.append("docNumber", docNumber || "");
  if (issueDate) formData.append("issueDate", issueDate);
  if (expiryDate) formData.append("expiryDate", expiryDate);
  // Uploader identity is derived by the server from the bearer token.
  formData.append("file", file);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: formData,
  });
  return parseResponse(response);
};

const update = async (docId, file, { particulars, docNumber, issueDate, expiryDate } = {}) => {
  const formData = new FormData();
  formData.append("particulars", particulars || "");
  formData.append("docNumber", docNumber || "");
  if (issueDate) formData.append("issueDate", issueDate);
  if (expiryDate) formData.append("expiryDate", expiryDate);
  if (file) formData.append("file", file);

  const response = await fetch(`${baseUrl}/${docId}`, {
    method: "PUT",
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

const CompanyDocumentService = {
  getAll,
  getCompanies,
  createCompany,
  deleteCompany,
  upload,
  update,
  remove,
};
export default CompanyDocumentService;
