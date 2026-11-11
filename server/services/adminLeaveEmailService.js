/**
 * Admin-to-Manager Leave Email Notification Service.
 *
 * Implements the notification workflow when an Admin user submits, or when
 * an assigned Manager approves or rejects, an Admin leave request.
 *
 * Reuses the existing Nodemailer Gmail SMTP transport (EMAIL_USER / EMAIL_PASS)
 * and existing Leave Management routing.
 */

const nodemailer = require('nodemailer');
const User = require('../models/User');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const { getPendingLeaveRecipients } = require('./pendingLeaveEmailService');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatDate = (value) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const leaveDaysLabel = (leave) => {
    const n = Number(leave?.leaveDays);
    if (!Number.isFinite(n) || n < 0) return 'N/A';
    return `${n} ${n === 1 ? 'day' : 'days'}`;
};

/** View link to the Leave Management page. */
function leaveManagementUrl() {
    const base = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    return base ? `${base}/leave-requests` : '';
}

/**
 * Configure the email transporter using existing Gmail SMTP environment variables.
 */
function getLeaveTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[AdminLeave] EMAIL_USER or EMAIL_PASS not set in .env – cannot send leave emails');
        return null;
    }
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: false },
    });
}

function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const clean = email.trim().toLowerCase();
    if (clean.includes('placeholder') || clean.includes('import.hrms')) return false;
    return EMAIL_RE.test(clean);
}

/** Helper to await Mongoose queries or plain mock promises safely. */
async function execQuery(query) {
    if (!query) return null;
    if (typeof query.lean === 'function') {
        return query.lean();
    }
    return query;
}

/**
 * Dynamically resolves the assigned Reporting Manager's email and name.
 * Hierarchy:
 *  1. Search by leave.reportingManager in Employee and User records.
 *  2. Search by employee.reportingManager from the employee's master record.
 *  3. If no manager assigned, fallback to authorize users (role: 'authorize_user').
 *  4. Fallback to configured pending leave recipients.
 *
 * Never hardcodes emails.
 */
async function resolveManagerRecipient(leave, { EmployeeModel = Employee, UserModel = User } = {}) {
    if (!leave) return null;

    let managerName = String(leave.reportingManager || '').trim();

    // If no manager name on leave record, check requester Employee master record
    if (!managerName) {
        try {
            let requesterEmp = null;
            if (leave.employeeRecordId) {
                requesterEmp = await execQuery(EmployeeModel.findById(leave.employeeRecordId));
            } else if (leave.employeeId) {
                requesterEmp = await execQuery(EmployeeModel.findOne({ employeeId: leave.employeeId }));
            } else if (leave.employee) {
                requesterEmp = await execQuery(EmployeeModel.findById(leave.employee));
            }
            if (requesterEmp?.reportingManager) {
                managerName = requesterEmp.reportingManager.trim();
            }
        } catch (err) {
            console.error('[AdminLeave] Error checking requester employee master:', err?.message || err);
        }
    }

    // 1. Direct email check in reportingManager field
    if (isValidEmail(managerName)) {
        return { email: managerName.toLowerCase(), name: managerName };
    }

    // 2. Resolve via managerName if provided
    if (managerName) {
        const regex = new RegExp(`^${escapeRegex(managerName)}$`, 'i');

        // Check Employee collection
        try {
            const emp = await execQuery(EmployeeModel.findOne({ employeeName: regex }));
            if (emp) {
                if (isValidEmail(emp.emailId)) {
                    return { email: emp.emailId.trim().toLowerCase(), name: emp.employeeName };
                }
                // Check if user linked to this employee has email
                const userLinked = await execQuery(UserModel.findOne({
                    $or: [{ employeeId: emp._id }, { username: regex }]
                }));
                if (isValidEmail(userLinked?.emailId)) {
                    return { email: userLinked.emailId.trim().toLowerCase(), name: emp.employeeName };
                }
            }
        } catch (err) {
            console.error('[AdminLeave] Error resolving manager from Employee:', err?.message || err);
        }

        // Check User collection directly
        try {
            const user = await execQuery(UserModel.findOne({ username: regex }));
            if (isValidEmail(user?.emailId)) {
                return { email: user.emailId.trim().toLowerCase(), name: user.username };
            }
        } catch (err) {
            console.error('[AdminLeave] Error resolving manager from User:', err?.message || err);
        }

        // When a manager name was explicitly specified but has no resolvable email,
        // do NOT send to someone else! Return null for safe error handling.
        return null;
    }

    // 3. If no manager was assigned, use the existing approval hierarchy fallback for Admin leaves: Authorize Users
    try {
        const authUsers = await execQuery(UserModel.find({ role: 'authorize_user' }, 'emailId username'));
        if (Array.isArray(authUsers)) {
            for (const u of authUsers) {
                if (isValidEmail(u.emailId)) {
                    return { email: u.emailId.trim().toLowerCase(), name: u.username || 'Reporting Manager' };
                }
            }
        }
    } catch (err) {
        console.error('[AdminLeave] Error fetching authorize_users:', err?.message || err);
    }

    // 4. Configured pending leave recipients fallback
    try {
        const recipients = getPendingLeaveRecipients();
        if (recipients.length > 0 && isValidEmail(recipients[0])) {
            return { email: recipients[0].toLowerCase(), name: 'Reporting Manager' };
        }
    } catch (_) { }

    return null;
}

