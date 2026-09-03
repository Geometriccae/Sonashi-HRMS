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

/** Human-readable role for document "Uploaded by" and similar UI. */
export const ROLE_LABELS = {
  admin: "Admin",
  hr: "HR",
  hod: "Head of Department",
  viewer: "Viewer",
  authorize_user: "Authorize User",
  sales_executive: "Sales Executive",
  sales_lead: "Sales Lead",
  managing_director: "Managing Director",
  director: "Director",
  accounts_manager: "Accounts Manager",
  chartering_manager: "Chartering Manager",
  business_development_manager: "Business Development Manager",
  office_assistance: "Office Assistance",
  executive_post_fixture: "Executive Post Fixture",
  operations_pricing_manager: "Operations Pricing Manager",
  operations_executive: "Operations Executive",
};

export const formatRoleLabel = (role) => {
  const raw = String(role || "").trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  if (/[A-Z\s]/.test(raw) && !raw.includes("_")) return raw;
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
};
