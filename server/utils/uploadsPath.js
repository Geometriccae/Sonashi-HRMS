const path = require("path");
const fs = require("fs");

const SERVER_DIR = path.join(__dirname, "..");

/**
 * Resolve the uploads root used for employee/company/etc files.
 * Prefers server/uploads (Hostinger extract + local server folder),
 * then monorepo ../uploads next to Sonashi-HRMS/server.
 */
function getUploadsRoot() {
  const candidates = [
    path.join(SERVER_DIR, "uploads"),
    path.join(SERVER_DIR, "..", "uploads"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  const preferred = candidates[0];
  fs.mkdirSync(preferred, { recursive: true });
  return preferred;
}

function normalizeUploadRelative(filePath) {
  if (!filePath) return "";
  return String(filePath)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Uploades\//i, "uploads/")
    .replace(/^uploads\/employeeDocuments\//i, "uploads/employeedocuments/")
    .replace(/uploads\/employeedocuments\/employeedocuments\//gi, "uploads/employeedocuments/");
}

/**
 * Try several on-disk locations for a stored filePath.
 * Returns absolute path if found, otherwise null.
 */
function resolveUploadDiskPath(filePath) {
  if (!filePath) return null;

  const relative = normalizeUploadRelative(filePath);
  const basename = path.basename(relative);
  const uploadsRoot = getUploadsRoot();
  const altRoots = [
    uploadsRoot,
    path.join(SERVER_DIR, "uploads"),
    path.join(SERVER_DIR, "..", "uploads"),
    path.join(SERVER_DIR, "..", "Uploades"),
  ];

  const uniqueRoots = [...new Set(altRoots.map((p) => path.resolve(p)))];
  const candidates = [];

  for (const root of uniqueRoots) {
    // Full relative path under uploads root (strip leading "uploads/")
    const underUploads = relative.replace(/^uploads\//i, "");
    candidates.push(path.join(root, underUploads));
    candidates.push(path.join(root, relative));
    // Legacy flat files: uploads/employeedocuments/<filename>
    candidates.push(path.join(root, "employeedocuments", basename));
    candidates.push(path.join(root, "employeeDocuments", basename));
  }

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch (_) {
      /* ignore */
    }
  }
  return null;
}

module.exports = {
  getUploadsRoot,
  normalizeUploadRelative,
  resolveUploadDiskPath,
  SERVER_DIR,
};