/**
 * Dynamically resolves the original requesting Admin's email and name.
 */
async function resolveAdminRequesterRecipient(leave, { EmployeeModel = Employee, UserModel = User } = {}) {
    if (!leave) return null;

    // 1. Explicitly recorded submittedByUser
    if (leave.submittedByUser) {
        try {
            const user = await execQuery(UserModel.findById(leave.submittedByUser));
            if (isValidEmail(user?.emailId)) {
                return { email: user.emailId.trim().toLowerCase(), name: user.username };
            }
        } catch (err) {
            console.error('[AdminLeave] Error resolving submittedByUser:', err?.message || err);
        }
    }

    // 2. Owner User record (leave.employee may reference User)
    if (leave.employee) {
        try {
            const user = await execQuery(UserModel.findById(leave.employee));
            if (isValidEmail(user?.emailId)) {
                return { email: user.emailId.trim().toLowerCase(), name: user.username };
            }
        } catch (err) {
            console.error('[AdminLeave] Error resolving owner User:', err?.message || err);
        }
    }

    // 3. User from status change history or changedByUser
    const historyUserId = leave.statusChangeHistory?.[0]?.changedByUser || leave.changedByUser;
    if (historyUserId) {
        try {
            const user = await execQuery(UserModel.findById(historyUserId));
            if (isValidEmail(user?.emailId)) {
                return { email: user.emailId.trim().toLowerCase(), name: user.username };
            }
        } catch (err) {
            console.error('[AdminLeave] Error resolving history user:', err?.message || err);
        }
    }

    // 4. Employee record email
    try {
        let emp = null;
        if (leave.employeeRecordId) {
            emp = await execQuery(EmployeeModel.findById(leave.employeeRecordId));
        } else if (leave.employeeId) {
            emp = await execQuery(EmployeeModel.findOne({ employeeId: leave.employeeId }));
        }
        if (isValidEmail(emp?.emailId)) {
            return { email: emp.emailId.trim().toLowerCase(), name: emp.employeeName };
        }
    } catch (err) {
        console.error('[AdminLeave] Error resolving employee record email:', err?.message || err);
    }

    // 5. User lookup by employeeName with role admin
    if (leave.employeeName) {
        try {
            const regex = new RegExp(`^${escapeRegex(leave.employeeName.trim())}$`, 'i');
            const adminUser = await execQuery(UserModel.findOne({ username: regex, role: 'admin' }));
            if (isValidEmail(adminUser?.emailId)) {
                return { email: adminUser.emailId.trim().toLowerCase(), name: adminUser.username };
            }
        } catch (err) {
            console.error('[AdminLeave] Error resolving admin by username:', err?.message || err);
        }
    }

    return null;
}

