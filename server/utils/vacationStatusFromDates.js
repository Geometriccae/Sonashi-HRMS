/**
 * Central vacation/leave status resolver.
 * Status is derived from approved leave dates + today, not a stale stored label.
 *
 *   today < travel            → Vacation Pending (Yet to go)
 *   travel ≤ today < end      → On Vacation
 *   today ≥ end (last 6 mo.)  → Vacation Approved (Returned)
 *
 * Employment status (Active / Notice Period / Ex-employee) is separate.
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

function isWithinLastMonths(day, today, months) {
  if (!day || !today) return false;
  const from = new Date(today);
  from.setMonth(from.getMonth() - months);
  return day >= from && day <= today;
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
  if (leaveCode && empCode && leaveCode === empCode) return true;

  const leaveEmail = String(leave.employee?.emailId || '').trim().toLowerCase();
  if (leaveEmail && empEmail && leaveEmail === empEmail) return true;

  const hasLeaveStaffOrRecord = Boolean(recordId || leaveStaff || (leaveCode && isHrStaffCode(leaveCode)));
  if (hasLeaveStaffOrRecord) return false;

  const leaveName = normalizeName(leave.employeeName || leave.employee?.username);
  return Boolean(leaveName && empName && leaveName === empName);
}

function getLeaveTravelStartDate(leave, employee) {
  return toCalendarDate(leave?.travellingDate || leave?.startDate || employee?.travellingDate);
}

function statusFromTravelAndEnd(travel, end, employee, today) {
  if (!today || !travel || !end) return null;
  const returnDay = toCalendarDate(employee?.returnDate);
  if (returnDay && today >= returnDay && travel <= returnDay && today < end) {
    return 'Vacation Approved';
  }
  if (today < travel) return 'Vacation Pending';
  if (today >= travel && today < end) return 'On Vacation';
  if (today >= end) return 'Vacation Approved';
  return null;
}

function statusFromLeaveDates(leave, employee, todayValue) {
  if (!leave || !APPROVED_LEAVE_STATUSES.includes(leave.status)) return null;
  const today = toCalendarDate(todayValue || new Date());
  const travel = getLeaveTravelStartDate(leave, employee);
  const end = toCalendarDate(leave.endDate);
  return statusFromTravelAndEnd(travel, end, employee, today);
}

/** Team Management vacation dates on the employee record (same date rules as leave). */
function statusFromEmployeeDates(employee, todayValue) {
  const today = toCalendarDate(todayValue || new Date());
  const travel = toCalendarDate(employee?.travellingDate);
  const end = toCalendarDate(employee?.leaveEndDate);
  if (!today || !travel) return null;
  if (!end) {
    if (today < travel) return 'Vacation Pending';
    return null;
  }
  return statusFromTravelAndEnd(travel, end, employee, today);
}

function resolveEmployeeVacationStatus(employee, leaveRequests, todayValue) {
  const today = toCalendarDate(todayValue || new Date());
  const leaves = (Array.isArray(leaveRequests) ? leaveRequests : []).filter((leave) =>
    leaveBelongsToEmployee(leave, employee)
  );

  const empTravel = toCalendarDate(employee?.travellingDate);
  const empEnd = toCalendarDate(employee?.leaveEndDate);
  const empStatus = statusFromEmployeeDates(employee, today);
  const empInterval = empStatus
    ? { status: empStatus, travel: empTravel, end: empEnd || empTravel }
    : null;

  const fromLeaves = leaves
    .map((leave) => ({
      status: statusFromLeaveDates(leave, employee, today),
      travel: getLeaveTravelStartDate(leave, employee),
      end: toCalendarDate(leave.endDate),
    }))
    .filter((row) => row.status);

  // Employee travellingDate + leaveEndDate (Team Management) is the current trip.
  // Leaves that start on/after that end date are a later trip and still count.
  const ranked =
    empInterval && empTravel && empEnd
      ? [empInterval, ...fromLeaves.filter((row) => row.travel && row.travel >= empEnd)]
      : empInterval
        ? [...fromLeaves, empInterval]
        : fromLeaves;

  if (ranked.some((row) => row.status === 'On Vacation')) return 'On Vacation';
  if (ranked.some((row) => row.status === 'Vacation Pending')) return 'Vacation Pending';

  const returnDay = toCalendarDate(employee?.returnDate);
  const newerAfterReturn = ranked.some(
    (row) => returnDay && row.travel && row.travel >= returnDay && row.status !== 'Vacation Approved'
  );
  if (returnDay && today >= returnDay && !newerAfterReturn && isWithinLastMonths(returnDay, today, 6)) {
    return 'Vacation Approved';
  }

  const latestEnd = ranked
    .filter((row) => row.status === 'Vacation Approved')
    .map((row) => row.end)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  if (latestEnd && isWithinLastMonths(latestEnd, today, 6)) return 'Vacation Approved';

  if (employee?.vacationStatus === 'Onboarding') return 'Onboarding';
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
  statusFromLeaveDates,
  resolveEmployeeVacationStatus,
  applyEffectiveVacationStatuses,
};
