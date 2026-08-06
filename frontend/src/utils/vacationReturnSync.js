import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";
import { findLeaveForEmployee } from "./yetToGoHelpers";

/** Employee fields allowed for vacation return / travel date updates. */
export const VACATION_RETURN_EMPLOYEE_FIELDS = [
  "vacationStatus",
  "returnDate",
  "firstWorkingDay",
  "lastWorkingDay",
  "travellingDate",
  "attendance",
];

const toIsoDay = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/**
 * Sync linked leave endDate to the actual return day (early or late).
 * Does not change leave approval status — Modified audit only.
 */
export async function syncLeaveEndDateForReturn(
  leaveId,
  returnOrFirstWorkDay,
  remarks = "Leave end date synced to staff return date"
) {
  if (!leaveId || !returnOrFirstWorkDay) return;
  const endDate = toIsoDay(returnOrFirstWorkDay);
  if (!endDate) return;
  await leaveRequestService.updateLeaveRequest(leaveId, {
    endDate,
    changeStatus: "Modified",
    changeRemarks: remarks,
  });
}

/**
 * Mark staff returned (early or on the given day).
 * Updates employee vacation/attendance dates and linked leave endDate.
 */
export async function markStaffReturned({
  empId,
  leaveId,
  returnDate = new Date(),
}) {
  const iso = toIsoDay(returnDate);
  if (!iso) throw new Error("Invalid return date");

  if (leaveId) {
    await syncLeaveEndDateForReturn(
      leaveId,
      iso,
      "Marked returned; end date updated to return date"
    );
  }

  if (empId) {
    await employeeService.updateEmployee(empId, {
      vacationStatus: "Vacation Approved",
      returnDate: iso,
      firstWorkingDay: iso,
      attendance: "Onsite",
    });
    employeeService.invalidateCache?.();
  }
}

/**
 * Save vacation status + dates; when Returned, sync leave endDate and set Onsite.
 */
export async function saveVacationStatusWithDates({
  empId,
  leaveId,
  vacationStatus,
  extraFields = {},
  leaveList = [],
  empList = [],
  employeeItem = null,
}) {
  if (!empId) throw new Error("Employee id required");

  const payload = { vacationStatus, ...extraFields };
  if (vacationStatus === "Vacation Approved") {
    payload.attendance = extraFields.attendance || "Onsite";
  }

  await employeeService.updateEmployee(empId, payload);
  employeeService.invalidateCache?.();

  if (vacationStatus === "Vacation Approved") {
    const returnDay =
      extraFields.returnDate ||
      extraFields.firstWorkingDay ||
      null;

    let linkedLeaveId = leaveId;
    if (!linkedLeaveId && employeeItem && Array.isArray(leaveList)) {
      const leave = findLeaveForEmployee(
        employeeItem,
        leaveList,
        empList.length ? empList : [employeeItem],
        "returned"
      ) || findLeaveForEmployee(
        employeeItem,
        leaveList,
        empList.length ? empList : [employeeItem],
        "onVacation"
      );
      linkedLeaveId = leave?._id || null;
    }

    if (linkedLeaveId && returnDay) {
      await syncLeaveEndDateForReturn(
        linkedLeaveId,
        returnDay,
        "Leave end date synced to staff return date (early/late return)"
      );
    }
  }
}
