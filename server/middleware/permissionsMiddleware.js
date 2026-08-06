const VIEWER_ROLE = "viewer";
const AUTHORIZE_USER_ROLE = "authorize_user";

const READ_ONLY_ROLES = new Set([VIEWER_ROLE, AUTHORIZE_USER_ROLE]);

/** Narrow employee fields Authorize User may update for vacation return dates. */
const VACATION_RETURN_KEYS = new Set([
  "vacationStatus",
  "returnDate",
  "firstWorkingDay",
  "lastWorkingDay",
  "travellingDate",
  "attendance",
]);

const isReadOnlyRole = (role) => READ_ONLY_ROLES.has(String(role || "").toLowerCase());

const parseUpdateBody = (body) => {
  if (!body || typeof body !== "object") return null;
  if (body.data && typeof body.data === "string") {
    try {
      return JSON.parse(body.data);
    } catch {
      return null;
    }
  }
  return body;
};

const isVacationReturnOnlyBody = (body) => {
  const data = parseUpdateBody(body);
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const keys = Object.keys(data).filter((k) => data[k] !== undefined);
  if (keys.length === 0) return false;
  return keys.every((k) => VACATION_RETURN_KEYS.has(k));
};

const blockViewerWrites = (req, res, next) => {
  if (isReadOnlyRole(req.user?.role)) {
    return res.status(403).json({
      message:
        "This role has read-only access. You can only approve or reject leave requests.",
    });
  }
  next();
};

/**
 * Like blockViewerWrites, but Authorize User may update vacation return date fields only.
 * Viewer remains fully read-only on employee writes.
 */
const blockViewerWritesAllowVacationReturn = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === AUTHORIZE_USER_ROLE && isVacationReturnOnlyBody(req.body)) {
    return next();
  }
  return blockViewerWrites(req, res, next);
};

module.exports = {
  blockViewerWrites,
  blockViewerWritesAllowVacationReturn,
  isVacationReturnOnlyBody,
  VIEWER_ROLE,
  AUTHORIZE_USER_ROLE,
  isReadOnlyRole,
  READ_ONLY_ROLES,
  VACATION_RETURN_KEYS,
};