/** Subject + HTML for Admin Leave Request Submission -> Email Manager */
function buildAdminLeaveSubmissionEmail(leave, managerName = '') {
    const adminName = leave?.employeeName || 'Admin User';
    const employeeCode = leave?.employeeId || leave?.linkedEmployeeCode || '';
    const leaveId = String(leave?._id || '');
    const link = leaveManagementUrl();

    const rows = [
        ['Admin / Employee Name', adminName],
        ['Employee ID', employeeCode || 'N/A'],
        ['Department', leave?.department || 'N/A'],
        ['Leave Type', leave?.leaveType || 'N/A'],
        ['Leave Start Date', formatDate(leave?.startDate)],
        ['Leave End Date', formatDate(leave?.endDate)],
        ['Number of Leave Days', leaveDaysLabel(leave)],
        ['Reason for Leave', leave?.reason || 'N/A'],
        ['Assigned Manager', managerName || leave?.reportingManager || 'N/A'],
        ['Current Status', 'Pending Approval'],
        ['Request Reference ID', leaveId || 'N/A'],
        ['Applied On', formatDate(leave?.appliedOn || leave?.createdAt || new Date())],
    ];

    const rowsHtml = rows
        .map(
            ([label, value]) => `
                <tr>
                    <td style="padding: 7px 12px 7px 0; color: #555; white-space: nowrap; vertical-align: top;"><strong>${escapeHtml(label)}:</strong></td>
                    <td style="padding: 7px 0; color: #111;">${escapeHtml(value)}</td>
                </tr>`
        )
        .join('');

    const buttonHtml = link
        ? `<p style="margin-top: 24px;">
                <a href="${escapeHtml(link)}" style="background: #1a73e8; color: #ffffff; padding: 11px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View Leave Request</a>
           </p>
           <p style="font-size: 12px; color: #777;">Please sign in to the Sonashi HRMS to review, approve, or reject this request.</p>`
        : `<p style="margin-top: 20px; color: #555;">Please sign in to Sonashi HRMS Leave Management to review, approve, or reject this request.</p>`;

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div style="border-bottom: 2px solid #1a73e8; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="color: #1a73e8; margin: 0; font-size: 20px;">Admin Leave Request – Action Required</h2>
            </div>
            <p style="color: #333; font-size: 14px; line-height: 1.5;">
                A new leave request submitted by Admin <strong>${escapeHtml(adminName)}</strong> requires your review and approval.
            </p>
            <table style="border-collapse: collapse; font-size: 14px; width: 100%; margin: 16px 0;">
                ${rowsHtml}
            </table>
            ${buttonHtml}
            <div style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #edf2f7; font-size: 11px; color: #a0aec0;">
                This is an automated notification from the Sonashi HRMS system.
            </div>
        </div>
    `;

    const subject = `Pending Leave Approval: Admin Request – ${adminName}${employeeCode ? ` (${employeeCode})` : ''}`;
    return { subject, html };
}

/** Subject + HTML for Manager Approves -> Email Admin */
function buildAdminLeaveApprovedEmail(leave, { managerName = '', remarks = '' } = {}) {
    const adminName = leave?.employeeName || 'Admin User';
    const employeeCode = leave?.employeeId || leave?.linkedEmployeeCode || '';
    const leaveId = String(leave?._id || '');
    const link = leaveManagementUrl();

    const rows = [
        ['Admin / Employee Name', adminName],
        ['Employee ID', employeeCode || 'N/A'],
        ['Leave Type', leave?.leaveType || 'N/A'],
        ['Leave Period', `${formatDate(leave?.startDate)} to ${formatDate(leave?.endDate)}`],
        ['Number of Leave Days', leaveDaysLabel(leave)],
        ['Approval Status', 'Approved'],
        ['Approved By', managerName || 'Reporting Manager'],
        ['Remarks / Notes', remarks || 'Leave request approved'],
        ['Request Reference ID', leaveId || 'N/A'],
        ['Decision Date', formatDate(new Date())],
    ];

    const rowsHtml = rows
        .map(
            ([label, value]) => `
                <tr>
                    <td style="padding: 7px 12px 7px 0; color: #555; white-space: nowrap; vertical-align: top;"><strong>${escapeHtml(label)}:</strong></td>
                    <td style="padding: 7px 0; color: #111;">${escapeHtml(value)}</td>
                </tr>`
        )
        .join('');

    const buttonHtml = link
        ? `<p style="margin-top: 24px;">
                <a href="${escapeHtml(link)}" style="background: #16a34a; color: #ffffff; padding: 11px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View Leave Details</a>
           </p>`
        : '';

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div style="border-bottom: 2px solid #16a34a; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="color: #16a34a; margin: 0; font-size: 20px;">Leave Request Approved</h2>
            </div>
            <p style="color: #333; font-size: 14px; line-height: 1.5;">
                Dear <strong>${escapeHtml(adminName)}</strong>, your leave request has been <strong>approved</strong> by ${escapeHtml(managerName || 'your Reporting Manager')}.
            </p>
            <table style="border-collapse: collapse; font-size: 14px; width: 100%; margin: 16px 0;">
                ${rowsHtml}
            </table>
            ${buttonHtml}
            <div style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #edf2f7; font-size: 11px; color: #a0aec0;">
                This is an automated notification from the Sonashi HRMS system.
            </div>
        </div>
    `;

    const subject = `Leave Request Approved – ${adminName} (${formatDate(leave?.startDate)} to ${formatDate(leave?.endDate)})`;
    return { subject, html };
}

