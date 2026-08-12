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
