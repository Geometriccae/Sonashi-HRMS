const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Employee = require('../models/Employee');
const authMiddleware = require('../middleware/authMiddleware');
const { calculateWorkingDays, isPublicHoliday } = require('../utils/leaveUtils');
const { notifyLeaveSubmitted, notifyLeaveStatusChange } = require('../services/hrNotificationService');
const { invalidateListCache } = require('../utils/employeeListCache');

const CHANGE_STATUSES = ['Created', 'Modified', 'Cancelled', 'Approved', 'Rejected', 'Error'];

function actorName(user) {
    return user?.username || user?.emailId || user?.name || 'System';
}

function buildChangeEntry(changeStatus, user, remarks = '') {
    const now = new Date();
    return {
        changeStatus,
        changedBy: actorName(user),
        changedByUser: user?._id || user?.id || null,
        changedOn: now,
        remarks: remarks || ''
    };
}

function applyChangeAudit(updateData, changeStatus, user, remarks = '') {
    const entry = buildChangeEntry(changeStatus, user, remarks);
    updateData.changeStatus = entry.changeStatus;
    updateData.changedBy = entry.changedBy;
    updateData.changedByUser = entry.changedByUser;
    updateData.changedOn = entry.changedOn;
    updateData.changeRemarks = entry.remarks;
    return entry;
}

/** Resolve Employee document linked to a leave request (User → Employee). */
async function resolveEmployeeForLeave(leaveRequest) {
    if (!leaveRequest) return null;

    const empRef = leaveRequest.employee?._id || leaveRequest.employee;
    if (empRef) {
        const user = await User.findById(empRef).populate('employeeId');
        if (user?.employeeId) {
            const linkedId = user.employeeId._id || user.employeeId;
            const emp = await Employee.findById(linkedId);
            if (emp) return emp;
        }
        if (user) {
            const byUser = await Employee.findOne({
                $or: [
                    { employeeName: user.username },
                    { emailId: user.emailId },
                ],
            });
            if (byUser) return byUser;
        }

        // leave.employee may be the Employee._id when no User account exists
        const asEmployee = await Employee.findById(empRef);
        if (asEmployee) return asEmployee;
    }

    if (leaveRequest.employeeId) {
        const byCode = await Employee.findOne({ employeeId: leaveRequest.employeeId });
        if (byCode) return byCode;
        const byMongo = await Employee.findById(leaveRequest.employeeId);
        if (byMongo) return byMongo;
    }

    if (leaveRequest.employeeName) {
        return Employee.findOne({ employeeName: leaveRequest.employeeName });
    }
    return null;
}

/**
 * After final leave approval: mark employee as Vacation Pending (Yet to go)
 * when Vacation leave has not started yet. Does not override On Vacation.
 */
async function syncYetToGoVacationStatus(leaveRequest) {
    try {
        if (!leaveRequest || leaveRequest.status !== 'Approved') return;

        // Match frontend Yet-to-go leave filter (Vacation only)
        if (leaveRequest.leaveType !== 'Vacation') return;

        const start = leaveRequest.startDate ? new Date(leaveRequest.startDate) : null;
        if (!start || Number.isNaN(start.getTime())) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDay = new Date(start);
        startDay.setHours(0, 0, 0, 0);
        if (startDay < today) return; // already started — not "yet to go"

        const emp = await resolveEmployeeForLeave(leaveRequest);
        if (!emp) {
            console.warn('[Leave] Yet-to-go sync skipped: employee not found for', leaveRequest.employeeName);
            return;
        }

        if (emp.vacationStatus === 'On Vacation') return;

        if (emp.vacationStatus !== 'Vacation Pending') {
            await Employee.findByIdAndUpdate(emp._id, { vacationStatus: 'Vacation Pending' });
            console.log(`[Leave] Set Vacation Pending (Yet to go) for employee ${emp.employeeId || emp._id}`);
        }

        // Ensure Dashboard / Team list show updated Vacation Status immediately
        invalidateListCache();
    } catch (err) {
        console.error('[Leave] Yet-to-go vacationStatus sync error:', err.message || err);
    }
}

function getLeaveTransporter() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Leave] EMAIL_USER or EMAIL_PASS not set in .env – cannot send leave emails');
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

