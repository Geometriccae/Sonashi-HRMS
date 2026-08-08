/** Shared employee lifecycle status helpers (display + working/non-working). */

export const EMPLOYEE_STATUS_VALUES = [
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

export const WORKING_EMPLOYEE_STATUSES = [
  "Active",
  "Provision Period",
  "Notice Period",
  "Confirmed",
  "On Hold",
];

export const NON_WORKING_EMPLOYEE_STATUSES = [
  "InActive",
  "Resigned",
  "Terminated",
  "Relieved",
];

export function isWorkingEmployeeStatus(status) {
  const s = String(status || "Active").trim();
  if (!s || s === "Active") return true;
  if (NON_WORKING_EMPLOYEE_STATUSES.includes(s)) return false;
  if (WORKING_EMPLOYEE_STATUSES.includes(s)) return true;
  return String(s).toLowerCase() !== "inactive";
}

export function isNonWorkingEmployeeStatus(status) {
  return !isWorkingEmployeeStatus(status);
}

function startOfLocalDay(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Calendar-day difference: end - start (can be negative). */
export function calendarDaysRemaining(endDate, fromDate = new Date()) {
  const end = startOfLocalDay(endDate);
  const from = startOfLocalDay(fromDate);
  if (!end || !from) return null;
  return Math.round((end - from) / (1000 * 60 * 60 * 24));
}

function periodSuffix(daysRemaining, { lastWorkingDayLabel = false } = {}) {
  if (daysRemaining == null) return "";
  if (daysRemaining > 0) {
    const unit = daysRemaining === 1 ? "Day" : "Days";
    return ` (${daysRemaining} ${unit} Remaining)`;
  }
  if (daysRemaining === 0) {
    return lastWorkingDayLabel
      ? " (Today is Last Working Day)"
      : " (Completed)";
  }
  return " (Completed)";
}

/**
 * Display label for Employee Status column.
 * Notice Period / Provision Period append remaining/completed days when an end date exists.
 */
export function formatEmployeeStatusDisplay(employeeOrStatus, maybeEmployee) {
  const employee =
    typeof employeeOrStatus === "object" && employeeOrStatus != null
      ? employeeOrStatus
      : maybeEmployee || {};
  const status =
    typeof employeeOrStatus === "string"
      ? employeeOrStatus
      : employee.employeeStatus || "Active";

  if (status === "InActive") return "Inactive";

  if (status === "Notice Period") {
    const end =
      employee.noticePeriodEndDate ||
      employee.lastWorkingDay ||
      null;
    const days = end != null ? calendarDaysRemaining(end) : null;
    return `Notice Period${periodSuffix(days, { lastWorkingDayLabel: true })}`;
  }

  if (status === "Provision Period") {
    const end = employee.provisionPeriodEndDate || null;
    const days = end != null ? calendarDaysRemaining(end) : null;
    return `Provision Period${periodSuffix(days)}`;
  }

  return status || "Active";
}

export function employeeStatusTagColor(status) {
  switch (status) {
    case "Active":
    case "Confirmed":
      return "success";
    case "Provision Period":
      return "processing";
    case "Notice Period":
      return "warning";
    case "On Hold":
      return "default";
    case "Resigned":
    case "Terminated":
    case "Relieved":
    case "InActive":
      return "error";
    default:
      return "default";
  }
}
