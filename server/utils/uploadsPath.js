const path = require("path");
const fs = require("fs");

const SERVER_DIR = path.join(__dirname, "..");
const PARENT_DIR = path.join(SERVER_DIR, "..");

/**
 * Uploads root from UPLOADS_ROOT in .env.
 * Local example: ../uploads
 * Hostinger: /home/u435871798/domains/backend.sonashi.in/uploads
 */
function getUploadsRoot() {
  const fromEnv = (process.env.UPLOADS_ROOT || "").trim();
  const chosen = fromEnv
    ? path.resolve(fromEnv)
    : path.join(PARENT_DIR, "uploads");
  fs.mkdirSync(chosen, { recursive: true });
  return chosen;
}

function listUploadRoots() {
  const roots = [
    getUploadsRoot(),
    path.join(PARENT_DIR, "@uploads"),
    path.join(PARENT_DIR, "uploads"),
    path.join(SERVER_DIR, "uploads"),
  ];
  return [...new Set(roots.map((p) => path.resolve(p)))];
}

function normalizeUploadRelative(filePath) {
  if (!filePath) return "";
  return String(filePath)
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^Uploades\//i, "uploads/")
    .replace(/^@uploads\//i, "uploads/")
    .replace(
      /uploads\/employeedocuments\/employeedocuments\//gi,
      "uploads/employeeDocuments/"
    )
    .replace(
      /uploads\/employeeDocuments\/employeeDocuments\//gi,
      "uploads/employeeDocuments/"
    );
}

function findFileByBasename(dir, basename, maxDepth) {
  if (!dir || maxDepth < 0) return null;
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === basename) return full;
      if (entry.isDirectory()) {
        const nested = findFileByBasename(full, basename, maxDepth - 1);
        if (nested) return nested;
      }
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

function buildUploadCandidates(filePath) {
  const relative = normalizeUploadRelative(filePath);
  const basename = path.basename(relative);
  const uniqueRoots = listUploadRoots();
  const candidates = [];

  for (const root of uniqueRoots) {
    const underUploads = relative
      .replace(/^uploads\//i, "")
      .replace(/^@uploads\//i, "");
    candidates.push(path.join(root, underUploads));
    candidates.push(path.join(root, relative));

    const underEmpDocs = underUploads
      .replace(/^employeedocuments\//i, "")
      .replace(/^employeeDocuments\//i, "");
    candidates.push(path.join(root, "employeeDocuments", underEmpDocs));
    candidates.push(path.join(root, "employeedocuments", underEmpDocs));
    candidates.push(path.join(root, "employeeDocuments", basename));
    candidates.push(path.join(root, "employeedocuments", basename));
  }

  return { relative, basename, uniqueRoots, candidates };
}

function resolveUploadDiskPath(filePath) {
  if (!filePath) return null;

  const { uniqueRoots, basename, candidates } = buildUploadCandidates(filePath);

  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch (_) {
      /* ignore */
    }
  }

  if (basename) {
    for (const root of uniqueRoots) {
      for (const folder of ["employeeDocuments", "employeedocuments"]) {
        const found = findFileByBasename(path.join(root, folder), basename, 4);
        if (found) return found;
      }
    }
  }
  return null;
}

function ensureUploadSubdir(...parts) {
  const root = getUploadsRoot();
  const dir = path.join(root, ...parts);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

module.exports = {
  getUploadsRoot,
  listUploadRoots,
  normalizeUploadRelative,
  buildUploadCandidates,
  resolveUploadDiskPath,
  ensureUploadSubdir,
  SERVER_DIR,
  PARENT_DIR,
};
