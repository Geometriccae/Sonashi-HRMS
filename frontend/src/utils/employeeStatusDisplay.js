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

/**
 * lastWorkingDay is also used as "last day before vacation" for working staff.
 * Only separated employees and Notice Period use it as a true employment end date.
 */
export function lastWorkingDayIsEmploymentExit(status) {
  const s = String(status || "").trim();
  if (NON_WORKING_EMPLOYEE_STATUSES.includes(s)) return true;
  return s === "Notice Period";
}

export function employeeMatchesSearch(employee, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const fields = [
    employee?.employeeName,
    employee?.name,
    employee?.employeeId,
    employee?.employeeNumber,
    employee?.empCode,
    employee?.emailId,
    employee?.mobile,
    employee?.role,
    employee?.department,
  ];
  return fields.some((value) => String(value || "").toLowerCase().includes(q));
}

/** UI/API category: Active | InActive | All */
export function normalizeEmployeeCategory(category) {
  const c = String(category || "Active").trim();
  if (c === "All" || c === "") return "All";
  if (
    c === "InActive" ||
    c === "Inactive" ||
    c === "Ex" ||
    c === "Ex-Employees" ||
    c === "Ex Employees"
  ) {
    return "InActive";
  }
  return "Active";
}

export function employeeMatchesCategory(employee, category) {
  const c = normalizeEmployeeCategory(category);
  if (c === "All") return true;
  if (c === "InActive") return isNonWorkingEmployeeStatus(employee?.employeeStatus);
  return isWorkingEmployeeStatus(employee?.employeeStatus);
}

/** Query param for GET /employees?status= — empty means All. */
export function apiStatusForEmployeeCategory(category) {
  const c = normalizeEmployeeCategory(category);
  if (c === "All") return "";
  return c;
}

export function filterEmployeesByCategory(employees, category, searchQuery = "") {
  return (employees || []).filter((employee) => {
    if (!employeeMatchesCategory(employee, category)) return false;
    return employeeMatchesSearch(employee, searchQuery);
  });
}

/**
 * Default HR lists/dropdowns: currently working employees only.
 * Search does not pull in ex-employees.
 */
export function filterEmployeesForDefaultList(employees, searchQuery = "") {
  return filterEmployeesByCategory(employees, "Active", searchQuery);
}

/** Native <select> lists: current staff, plus a currently selected ex-employee if any. */
export function employeesForNativeSelect(employees, selectedId = "") {
  const list = filterEmployeesForDefaultList(employees, "");
  if (!selectedId) return list;
  if (list.some((employee) => String(employee._id) === String(selectedId))) return list;
  const selected = (employees || []).find((employee) => String(employee._id) === String(selectedId));
  return selected ? [...list, selected] : list;
}

export function toSearchableEmployeeOption(employee, extra = {}) {
  const name = employee?.employeeName || employee?.name || "Unknown";
  const code = employee?.employeeId || "";
  return {
    value: extra.value ?? employee?._id,
    label: extra.label ?? `${name}${code ? ` (${code})` : ""}`,
    name,
    employeeId: code,
    employeeNumber: employee?.employeeNumber || extra.employeeNumber || "",
    emailId: employee?.emailId || "",
    mobile: employee?.mobile || "",
    ...extra,
    inactive: extra.inactive ?? isNonWorkingEmployeeStatus(employee?.employeeStatus),
  };
}

/** react-select: Active-employee pickers never list ex-employees. */
export function filterReactSelectEmployeeOption(option, inputValue, { includeInactive = false } = {}) {
  const q = String(inputValue || "").trim().toLowerCase();
  const data = option?.data || option || {};
  const haystack = [
    option?.label,
    data.label,
    data.name,
    data.employeeId,
    data.employeeNumber,
    data.emailId,
    data.mobile,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
  if (q && !haystack.includes(q)) return false;
  if (!includeInactive && data.inactive) return false;
  return true;
}

/** Reports / All-employees pickers: text match only (dataset already category-filtered). */
export function filterReactSelectEmployeeOptionIncludingInactive(option, inputValue) {
  return filterReactSelectEmployeeOption(option, inputValue, { includeInactive: true });
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
