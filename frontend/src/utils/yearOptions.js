/**
 * Build year options for filters/history views.
 * Includes a wide past/future range plus any years present in data.
 * No business logic — display/filter options only.
 */
export function buildYearList({
  fromDataYears = [],
  pastYears = 25,
  futureYears = 5,
  includeAll = false,
  allLabel = "All",
} = {}) {
  const current = new Date().getFullYear();
  const set = new Set();

  for (let y = current + futureYears; y >= current - pastYears; y -= 1) {
    set.add(y);
  }

  (fromDataYears || []).forEach((y) => {
    const n = Number(y);
    if (Number.isFinite(n) && n >= 1990 && n <= 2100) set.add(n);
  });

  const sorted = [...set].sort((a, b) => b - a);
  if (includeAll) return [allLabel, ...sorted.map(String)];
  return sorted;
}

/** Extract years from leave requests via startDate. */
export function yearsFromLeaveRequests(leaveRequests = []) {
  return (leaveRequests || [])
    .map((req) => {
      const dateVal = req.startDate || req.appliedOn || req.createdAt;
      if (!dateVal) return null;
      if (typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
        return Number(dateVal.slice(0, 4));
      }
      const d = new Date(dateVal);
      return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
    })
    .filter((y) => y != null);
}

/** Extract years from salary slips. */
export function yearsFromSalarySlips(slips = []) {
  return (slips || [])
    .map((s) => Number(s.year))
    .filter((y) => Number.isFinite(y));
}

function toCalendarYear(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return Number(match[1]);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
}

function toCalendarDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Leave History years for an employee: joining year → current year (descending).
 * Never includes future years or years before Date of Joining.
 */
export function buildLeaveHistoryYears(doj, asOf = new Date()) {
  const currentYear = toCalendarYear(asOf) ?? new Date().getFullYear();
  const joiningYear = toCalendarYear(doj);

  if (joiningYear == null) return [currentYear];
  if (joiningYear > currentYear) return [];

  const years = [];
  for (let year = currentYear; year >= joiningYear; year -= 1) {
    years.push(year);
  }
  return years;
}

/** Whether an approved leave belongs to a history year after the employee joined. */
export function leaveBelongsToHistoryYear(leave, year, doj) {
  const start = toCalendarDate(leave?.startDate);
  if (!start || start.getFullYear() !== year) return false;

  const joinDate = toCalendarDate(doj);
  // Allow leave anywhere in the joining year (imported Excel days before exact DOJ).
  if (joinDate && start.getFullYear() < joinDate.getFullYear()) return false;

  return true;
}
