import config, { getApiBaseUrl } from "../config/config";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

class SifService {
  constructor() {
    const raw = (config.API_BASE_URL || "").trim();
    let apiRoot;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      apiRoot = raw.replace(/\/$/, "");
      if (!apiRoot.endsWith("/api")) {
        apiRoot = apiRoot.endsWith("/") ? `${apiRoot}api` : `${apiRoot}/api`;
      }
    } else {
      const host = getApiBaseUrl();
      apiRoot = host ? `${host.replace(/\/$/, "")}/api` : "/api";
    }
    this.baseURL = `${apiRoot}/sif`;
  }

  getAuthToken() {
    return localStorage.getItem("token");
  }

  getAuthHeaders(json = true) {
    const token = this.getAuthToken();
    const headers = {};
    if (token && token !== "null" && token !== "undefined") {
      headers.Authorization = `Bearer ${token}`;
    }
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async getSettings() {
    const res = await fetch(`${this.baseURL}/settings`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to load SIF settings");
    return res.json();
  }

  async saveSettings(payload) {
    const res = await fetch(`${this.baseURL}/settings`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to save SIF settings");
    return res.json();
  }

  async previewExport(month, year) {
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    const res = await fetch(`${this.baseURL}/export/sif/preview?${params}`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Preview failed");
    return res.json();
  }

  async exportSif(month, year) {
    const params = new URLSearchParams({ month: String(month), year: String(year) });
    const res = await fetch(`${this.baseURL}/export/sif?${params}`, {
      headers: this.getAuthHeaders(false),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "SIF export failed");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const fileName = match?.[1] || `export_${year}_${month}.SIF`;
    saveAs(blob, fileName);

    let skipped = [];
    const skipHeader = res.headers.get("X-SIF-Skip-Summary");
    if (skipHeader) {
      try {
        skipped = JSON.parse(atob(skipHeader));
      } catch {
        skipped = [];
      }
    }
    return {
      fileName,
      edrCount: Number(res.headers.get("X-SIF-Edr-Count") || 0),
      skippedCount: Number(res.headers.get("X-SIF-Skipped") || 0),
      totalSalary: Number(res.headers.get("X-SIF-Total") || 0),
      skipped,
    };
  }

  async importSif(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseURL}/import/sif`, {
      method: "POST",
      headers: this.getAuthHeaders(false),
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "SIF import failed");
    return data;
  }

  async exportExcel(month, year) {
    const res = await fetch(`${this.baseURL}/export/excel-data`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Excel export failed");
    }
    const { headers, redHeaders, rows } = await res.json();
    const redSet = new Set(redHeaders || []);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("SIF");
    sheet.addRow(headers);

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      cell.font = {
        bold: true,
        color: redSet.has(header) ? { argb: "FFFF0000" } : { argb: "FF000000" },
      };
      if (redSet.has(header)) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFF99" },
        };
      }
    });

    rows.forEach((row) => {
      sheet.addRow(headers.map((h) => row[h]));
    });

    headers.forEach((h, i) => {
      sheet.getColumn(i + 1).width = Math.max(12, h.length + 4);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `SIF_Employees_${year || "all"}_${month || "all"}.xlsx`;
    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      fileName
    );
    return { fileName, rowCount: rows.length };
  }

  async importExcel(file) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${this.baseURL}/import/excel`, {
      method: "POST",
      headers: this.getAuthHeaders(false),
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Excel import failed");
    return data;
  }
}

const sifService = new SifService();
export default sifService;
