export const ROLES = {
  ADMIN: "admin",
  HR: "hr",
  HOD: "hod",
  VIEWER: "viewer",
};

export const getUserRole = () => localStorage.getItem("role") || "";

export const isViewer = (role = getUserRole()) => role === ROLES.VIEWER;

export const canLogin = (role) =>
  role === ROLES.ADMIN || role === ROLES.HR || role === ROLES.VIEWER;

export const isViewOnly = (role = getUserRole()) => isViewer(role);

export const canEdit = (role = getUserRole()) => !isViewer(role);

export const canDelete = (role = getUserRole()) => !isViewer(role);

export const isAdmin = (role = getUserRole()) =>
  role === ROLES.ADMIN || role === ROLES.HOD;

export const canManageUsers = (role = getUserRole()) =>
  role === ROLES.ADMIN || role === ROLES.HOD;

export const canManageLeaves = (role = getUserRole()) =>
  role === ROLES.ADMIN || role === ROLES.HOD || role === ROLES.HR || role === ROLES.VIEWER;

export const canApproveLeaves = (role = getUserRole()) =>
  role === ROLES.ADMIN || role === ROLES.VIEWER;

export const canCreateLeaves = (role = getUserRole()) =>
  !isViewer(role) && (role === ROLES.HR || role === ROLES.ADMIN || role === ROLES.HOD);

export const canEditLeaves = (role = getUserRole()) =>
  !isViewer(role) && (role === ROLES.HR || role === ROLES.ADMIN || role === ROLES.HOD);

export const canManageSlips = (role = getUserRole()) =>
  !isViewer(role) && (role === ROLES.ADMIN || role === ROLES.HOD);
