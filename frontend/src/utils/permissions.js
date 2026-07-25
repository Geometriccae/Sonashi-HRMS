export const ROLES = {
  ADMIN: "admin",
  HR: "hr",
  HOD: "hod",
  VIEWER: "viewer",
  AUTHORIZE_USER: "authorize_user",
};

export const getUserRole = () => localStorage.getItem("role") || "";

export const isViewer = (role = getUserRole()) => role === ROLES.VIEWER;

export const isAuthorizeUser = (role = getUserRole()) =>
  role === ROLES.AUTHORIZE_USER;

/** Viewer + Authorize User: leave approve/reject + view; no employee/payroll edits */
export const isReadOnlyRole = (role = getUserRole()) =>
  isViewer(role) || isAuthorizeUser(role);

export const canLogin = (role) =>
  role === ROLES.ADMIN ||
  role === ROLES.HR ||
  role === ROLES.VIEWER ||
  role === ROLES.AUTHORIZE_USER;

export const isViewOnly = (role = getUserRole()) => isReadOnlyRole(role);

export const canEdit = (role = getUserRole()) => !isReadOnlyRole(role);

export const canDelete = (role = getUserRole()) => !isReadOnlyRole(role);

export const isAdmin = (role = getUserRole()) =>
  role === ROLES.ADMIN || role === ROLES.HOD;

export const canManageUsers = (role = getUserRole()) =>
  role === ROLES.ADMIN || role === ROLES.HOD;

export const canManageLeaves = (role = getUserRole()) =>
  role === ROLES.ADMIN ||
  role === ROLES.HOD ||
  role === ROLES.HR ||
  role === ROLES.VIEWER ||
  role === ROLES.AUTHORIZE_USER;

export const canApproveLeaves = (role = getUserRole()) =>
  role === ROLES.ADMIN ||
  role === ROLES.VIEWER ||
  role === ROLES.AUTHORIZE_USER;

export const canCreateLeaves = (role = getUserRole()) =>
  !isReadOnlyRole(role) &&
  (role === ROLES.HR || role === ROLES.ADMIN || role === ROLES.HOD);

export const canEditLeaves = (role = getUserRole()) =>
  !isReadOnlyRole(role) &&
  (role === ROLES.HR || role === ROLES.ADMIN || role === ROLES.HOD);

export const canManageSlips = (role = getUserRole()) =>
  !isReadOnlyRole(role) && (role === ROLES.ADMIN || role === ROLES.HOD);
