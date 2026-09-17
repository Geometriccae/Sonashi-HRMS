/**
 * Central vacation/leave status resolver.
 * Status is derived from APPROVED leave/vacation dates + today.
 * Applied On (request submitted date) is never used.
 *
 *   today < travel/start                         → Vacation Pending (Yet to go)
 *   travel/start ≤ today ≤ end (not yet returned) → On Vacation
 *   today > end  OR  today >= actual return       → Vacation Approved (Returned)
 *
 * LeaveRequest.startDate / travellingDate = vacation start (not appliedOn).
 * LeaveRequest.endDate = planned vacation end.
 * Employee.returnDate / firstWorkingDay = actual return/entry when it belongs
 * to this trip (on or after travel start).
 */

const APPROVED_LEAVE_STATUSES = ['Approved', 'HOD Approved'];

/** Persisted statuses an authorized user may set from Team Management / Annual Vacations. */
const MANUAL_VACATION_STATUSES = [
  'Onsite',
  'On Vacation',
  'Vacation Approved',
  'Vacation Pending',
  'Onboarding',
];

function toCalendarDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const [, year, month, day] = match;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[\s_.-]+/g, '').trim();
}

function isHrStaffCode(value) {
  return /^id[a-z]{2}-\d+/i.test(String(value || '').trim());
}

function staffCode(value) {
  const s = String(value || '').trim();
  return isHrStaffCode(s) ? s.toLowerCase() : '';
}

function leaveBelongsToEmployee(leave, employee) {
  if (!leave || !employee) return false;
  const empId = String(employee._id || '').trim();
  const empCode = String(employee.employeeId || '').trim();
  const normalizedEmpCode = empCode.toLowerCase();
  const empStaff = staffCode(employee.employeeId);
  const empEmail = String(employee.emailId || '').trim().toLowerCase();
  const empName = normalizeName(employee.employeeName);

  const leaveStaff = staffCode(leave.linkedEmployeeCode) || staffCode(leave.employeeId);
  if (empStaff && leaveStaff && empStaff !== leaveStaff) return false;

  const recordId = String(leave.employeeRecordId?._id || leave.employeeRecordId || '').trim();
  if (recordId && empId && recordId === empId) return true;

  const userRef = String(leave.employee?._id || leave.employee || '').trim();
  if (userRef && empId && userRef === empId) return true;

  const linked = String(leave.employee?.employeeId?._id || leave.employee?.employeeId || '').trim();
  if (linked && empId && linked === empId) return true;
  if (linked && empCode && linked === empCode) return true;

  const leaveCode = String(leave.employeeId || leave.linkedEmployeeCode || '').trim();
  if (leaveCode && normalizedEmpCode && leaveCode.toLowerCase() === normalizedEmpCode) return true;

  const leaveEmail = String(leave.employee?.emailId || '').trim().toLowerCase();
  if (leaveEmail && empEmail && leaveEmail === empEmail) return true;

  const hasLeaveStaffOrRecord = Boolean(recordId || leaveStaff || (leaveCode && isHrStaffCode(leaveCode)));
  if (hasLeaveStaffOrRecord) return false;

  const leaveName = normalizeName(leave.employeeName || leave.employee?.username);
  return Boolean(leaveName && empName && leaveName === empName);
}

/**
 * Employee Master trip dates (travellingDate / leaveEndDate / returnDate)
 * describe the CURRENT trip. They must only overlay the matching leave.
 * Applying leaveEndDate to every historical request makes a completed 2022
 * leave look active until a 2026 end date, which falsely marks the employee
 * On Vacation before the next trip starts.
 */
function employeeTripDatesApplyToLeave(leave, employee) {
  if (!leave || !employee) return false;
  const leaveStart = toCalendarDate(leave.startDate || leave.travellingDate);
  if (!leaveStart) return false;
  const leaveEnd = toCalendarDate(leave.endDate);
  const empTravel = toCalendarDate(employee.travellingDate);
  const empEnd = toCalendarDate(employee.leaveEndDate);
  if (empTravel && empTravel.getTime() === leaveStart.getTime()) return true;
  if (leaveEnd && empEnd && empEnd.getTime() === leaveEnd.getTime()) return true;
  return false;
}

function employeeDatesForLeave(leave, employee) {
  return employeeTripDatesApplyToLeave(leave, employee) ? employee : null;
}

/** Vacation/travel start — never appliedOn. */
function getLeaveTravelStartDate(leave, employee) {
  const emp = employeeDatesForLeave(leave, employee);
  return toCalendarDate(
    leave?.travellingDate || (emp && emp.travellingDate) || leave?.startDate
  );
}

/**
 * Actual return/entry/first working day when it belongs to this trip.
 * A previous trip's return (before this travel start) is ignored.
 */
function getTripReturnDate(leave, employee) {
  const emp = employeeDatesForLeave(leave, employee);
  const travel = getLeaveTravelStartDate(leave, employee);
  const leaveReturn = toCalendarDate(leave?.returnDate || leave?.firstWorkingDay);
  if (leaveReturn && travel && leaveReturn >= travel) return leaveReturn;

  // HR Onsite writes returnDate as a persist stamp; it is not an actual
  // vacation return and must not end a still-approved trip.
  if (emp?.vacationStatus === 'Onsite') return null;

  const empReturn = toCalendarDate(emp?.returnDate || emp?.firstWorkingDay);
  if (!empReturn || !travel || empReturn < travel) return null;
  return empReturn;
}