/** Flow: Employee submits leave → email to HOD and HR Admin (both receive). All emails FROM EMAIL_USER. */
async function sendLeaveRequestToHodAndAdmin(leaveRequest) {
    const transporter = getLeaveTransporter();
    if (!transporter) return;
    try {
        const [hodUsers, adminUsers] = await Promise.all([
            User.find({ role: 'hod' }, 'emailId username').lean(),
            User.find({ role: 'admin' }, 'emailId username').lean(),
        ]);
        const toHod = hodUsers.map(u => (u.emailId && String(u.emailId).trim()) || null).filter(Boolean);
        const toAdmin = adminUsers.map(u => (u.emailId && String(u.emailId).trim()) || null).filter(Boolean);
        if (toHod.length === 0 && toAdmin.length === 0) {
            console.warn('[Leave] No HOD or Admin with emailId. Set emailId for users with role "hod" and "admin".');
            return;
        }
        if (toAdmin.length === 0) {
            console.warn('[Leave] No Admin user with emailId. Add emailId for the user with role "admin" in User collection.');
        }
        const toList = [...new Set([...toHod, ...toAdmin])];
        console.log('[Leave] Sending new leave request – HOD:', toHod.length, 'recipient(s), Admin:', toAdmin.length, 'recipient(s). To:', toList.join(', '));
        const startStr = leaveRequest.startDate ? new Date(leaveRequest.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const endStr = leaveRequest.endDate ? new Date(leaveRequest.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const subject = `Leave Request from ${leaveRequest.employeeName || 'Employee'}`;
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #1a73e8;">New Leave Request</h2>
                <p><strong>Employee:</strong> ${leaveRequest.employeeName || 'N/A'}</p>
                <p><strong>Company:</strong> ${leaveRequest.company || 'N/A'}</p>
                <p><strong>Leave Type:</strong> ${leaveRequest.leaveType || 'N/A'}</p>
                <p><strong>Start Date:</strong> ${startStr}</p>
                <p><strong>End Date:</strong> ${endStr}</p>
                <p><strong>Reason:</strong> ${leaveRequest.reason || 'N/A'}</p>
                <p><strong>Applied On:</strong> ${leaveRequest.appliedOn ? new Date(leaveRequest.appliedOn).toLocaleString('en-IN') : 'N/A'}</p>
                <p style="margin-top: 20px; color: #555;">Please review and approve or reject in the leave request portal.</p>
            </div>
        `;
        for (const to of toList) {
            try {
                await transporter.sendMail({
                    from: `"Auxin Leave" <${process.env.EMAIL_USER}>`,
                    to,
                    subject,
                    html,
                });
                console.log('[Leave] Sent new leave request to HOD/Admin:', to);
            } catch (e) {
                console.error('[Leave] Failed to send to HOD/Admin', to, e.message);
            }
        }
    } catch (err) {
        console.error('[Leave] Failed to email HOD/Admin:', err);
    }
}

/** Flow: When HOD or Admin approve/reject → email to employee. All emails FROM EMAIL_USER. */
async function sendLeaveStatusToEmployee(leaveRequest, newStatus) {
    const transporter = getLeaveTransporter();
    if (!transporter) return;
    try {
        let employeeEmail = null;
        const emp = leaveRequest.employee;
        if (emp && typeof emp === 'object' && emp.emailId) {
            employeeEmail = String(emp.emailId).trim() || null;
        }
        if (!employeeEmail && leaveRequest.employee) {
            const user = await User.findById(leaveRequest.employee).select('emailId').lean();
            employeeEmail = (user && user.emailId && String(user.emailId).trim()) || null;
        }
        if (!employeeEmail) {
            console.warn('[Leave] No employee email for leave request', leaveRequest._id);
            return;
        }
        const startStr = leaveRequest.startDate ? new Date(leaveRequest.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        const endStr = leaveRequest.endDate ? new Date(leaveRequest.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        let statusLabel;
        let messageLine;
        if (newStatus === 'HOD Approved') {
            statusLabel = 'Approved by HOD';
            messageLine = 'Your leave request has been <strong>approved by HOD</strong> and is pending admin approval.';
        } else if (newStatus === 'Approved') {
            statusLabel = 'Approved';
            messageLine = 'Your leave request has been <strong>approved</strong>.';
        } else if (newStatus === 'Rejected') {
            statusLabel = 'Rejected';
            messageLine = 'Your leave request has been <strong>rejected</strong>.';
        } else {
            statusLabel = newStatus;
            messageLine = `Your leave request status: <strong>${newStatus}</strong>.`;
        }
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #1a73e8;">Leave Request – ${statusLabel}</h2>
                <p>${messageLine}</p>
                <p><strong>Leave Type:</strong> ${leaveRequest.leaveType || 'N/A'}</p>
                <p><strong>Period:</strong> ${startStr} to ${endStr}</p>
                <p><strong>Reason:</strong> ${leaveRequest.reason || 'N/A'}</p>
                <p style="margin-top: 20px; color: #555;">Thank you.</p>
            </div>
        `;
        await transporter.sendMail({
            from: `"Auxin Leave" <${process.env.EMAIL_USER}>`,
            to: employeeEmail,
            subject: `Leave Request – ${statusLabel}`,
            html,
        });
        console.log('[Leave] Sent status to employee:', employeeEmail);
    } catch (err) {
        console.error('[Leave] Failed to email employee:', err.message || err);
    }
}

/** Check if any day in [startDate, endDate] (inclusive) is a government holiday. */
function hasHolidayInRange(startDate, endDate) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (!start || !end || start > end) return false;
    const current = new Date(start);
    while (current <= end) {
        if (isPublicHoliday(current)) return true;
        current.setDate(current.getDate() + 1);
    }
    return false;
}

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();
    const match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
        const y = parseInt(match[1], 10), m = parseInt(match[2], 10) - 1, d = parseInt(match[3], 10);
        const date = new Date(y, m, d);
        return isNaN(date.getTime()) ? null : date;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Get all leave requests
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { status, employeeId } = req.query;
        const filter = {};

        if (req.user.role === 'hod') {
            // HOD sees only Pending requests (waiting for HOD approval)
            // and also sees requests they have already processed (HOD Approved, Approved, Rejected)
            if (status && status !== 'All') {
                filter.status = status;
            } else {
                // Default: show Pending (for approval) and completed ones
                filter.status = { $in: ['Pending', 'HOD Approved', 'Approved', 'Rejected', 'Cancelled'] };
            }
            if (employeeId) {
                filter.employee = employeeId;
            }
        } else if (
          req.user.role === 'admin' ||
          req.user.role === 'hr' ||
          req.user.role === 'viewer' ||
          req.user.role === 'authorize_user'
        ) {
            // Admin and HR see Pending requests, HOD processed requests, and final ones
            const visibleStatuses = ['Pending', 'HOD Approved', 'Approved', 'Rejected', 'Cancelled'];

            if (status && status !== 'All') {
                if (visibleStatuses.includes(status)) {
                    filter.status = status;
                } else {
                    // If requesting a status admin/HR shouldn't see, return nothing
                    filter.status = 'RESTRICTED_VIEW';
                }
            } else {
                // Default: show Pending (for approval) and completed ones
                filter.status = { $in: visibleStatuses };
            }
            if (employeeId) {
                filter.employee = employeeId;
            }
        } else {
            // Regular Employees can only see their own requests
            filter.employee = req.user.id;
            if (status && status !== 'All') {
                filter.status = status;
            }
        }

        const leaveRequests = await LeaveRequest.find(filter)
            .populate('employee', 'username emailId employeeId role')
            .populate('hodApprovedBy', 'username')
            .populate('adminApprovedBy', 'username')
            .populate('changedByUser', 'username')
            .sort({ appliedOn: -1 })
            .lean();

        res.json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Error fetching leave requests', error: error.message });
    }
});

