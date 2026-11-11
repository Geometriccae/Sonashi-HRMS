const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('./adminLeaveEmailService');

const {
    sendPendingLeaveNotification,
    buildPendingLeaveEmail,
} = require('./pendingLeaveEmailService');

const fakeTransporter = ({ failFor = [] } = {}) => {
    const sent = [];
    return {
        sent,
        sendMail: async (msg) => {
            if (failFor.includes(msg.to)) {
                throw new Error(`SMTP connection refused for ${msg.to}`);
            }
            sent.push(msg);
            return { messageId: `msg_${sent.length}` };
        },
    };
};

function createMockModels({ users = [], employees = [] } = {}) {
    const userStore = [...users];
    const empStore = [...employees];
    const leaveUpdates = {};

    const wrapQuery = (result) => ({
        lean: async () => result,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    });

    const UserModel = {
        findOne: (query) => {
            const found = userStore.find(u => {
                if (query.role && u.role !== query.role) return false;
                if (query.username instanceof RegExp) {
                    return query.username.test(u.username);
                }
                if (query.username && u.username !== query.username) return false;
                if (query.$or) {
                    return query.$or.some(cond => {
                        if (cond.employeeId && String(u.employeeId) === String(cond.employeeId)) return true;
                        if (cond.username instanceof RegExp && cond.username.test(u.username)) return true;
                        return false;
                    });
                }
                return true;
            }) || null;
            return wrapQuery(found);
        },
        findById: (id) => {
            const found = userStore.find(u => String(u._id) === String(id)) || null;
            return wrapQuery(found);
        },
        find: (query) => {
            const found = userStore.filter(u => {
                if (query.role && u.role !== query.role) return false;
                return true;
            });
            return wrapQuery(found);
        },
    };

    const EmployeeModel = {
        findOne: (query) => {
            const found = empStore.find(e => {
                if (query.employeeName instanceof RegExp) {
                    return query.employeeName.test(e.employeeName);
                }
                if (query.employeeId && e.employeeId === query.employeeId) return true;
                if (query.$or) {
                    return query.$or.some(c => {
                        if (c._id && String(e._id) === String(c._id)) return true;
                        if (c.employeeId && e.employeeId === c.employeeId) return true;
                        return false;
                    });
                }
                return false;
            }) || null;
            return wrapQuery(found);
        },
        findById: (id) => {
            const found = empStore.find(e => String(e._id) === String(id)) || null;
            return wrapQuery(found);
        },
    };

    const LeaveRequestModel = {
        findByIdAndUpdate: async (id, update) => {
            const sid = String(id);
            leaveUpdates[sid] = leaveUpdates[sid] || {};
            if (update.$set) {
                Object.assign(leaveUpdates[sid], update.$set);
            }
            return { _id: id, ...leaveUpdates[sid] };
        },
        _updates: leaveUpdates,
    };

    return { UserModel, EmployeeModel, LeaveRequestModel };
}

