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

/** True when this leave belongs to an Admin and must be finalized by Authorize User */
export const isAdminOwnedLeave = (leaveRequest) => {
  const role = String(
    leaveRequest?.requesterRole || leaveRequest?.employee?.role || ""
  ).toLowerCase();
  return role === ROLES.ADMIN;
};

/**
 * Whether the current user may approve/reject this leave request.
 * - Blocks self-approval
 * - Admin leaves: Authorize User only
 * - Employee leaves: Admin / Viewer / Authorize User (existing)
 */
export const canApproveLeaveRequest = (leaveRequest, role = getUserRole()) => {
  if (!canApproveLeaves(role)) return false;
  const status = leaveRequest?.status;
  if (status !== "Pending" && status !== "HOD Approved") return false;

  const myId = String(localStorage.getItem("userId") || "");
  const ownerId = String(
    leaveRequest?.employee?._id || leaveRequest?.employee || ""
  );
  if (myId && ownerId && myId === ownerId) return false;

  if (isAdminOwnedLeave(leaveRequest) && !isAuthorizeUser(role)) return false;

  return true;
};

export const canEditLeaves = (role = getUserRole()) =>
  !isReadOnlyRole(role) &&
  (role === ROLES.HR || role === ROLES.ADMIN || role === ROLES.HOD);

/** Admin / HOD / HR / Authorize User — update early or extended vacation return dates */
export const canUpdateVacationReturn = (role = getUserRole()) =>
  role === ROLES.ADMIN ||
  role === ROLES.HOD ||
  role === ROLES.HR ||
  role === ROLES.AUTHORIZE_USER;

export const canManageSlips = (role = getUserRole()) =>
  !isReadOnlyRole(role) && (role === ROLES.ADMIN || role === ROLES.HOD);