// Create a new leave request
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'viewer' || req.user.role === 'authorize_user') {
            return res.status(403).json({ message: 'This role cannot create leave requests' });
        }

        const { employeeId, employeeName, company, department, reportingManager, leaveType, startDate, endDate, reason, requestAirfare } = req.body;


        let targetUserId = req.user.id; // Fallback to current acting user
        if (employeeId) {
            // employeeId from the frontend frontend dropdown is an Employee document _id. We need to find the equivalent User _id
            const equivalentUser = await User.findOne({ employeeId: employeeId });
            if (equivalentUser) {
                targetUserId = equivalentUser._id;
            } else {
                targetUserId = employeeId; // In case the frontend actually sends a User ID or for non-user employees
            }
        }

        // Validate dates against Employee's Joining Date (DOJ)
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                let employeeObj = null;
                if (employeeId) {
                    employeeObj = await Employee.findById(employeeId);
                } else if (req.user && req.user.employeeId) {
                    employeeObj = await Employee.findById(req.user.employeeId);
                } else if (req.user) {
                    employeeObj = await Employee.findOne({
                        $or: [
                            { employeeName: req.user.username },
                            { emailId: req.user.emailId }
                        ]
                    });
                }

                if (employeeObj && employeeObj.doj) {
                    const joiningDate = new Date(employeeObj.doj);
                    joiningDate.setHours(0, 0, 0, 0);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(0, 0, 0, 0);

                    if (start < joiningDate || end < joiningDate) {
                        return res.status(400).json({
                            message: `Leave dates cannot be before the Employee's Joining Date (${joiningDate.toLocaleDateString('en-GB')})`
                        });
                    }
                }
            }
        }

        const isPastLeave = req.body.isPastLeave === true;
        const createChangeStatus = isPastLeave ? 'Approved' : 'Created';
        const createRemarks = isPastLeave
            ? (req.body.changeRemarks || 'Past leave created as approved')
            : (req.body.changeRemarks || 'Leave request created');
        const createEntry = buildChangeEntry(createChangeStatus, req.user, createRemarks);

        // Capture requester role for Admin → Authorize User approval routing
        let requesterRole = '';
        try {
            const ownerUser = await User.findById(targetUserId).select('role').lean();
            requesterRole = ownerUser?.role || req.user.role || '';
        } catch (_) {
            requesterRole = req.user.role || '';
        }

        const newLeaveRequest = new LeaveRequest({
            employee: targetUserId,
            employeeName: employeeName || req.user.username,
            company,
            department,
            reportingManager,
            leaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            status: isPastLeave ? 'Approved' : 'Pending',
            isPastLeave: isPastLeave,
            adminApprovedBy: isPastLeave ? req.user.id : undefined,
            adminApprovedAt: isPastLeave ? new Date() : undefined,
            requestAirfare: req.body.requestAirfare === true || req.body.requestAirfare === 'true',
            requesterRole,
            changeStatus: createEntry.changeStatus,
            changedBy: createEntry.changedBy,
            changedByUser: createEntry.changedByUser,
            changedOn: createEntry.changedOn,
            changeRemarks: createEntry.remarks,
            statusChangeHistory: [createEntry]
        });

        const savedRequest = await newLeaveRequest.save();

        if (isPastLeave && req.body.visaExpiryDate && employeeId) {
            await Employee.findByIdAndUpdate(employeeId, { visaExpiryDate: new Date(req.body.visaExpiryDate) });
            console.log(`[Leave] Updated Employee ${employeeId} visaExpiryDate to ${req.body.visaExpiryDate}`);
        }

        res.status(201).json(savedRequest);

        const leaveSnapshot = {
            employeeName: savedRequest.employeeName,
            company: savedRequest.company,
            leaveType: savedRequest.leaveType,
            startDate: savedRequest.startDate,
            endDate: savedRequest.endDate,
            reason: savedRequest.reason,
            appliedOn: savedRequest.appliedOn,
        };
        sendLeaveRequestToHodAndAdmin(leaveSnapshot)
            .then(() => console.log('[Leave] HOD/Admin email sent'))
            .catch(e => console.error('[Leave] HOD/Admin email error:', e));

        if (!isPastLeave) {
            const io = req.app.get('io');
            notifyLeaveSubmitted(io, savedRequest)
                .catch((e) => console.error('[Leave] Notification error:', e));
        }
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(400).json({ message: 'Error creating leave request', error: error.message });
    }
});


