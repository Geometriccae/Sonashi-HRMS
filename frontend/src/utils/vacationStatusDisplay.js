/**
 * Single source for vacation status values, display labels and badge styling.
 *
 * Stored values are the Employee.vacationStatus enum. "Vacation Pending" means
 * "Yet to Go" and "Vacation Approved" means "Returned Back" — every screen must
 * render them through here so Team Management, Annual Vacations, Dashboard,
 * Employee Profile and Reports never show different wording for one employee.
 */

export const VACATION_STATUS = {
  ONSITE: "Onsite",
  ON_VACATION: "On Vacation",
  YET_TO_GO: "Vacation Pending",
  RETURNED_BACK: "Vacation Approved",
  ONBOARDING: "Onboarding",
};

/** Stored enum values accepted by the employee vacation-status endpoint. */
export const VACATION_STATUS_VALUES = [
  VACATION_STATUS.ONSITE,
  VACATION_STATUS.ON_VACATION,
  VACATION_STATUS.RETURNED_BACK,
  VACATION_STATUS.YET_TO_GO,
  VACATION_STATUS.ONBOARDING,
];

const VACATION_STATUS_LABELS = {
  [VACATION_STATUS.ONSITE]: "Onsite",
  [VACATION_STATUS.ON_VACATION]: "On Vacation",
  [VACATION_STATUS.YET_TO_GO]: "Yet to Go",
  [VACATION_STATUS.RETURNED_BACK]: "Returned Back",
  [VACATION_STATUS.ONBOARDING]: "Onboarding",
};

/** Legacy label still present on older records / payloads. */
const LEGACY_ALIASES = {
  "Not on Vacation": VACATION_STATUS.ONSITE,
};

export const normalizeVacationStatus = (value) => {
  const vs = String(value ?? "").trim();
  if (!vs) return "";
  return LEGACY_ALIASES[vs] || vs;
};

/** Stored value -> label shown in the UI. */
export const formatVacationStatus = (value) => {
  const vs = normalizeVacationStatus(value);
  if (!vs) return "";
  return VACATION_STATUS_LABELS[vs] || vs;
};

/** Resolved status for a row, defaulting to Onsite like the backend does. */
export const employeeVacationStatus = (employee) =>
  normalizeVacationStatus(employee?.vacationStatus) || VACATION_STATUS.ONSITE;

/** The four statuses a user may select. Onboarding is set by onboarding flows. */
export const VACATION_STATUS_EDIT_OPTIONS = [
  VACATION_STATUS.ONSITE,
  VACATION_STATUS.ON_VACATION,
  VACATION_STATUS.YET_TO_GO,
  VACATION_STATUS.RETURNED_BACK,
].map((value) => ({ value, label: VACATION_STATUS_LABELS[value] }));

/** Ant Design Tag colours. */
export const vacationStatusTagColor = {
  [VACATION_STATUS.ONSITE]: "success",
  [VACATION_STATUS.ON_VACATION]: "processing",
  [VACATION_STATUS.RETURNED_BACK]: "purple",
  [VACATION_STATUS.YET_TO_GO]: "warning",
};

/** Pill styling for the gradient badges used on Annual Vacations / Dashboard. */
export const VACATION_STATUS_BADGE = {
  [VACATION_STATUS.ONSITE]: {
    bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)",
    color: "#065f46",
    dot: "#10b981",
  },
  [VACATION_STATUS.ON_VACATION]: {
    bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)",
    color: "#1e3a8a",
    dot: "#3b82f6",
  },
  [VACATION_STATUS.RETURNED_BACK]: {
    bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)",
    color: "#065f46",
    dot: "#10b981",
  },
  [VACATION_STATUS.YET_TO_GO]: {
    bg: "linear-gradient(135deg,#fef9c3,#fde68a)",
    color: "#713f12",
    dot: "#f59e0b",
  },
};

export const vacationStatusBadgeStyle = (value) => {
  const vs = normalizeVacationStatus(value);
  return VACATION_STATUS_BADGE[vs] || VACATION_STATUS_BADGE[VACATION_STATUS.ONSITE];
};
