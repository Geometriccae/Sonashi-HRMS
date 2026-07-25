const VIEWER_ROLE = "viewer";
const AUTHORIZE_USER_ROLE = "authorize_user";

const READ_ONLY_ROLES = new Set([VIEWER_ROLE, AUTHORIZE_USER_ROLE]);

const isReadOnlyRole = (role) => READ_ONLY_ROLES.has(String(role || "").toLowerCase());

const blockViewerWrites = (req, res, next) => {
  if (isReadOnlyRole(req.user?.role)) {
    return res.status(403).json({
      message:
        "This role has read-only access. You can only approve or reject leave requests.",
    });
  }
  next();
};

module.exports = {
  blockViewerWrites,
  VIEWER_ROLE,
  AUTHORIZE_USER_ROLE,
  isReadOnlyRole,
  READ_ONLY_ROLES,
};
