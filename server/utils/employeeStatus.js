/** Canonical employee lifecycle statuses stored on Employee.employeeStatus */
const EMPLOYEE_STATUS_VALUES = [
  "Active",
  "Provision Period",
  "Notice Period",
  "Confirmed",
  "Resigned",
  "Terminated",
  "Relieved",
  "On Hold",
  "InActive",
];

/** Still employed / working (include in Active filters, payroll, alerts) */
const WORKING_EMPLOYEE_STATUSES = [
  "Active",
  "Provision Period",
  "Notice Period",
  "Confirmed",
  "On Hold",
];

/** Separated / non-working */
const NON_WORKING_EMPLOYEE_STATUSES = [
  "InActive",
  "Resigned",
  "Terminated",
  "Relieved",
];

function isWorkingEmployeeStatus(status) {
  const s = String(status || "Active").trim();
  if (!s || s === "Active") return true;
  if (NON_WORKING_EMPLOYEE_STATUSES.includes(s)) return false;
  if (WORKING_EMPLOYEE_STATUSES.includes(s)) return true;
  // Legacy / unknown: treat anything other than known non-working as working
  return String(s).toLowerCase() !== "inactive";
}

function isNonWorkingEmployeeStatus(status) {
  return !isWorkingEmployeeStatus(status);
}

/**
 * lastWorkingDay is also used as "last day before vacation" for working staff.
 * Only separated employees and Notice Period use it as a true employment end date.
 */
function lastWorkingDayIsEmploymentExit(status) {
  const s = String(status || "").trim();
  if (NON_WORKING_EMPLOYEE_STATUSES.includes(s)) return true;
  return s === "Notice Period";
}

function workingStatusFilter() {
  return { employeeStatus: { $in: WORKING_EMPLOYEE_STATUSES } };
}

function nonWorkingStatusFilter() {
  return { employeeStatus: { $in: NON_WORKING_EMPLOYEE_STATUSES } };
}

module.exports = {
  EMPLOYEE_STATUS_VALUES,
  WORKING_EMPLOYEE_STATUSES,
  NON_WORKING_EMPLOYEE_STATUSES,
  isWorkingEmployeeStatus,
  isNonWorkingEmployeeStatus,
  lastWorkingDayIsEmploymentExit,
  workingStatusFilter,
  nonWorkingStatusFilter,
};
