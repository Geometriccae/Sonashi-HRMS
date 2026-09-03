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

function toCalendarDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
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

/** Vacation/travel start — never appliedOn. */
function getLeaveTravelStartDate(leave, employee) {
  return toCalendarDate(leave?.travellingDate || leave?.startDate || employee?.travellingDate);
}

/**
 * Actual return/entry/first working day when it belongs to this trip.
 * A previous trip's return (before this travel start) is ignored.
 */
function getTripReturnDate(leave, employee) {
  const travel = getLeaveTravelStartDate(leave, employee);
  const leaveReturn = toCalendarDate(leave?.returnDate || leave?.firstWorkingDay);
  if (leaveReturn && travel && leaveReturn >= travel) return leaveReturn;

  // HR Onsite writes returnDate as a persist stamp; it is not an actual
  // vacation return and must not end a still-approved trip.
  if (employee?.vacationStatus === 'Onsite') return null;

  const empReturn = toCalendarDate(employee?.returnDate || employee?.firstWorkingDay);
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
  const travel = getLeaveTravelStartDate(leave, employee);
  const end = toCalendarDate(leave.endDate);
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

function resolveEmployeeVacationStatus(employee, leaveRequests, todayValue) {
  const today = toCalendarDate(todayValue || new Date());
  const leaves = (Array.isArray(leaveRequests) ? leaveRequests : []).filter((leave) =>
    leaveBelongsToEmployee(leave, employee)
  );

  const fromLeaves = leaves
    .map((leave) => ({
      status: statusFromLeaveDates(leave, employee, today),
      travel: getLeaveTravelStartDate(leave, employee),
      end: toCalendarDate(leave.endDate),
    }))
    .filter((row) => row.status);

  const fromLeaveStatus = fromLeaves.some((row) => row.status === 'On Vacation')
    ? 'On Vacation'
    : fromLeaves.some((row) => row.status === 'Vacation Pending')
      ? 'Vacation Pending'
      : fromLeaves.some((row) => row.status === 'Vacation Approved')
        ? 'Vacation Approved'
        : null;

  // Current and future approved leave dates always win over a stored label.
  if (fromLeaveStatus === 'On Vacation' || fromLeaveStatus === 'Vacation Pending') {
    return fromLeaveStatus;
  }

  // Manual Yet to Go / On Vacation after a finished trip only when the
  // employee travel date is after that trip ended (Returned Back → Yet to Go).
  const employeeDateStatus = statusFromEmployeeDates(employee, today);
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
  if (['Vacation Pending', 'On Vacation', 'Vacation Approved'].includes(employee?.vacationStatus)) {
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
  toCalendarDate,
  leaveBelongsToEmployee,
  getLeaveTravelStartDate,
  getTripReturnDate,
  statusFromLeaveDates,
  resolveEmployeeVacationStatus,
  applyEffectiveVacationStatuses,
};
