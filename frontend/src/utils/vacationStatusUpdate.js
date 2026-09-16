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

/**
 * `YYYY-MM-DD` for a date input, read as the same calendar day the vacation
 * tables and the status resolver read for that value.
 *
 * Formatting through toISOString() reported the UTC day instead, so a date
 * stored at local midnight prefilled one day earlier than the tables showed it
 * and confirming the dialog unchanged silently moved the date back a day.
 */
export const toDateInputValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const dateOnly = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
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
      ? toDateInputValue(item?.leaveEndDate || item?.endDate)
      : "",
    mode,
  };
};

/**
 * The prompt to open when a user picks a status, including the Returned Back
 * prefill. Returns null for statuses saved without asking for dates (Onsite).
 * Shared so Team Management and Employee Master open the identical dialog.
 */
export const buildStatusChangePrompt = (item, status) => {
  const prompt = buildVacationDatePrompt(item, status);
  if (!prompt) return null;
  if (normalizeVacationStatus(status) === VACATION_STATUS.RETURNED_BACK) {
    const planned =
      toDateInputValue(item?.leaveEndDate || item?.endDate || item?.returnDate) || toDateInputValue(new Date());
    prompt.dateValue = prompt.dateValue || planned;
    prompt.secondaryDateValue = prompt.secondaryDateValue || planned;
  }
  return prompt;
};

/**
 * Validates a confirmed prompt and turns it into the date payload to persist.
 * @returns {{ dates: object } | { error: string }}
 */
export const datesFromPrompt = (prompt) => {
  const {
    newStatus,
    fieldKey,
    dateValue,
    secondaryFieldKey,
    secondaryDateValue,
    tertiaryFieldKey,
    tertiaryDateValue,
  } = prompt || {};
  const isReturn = normalizeVacationStatus(newStatus) === VACATION_STATUS.RETURNED_BACK;

  if (isReturn && !dateValue) {
    return { error: "Please select the Return / Entry Date." };
  }

  const iso = (value) => toDateInputValue(value);
  const dates = {};
  if (dateValue) dates[fieldKey] = iso(dateValue);
  if (secondaryFieldKey && secondaryDateValue) {
    dates[secondaryFieldKey] = iso(secondaryDateValue);
  } else if (isReturn && dateValue) {
    dates.firstWorkingDay = iso(dateValue);
  }
  if (tertiaryFieldKey && tertiaryDateValue) {
    dates[tertiaryFieldKey] = iso(tertiaryDateValue);
  }
  // #region agent log
  fetch('http://127.0.0.1:7876/ingest/39a980ca-c572-4a37-ae28-bc521160a4b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cda47c'},body:JSON.stringify({sessionId:'cda47c',runId:'post-fix',hypothesisId:'E',location:'vacationStatusUpdate.js:datesFromPrompt',message:'calendar dates to persist',data:{dates,newStatus},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { dates };
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

  // #region agent log
  fetch('http://127.0.0.1:7876/ingest/39a980ca-c572-4a37-ae28-bc521160a4b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cda47c'},body:JSON.stringify({sessionId:'cda47c',runId:'post-fix',hypothesisId:'E',location:'vacationStatusUpdate.js:applyVacationStatusChange',message:'vacation write + cache invalidate',data:{empIdLen:String(employeeId||'').length,status,dateKeys:Object.keys(dates||{}),sentLeaveEnd:dates?.leaveEndDate||null,hasLeaveId:Boolean(leaveId),savedLeaveEnd:updated?.leaveEndDate||null,savedTravel:updated?.travellingDate||null,savedStatus:updated?.vacationStatus||null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  return updated;
}
