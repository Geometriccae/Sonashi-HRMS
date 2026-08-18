const path = require("path");
const fs = require("fs");

const SERVER_DIR = path.join(__dirname, "..");
const PARENT_DIR = path.join(SERVER_DIR, "..");

function isInsideServerDir(p) {
  const resolved = path.resolve(p).toLowerCase();
  const server = path.resolve(SERVER_DIR).toLowerCase();
  return resolved === server || resolved.startsWith(server + path.sep);
}

/**
 * WRITE root: always outer Hostinger/project uploads (sibling of server/), never server/uploads.
 * Prefer UPLOADS_ROOT env, then ../@uploads, then ../uploads (create ../uploads if missing).
 */
function getUploadsRoot() {
  const fromEnv = (process.env.UPLOADS_ROOT || "").trim();
  const outerAt = path.join(PARENT_DIR, "@uploads");
  const outerUploads = path.join(PARENT_DIR, "uploads");

  let chosen;
  if (fromEnv) {
    chosen = path.resolve(fromEnv);
  } else if (fs.existsSync(outerAt) && fs.statSync(outerAt).isDirectory()) {
    chosen = outerAt;
  } else if (fs.existsSync(outerUploads) && fs.statSync(outerUploads).isDirectory()) {
    chosen = outerUploads;
  } else {
    chosen = outerUploads;
  }

  // Never write under server/ — force the sibling outer folder.
  if (isInsideServerDir(chosen)) {
    chosen = outerUploads;
  }

  fs.mkdirSync(chosen, { recursive: true });
  return chosen;
}

/** Read roots: write root first, then legacy locations (including old server/uploads). */
function listUploadRoots() {
  const roots = [
    getUploadsRoot(),
    path.join(PARENT_DIR, "@uploads"),
    path.join(PARENT_DIR, "uploads"),
    path.join(SERVER_DIR, "uploads"), // legacy READ only
    path.join(PARENT_DIR, "Uploades"),
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

/**
 * Try several on-disk locations for a stored filePath.
 * Returns absolute path if found, otherwise null.
 */
function resolveUploadDiskPath(filePath) {
  if (!filePath) return null;

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

/**
 * Ensure a subdirectory under the OUTER uploads root exists; return absolute path.
 * Never writes under server/uploads.
 */
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
  resolveUploadDiskPath,
  ensureUploadSubdir,
  SERVER_DIR,
  PARENT_DIR,
};