function statusFromTravelEndAndReturn(travel, end, returnDay, today) {
  if (!today || !travel) return null;
  if (today < travel) return 'Vacation Pending';
  if (returnDay && today >= returnDay) return 'Vacation Approved';
  if (end) {
    if (today <= end) return 'On Vacation';
    return 'Vacation Approved';
  }
  return 'On Vacation';
}

function statusFromLeaveDates(leave, employee, todayValue) {
  if (!leave || !APPROVED_LEAVE_STATUSES.includes(leave.status)) return null;
  const today = toCalendarDate(todayValue || new Date());
  const emp = employeeDatesForLeave(leave, employee);
  const travel = getLeaveTravelStartDate(leave, employee);
  // Employee Master leaveEndDate wins only for the trip those dates belong to.
  const end = toCalendarDate((emp && emp.leaveEndDate) || leave.endDate);
  const returnDay = getTripReturnDate(leave, employee);
  return statusFromTravelEndAndReturn(travel, end, returnDay, today);
}

/** Team Management vacation dates on the employee record (same date rules as leave). */
function statusFromEmployeeDates(employee, todayValue) {
  const today = toCalendarDate(todayValue || new Date());
  const travel = toCalendarDate(employee?.travellingDate);
  const end = toCalendarDate(employee?.leaveEndDate);
  const returnDay = toCalendarDate(employee?.returnDate || employee?.firstWorkingDay);
  const tripReturn = travel && returnDay && returnDay >= travel ? returnDay : null;
  if (!today || !travel) return null;
  if (!end && !tripReturn) {
    if (today < travel) return 'Vacation Pending';
    return null;
  }
  return statusFromTravelEndAndReturn(travel, end, tripReturn, today);
}

/**
 * Progress order of the three date-driven stages of a trip.
 * 'Onsite' is deliberately unranked: it means "no vacation data applies", not a
 * later stage, so it must never make a manual status look overtaken.
 */
const STATUS_PROGRESS = {
  'Vacation Pending': 0,
  'On Vacation': 1,
  'Vacation Approved': 2,
};

/**
 * Which stage of their own trip the employee's dates put today in.
 *
 * Unlike statusFromEmployeeDates this still answers once the travel date has
 * arrived and no leave end date was ever captured: a travel date in the past is
 * on its own enough to know the trip is no longer pending. Leaving that case
 * unanswered is what kept employees on 'Yet to Go' after they had travelled,
 * because an unanswered timeline lets a stored status stand unchallenged.
 */
function employeeDateStage(employee, todayValue) {
  const today = toCalendarDate(todayValue || new Date());
  const travel = toCalendarDate(employee?.travellingDate);
  if (!today || !travel) return null;
  if (today < travel) return 'Vacation Pending';

  const end = toCalendarDate(employee?.leaveEndDate);
  const returnDay = toCalendarDate(employee?.returnDate || employee?.firstWorkingDay);
  const tripReturn = returnDay && returnDay >= travel ? returnDay : null;
  if (tripReturn && today >= tripReturn) return 'Vacation Approved';
  if (end && today > end) return 'Vacation Approved';
  return 'On Vacation';
}

/**
 * An authorized manual status stays authoritative until the vacation timeline
 * disagrees with it.
 *
 * Dates that move further along the trip overtake an earlier label (Yet to Go
 * once travel starts, On Vacation once the trip ends). A stored Returned Back
 * with a return date still ahead is treated as planned, so the live stage is
 * shown until that day. Onsite remains a true override and does not snap back.
 */
function manualStatusSurvives(manualStatus, dateDrivenStatus) {
  if (!dateDrivenStatus || dateDrivenStatus === manualStatus) return true;
  const pinned = STATUS_PROGRESS[manualStatus];
  const live = STATUS_PROGRESS[dateDrivenStatus];
  if (pinned === undefined || live === undefined) return true;
  // Dates that have moved further along the trip overtake the stored label.
  if (live > pinned) return false;
  // Returned Back with a return date still ahead (or a new trip still pending)
  // is a planned date, not an early return. Show the live stage until that day.
  if (manualStatus === 'Vacation Approved' && live < pinned) return false;
  return true;
}

/** Per-leave derived rows for one employee, newest data first is not required. */
function leaveDrivenRows(employee, leaveRequests, today) {
  return (Array.isArray(leaveRequests) ? leaveRequests : [])
    .filter((leave) => leaveBelongsToEmployee(leave, employee))
    .map((leave) => {
      const emp = employeeDatesForLeave(leave, employee);
      return {
        status: statusFromLeaveDates(leave, employee, today),
        travel: getLeaveTravelStartDate(leave, employee),
        end: toCalendarDate((emp && emp.leaveEndDate) || leave.endDate),
      };
    })
    .filter((row) => row.status);
}