describe('Admin Leave Email Notification Workflow', () => {
    process.env.FRONTEND_URL = 'https://hrms.sonashi.ae';
    process.env.EMAIL_USER = 'auxin.leave@gmail.com';

    it('1. Admin Submits Leave Request -> assigned Manager receives one email with details and link', async () => {
        const { UserModel, EmployeeModel, LeaveRequestModel } = createMockModels({
            users: [
                { _id: 'u_admin1', username: 'Kailash Admin', role: 'admin', emailId: 'kailash.admin@sonashi.ae' },
                { _id: 'u_mgr1', username: 'Mahesh Manager', role: 'authorize_user', emailId: 'mahesh.manager@sonashi.ae' },
            ],
            employees: [
                { _id: 'e_admin1', employeeId: 'ID-ADM-01', employeeName: 'Kailash Admin', emailId: 'kailash.admin@sonashi.ae', reportingManager: 'Mahesh Manager' },
                { _id: 'e_mgr1', employeeId: 'ID-MGR-01', employeeName: 'Mahesh Manager', emailId: 'mahesh.manager@sonashi.ae' },
            ]
        });

        const leave = {
            _id: 'leave_101',
            employeeName: 'Kailash Admin',
            employeeId: 'ID-ADM-01',
            department: 'Executive Management',
            leaveType: 'Annual Leave',
            startDate: new Date('2026-11-10'),
            endDate: new Date('2026-11-20'),
            leaveDays: 10,
            reason: 'Annual family holiday',
            reportingManager: 'Mahesh Manager',
            requesterRole: 'admin',
            submittedByUser: 'u_admin1',
            status: 'Pending',
            adminLeaveNotifications: { submissionEmailSent: false },
        };

        const t = fakeTransporter();
        const res = await sendAdminLeaveSubmittedEmail(leave, {
            transporter: t,
            LeaveRequestModel,
            EmployeeModel,
            UserModel,
        });

        assert.strictEqual(res.skipped, undefined);
        assert.deepStrictEqual(res.sent, ['mahesh.manager@sonashi.ae']);
        assert.strictEqual(t.sent.length, 1);

        const email = t.sent[0];
        assert.strictEqual(email.to, 'mahesh.manager@sonashi.ae');
        assert.ok(email.subject.includes('Pending Leave Approval: Admin Request – Kailash Admin'));
        assert.ok(email.html.includes('Kailash Admin'));
        assert.ok(email.html.includes('ID-ADM-01'));
        assert.ok(email.html.includes('Annual Leave'));
        assert.ok(email.html.includes('10 Nov 2026'));
        assert.ok(email.html.includes('20 Nov 2026'));
        assert.ok(email.html.includes('10 days'));
        assert.ok(email.html.includes('Annual family holiday'));
        assert.ok(email.html.includes('leave_101'));
        assert.ok(email.html.includes('https://hrms.sonashi.ae/leave-requests'));

        // Persistence check
        assert.strictEqual(LeaveRequestModel._updates['leave_101']['adminLeaveNotifications.submissionEmailSent'], true);
        assert.strictEqual(LeaveRequestModel._updates['leave_101']['adminLeaveNotifications.submissionEmailRecipient'], 'mahesh.manager@sonashi.ae');
    });

    it('2. Manager Approves -> original Admin receives one approval email', async () => {
        const { UserModel, EmployeeModel, LeaveRequestModel } = createMockModels({
            users: [
                { _id: 'u_admin1', username: 'Kailash Admin', role: 'admin', emailId: 'kailash.admin@sonashi.ae' },
                { _id: 'u_mgr1', username: 'Mahesh Manager', role: 'authorize_user', emailId: 'mahesh.manager@sonashi.ae' },
            ],
            employees: [
                { _id: 'e_admin1', employeeId: 'ID-ADM-01', employeeName: 'Kailash Admin', emailId: 'kailash.admin@sonashi.ae', reportingManager: 'Mahesh Manager' },
            ]
        });

        const leave = {
            _id: 'leave_102',
            employeeName: 'Kailash Admin',
            employeeId: 'ID-ADM-01',
            leaveType: 'Annual Leave',
            startDate: new Date('2026-11-10'),
            endDate: new Date('2026-11-20'),
            leaveDays: 10,
            reason: 'Annual family holiday',
            reportingManager: 'Mahesh Manager',
            requesterRole: 'admin',
            submittedByUser: 'u_admin1',
            status: 'Approved',
            adminLeaveNotifications: { approvalEmailSent: false },
        };

        const t = fakeTransporter();
        const res = await sendAdminLeaveApprovedEmail(leave, {
            transporter: t,
            manager: { username: 'Mahesh Manager' },
            remarks: 'Approved. Enjoy your vacation!',
            LeaveRequestModel,
            EmployeeModel,
            UserModel,
        });

        assert.strictEqual(res.skipped, undefined);
        assert.deepStrictEqual(res.sent, ['kailash.admin@sonashi.ae']);
        assert.strictEqual(t.sent.length, 1);

        const email = t.sent[0];
        assert.strictEqual(email.to, 'kailash.admin@sonashi.ae');
        assert.ok(email.subject.includes('Leave Request Approved – Kailash Admin'));
        assert.ok(email.html.includes('Leave Request Approved'));
        assert.ok(email.html.includes('Mahesh Manager'));
        assert.ok(email.html.includes('Approved. Enjoy your vacation!'));
        assert.ok(email.html.includes('https://hrms.sonashi.ae/leave-requests'));

        // Persistence check
        assert.strictEqual(LeaveRequestModel._updates['leave_102']['adminLeaveNotifications.approvalEmailSent'], true);
        assert.strictEqual(LeaveRequestModel._updates['leave_102']['adminLeaveNotifications.approvalEmailRecipient'], 'kailash.admin@sonashi.ae');
    });

    it('3. Manager Rejects -> original Admin receives one rejection email', async () => {
        const { UserModel, EmployeeModel, LeaveRequestModel } = createMockModels({
            users: [
                { _id: 'u_admin1', username: 'Kailash Admin', role: 'admin', emailId: 'kailash.admin@sonashi.ae' },
                { _id: 'u_mgr1', username: 'Mahesh Manager', role: 'authorize_user', emailId: 'mahesh.manager@sonashi.ae' },
            ],
            employees: [
                { _id: 'e_admin1', employeeId: 'ID-ADM-01', employeeName: 'Kailash Admin', emailId: 'kailash.admin@sonashi.ae', reportingManager: 'Mahesh Manager' },
            ]
        });

        const leave = {
            _id: 'leave_103',
            employeeName: 'Kailash Admin',
            employeeId: 'ID-ADM-01',
            leaveType: 'Annual Leave',
            startDate: new Date('2026-11-10'),
            endDate: new Date('2026-11-20'),
            leaveDays: 10,
            reason: 'Annual family holiday',
            reportingManager: 'Mahesh Manager',
            requesterRole: 'admin',
            submittedByUser: 'u_admin1',
            status: 'Rejected',
            adminLeaveNotifications: { rejectionEmailSent: false },
        };

        const t = fakeTransporter();
        const res = await sendAdminLeaveRejectedEmail(leave, {
            transporter: t,
            manager: { username: 'Mahesh Manager' },
            remarks: 'Critical audit scheduled during this period. Please reschedule.',
            LeaveRequestModel,
            EmployeeModel,
            UserModel,
        });

        assert.strictEqual(res.skipped, undefined);
        assert.deepStrictEqual(res.sent, ['kailash.admin@sonashi.ae']);
        assert.strictEqual(t.sent.length, 1);

        const email = t.sent[0];
        assert.strictEqual(email.to, 'kailash.admin@sonashi.ae');
        assert.ok(email.subject.includes('Leave Request Rejected – Kailash Admin'));
        assert.ok(email.html.includes('Leave Request Rejected'));
        assert.ok(email.html.includes('Mahesh Manager'));
        assert.ok(email.html.includes('Critical audit scheduled during this period'));

        // Persistence check
        assert.strictEqual(LeaveRequestModel._updates['leave_103']['adminLeaveNotifications.rejectionEmailSent'], true);
        assert.strictEqual(LeaveRequestModel._updates['leave_103']['adminLeaveNotifications.rejectionEmailRecipient'], 'kailash.admin@sonashi.ae');
    });

    it('4. Multiple managers and Admin users -> only the correct recipients receive emails', async () => {
        const { UserModel, EmployeeModel, LeaveRequestModel } = createMockModels({
            users: [
                { _id: 'u_admin_alice', username: 'Alice Admin', role: 'admin', emailId: 'alice@sonashi.ae' },
                { _id: 'u_admin_charlie', username: 'Charlie Admin', role: 'admin', emailId: 'charlie@sonashi.ae' },
                { _id: 'u_mgr_bob', username: 'Bob Manager', role: 'authorize_user', emailId: 'bob@sonashi.ae' },
                { _id: 'u_mgr_dave', username: 'Dave Manager', role: 'authorize_user', emailId: 'dave@sonashi.ae' },
            ],
            employees: [
                { _id: 'e_alice', employeeId: 'ID-ALICE', employeeName: 'Alice Admin', emailId: 'alice@sonashi.ae', reportingManager: 'Bob Manager' },
                { _id: 'e_charlie', employeeId: 'ID-CHARLIE', employeeName: 'Charlie Admin', emailId: 'charlie@sonashi.ae', reportingManager: 'Dave Manager' },
                { _id: 'e_bob', employeeId: 'ID-BOB', employeeName: 'Bob Manager', emailId: 'bob@sonashi.ae' },
                { _id: 'e_dave', employeeId: 'ID-DAVE', employeeName: 'Dave Manager', emailId: 'dave@sonashi.ae' },
            ]
        });

        const leaveAlice = {
            _id: 'leave_alice',
            employeeName: 'Alice Admin',
            employeeId: 'ID-ALICE',
            leaveType: 'Vacation',
            startDate: new Date('2026-12-01'),
            endDate: new Date('2026-12-05'),
            leaveDays: 5,
            reason: 'Trip',
            reportingManager: 'Bob Manager',
            requesterRole: 'admin',
            submittedByUser: 'u_admin_alice',
            status: 'Pending',
            adminLeaveNotifications: {},
        };

        const leaveCharlie = {
            _id: 'leave_charlie',
            employeeName: 'Charlie Admin',
            employeeId: 'ID-CHARLIE',
            leaveType: 'Sick Leave',
            startDate: new Date('2026-12-10'),
            endDate: new Date('2026-12-12'),
            leaveDays: 3,
            reason: 'Flu',
            reportingManager: 'Dave Manager',
            requesterRole: 'admin',
            submittedByUser: 'u_admin_charlie',
            status: 'Pending',
            adminLeaveNotifications: {},
        };

        const t = fakeTransporter();

        // 1. Alice submits -> ONLY Bob gets email
        await sendAdminLeaveSubmittedEmail(leaveAlice, { transporter: t, LeaveRequestModel, EmployeeModel, UserModel });
        assert.strictEqual(t.sent.length, 1);
        assert.strictEqual(t.sent[0].to, 'bob@sonashi.ae');

        // 2. Charlie submits -> ONLY Dave gets email
        await sendAdminLeaveSubmittedEmail(leaveCharlie, { transporter: t, LeaveRequestModel, EmployeeModel, UserModel });
        assert.strictEqual(t.sent.length, 2);
        assert.strictEqual(t.sent[1].to, 'dave@sonashi.ae');

        // 3. Bob approves Alice's leave -> ONLY Alice gets email
        await sendAdminLeaveApprovedEmail(leaveAlice, {
            transporter: t,
            manager: { username: 'Bob Manager' },
            remarks: 'Approved by Bob',
            LeaveRequestModel,
            EmployeeModel,
            UserModel,
        });
        assert.strictEqual(t.sent.length, 3);
        assert.strictEqual(t.sent[2].to, 'alice@sonashi.ae');

        // 4. Dave rejects Charlie's leave -> ONLY Charlie gets email
        await sendAdminLeaveRejectedEmail(leaveCharlie, {
            transporter: t,
            manager: { username: 'Dave Manager' },
            remarks: 'Rejected by Dave',
            LeaveRequestModel,
            EmployeeModel,
            UserModel,
        });
        assert.strictEqual(t.sent.length, 4);
        assert.strictEqual(t.sent[3].to, 'charlie@sonashi.ae');
    });

    it('5. Missing email addresses -> safe error handling (no throw, leave intact)', async () => {
        const { UserModel, EmployeeModel, LeaveRequestModel } = createMockModels({
            users: [
                { _id: 'u_admin_no_email', username: 'No Email Admin', role: 'admin', emailId: '' },
            ],
            employees: [
                { _id: 'e_admin_no_email', employeeName: 'No Email Admin', emailId: '', reportingManager: 'Nonexistent Manager' },
            ]
        });

        const leave = {
            _id: 'leave_no_email',
            employeeName: 'No Email Admin',
            reportingManager: 'Nonexistent Manager',
            requesterRole: 'admin',
            submittedByUser: 'u_admin_no_email',
            status: 'Pending',
            adminLeaveNotifications: {},
        };

        const t = fakeTransporter();

        // Submission with unresolvable manager email
        const resSub = await sendAdminLeaveSubmittedEmail(leave, {
            transporter: t,
            LeaveRequestModel,
            EmployeeModel,
            UserModel,
        });
        assert.strictEqual(resSub.skipped, 'no_recipient');
        assert.strictEqual(t.sent.length, 0);

        // Approval with unresolvable admin email
        const resApp = await sendAdminLeaveApprovedEmail(leave, {
            transporter: t,
            LeaveRequestModel,
            EmployeeModel,
            UserModel,
        });
        assert.strictEqual(resApp.skipped, 'no_recipient');
        assert.strictEqual(t.sent.length, 0);
    });

    it('6. Email provider failure -> leave status remains correct and non-throwing', async () => {
        const { UserModel, EmployeeModel, LeaveRequestModel } = createMockModels({
            users: [
                { _id: 'u_admin1', username: 'Kailash Admin', role: 'admin', emailId: 'kailash@sonashi.ae' },
                { _id: 'u_mgr1', username: 'Mahesh Manager', role: 'authorize_user', emailId: 'mahesh@sonashi.ae' },
            ],
            employees: [
                { _id: 'e_admin1', employeeName: 'Kailash Admin', emailId: 'kailash@sonashi.ae', reportingManager: 'Mahesh Manager' },
                { _id: 'e_mgr1', employeeName: 'Mahesh Manager', emailId: 'mahesh@sonashi.ae' },
            ]
        });

        const leave = {
            _id: 'leave_fail_smtp',
            employeeName: 'Kailash Admin',
            reportingManager: 'Mahesh Manager',
            requesterRole: 'admin',
            submittedByUser: 'u_admin1',
            status: 'Pending',
            adminLeaveNotifications: { submissionEmailSent: false },
        };

        // Transporter that refuses connections to mahesh@sonashi.ae
        const t = fakeTransporter({ failFor: ['mahesh@sonashi.ae'] });

        const res = await sendAdminLeaveSubmittedEmail(leave, {
            transporter: t,
            LeaveRequestModel,
            EmployeeModel,
            UserModel,
        });

        // Does not throw! Reports failure safely
        assert.deepStrictEqual(res.failed, ['mahesh@sonashi.ae']);
        assert.ok(res.error.includes('SMTP connection refused'));

        // Does not mark submissionEmailSent = true so it can be retried later
        assert.strictEqual(LeaveRequestModel._updates['leave_fail_smtp']?.['adminLeaveNotifications.submissionEmailSent'], undefined);
        assert.ok(LeaveRequestModel._updates['leave_fail_smtp']?.['adminLeaveNotifications.lastError']?.includes('SMTP connection refused'));
    });

    it('7. Refresh/retry -> no duplicate notification', async () => {
        const { UserModel, EmployeeModel, LeaveRequestModel } = createMockModels({
            users: [
                { _id: 'u_admin1', username: 'Kailash Admin', role: 'admin', emailId: 'kailash@sonashi.ae' },
                { _id: 'u_mgr1', username: 'Mahesh Manager', role: 'authorize_user', emailId: 'mahesh@sonashi.ae' },
            ],
            employees: [
                { _id: 'e_admin1', employeeName: 'Kailash Admin', emailId: 'kailash@sonashi.ae', reportingManager: 'Mahesh Manager' },
                { _id: 'e_mgr1', employeeName: 'Mahesh Manager', emailId: 'mahesh@sonashi.ae' },
            ]
        });

        const leave = {
            _id: 'leave_dup_test',
            employeeName: 'Kailash Admin',
            reportingManager: 'Mahesh Manager',
            requesterRole: 'admin',
            submittedByUser: 'u_admin1',
            status: 'Pending',
            adminLeaveNotifications: { submissionEmailSent: false, approvalEmailSent: false, rejectionEmailSent: false },
        };

        const t = fakeTransporter();

        // 1st call -> sends email
        const res1 = await sendAdminLeaveSubmittedEmail(leave, { transporter: t, LeaveRequestModel, EmployeeModel, UserModel });
        assert.deepStrictEqual(res1.sent, ['mahesh@sonashi.ae']);
        assert.strictEqual(t.sent.length, 1);

        // 2nd call (refresh / re-save / double-click) -> skips duplicate
        const res2 = await sendAdminLeaveSubmittedEmail(leave, { transporter: t, LeaveRequestModel, EmployeeModel, UserModel });
        assert.strictEqual(res2.skipped, 'already_sent');
        assert.strictEqual(t.sent.length, 1); // Still exactly 1 email sent!

        // Approval: 1st call -> sends email
        leave.status = 'Approved';
        const resApp1 = await sendAdminLeaveApprovedEmail(leave, { transporter: t, LeaveRequestModel, EmployeeModel, UserModel });
        assert.deepStrictEqual(resApp1.sent, ['kailash@sonashi.ae']);
        assert.strictEqual(t.sent.length, 2);

        // Approval: 2nd call -> skips duplicate
        const resApp2 = await sendAdminLeaveApprovedEmail(leave, { transporter: t, LeaveRequestModel, EmployeeModel, UserModel });
        assert.strictEqual(resApp2.skipped, 'already_sent');
        assert.strictEqual(t.sent.length, 2); // Still exactly 2 emails sent total!
    });

    it('8. Non-admin leave requests are ignored by admin notification service', async () => {
        const leaveEmployee = {
            _id: 'leave_emp_01',
            employeeName: 'Regular Employee',
            requesterRole: 'sales_executive',
            status: 'Pending',
            adminLeaveNotifications: {},
        };

        const t = fakeTransporter();
        const resSub = await sendAdminLeaveSubmittedEmail(leaveEmployee, { transporter: t });
        assert.strictEqual(resSub.skipped, 'not_admin_leave');
        assert.strictEqual(t.sent.length, 0);

        const resApp = await sendAdminLeaveApprovedEmail(leaveEmployee, { transporter: t });
        assert.strictEqual(resApp.skipped, 'not_admin_leave');
        assert.strictEqual(t.sent.length, 0);

        const resRej = await sendAdminLeaveRejectedEmail(leaveEmployee, { transporter: t });
        assert.strictEqual(resRej.skipped, 'not_admin_leave');
        assert.strictEqual(t.sent.length, 0);
    });

    it('9. Existing expiry and leave email workflows continue to work', async () => {
        // Pending leave email check
        const samplePendingLeave = {
            _id: 'pending_001',
            employeeName: 'John Regular',
            employeeId: 'ID-002',
            department: 'Logistics',
            reportingManager: 'Manager Dave',
            leaveType: 'Personal Leave',
            startDate: new Date('2026-10-15'),
            endDate: new Date('2026-10-18'),
            leaveDays: 3,
            status: 'Pending',
            appliedOn: new Date('2026-10-10'),
        };

        const t = fakeTransporter();
        process.env.LEAVE_PENDING_NOTIFY_EMAILS = 'approver1@sonashi.ae,approver2@sonashi.ae';
        const pendingRes = await sendPendingLeaveNotification(samplePendingLeave, { transporter: t });
        assert.deepStrictEqual(pendingRes.sent, ['approver1@sonashi.ae', 'approver2@sonashi.ae']);
        assert.strictEqual(t.sent.length, 2);
        assert.ok(t.sent[0].subject.includes('Pending Leave Approval – John Regular'));
    });
});