// Update leave request status (Admin/HOD) or edit request (Employee)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { employeeId, employeeName, company, status, leaveType, startDate, endDate, reason, requestAirfare, changeStatus, changeRemarks } = req.body;
        const updateData = {};

        const oldRequest = await LeaveRequest.findById(req.params.id);
        if (!oldRequest) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        if (req.user.role === 'viewer' || req.user.role === 'authorize_user') {
            const hasFieldEdits = employeeId || employeeName || company || leaveType || startDate || endDate || reason
                || req.body.isPastLeave !== undefined || req.body.requestAirfare !== undefined || req.body.visaExpiryDate;
            if (!status || hasFieldEdits) {
                return res.status(403).json({ message: 'This role can only approve or reject leave requests' });
            }
        }

        // Handle status update (approval/rejection) — only when status is actually changing.
        // The edit form always sends the current status; re-sending "Approved" on an already-
        // approved record must not trigger the approval workflow.
        if (status && status !== oldRequest.status) {
            const userRole = req.user.role;
            const currentStatus = oldRequest.status;
            const actorId = String(req.user._id || req.user.id || '');
            const ownerId = String(oldRequest.employee?._id || oldRequest.employee || '');

            // Nobody may approve/reject their own leave (especially Admin self-approve)
            if (
                actorId &&
                ownerId &&
                actorId === ownerId &&
                (status === 'Approved' || status === 'Rejected' || status === 'HOD Approved')
            ) {
                return res.status(403).json({
                    message:
                        'You cannot approve or reject your own leave request. An Authorize User must review Admin leave requests.',
                });
            }

            // Resolve whether this leave belongs to an Admin user
            let requesterRole = String(oldRequest.requesterRole || '').toLowerCase();
            if (!requesterRole && oldRequest.employee) {
                const ownerUser = await User.findById(oldRequest.employee).select('role').lean();
                requesterRole = String(ownerUser?.role || '').toLowerCase();
            }
            const isAdminLeave = requesterRole === 'admin';

            // Admin leave requests can ONLY be finalized by Authorize Users
            if (
                isAdminLeave &&
                (status === 'Approved' || status === 'Rejected') &&
                userRole !== 'authorize_user'
            ) {
                return res.status(403).json({
                    message:
                        'Admin leave requests can only be approved or rejected by an Authorize User (Kailash / Mahesh).',
                });
            }

            // HOD Approval Logic
            if (userRole === 'hod') {
                if (status === 'Approved' || status === 'HOD Approved') {
                    // HOD can only approve Pending requests
                    if (currentStatus !== 'Pending') {
                        return res.status(400).json({
                            message: 'HOD can only approve requests that are in Pending status'
                        });
                    }
                    // HOD approval moves to "HOD Approved" status
                    updateData.status = 'HOD Approved';
                    updateData.hodApprovedBy = req.user.id;
                    updateData.hodApprovedAt = new Date();
                } else if (status === 'Rejected') {
                    // HOD can reject Pending requests
                    if (currentStatus !== 'Pending') {
                        return res.status(400).json({
                            message: 'HOD can only reject requests that are in Pending status'
                        });
                    }
                    updateData.status = 'Rejected';
                    updateData.hodApprovedBy = req.user.id;
                    updateData.hodApprovedAt = new Date();
                }
            }
            // Final Approval Logic: Admin, Viewer, and Authorize User can finalize.
            else if (
              userRole === 'admin' ||
              userRole === 'viewer' ||
              userRole === 'authorize_user'
            ) {
                if (status === 'Approved') {
                    // Admin can approve Pending or HOD Approved requests
                    if (currentStatus !== 'Pending' && currentStatus !== 'HOD Approved') {
                        return res.status(400).json({
                            message: 'Admin can only approve requests that are in Pending or HOD Approved status'
                        });
                    }
                    // Admin final approval
                    updateData.status = 'Approved';
                    updateData.adminApprovedBy = req.user.id;
                    updateData.adminApprovedAt = new Date();
                } else if (status === 'Rejected') {
                    // Admin can reject Pending or HOD Approved requests
                    if (currentStatus !== 'Pending' && currentStatus !== 'HOD Approved') {
                        return res.status(400).json({
                            message: 'Admin can only reject requests that are in Pending or HOD Approved status'
                        });
                    }
                    updateData.status = 'Rejected';
                    updateData.adminApprovedBy = req.user.id;
                    updateData.adminApprovedAt = new Date();
                }
            }
            // Regular employees cannot change status
            else {
                // Employees can only edit their own pending requests (not status)
                // Status changes are ignored for regular employees
            }
        }

        // Handle other field updates (for employee editing their own request).
        // employeeId from the form is Employee._id — resolve to User._id like create does.
        if (employeeId) {
            const equivalentUser = await User.findOne({ employeeId: employeeId });
            if (equivalentUser) {
                updateData.employee = equivalentUser._id;
            } else {
                const asUser = await User.findById(employeeId);
                updateData.employee = asUser ? asUser._id : employeeId;
            }
        }
        if (employeeName) updateData.employeeName = employeeName;
        if (company) updateData.company = company;
        if (req.body.department !== undefined) updateData.department = req.body.department;
        if (req.body.reportingManager !== undefined) updateData.reportingManager = req.body.reportingManager;
        if (leaveType) updateData.leaveType = leaveType;
        if (startDate) {
            const parsed = new Date(startDate);
            if (!Number.isNaN(parsed.getTime())) updateData.startDate = parsed;
        }
        if (endDate) {
            const parsed = new Date(endDate);
            if (!Number.isNaN(parsed.getTime())) updateData.endDate = parsed;
        }
        if (reason) updateData.reason = reason;
        if (req.body.isPastLeave !== undefined) {
            updateData.isPastLeave = req.body.isPastLeave === true || req.body.isPastLeave === 'true';
        }
        if (req.body.requestAirfare !== undefined) {
            updateData.requestAirfare = req.body.requestAirfare === true || req.body.requestAirfare === 'true';
        }

        if (req.body.visaExpiryDate) {
            let employeeObjId = null;
            if (employeeId) {
                employeeObjId = employeeId;
            } else if (oldRequest.employee) {
                const user = await User.findById(oldRequest.employee).populate('employeeId');
                if (user && user.employeeId) {
                    employeeObjId = user.employeeId._id || user.employeeId;
                } else {
                    const usr = await User.findById(oldRequest.employee);
                    if (usr) {
                        const emp = await Employee.findOne({
                            $or: [
                                { employeeName: usr.username },
                                { emailId: usr.emailId }
                            ]
                        });
                        if (emp) {
                            employeeObjId = emp._id;
                        }
                    }
                }
            }
            if (employeeObjId) {
                await Employee.findByIdAndUpdate(employeeObjId, { visaExpiryDate: new Date(req.body.visaExpiryDate) });
                console.log(`[Leave] Updated Employee ${employeeObjId} visaExpiryDate to ${req.body.visaExpiryDate} on leave update`);
            }
        }

        const effectiveStart = updateData.startDate || oldRequest.startDate;
        const effectiveEnd = updateData.endDate || oldRequest.endDate;

        // Validate dates against Employee's Joining Date (DOJ)
        if (effectiveStart && effectiveEnd) {
            const start = new Date(effectiveStart);
            const end = new Date(effectiveEnd);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                let employeeObj = null;
                if (employeeId) {
                    employeeObj = await Employee.findById(employeeId);
                } else if (oldRequest.employee) {
                    const user = await User.findById(oldRequest.employee).populate('employeeId');
                    if (user && user.employeeId) {
                        employeeObj = user.employeeId;
                    } else {
                        const usr = await User.findById(oldRequest.employee);
                        if (usr) {
                            employeeObj = await Employee.findOne({
                                $or: [
                                    { employeeName: usr.username },
                                    { emailId: usr.emailId }
                                ]
                            });
                        }
                    }
                }

                if (employeeObj && employeeObj.doj) {
                    const joiningDate = new Date(employeeObj.doj);
                    joiningDate.setHours(0, 0, 0, 0);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(0, 0, 0, 0);

                    if (start < joiningDate || end < joiningDate) {
                        return res.status(400).json({
                            message: `Leave dates cannot be before the Employee's Joining Date (${joiningDate.toLocaleDateString('en-GB')})`
                        });
                    }
                }
            }
        }

        // Derive Change Status audit (Created / Modified / Approved / Rejected / Cancelled / Error)
        let auditStatus = null;
        let auditRemarks = changeRemarks || '';
        if (changeStatus && CHANGE_STATUSES.includes(changeStatus)) {
            auditStatus = changeStatus;
        } else if (updateData.status === 'Rejected') {
            auditStatus = 'Rejected';
            auditRemarks = auditRemarks || 'Leave request rejected';
        } else if (updateData.status === 'Cancelled') {
            auditStatus = 'Cancelled';
            auditRemarks = auditRemarks || 'Leave request cancelled';
        } else if (updateData.status === 'Approved' || updateData.status === 'HOD Approved') {
            auditStatus = 'Approved';
            auditRemarks = auditRemarks || (updateData.status === 'HOD Approved' ? 'HOD approved leave request' : 'Leave request approved');
        } else if (
            updateData.startDate ||
            updateData.endDate ||
            updateData.leaveType ||
            updateData.reason ||
            updateData.employeeName ||
            updateData.company ||
            updateData.department !== undefined ||
            updateData.reportingManager !== undefined ||
            updateData.requestAirfare !== undefined ||
            updateData.isPastLeave !== undefined
        ) {
            auditStatus = 'Modified';
            if (!auditRemarks) {
                if (updateData.endDate && !updateData.startDate) {
                    auditRemarks = 'Leave end date updated';
                } else {
                    auditRemarks = 'Leave request modified';
                }
            }
        }

        let historyEntry = null;
        if (auditStatus) {
            historyEntry = applyChangeAudit(updateData, auditStatus, req.user, auditRemarks);
        }

        const updateOps = Object.keys(updateData).length
            ? (historyEntry
                ? { $set: updateData, $push: { statusChangeHistory: historyEntry } }
                : { $set: updateData })
            : null;

        if (!updateOps) {
            return res.json(oldRequest);
        }

        const updatedRequest = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            updateOps,
            { new: true, runValidators: true }
        ).populate('employee', 'username emailId')
            .populate('hodApprovedBy', 'username')
            .populate('adminApprovedBy', 'username')
            .populate('changedByUser', 'username');

        if (updateData.status === 'HOD Approved' || updateData.status === 'Approved' || updateData.status === 'Rejected') {
            sendLeaveStatusToEmployee(updatedRequest, updateData.status)
                .then(() => console.log('[Leave] Employee status email sent'))
                .catch(e => console.error('[Leave] Employee status email error:', e));

            const io = req.app.get('io');
            notifyLeaveStatusChange(io, updatedRequest, updateData.status, req.user.role)
                .catch((e) => console.error('[Leave] Status notification error:', e));
        }

        // Yet to go card: after Authorize/Approve, mark employee Vacation Pending
        if (updateData.status === 'Approved') {
            await syncYetToGoVacationStatus(updatedRequest);
        }

        res.json(updatedRequest);
    } catch (error) {
        console.error('Error updating leave request:', error);
        try {
            // Best-effort Error audit when update fails after leave was found
            if (req.params?.id && req.user) {
                const errEntry = buildChangeEntry('Error', req.user, error.message || 'Error updating leave request');
                await LeaveRequest.findByIdAndUpdate(req.params.id, {
                    $set: {
                        changeStatus: errEntry.changeStatus,
                        changedBy: errEntry.changedBy,
                        changedByUser: errEntry.changedByUser,
                        changedOn: errEntry.changedOn,
                        changeRemarks: errEntry.remarks,
                    },
                    $push: { statusChangeHistory: errEntry },
                });
            }
        } catch (auditErr) {
            console.error('Error writing leave Error audit:', auditErr);
        }
        res.status(400).json({ message: 'Error updating leave request', error: error.message });
    }
});

