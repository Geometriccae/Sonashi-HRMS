/**
 * Paths for summary cards that open an existing page with its filter applied.
 * Each path starts on page 1 so a remembered page from an earlier visit is not reused.
 */

export const LEAVE_STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected", "Cancelled", "History"];

/** Leave Management (`/leave-requests`): status tab + year ("All" = every year) + optional search. */
export const leaveManagementPath = ({ status = "Pending", year = "All", search = "" } = {}) => {
  const params = new URLSearchParams();
  params.set("status", LEAVE_STATUS_FILTERS.includes(status) ? status : "All");
  params.set("year", String(year || "All"));
  if (search) params.set("search", String(search));
  params.set("page", "1");
  return `/leave-requests?${params.toString()}`;
};

/** Team Management (`/teammanagement`): employee list filter Active | Inactive | All. */
export const teamManagementPath = (filter = "Active") => {
  const params = new URLSearchParams();
  params.set("filter", filter);
  params.set("page", "1");
  return `/teammanagement?${params.toString()}`;
};

/** Annual Vacations (`/annual-vacations`): onVacation | yetToGo | returned tab. */
export const annualVacationsPath = (tab) => `/annual-vacations?tab=${encodeURIComponent(tab)}`;