/** An active trip outranks a pending one, which outranks a finished one. */
function pickLeaveDrivenStatus(rows) {
  if (rows.some((row) => row.status === 'On Vacation')) return 'On Vacation';
  if (rows.some((row) => row.status === 'Vacation Pending')) return 'Vacation Pending';
  if (rows.some((row) => row.status === 'Vacation Approved')) return 'Vacation Approved';
  return null;
}

/**
 * Whether a stored manual status should still be shown as-is.
 * Exported so the write/persist paths agree with what reads resolve.
 */
function manualVacationStatusHolds(employee, leaveRequests, todayValue) {
  if (
    employee?.vacationStatusSource !== 'manual' ||
    !MANUAL_VACATION_STATUSES.includes(employee?.vacationStatus)
  ) {
    return false;
  }
  const today = toCalendarDate(todayValue || new Date());
  // The employee's own vacation dates are the ones edited alongside the manual
  // status, so they describe the manual intent best; leave dates are the fallback.
  const dateDriven =
    employeeDateStage(employee, today) ||
    pickLeaveDrivenStatus(leaveDrivenRows(employee, leaveRequests, today));
  return manualStatusSurvives(employee.vacationStatus, dateDriven);
}

function resolveEmployeeVacationStatus(employee, leaveRequests, todayValue) {
  const today = toCalendarDate(todayValue || new Date());

  // Authorized manual updates win until the dates overtake them; see
  // manualStatusSurvives. Once overtaken we fall through to the date logic below,
  // so an employee always advances through their trip on their own dates.
  if (manualVacationStatusHolds(employee, leaveRequests, today)) {
    return employee.vacationStatus;
  }

  const fromLeaves = leaveDrivenRows(employee, leaveRequests, today);
  const fromLeaveStatus = pickLeaveDrivenStatus(fromLeaves);
  const employeeDateStatus = statusFromEmployeeDates(employee, today);

  // An employee who is already away is never reported as still waiting to go.
  // The dates HR typed on the employee record describe this employee's own
  // trip, so once they are live they outrank a separate approved request that
  // still lies ahead: ranking the leave rows first left employees on 'Yet to
  // Go' for the whole of a trip they had already started, because a future
  // request further down their leave history answered for them.
  if (employeeDateStatus === 'On Vacation' && employee?.vacationStatusSource === 'manual') {
    return employeeDateStatus;
  }

  // Current and future approved leave dates always win over a stored label
  // when the status is leave-driven (or legacy / unset source).
  if (fromLeaveStatus === 'On Vacation' || fromLeaveStatus === 'Vacation Pending') {
    return fromLeaveStatus;
  }

  // Manual Yet to Go / On Vacation after a finished trip only when the
  // employee travel date is after that trip ended (Returned Back → Yet to Go).
  if (employeeDateStatus === 'On Vacation' || employeeDateStatus === 'Vacation Pending') {
    if (!fromLeaveStatus) return employeeDateStatus;
    const empTravel = toCalendarDate(employee?.travellingDate);
    const latestLeaveEnd = fromLeaves.reduce((latest, row) => {
      if (!row.end) return latest;
      if (!latest || row.end > latest) return row.end;
      return latest;
    }, null);
    if (empTravel && latestLeaveEnd && empTravel > latestLeaveEnd) {
      return employeeDateStatus;
    }
  }

  if (fromLeaveStatus) return fromLeaveStatus;
  if (employeeDateStatus) return employeeDateStatus;

  if (employee?.vacationStatus === 'Onboarding') return 'Onboarding';
  if (STATUS_PROGRESS[employee?.vacationStatus] !== undefined) {
    // The stored label already claims a trip, so that trip's own dates decide
    // which stage today falls in. Only a move further along the trip is applied:
    // a leftover travel date can then never drag a finished trip back to an
    // earlier stage, while a travel date that has arrived always ends 'Yet to Go'.
    const stage = employeeDateStage(employee, today);
    if (stage && STATUS_PROGRESS[stage] > STATUS_PROGRESS[employee.vacationStatus]) {
      return stage;
    }
    return employee.vacationStatus;
  }
  return 'Onsite';
}

function applyEffectiveVacationStatuses(employees, leaveRequests, todayValue) {
  const list = Array.isArray(employees) ? employees : [];
  const leaves = Array.isArray(leaveRequests) ? leaveRequests : [];
  const today = toCalendarDate(todayValue || new Date());
  return list.map((employee) => {
    const next = resolveEmployeeVacationStatus(employee, leaves, today);
    if (next === employee.vacationStatus) return employee;
    return { ...employee, vacationStatus: next };
  });
}

module.exports = {
  APPROVED_LEAVE_STATUSES,
  MANUAL_VACATION_STATUSES,
  toCalendarDate,
  leaveBelongsToEmployee,
  employeeTripDatesApplyToLeave,
  getLeaveTravelStartDate,
  getTripReturnDate,
  statusFromLeaveDates,
  statusFromEmployeeDates,
  employeeDateStage,
  manualVacationStatusHolds,
  resolveEmployeeVacationStatus,
  applyEffectiveVacationStatuses,
};