// Revert (cancel) an unavailed approved leave — credits balance back by excluding from entitlement calculations
router.post('/:id/revert', authMiddleware, async (req, res) => {
    try {
        const allowedRoles = ['admin', 'hr', 'hod', 'viewer', 'authorize_user'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'You do not have permission to revert leave requests' });
        }

        const leaveRequest = await LeaveRequest.findById(req.params.id);
        if (!leaveRequest) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        if (!['Approved', 'HOD Approved'].includes(leaveRequest.status)) {
            return res.status(400).json({
                message: 'Only approved leave requests can be reverted',
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(leaveRequest.startDate);
        start.setHours(0, 0, 0, 0);

        if (start <= today) {
            return res.status(400).json({
                message: 'Leave cannot be reverted once it has started or been availed. Revert is only allowed for future (unavailed) leave.',
            });
        }

        const creditedDays = calculateWorkingDays(leaveRequest.startDate, leaveRequest.endDate);

        const cancelEntry = buildChangeEntry(
            'Cancelled',
            req.user,
            req.body.changeRemarks || 'Leave reverted / cancelled'
        );

        const updatedRequest = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    status: 'Cancelled',
                    cancelledAt: new Date(),
                    cancelledBy: req.user._id || req.user.id,
                    changeStatus: cancelEntry.changeStatus,
                    changedBy: cancelEntry.changedBy,
                    changedByUser: cancelEntry.changedByUser,
                    changedOn: cancelEntry.changedOn,
                    changeRemarks: cancelEntry.remarks,
                },
                $push: { statusChangeHistory: cancelEntry },
            },
            { new: true, runValidators: true }
        )
            .populate('employee', 'username emailId')
            .populate('hodApprovedBy', 'username')
            .populate('adminApprovedBy', 'username')
            .populate('cancelledBy', 'username')
            .populate('changedByUser', 'username');

        const io = req.app.get('io');
        notifyLeaveStatusChange(io, updatedRequest, 'Cancelled', req.user.role)
            .catch((e) => console.error('[Leave] Revert notification error:', e));

        sendLeaveStatusToEmployee(updatedRequest, 'Cancelled')
            .then(() => console.log('[Leave] Revert email sent'))
            .catch(e => console.error('[Leave] Revert email error:', e));

        res.json({
            message: 'Leave reverted successfully. Leave balance has been credited back.',
            creditedDays,
            leaveRequest: updatedRequest,
        });
    } catch (error) {
        console.error('Error reverting leave request:', error);
        res.status(400).json({ message: 'Error reverting leave request', error: error.message });
    }
});

