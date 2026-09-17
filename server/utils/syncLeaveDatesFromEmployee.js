/**
 * When HR updates vacation dates on the Employee record (Employee Master /
 * vacation-status), keep the linked approved LeaveRequest trip dates in sync
 * so Annual Vacations / On Vacation / Yet To Go / status derivation all read
 * the same values.
 *
 * Does NOT change leave entitlement / leaveDays totals: freezes leaveDays from
 * the previous start/end window before rewriting dates (same pattern as
 * vacation-return).
 */

const LeaveRequest = require('../models/LeaveRequest');
const { leaveBelongsToEmployee, toCalendarDate } = require('./vacationStatusFromDates');

const APPROVED_LEAVE_STATUSES = ['Approved', 'HOD Approved'];
const VACATION_LEAVE_TYPES = new Set(['Vacation', 'Annual Leave']);

function freezeLeaveDaysIfNeeded(leave) {
  if (leave.leaveDays != null) return;
  if (!leave.startDate || !leave.endDate) return;
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (Number.isFinite(days) && days >= 0) {
    leave.leaveDays = days === 0 ? 1 : days;
  }
}

function calendarDateOnly(value) {
  const d = toCalendarDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Pick the controlling approved leave for an employee (active trip,
 * else nearest future, else most recent). Prefer Vacation / Annual Leave.
 */
async function findControllingVacationLeave(employee, preferredLeaveId = null) {
  if (!employee) return null;

  if (preferredLeaveId) {
    const byId = await LeaveRequest.findById(preferredLeaveId);
    if (byId && APPROVED_LEAVE_STATUSES.includes(byId.status)) return byId;
  }

  const empPlain =
    typeof employee.toObject === 'function' ? employee.toObject() : employee;
  const or = [];
  if (empPlain._id) {
    or.push({ employeeRecordId: empPlain._id });
    or.push({ employee: empPlain._id });
  }
  if (empPlain.employeeId) or.push({ employeeId: empPlain.employeeId });
  if (empPlain.employeeName) or.push({ employeeName: empPlain.employeeName });

  const query = {
    status: { $in: APPROVED_LEAVE_STATUSES },
    ...(or.length ? { $or: or } : {}),
  };

  const candidates = await LeaveRequest.find(query).sort({ startDate: -1 }).limit(50);
  const mine = candidates.filter((row) => leaveBelongsToEmployee(row, empPlain));
  if (mine.length === 0) return null;

  const vacationPool = mine.filter((row) => VACATION_LEAVE_TYPES.has(row.leaveType));
  const pool = vacationPool.length > 0 ? vacationPool : mine;

  const today = toCalendarDate(new Date());
  const active = pool.find((row) => {
    const start = toCalendarDate(row.travellingDate || row.startDate);
    const end = toCalendarDate(row.endDate);
    return start && end && start <= today && today <= end;
  });
  if (active) return active;

  const future = [...pool]
    .filter((row) => {
      const start = toCalendarDate(row.travellingDate || row.startDate);
      return start && start > today;
    })
    .sort(
      (a, b) =>
        toCalendarDate(a.travellingDate || a.startDate) -
        toCalendarDate(b.travellingDate || b.startDate)
    )[0];
  if (future) return future;

  return pool[0] || null;
}

/**
 * Sync LeaveRequest.startDate / endDate from Employee travellingDate / leaveEndDate.
 * @returns {Promise<object|null>} updated leave doc or null
 */
async function syncLinkedLeaveDatesFromEmployee(employee, {
  travellingDate,
  leaveEndDate,
  actor = 'System',
  actorUserId = null,
  leaveId = null,
} = {}) {
  const hasTravel = travellingDate !== undefined;
  const hasEnd = leaveEndDate !== undefined;
  if (!hasTravel && !hasEnd) return null;

  const leave = await findControllingVacationLeave(employee, leaveId);
  if (!leave) return null;

  const nextStart = hasTravel ? calendarDateOnly(travellingDate) : null;
  const nextEnd = hasEnd ? calendarDateOnly(leaveEndDate) : null;

  let changed = false;
  if (hasTravel && nextStart) {
    const prev = calendarDateOnly(leave.startDate);
    if (!prev || prev.getTime() !== nextStart.getTime()) {
      freezeLeaveDaysIfNeeded(leave);
      leave.startDate = nextStart;
      changed = true;
    }
  }
  if (hasEnd && nextEnd) {
    const prev = calendarDateOnly(leave.endDate);
    if (!prev || prev.getTime() !== nextEnd.getTime()) {
      freezeLeaveDaysIfNeeded(leave);
      leave.endDate = nextEnd;
      changed = true;
    }
  }
  // Clearing leave end on employee should clear leave end only when explicitly null
  if (hasEnd && leaveEndDate === null) {
    // Keep leave.endDate — approved leave period should not be wiped by a null patch.
  }

  if (!changed) return leave;

  const remark = 'Vacation dates updated from Employee Master';
  leave.changeStatus = 'Modified';
  leave.changedBy = actor;
  leave.changedByUser = actorUserId || null;
  leave.changedOn = new Date();
  leave.changeRemarks = remark;
  if (Array.isArray(leave.statusChangeHistory)) {
    leave.statusChangeHistory.push({
      changeStatus: 'Modified',
      changedBy: actor,
      changedByUser: actorUserId || null,
      changedOn: new Date(),
      remarks: remark,
    });
  }
  await leave.save();
  return leave;
}

module.exports = {
  findControllingVacationLeave,
  syncLinkedLeaveDatesFromEmployee,
};
