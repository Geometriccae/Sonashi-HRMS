const Notification = require('../models/Notification');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const { workingStatusFilter } = require('../utils/employeeStatus');
const { applyEffectiveVacationStatuses } = require('../utils/vacationStatusFromDates');

const HR_NOTIFY_ROLES = ['admin', 'hr', 'viewer', 'hod'];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function getDiffDays(dateValue, today) {
  if (!dateValue) return null;
  const expDate = new Date(dateValue);
  if (Number.isNaN(expDate.getTime())) return null;
  expDate.setHours(0, 0, 0, 0);
  return Math.round((expDate.getTime() - today.getTime()) / MS_PER_DAY);
}

function getTimeStr(diffDays) {
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 0) return `${Math.abs(diffDays)} day(s) ago`;
  return `in ${diffDays} days`;
}

function formatDate(dateValue) {
  if (!dateValue) return 'N/A';
  return new Date(dateValue).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function makeAlert({ id, type, title, body, meta = {} }) {
  return {
    id,
    type,
    title,
    body,
    meta,
    timestamp: new Date().toISOString(),
  };
}

async function persistAndEmit(io, payload, options = {}) {
  const roles = options.roles || HR_NOTIFY_ROLES;
  const dedupeId = options.dedupeId || payload.id;

  try {
    if (io) {
      if (options.userId) {
        io.to(`user-${options.userId}`).emit('notification', payload);
      }
      if (options.email) {
        io.to(`email-${options.email}`).emit('notification', payload);
      }
      roles.forEach((role) => {
        io.to(`role-${role}`).emit('notification', payload);
      });
    }

    const targets = [];
    if (options.userId) targets.push({ userId: options.userId });
    if (options.email) targets.push({ email: options.email });
    roles.forEach((role) => targets.push({ role }));

    for (const target of targets) {
      const query = { 'payload.id': dedupeId, ...target };
      const existing = await Notification.findOne(query).lean();
      if (existing) continue;

      await Notification.create({
        title: payload.title,
        body: payload.body,
        payload: { ...payload, id: dedupeId },
        ...target,
      });
    }
  } catch (err) {
    console.error('[HR Notification] persist/emit failed:', err.message);
  }
}

async function getHrAlerts() {
  const alerts = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const [employees, approvedLeaves] = await Promise.all([
    Employee.find(workingStatusFilter())
      .select('employeeName employeeId emailId employeeStatus vacationStatus doj passportExpiryDate visaExpiryDate labourCardExpiryDate emiratesIdExpiryDate contractRenewalDate travellingDate returnDate leaveEndDate firstWorkingDay')
      .lean(),
    LeaveRequest.find({ status: { $in: ['Approved', 'HOD Approved'] } })
      .select('employee employeeRecordId employeeId employeeName leaveType startDate endDate status travellingDate returnDate')
      .lean(),
  ]);
  const resolvedEmployees = applyEffectiveVacationStatuses(employees, approvedLeaves);

  for (const emp of resolvedEmployees) {
    const empName = emp.employeeName || 'Employee';
    const empId = String(emp._id);

    const docChecks = [
      { name: 'Passport', date: emp.passportExpiryDate },
      { name: 'Labour Card', date: emp.labourCardExpiryDate },
      { name: 'Visa', date: emp.visaExpiryDate },
      { name: 'Emirates ID', date: emp.emiratesIdExpiryDate },
    ];

    for (const doc of docChecks) {
      const diffDays = getDiffDays(doc.date, today);
      if (diffDays === null || diffDays < 0 || diffDays > 30) continue;
      alerts.push(makeAlert({
        id: `expiry-${empId}-${doc.name}-${todayStr}`,
        type: 'expiry-reminder',
        title: 'Document Expiry Reminder',
        body: `${empName}'s ${doc.name} is expiring ${getTimeStr(diffDays)} (${formatDate(doc.date)})`,
        meta: { url: `/teammanagement_salesleads/${empId}`, employeeId: empId, docName: doc.name },
      }));
    }

    if (emp.contractRenewalDate) {
      const diffDays = getDiffDays(emp.contractRenewalDate, today);
      if (diffDays !== null && diffDays >= 0 && diffDays <= 60) {
        alerts.push(makeAlert({
          id: `contract-renewal-${empId}-${todayStr}`,
          type: 'contract-renewal',
          title: 'Contract Renewal Reminder',
          body: `${empName}'s contract is due for renewal ${getTimeStr(diffDays)} (${formatDate(emp.contractRenewalDate)})`,
          meta: { url: `/teammanagement_salesleads/${empId}`, employeeId: empId },
        }));
      }
    }

    if (emp.doj) {
      const diffDays = getDiffDays(emp.doj, today);
      if (diffDays !== null && diffDays >= 0 && diffDays <= 14) {
        alerts.push(makeAlert({
          id: `joining-reminder-${empId}-${todayStr}`,
          type: 'joining-reminder',
          title: 'Employee Joining Date Reminder',
          body: `${empName} is joining ${getTimeStr(diffDays)} on ${formatDate(emp.doj)}`,
          meta: { url: `/teammanagement_salesleads/${empId}`, employeeId: empId },
        }));
      }
    }

    if (emp.vacationStatus === 'Onboarding') {
      alerts.push(makeAlert({
        id: `onboarding-${empId}-${todayStr}`,
        type: 'onboarding-reminder',
        title: 'Employee Onboarding',
        body: `${empName} is currently in onboarding${emp.doj ? ` (DOJ: ${formatDate(emp.doj)})` : ''}`,
        meta: { url: `/teammanagement_salesleads/${empId}`, employeeId: empId },
      }));
    }

    if (emp.vacationStatus === 'On Vacation') {
      const returnInfo = emp.firstWorkingDay
        ? ` Expected return: ${formatDate(emp.firstWorkingDay)}.`
        : '';
      const overdue = emp.firstWorkingDay && getDiffDays(emp.firstWorkingDay, today) < 0;
      alerts.push(makeAlert({
        id: `on-vacation-${empId}-${todayStr}`,
        type: overdue ? 'vacation-overdue' : 'on-vacation',
        title: overdue ? 'Employee Overdue from Vacation' : 'Employee On Vacation',
        body: `${empName} is still on vacation.${returnInfo}`,
        meta: { url: '/annual-vacations', employeeId: empId },
      }));
    }
  }

  const pendingLeaves = await LeaveRequest.find({ status: 'Pending' })
    .select('employeeName leaveType startDate endDate status appliedOn')
    .sort({ appliedOn: -1 })
    .limit(20)
    .lean();

  if (pendingLeaves.length > 0) {
    alerts.push(makeAlert({
      id: `pending-leaves-summary-${todayStr}`,
      type: 'pending-action',
      title: 'Pending Leave Approvals',
      body: `${pendingLeaves.length} leave request(s) are waiting for approval.`,
      meta: { url: '/leave-requests', count: pendingLeaves.length },
    }));

    pendingLeaves.slice(0, 5).forEach((leave) => {
      alerts.push(makeAlert({
        id: `pending-leave-${leave._id}-${todayStr}`,
        type: 'leave-pending',
        title: 'Leave Awaiting Approval',
        body: `${leave.employeeName || 'Employee'} submitted a ${leave.leaveType || 'leave'} request (${formatDate(leave.startDate)} - ${formatDate(leave.endDate)})`,
        meta: { url: '/leave-requests', leaveId: String(leave._id) },
      }));
    });
  }

  const hodApprovedLeaves = await LeaveRequest.find({ status: 'HOD Approved' })
    .select('employeeName leaveType startDate endDate status')
    .sort({ appliedOn: -1 })
    .limit(10)
    .lean();

  if (hodApprovedLeaves.length > 0) {
    alerts.push(makeAlert({
      id: `hod-approved-leaves-${todayStr}`,
      type: 'pending-action',
      title: 'Leaves Pending Final Approval',
      body: `${hodApprovedLeaves.length} leave request(s) are HOD approved and need final approval.`,
      meta: { url: '/leave-requests', count: hodApprovedLeaves.length },
    }));
  }

  return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function notifyLeaveSubmitted(io, leaveRequest) {
  const payload = makeAlert({
    id: `leave-submitted-${leaveRequest._id}`,
    type: 'leave-submitted',
    title: 'New Leave Request Submitted',
    body: `${leaveRequest.employeeName || 'Employee'} submitted a ${leaveRequest.leaveType || 'leave'} request (${formatDate(leaveRequest.startDate)} - ${formatDate(leaveRequest.endDate)})`,
    meta: { url: '/leave-requests', leaveId: String(leaveRequest._id) },
  });

  await persistAndEmit(io, payload, {
    roles: ['admin', 'hr', 'viewer', 'hod'],
    dedupeId: payload.id,
  });
}

async function notifyLeaveStatusChange(io, leaveRequest, newStatus, actorRole) {
  const statusMessages = {
    'HOD Approved': 'approved by HOD',
    Approved: 'approved',
    Rejected: 'rejected',
  };
  const statusText = statusMessages[newStatus] || `updated to ${newStatus}`;

  const hrPayload = makeAlert({
    id: `leave-status-${leaveRequest._id}-${newStatus}`,
    type: newStatus === 'Rejected' ? 'leave-rejected' : 'leave-approved',
    title: `Leave Request ${newStatus}`,
    body: `${leaveRequest.employeeName || 'Employee'}'s leave request was ${statusText} by ${actorRole || 'admin'}.`,
    meta: { url: '/leave-requests', leaveId: String(leaveRequest._id), status: newStatus },
  });

  await persistAndEmit(io, hrPayload, {
    roles: ['admin', 'hr', 'viewer'],
    dedupeId: hrPayload.id,
  });

  let employeeUser = null;
  if (leaveRequest.employee) {
    employeeUser = await User.findById(leaveRequest.employee).lean();
  }

  if (employeeUser) {
    const empPayload = makeAlert({
      id: `leave-employee-${leaveRequest._id}-${newStatus}`,
      type: newStatus === 'Rejected' ? 'leave-rejected' : 'leave-approved',
      title: `Your Leave Request ${newStatus}`,
      body: `Your ${leaveRequest.leaveType || 'leave'} request (${formatDate(leaveRequest.startDate)} - ${formatDate(leaveRequest.endDate)}) was ${statusText}.`,
      meta: { url: '/leave-requests', leaveId: String(leaveRequest._id), status: newStatus },
    });

    await persistAndEmit(io, empPayload, {
      roles: [],
      userId: String(employeeUser._id),
      email: employeeUser.emailId || undefined,
      dedupeId: empPayload.id,
    });
  }
}

async function notifyEmployeeOnboarding(io, employee) {
  const payload = makeAlert({
    id: `employee-onboarding-${employee._id}`,
    type: 'onboarding-reminder',
    title: 'New Employee Onboarding',
    body: `${employee.employeeName} has been added${employee.doj ? ` with joining date ${formatDate(employee.doj)}` : ''}.`,
    meta: { url: `/teammanagement_salesleads/${employee._id}`, employeeId: String(employee._id) },
  });

  await persistAndEmit(io, payload, {
    roles: HR_NOTIFY_ROLES,
    dedupeId: payload.id,
  });
}

async function runDailyHrAlerts(io) {
  const alerts = await getHrAlerts();
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const alert of alerts) {
    await persistAndEmit(io, alert, {
      roles: HR_NOTIFY_ROLES,
      dedupeId: `${alert.id}-${todayStr}`,
    });
  }

  console.log(`[HR Notification] Daily alerts processed: ${alerts.length}`);
}

module.exports = {
  HR_NOTIFY_ROLES,
  getHrAlerts,
  persistAndEmit,
  notifyLeaveSubmitted,
  notifyLeaveStatusChange,
  notifyEmployeeOnboarding,
  runDailyHrAlerts,
};
