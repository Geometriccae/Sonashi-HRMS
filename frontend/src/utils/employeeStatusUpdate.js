/**
 * The one Employee Status update mechanism used by Team Management and
 * Employee Details. Prompt shape, date fields, and write payload stay here
 * so no screen keeps a second copy of Notice / Provision / exit handling.
 */
import employeeService from "../services/EmployeeService";
import {
  EMPLOYEE_STATUS_VALUES,
  isNonWorkingEmployeeStatus,
} from "./employeeStatusDisplay";
import { toDateInputValue } from "./vacationStatusUpdate";

export const isNoticeOrProvisionStatus = (status) =>
  status === "Notice Period" || status === "Provision Period";

export const getPeriodRestoreStatus = (employee) => {
  const current = employee?.employeeStatus;
  const prev = String(employee?.previousEmployeeStatus || "").trim();
  if (prev && EMPLOYEE_STATUS_VALUES.includes(prev) && prev !== current) {
    return prev;
  }
  return "Active";
};

/**
 * Date-prompt state for Notice Period, Provision Period, and exit statuses.
 * Returns null when the status can be saved immediately (Active, Confirmed, etc.).
 */
export function buildEmployeeStatusPrompt(employeeItem, newStatus, options = {}) {
  const isEdit = Boolean(options.isEdit);
  if (newStatus === "Notice Period") {
    return {
      employeeItem,
      newStatus,
      mode: "notice",
      isEdit,
      noticePeriodStartDate: toDateInputValue(employeeItem.noticePeriodStartDate),
      noticePeriodEndDate: toDateInputValue(
        employeeItem.noticePeriodEndDate || employeeItem.lastWorkingDay
      ),
      lastWorkingDay: "",
      provisionPeriodStartDate: "",
      provisionPeriodEndDate: "",
    };
  }
  if (newStatus === "Provision Period") {
    return {
      employeeItem,
      newStatus,
      mode: "provision",
      isEdit,
      provisionPeriodStartDate: toDateInputValue(employeeItem.provisionPeriodStartDate),
      provisionPeriodEndDate: toDateInputValue(employeeItem.provisionPeriodEndDate),
      lastWorkingDay: "",
      noticePeriodStartDate: "",
      noticePeriodEndDate: "",
    };
  }
  if (isNonWorkingEmployeeStatus(newStatus)) {
    return {
      employeeItem,
      newStatus,
      mode: "exit",
      lastWorkingDay: toDateInputValue(employeeItem.lastWorkingDay),
      noticePeriodStartDate: "",
      noticePeriodEndDate: "",
      provisionPeriodStartDate: "",
      provisionPeriodEndDate: "",
    };
  }
  return null;
}

export function validateEmployeeStatusPrompt(prompt) {
  const mode = prompt?.mode || "exit";
  if (mode === "notice") {
    const start = prompt.noticePeriodStartDate;
    const end = prompt.noticePeriodEndDate;
    if (start && end && start > end) {
      return "Start date cannot be after the end date.";
    }
  }
  if (mode === "provision") {
    const start = prompt.provisionPeriodStartDate;
    const end = prompt.provisionPeriodEndDate;
    if (start && end && start > end) {
      return "Start date cannot be after the end date.";
    }
  }
  return null;
}

export function datesFromEmployeeStatusPrompt(prompt) {
  return {
    lastWorkingDay: prompt?.lastWorkingDay,
    noticePeriodStartDate: prompt?.noticePeriodStartDate,
    noticePeriodEndDate: prompt?.noticePeriodEndDate,
    provisionPeriodStartDate: prompt?.provisionPeriodStartDate,
    provisionPeriodEndDate: prompt?.provisionPeriodEndDate,
  };
}

export function buildEmployeeStatusPayload(employeeItem, newStatus, dates = {}) {
  const payload = { employeeStatus: newStatus };
  const currentStatus = employeeItem.employeeStatus || "Active";

  if (isNoticeOrProvisionStatus(newStatus) && currentStatus !== newStatus) {
    payload.previousEmployeeStatus = currentStatus;
  }

  if (newStatus === "Notice Period") {
    if (dates.noticePeriodStartDate) {
      payload.noticePeriodStartDate = new Date(dates.noticePeriodStartDate).toISOString();
    }
    if (dates.noticePeriodEndDate) {
      payload.noticePeriodEndDate = new Date(dates.noticePeriodEndDate).toISOString();
      payload.lastWorkingDay = new Date(dates.noticePeriodEndDate).toISOString();
    }
  } else if (newStatus === "Provision Period") {
    if (dates.provisionPeriodStartDate) {
      payload.provisionPeriodStartDate = new Date(dates.provisionPeriodStartDate).toISOString();
    }
    if (dates.provisionPeriodEndDate) {
      payload.provisionPeriodEndDate = new Date(dates.provisionPeriodEndDate).toISOString();
    }
  } else if (isNonWorkingEmployeeStatus(newStatus)) {
    payload.lastWorkingDay = dates.lastWorkingDay
      ? new Date(dates.lastWorkingDay).toISOString()
      : null;
    payload.vacationStatus = "Onsite";
    payload.attendance = "Onsite";
  }

  return payload;
}

export function employeeStatusChangeSuccessMessage(newStatus, isEdit) {
  if (isEdit && newStatus === "Notice Period") {
    return "Notice Period updated successfully.";
  }
  if (isEdit && newStatus === "Provision Period") {
    return "Provision Period updated successfully.";
  }
  return "Employee status updated successfully.";
}

export async function applyEmployeeStatusChange({
  employeeItem,
  newStatus,
  dates = {},
}) {
  const empId = employeeItem?._id || employeeItem?.id;
  if (!empId) throw new Error("Employee record not found.");
  const payload = buildEmployeeStatusPayload(employeeItem, newStatus, dates);
  const updated = await employeeService.updateEmployee(empId, payload);
  employeeService.invalidateCache?.();
  return { payload, updated, empId };
}

export function buildPeriodResetPayload(employeeItem) {
  const currentStatus = employeeItem.employeeStatus;
  const restoredStatus = getPeriodRestoreStatus(employeeItem);
  const payload = {
    employeeStatus: restoredStatus,
    previousEmployeeStatus: null,
  };
  if (currentStatus === "Notice Period") {
    payload.noticePeriodStartDate = null;
    payload.noticePeriodEndDate = null;
    payload.lastWorkingDay = null;
  } else if (currentStatus === "Provision Period") {
    payload.provisionPeriodStartDate = null;
    payload.provisionPeriodEndDate = null;
  }
  return { payload, currentStatus, restoredStatus };
}

export function employeeStatusResetSuccessMessage(currentStatus) {
  return currentStatus === "Provision Period"
    ? "Provision Period reset successfully."
    : "Notice Period reset successfully.";
}

export async function applyEmployeeStatusReset(employeeItem) {
  const empId = employeeItem?._id || employeeItem?.id;
  if (!empId) throw new Error("Employee record not found.");
  const { payload, currentStatus } = buildPeriodResetPayload(employeeItem);
  const updated = await employeeService.updateEmployee(empId, payload);
  employeeService.invalidateCache?.();
  return { payload, updated, empId, currentStatus };
}
