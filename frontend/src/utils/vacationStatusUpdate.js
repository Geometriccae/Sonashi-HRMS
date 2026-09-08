/**
 * The one vacation-status update mechanism shared by every screen that can edit
 * status (Annual Vacations, Team Management list, Employee Profile, Dashboard
 * drill-down). It owns which dates each status needs and which backend endpoint
 * performs the write, so no screen keeps its own copy of that logic.
 */
import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";
import { VACATION_STATUS, normalizeVacationStatus } from "./vacationStatusDisplay";

const DATE_CONFIGS = {
  [VACATION_STATUS.ON_VACATION]: {
    label: "Last Working Day",
    fieldKey: "lastWorkingDay",
    secondaryLabel: "Travelling Date",
    secondaryFieldKey: "travellingDate",
    tertiaryLabel: "Leave End Date",
    tertiaryFieldKey: "leaveEndDate",
  },
  [VACATION_STATUS.YET_TO_GO]: {
    label: "Last Working Day",
    fieldKey: "lastWorkingDay",
    secondaryLabel: "Travelling Date",
    secondaryFieldKey: "travellingDate",
    tertiaryLabel: "Leave End Date",
    tertiaryFieldKey: "leaveEndDate",
  },
  [VACATION_STATUS.RETURNED_BACK]: {
    label: "Return / Entry Date",
    fieldKey: "returnDate",
    secondaryLabel: "First Working Day",
    secondaryFieldKey: "firstWorkingDay",
  },
};

/** Dates a status needs, or null for statuses saved without a prompt (Onsite). */
export const getVacationDateConfig = (status) =>
  DATE_CONFIGS[normalizeVacationStatus(status)] || null;

export const toDateInputValue = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return "";
  }
};

/** Prefilled prompt state for the date modal each screen already renders. */
export const buildVacationDatePrompt = (item, status, mode = "date") => {
  const cfg = getVacationDateConfig(status);
  if (!cfg) return null;
  return {
    item,
    employeeItem: item,
    newStatus: normalizeVacationStatus(status),
    label: cfg.label,
    fieldKey: cfg.fieldKey,
    dateValue: toDateInputValue(item?.[cfg.fieldKey]),
    secondaryLabel: cfg.secondaryLabel,
    secondaryFieldKey: cfg.secondaryFieldKey,
    secondaryDateValue: cfg.secondaryFieldKey
      ? toDateInputValue(item?.[cfg.secondaryFieldKey])
      : "",
    tertiaryLabel: cfg.tertiaryLabel,
    tertiaryFieldKey: cfg.tertiaryFieldKey,
    tertiaryDateValue: cfg.tertiaryFieldKey
      ? toDateInputValue(item?.endDate || item?.leaveEndDate)
      : "",
    mode,
  };
};

/**
 * Persists a status change and clears the caches every other screen reads from.
 * Rejects when the backend rejects, so callers never report a false success.
 */
export async function applyVacationStatusChange({
  employeeId,
  newStatus,
  dates = {},
  leaveId = null,
}) {
  if (!employeeId) throw new Error("Employee record not found for this row.");
  const status = normalizeVacationStatus(newStatus);
  if (!status) throw new Error("Select a vacation status.");

  let updated = null;
  const isReturn = status === VACATION_STATUS.RETURNED_BACK;
  const returnDate = dates.returnDate || dates.firstWorkingDay;

  if (isReturn && returnDate) {
    // Records the actual return day without touching approved leave days.
    const result = await employeeService.markVacationReturn(employeeId, {
      returnDate,
      firstWorkingDay: dates.firstWorkingDay || returnDate,
      leaveId,
    });
    updated = result?.employee || result;
  } else {
    updated = await employeeService.updateVacationStatus(employeeId, {
      vacationStatus: status,
      ...dates,
    });
  }

  employeeService.invalidateCache?.();
  leaveRequestService.invalidateCache?.();

  return updated;
}