// Delete leave request
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'viewer' || req.user.role === 'authorize_user') {
            return res.status(403).json({ message: 'This role cannot delete leave requests' });
        }

        const deletedRequest = await LeaveRequest.findByIdAndDelete(req.params.id);
        if (!deletedRequest) {
            return res.status(404).json({ message: 'Leave request not found' });
        }
        res.json({ message: 'Leave request deleted successfully' });
    } catch (error) {
        console.error('Error deleting leave request:', error);
        res.status(500).json({ message: 'Error deleting leave request', error: error.message });
    }
});

// Bulk delete leave requests
router.post('/bulk-delete', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'hr') {
            return res.status(403).json({ message: 'Only Admin and HR can bulk delete leave requests' });
        }

        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No leave request IDs provided' });
        }

        const result = await LeaveRequest.deleteMany({ _id: { $in: ids } });
        res.json({ message: `Successfully deleted ${result.deletedCount} leave requests`, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Error bulk deleting leave requests:', error);
        res.status(500).json({ message: 'Error bulk deleting leave requests', error: error.message });
    }
});

// Bulk import leave requests
router.post('/bulk-import', authMiddleware, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'hr') {
            return res.status(403).json({ message: 'Only Admin and HR can bulk import leave requests' });
        }

        const { leaves } = req.body;
        if (!Array.isArray(leaves) || leaves.length === 0) {
            return res.status(400).json({ message: 'No leave data provided' });
        }

        const newLeaves = [];
        const errors = [];

        // Pre-fetch all users and employees to map employeeId to User _id or Employee _id
        const Employee = require('../models/Employee'); // Ensure Employee model is available
        const employees = await Employee.find({}).lean();
        const users = await User.find({}).lean();
        
        const empIdMap = {}; // Maps "idmo-032" -> Employee
        const empNameMap = {}; // Maps "pawan jaikishin" -> Employee
        
        employees.forEach(e => {
            if (e.employeeId) empIdMap[String(e.employeeId).toLowerCase()] = e;
            if (e.employeeName) empNameMap[String(e.employeeName).toLowerCase().replace(/[\s_.-]/g, '')] = e;
        });

        const userByEmpObjIdMap = {}; // Maps Employee._id -> User
        const userNameMap = {}; // Maps "pawan" -> User
        
        users.forEach(u => {
            if (u.employeeId) userByEmpObjIdMap[String(u.employeeId)] = u;
            if (u.username) userNameMap[String(u.username).toLowerCase().replace(/[\s_.-]/g, '')] = u;
        });

        for (let i = 0; i < leaves.length; i++) {
            const row = leaves[i];
            try {
                let targetUserId = null;
                const rawId = String(row.employeeId || '').toLowerCase();
                const rawName = String(row.employeeName || '').toLowerCase().replace(/[\s_.-]/g, '');
                
                // 1. Try matching by real Employee ID (e.g., idmo-032)
                let matchedEmp = null;
                if (rawId && empIdMap[rawId]) {
                    matchedEmp = empIdMap[rawId];
                }
                
                // 2. Try matching by Name exactly (if ID was a serial number like "1")
                if (!matchedEmp && rawName) {
                    matchedEmp = empNameMap[rawName];
                }
                
                // 3. Try fuzzy matching name (e.g. if Excel says "PAWAN JAIKISHIN KOTAI" but DB has "Pawan Jaikishin")
                if (!matchedEmp && rawName) {
                    const possibleEmps = employees.filter(e => {
                        const dbName = String(e.employeeName).toLowerCase().replace(/[\s_.-]/g, '');
                        return dbName.includes(rawName) || rawName.includes(dbName);
                    });
                    if (possibleEmps.length > 0) matchedEmp = possibleEmps[0];
                }

                // Now resolve to a User ID (or fallback to Employee ID)
                if (matchedEmp) {
                    const linkedUser = userByEmpObjIdMap[String(matchedEmp._id)];
                    targetUserId = linkedUser ? linkedUser._id : matchedEmp._id;
                } else if (rawName && userNameMap[rawName]) {
                    targetUserId = userNameMap[rawName]._id;
                }
                
                if (!targetUserId) {
                    const empText = row.employeeId ? `${row.employeeName} (ID: ${row.employeeId})` : `"${row.employeeName}"`;
                    errors.push(`[Sheet ${row.sheetName || 'Unknown'}] Row ${row.rowNumber || 'Unknown'}: Employee ${empText} was not found in the database. Please ensure the name matches the system.`);
                    continue;
                }

                let startDate = row.startDate ? new Date(row.startDate) : null;
                let endDate = row.endDate ? new Date(row.endDate) : null;

                if (!startDate || isNaN(startDate.getTime())) {
                    errors.push(`[Sheet ${row.sheetName || 'Unknown'}] Row ${row.rowNumber || 'Unknown'}: Missing or invalid start date for "${row.employeeName}".`);
                    continue;
                }
                if (!endDate || isNaN(endDate.getTime())) {
                    endDate = startDate; // fallback to single day
                }

                newLeaves.push({
                    employee: targetUserId,
                    employeeName: row.employeeName || row.employeeId || 'Unknown Employee',
                    company: row.company || 'Unknown Company',
                    department: matchedEmp?.department || row.department || '',
                    reportingManager: matchedEmp?.reportingManager || row.reportingManager || '',
                    leaveType: row.leaveType || 'Personal Leave',
                    startDate: startDate,
                    endDate: endDate,
                    reason: row.reason || 'Imported from Excel',
                    status: row.status || 'Approved', // Defaults to Approved for imported history
                    isPastLeave: true,
                    requestAirfare: row.requestAirfare === true || String(row.requestAirfare).toLowerCase() === 'yes' || String(row.requestAirfare).toLowerCase() === 'true',
                    appliedOn: row.appliedOn ? new Date(row.appliedOn) : new Date(),
                    adminApprovedBy: req.user.id,
                    adminApprovedAt: new Date()
                });
            } catch (err) {
                errors.push(`[Sheet ${row.sheetName || 'Unknown'}] Row ${row.rowNumber || 'Unknown'}: Failed to process "${row.employeeName}" - ${err.message}`);
            }
        }

        if (newLeaves.length > 0) {
            await LeaveRequest.insertMany(newLeaves);
        }

        res.json({
            message: `Successfully imported ${newLeaves.length} leave requests.`,
            errors: errors.length > 0 ? errors : undefined,
            importedCount: newLeaves.length
        });
    } catch (error) {
        console.error('Error bulk importing leave requests:', error);
        res.status(500).json({ message: 'Error bulk importing leave requests', error: error.message });
    }
});

module.exports = router;