/** Subject + HTML for Manager Rejects -> Email Admin */
function buildAdminLeaveRejectedEmail(leave, { managerName = '', remarks = '' } = {}) {
    const adminName = leave?.employeeName || 'Admin User';
    const employeeCode = leave?.employeeId || leave?.linkedEmployeeCode || '';
    const leaveId = String(leave?._id || '');
    const link = leaveManagementUrl();

    const rows = [
        ['Admin / Employee Name', adminName],
        ['Employee ID', employeeCode || 'N/A'],
        ['Leave Type', leave?.leaveType || 'N/A'],
        ['Leave Period', `${formatDate(leave?.startDate)} to ${formatDate(leave?.endDate)}`],
        ['Number of Leave Days', leaveDaysLabel(leave)],
        ['Decision Status', 'Rejected'],
        ['Rejected By', managerName || 'Reporting Manager'],
        ['Reason / Remarks', remarks || 'Leave request rejected'],
        ['Request Reference ID', leaveId || 'N/A'],
        ['Decision Date', formatDate(new Date())],
    ];

    const rowsHtml = rows
        .map(
            ([label, value]) => `
                <tr>
                    <td style="padding: 7px 12px 7px 0; color: #555; white-space: nowrap; vertical-align: top;"><strong>${escapeHtml(label)}:</strong></td>
                    <td style="padding: 7px 0; color: #111;">${escapeHtml(value)}</td>
                </tr>`
        )
        .join('');

    const buttonHtml = link
        ? `<p style="margin-top: 24px;">
                <a href="${escapeHtml(link)}" style="background: #dc2626; color: #ffffff; padding: 11px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View Leave Details</a>
           </p>`
        : '';

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 24px; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
            <div style="border-bottom: 2px solid #dc2626; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="color: #dc2626; margin: 0; font-size: 20px;">Leave Request Rejected</h2>
            </div>
            <p style="color: #333; font-size: 14px; line-height: 1.5;">
                Dear <strong>${escapeHtml(adminName)}</strong>, your leave request has been <strong>rejected</strong> by ${escapeHtml(managerName || 'your Reporting Manager')}.
            </p>
            <table style="border-collapse: collapse; font-size: 14px; width: 100%; margin: 16px 0;">
                ${rowsHtml}
            </table>
            ${buttonHtml}
            <div style="margin-top: 28px; padding-top: 12px; border-top: 1px solid #edf2f7; font-size: 11px; color: #a0aec0;">
                This is an automated notification from the Sonashi HRMS system.
            </div>
        </div>
    `;

    const subject = `Leave Request Rejected – ${adminName} (${formatDate(leave?.startDate)} to ${formatDate(leave?.endDate)})`;
    return { subject, html };
}

/**
 * Sends notification to the assigned Reporting Manager when an Admin submits a leave request.
 * - Idempotent: Skips if submissionEmailSent is true.
 * - Non-throwing: Catches and logs errors without reverting DB operations.
 */
async function sendAdminLeaveSubmittedEmail(leave, options = {}) {
    const leaveId = String(leave?._id || '');
    if (!leave) return { skipped: 'no_leave' };

    // Duplicate check
    if (leave.adminLeaveNotifications?.submissionEmailSent) {
        console.log(`[AdminLeave] Submission email already sent for ${leaveId}. Skipping duplicate.`);
        return { skipped: 'already_sent' };
    }

    // Role check: Only applies to Admin leave requests
    const isAdmin = String(leave.requesterRole || options.submitter?.role || '').toLowerCase() === 'admin';
    if (!isAdmin) {
        return { skipped: 'not_admin_leave' };
    }

    const LeaveRequestModel = options.LeaveRequestModel || LeaveRequest;
    const EmployeeModel = options.EmployeeModel || Employee;
    const UserModel = options.UserModel || User;

    // Resolve Manager dynamically
    const manager = await resolveManagerRecipient(leave, { EmployeeModel, UserModel });
    if (!manager || !manager.email) {
        console.warn(`[AdminLeave] Cannot send submission email for ${leaveId}: manager email could not be resolved`);
        try {
            if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
                await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                    $set: { 'adminLeaveNotifications.lastError': 'Manager email could not be resolved' }
                });
            }
        } catch (_) { }
        return { skipped: 'no_recipient' };
    }

    const transporter = options.transporter || getLeaveTransporter();
    if (!transporter) {
        console.warn(`[AdminLeave] Email transporter not configured. Cannot send email for ${leaveId}`);
        return { skipped: 'no_transporter' };
    }

    const { subject, html } = buildAdminLeaveSubmissionEmail(leave, manager.name);
    const sender = options.from || `"Auxin Leave" <${process.env.EMAIL_USER}>`;

    try {
        await transporter.sendMail({
            from: sender,
            to: manager.email,
            subject,
            html,
        });
        console.log(`[AdminLeave] Submission email sent for ${leaveId} to manager ${manager.email}`);

        // Persist notification success
        if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
            await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                $set: {
                    'adminLeaveNotifications.submissionEmailSent': true,
                    'adminLeaveNotifications.submissionEmailSentAt': new Date(),
                    'adminLeaveNotifications.submissionEmailRecipient': manager.email,
                    'adminLeaveNotifications.lastError': '',
                }
            });
        }
        if (leave.adminLeaveNotifications) {
            leave.adminLeaveNotifications.submissionEmailSent = true;
            leave.adminLeaveNotifications.submissionEmailSentAt = new Date();
            leave.adminLeaveNotifications.submissionEmailRecipient = manager.email;
        }

        return { sent: [manager.email], recipient: manager.email };
    } catch (err) {
        const errMsg = err?.message || String(err);
        console.error(`[AdminLeave] Submission email failed for ${leaveId} to ${manager.email}:`, errMsg);
        try {
            if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
                await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                    $set: { 'adminLeaveNotifications.lastError': errMsg }
                });
            }
        } catch (_) { }
        return { failed: [manager.email], error: errMsg };
    }
}

/**
 * Sends approval confirmation email to the requesting Admin when a Manager approves the request.
 * - Idempotent: Skips if approvalEmailSent is true.
 * - Non-throwing.
 */
async function sendAdminLeaveApprovedEmail(leave, options = {}) {
    const leaveId = String(leave?._id || '');
    if (!leave) return { skipped: 'no_leave' };

    // Duplicate check
    if (leave.adminLeaveNotifications?.approvalEmailSent) {
        console.log(`[AdminLeave] Approval email already sent for ${leaveId}. Skipping duplicate.`);
        return { skipped: 'already_sent' };
    }

    // Role check: Only applies to Admin leave requests
    const isAdmin = String(leave.requesterRole || '').toLowerCase() === 'admin';
    if (!isAdmin) {
        return { skipped: 'not_admin_leave' };
    }

    const LeaveRequestModel = options.LeaveRequestModel || LeaveRequest;
    const EmployeeModel = options.EmployeeModel || Employee;
    const UserModel = options.UserModel || User;

    // Resolve Admin requester dynamically
    const admin = await resolveAdminRequesterRecipient(leave, { EmployeeModel, UserModel });
    if (!admin || !admin.email) {
        console.warn(`[AdminLeave] Cannot send approval email for ${leaveId}: Admin email could not be resolved`);
        try {
            if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
                await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                    $set: { 'adminLeaveNotifications.lastError': 'Admin requester email could not be resolved' }
                });
            }
        } catch (_) { }
        return { skipped: 'no_recipient' };
    }

    const transporter = options.transporter || getLeaveTransporter();
    if (!transporter) {
        console.warn(`[AdminLeave] Email transporter not configured for approval email ${leaveId}`);
        return { skipped: 'no_transporter' };
    }

    const managerName = options.manager?.username || options.managerName || leave.reportingManager || 'Reporting Manager';
    const remarks = options.remarks || leave.changeRemarks || '';
    const { subject, html } = buildAdminLeaveApprovedEmail(leave, { managerName, remarks });
    const sender = options.from || `"Auxin Leave" <${process.env.EMAIL_USER}>`;

    try {
        await transporter.sendMail({
            from: sender,
            to: admin.email,
            subject,
            html,
        });
        console.log(`[AdminLeave] Approval confirmation email sent for ${leaveId} to Admin ${admin.email}`);

        // Persist notification success
        if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
            await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                $set: {
                    'adminLeaveNotifications.approvalEmailSent': true,
                    'adminLeaveNotifications.approvalEmailSentAt': new Date(),
                    'adminLeaveNotifications.approvalEmailRecipient': admin.email,
                    'adminLeaveNotifications.lastError': '',
                }
            });
        }
        if (leave.adminLeaveNotifications) {
            leave.adminLeaveNotifications.approvalEmailSent = true;
            leave.adminLeaveNotifications.approvalEmailSentAt = new Date();
            leave.adminLeaveNotifications.approvalEmailRecipient = admin.email;
        }

        return { sent: [admin.email], recipient: admin.email };
    } catch (err) {
        const errMsg = err?.message || String(err);
        console.error(`[AdminLeave] Approval email failed for ${leaveId} to ${admin.email}:`, errMsg);
        try {
            if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
                await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                    $set: { 'adminLeaveNotifications.lastError': errMsg }
                });
            }
        } catch (_) { }
        return { failed: [admin.email], error: errMsg };
    }
}

/**
 * Sends rejection notification email to the requesting Admin when a Manager rejects the request.
 * - Idempotent: Skips if rejectionEmailSent is true.
 * - Non-throwing.
 */
async function sendAdminLeaveRejectedEmail(leave, options = {}) {
    const leaveId = String(leave?._id || '');
    if (!leave) return { skipped: 'no_leave' };

    // Duplicate check
    if (leave.adminLeaveNotifications?.rejectionEmailSent) {
        console.log(`[AdminLeave] Rejection email already sent for ${leaveId}. Skipping duplicate.`);
        return { skipped: 'already_sent' };
    }

    // Role check: Only applies to Admin leave requests
    const isAdmin = String(leave.requesterRole || '').toLowerCase() === 'admin';
    if (!isAdmin) {
        return { skipped: 'not_admin_leave' };
    }

    const LeaveRequestModel = options.LeaveRequestModel || LeaveRequest;
    const EmployeeModel = options.EmployeeModel || Employee;
    const UserModel = options.UserModel || User;

    // Resolve Admin requester dynamically
    const admin = await resolveAdminRequesterRecipient(leave, { EmployeeModel, UserModel });
    if (!admin || !admin.email) {
        console.warn(`[AdminLeave] Cannot send rejection email for ${leaveId}: Admin email could not be resolved`);
        try {
            if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
                await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                    $set: { 'adminLeaveNotifications.lastError': 'Admin requester email could not be resolved' }
                });
            }
        } catch (_) { }
        return { skipped: 'no_recipient' };
    }

    const transporter = options.transporter || getLeaveTransporter();
    if (!transporter) {
        console.warn(`[AdminLeave] Email transporter not configured for rejection email ${leaveId}`);
        return { skipped: 'no_transporter' };
    }

    const managerName = options.manager?.username || options.managerName || leave.reportingManager || 'Reporting Manager';
    const remarks = options.remarks || leave.changeRemarks || '';
    const { subject, html } = buildAdminLeaveRejectedEmail(leave, { managerName, remarks });
    const sender = options.from || `"Auxin Leave" <${process.env.EMAIL_USER}>`;

    try {
        await transporter.sendMail({
            from: sender,
            to: admin.email,
            subject,
            html,
        });
        console.log(`[AdminLeave] Rejection notification email sent for ${leaveId} to Admin ${admin.email}`);

        // Persist notification success
        if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
            await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                $set: {
                    'adminLeaveNotifications.rejectionEmailSent': true,
                    'adminLeaveNotifications.rejectionEmailSentAt': new Date(),
                    'adminLeaveNotifications.rejectionEmailRecipient': admin.email,
                    'adminLeaveNotifications.lastError': '',
                }
            });
        }
        if (leave.adminLeaveNotifications) {
            leave.adminLeaveNotifications.rejectionEmailSent = true;
            leave.adminLeaveNotifications.rejectionEmailSentAt = new Date();
            leave.adminLeaveNotifications.rejectionEmailRecipient = admin.email;
        }

        return { sent: [admin.email], recipient: admin.email };
    } catch (err) {
        const errMsg = err?.message || String(err);
        console.error(`[AdminLeave] Rejection email failed for ${leaveId} to ${admin.email}:`, errMsg);
        try {
            if (leaveId && LeaveRequestModel?.findByIdAndUpdate) {
                await LeaveRequestModel.findByIdAndUpdate(leaveId, {
                    $set: { 'adminLeaveNotifications.lastError': errMsg }
                });
            }
        } catch (_) { }
        return { failed: [admin.email], error: errMsg };
    }
}

module.exports = {
    getLeaveTransporter,
    leaveManagementUrl,
    resolveManagerRecipient,
    resolveAdminRequesterRecipient,
    buildAdminLeaveSubmissionEmail,
    buildAdminLeaveApprovedEmail,
    buildAdminLeaveRejectedEmail,
    sendAdminLeaveSubmittedEmail,
    sendAdminLeaveApprovedEmail,
    sendAdminLeaveRejectedEmail,
};
