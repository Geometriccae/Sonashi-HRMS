/**
 * Pending leave approval email.
 *
 * Sent once, when a leave request is created with status "Pending".
 * Recipients come from LEAVE_PENDING_NOTIFY_EMAILS (comma-separated) and
 * default to the leave approvers below. Transport is supplied by the caller
 * (the leave module's existing SMTP transporter), so there is one mail setup.
 */

const DEFAULT_PENDING_LEAVE_RECIPIENTS = ['mahesh@sonashi.ae', 'kailash@sonashi.ae'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPendingLeaveRecipients() {
    const configured = String(process.env.LEAVE_PENDING_NOTIFY_EMAILS || '')
        .split(/[,;]/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => EMAIL_RE.test(s));
    const list = configured.length ? configured : DEFAULT_PENDING_LEAVE_RECIPIENTS;
    return [...new Set(list)];
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

/** View link to the login-protected Leave Management page (no new auth). */
function leaveManagementUrl() {
    const base = String(process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
    return base ? `${base}/leave-requests` : '';
}

/** Subject + HTML for one pending LeaveRequest document. */
function buildPendingLeaveEmail(leave) {
    const name = leave?.employeeName || 'Employee';
    const employeeCode = leave?.employeeId || leave?.linkedEmployeeCode || '';
    const leaveId = String(leave?._id || '');
    const link = leaveManagementUrl();

    const rows = [
        ['Employee Name', name],
        ['Employee ID', employeeCode || 'N/A'],
        ['Department', leave?.department || 'N/A'],
        ['Leave Type', leave?.leaveType || 'N/A'],
        ['Leave Start Date', formatDate(leave?.startDate)],
        ['Leave End Date', formatDate(leave?.endDate)],
        ['Number of Leave Days', leaveDaysLabel(leave)],
        ['Current Status', 'Pending'],
        ['Reporting Manager', leave?.reportingManager || 'N/A'],
        ['Applied On', formatDate(leave?.appliedOn || leave?.createdAt)],
        ['Leave Request ID', leaveId || 'N/A'],
    ];

    const rowsHtml = rows
        .map(
            ([label, value]) => `
                <tr>
                    <td style="padding: 6px 12px 6px 0; color: #555; white-space: nowrap;"><strong>${escapeHtml(label)}:</strong></td>
                    <td style="padding: 6px 0; color: #111;">${escapeHtml(value)}</td>
                </tr>`
        )
        .join('');

    const buttonHtml = link
        ? `<p style="margin-top: 24px;">
                <a href="${escapeHtml(link)}" style="background: #1a73e8; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Leave Request</a>
           </p>
           <p style="font-size: 12px; color: #777;">Sign in to the HRMS to review and approve or reject this request.</p>`
        : `<p style="margin-top: 20px; color: #555;">Please sign in to the HRMS Leave Management to approve or reject this request.</p>`;

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #1a73e8; margin-top: 0;">Leave Request Pending Approval</h2>
            <p>An employee leave request is pending for approval.</p>
            <table style="border-collapse: collapse; font-size: 14px;">${rowsHtml}
            </table>
            ${buttonHtml}
        </div>
    `;

    const subject = `Pending Leave Approval – ${name}${employeeCode ? ` (${employeeCode})` : ''}`;
    return { subject, html };
}

/**
 * Email the pending-leave approvers about one newly created request.
 * Never throws: failures are logged and reported in the result.
 */
async function sendPendingLeaveNotification(leave, { transporter, from } = {}) {
    const leaveId = String(leave?._id || '');
    if (!leave || leave.status !== 'Pending') {
        return { sent: [], failed: [], skipped: 'not pending' };
    }
    if (!transporter) {
        console.warn(`[Leave] Pending leave email not sent for ${leaveId}: email is not configured`);
        return { sent: [], failed: [], skipped: 'no transporter' };
    }

    const recipients = getPendingLeaveRecipients();
    const { subject, html } = buildPendingLeaveEmail(leave);
    const sender = from || `"Auxin Leave" <${process.env.EMAIL_USER}>`;
    const sent = [];
    const failed = [];

    for (const to of recipients) {
        try {
            await transporter.sendMail({ from: sender, to, subject, html });
            sent.push(to);
            console.log(`[Leave] Pending leave email sent for ${leaveId} to ${to}`);
        } catch (err) {
            failed.push(to);
            console.error(`[Leave] Pending leave email failed for ${leaveId} to ${to}:`, err?.message || err);
        }
    }
    return { sent, failed };
}

module.exports = {
    DEFAULT_PENDING_LEAVE_RECIPIENTS,
    getPendingLeaveRecipients,
    buildPendingLeaveEmail,
    sendPendingLeaveNotification,
};
