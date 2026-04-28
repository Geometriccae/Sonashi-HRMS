const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { calculateWorkingDays, isPublicHoliday } = require('../utils/leaveUtils');

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
                filter.status = { $in: ['Pending', 'HOD Approved', 'Approved', 'Rejected'] };
            }
            if (employeeId) {
                filter.employee = employeeId;
            }
        } else if (req.user.role === 'admin' || req.user.role === 'hr') {
            // Admin and HR see Pending requests, HOD processed requests, and final ones
            const visibleStatuses = ['Pending', 'HOD Approved', 'Approved', 'Rejected'];

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
            .populate('employee', 'username emailId employeeId')
            .populate('hodApprovedBy', 'username')
            .populate('adminApprovedBy', 'username')
            .sort({ appliedOn: -1 });

        res.json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Error fetching leave requests', error: error.message });
    }
});

// Create a new leave request
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { employeeId, employeeName, company, department, reportingManager, leaveType, startDate, endDate, reason, requestAirfare } = req.body;

        if (hasHolidayInRange(startDate, endDate)) {
            return res.status(400).json({ message: 'This is a government holiday. You should not apply for a leave request.' });
        }

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
            status: 'Pending',
            requestAirfare: req.body.requestAirfare === true || req.body.requestAirfare === 'true'
        });

        const savedRequest = await newLeaveRequest.save();
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
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(400).json({ message: 'Error creating leave request', error: error.message });
    }
});


// Update leave request status (Admin/HOD) or edit request (Employee)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { employeeId, employeeName, company, status, leaveType, startDate, endDate, reason, requestAirfare } = req.body;
        const updateData = {};

        const oldRequest = await LeaveRequest.findById(req.params.id);
        if (!oldRequest) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        // Handle status update (approval/rejection)
        if (status) {
            const userRole = req.user.role;
            const currentStatus = oldRequest.status;

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
            // Final Approval Logic: Only Admin can finalize.
            else if (userRole === 'admin') {
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

        // Handle other field updates (for employee editing their own request)
        if (employeeId) updateData.employee = employeeId;
        if (employeeName) updateData.employeeName = employeeName;
        if (company) updateData.company = company;
        if (leaveType) updateData.leaveType = leaveType;
        if (startDate) updateData.startDate = new Date(startDate);
        if (endDate) updateData.endDate = new Date(endDate);
        if (reason) updateData.reason = reason;
        if (req.body.requestAirfare !== undefined) {
            updateData.requestAirfare = req.body.requestAirfare === true || req.body.requestAirfare === 'true';
        }

        const effectiveStart = updateData.startDate || oldRequest.startDate;
        const effectiveEnd = updateData.endDate || oldRequest.endDate;
        const startStr = effectiveStart && (effectiveStart.toISOString ? effectiveStart.toISOString().split('T')[0] : effectiveStart);
        const endStr = effectiveEnd && (effectiveEnd.toISOString ? effectiveEnd.toISOString().split('T')[0] : effectiveEnd);
        if (startStr && endStr && hasHolidayInRange(startStr, endStr)) {
            return res.status(400).json({ message: 'This is a government holiday. You should not apply for a leave request.' });
        }

        const updatedRequest = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('employee', 'username emailId')
            .populate('hodApprovedBy', 'username')
            .populate('adminApprovedBy', 'username');

        if (updateData.status === 'HOD Approved' || updateData.status === 'Approved' || updateData.status === 'Rejected') {
            sendLeaveStatusToEmployee(updatedRequest, updateData.status)
                .then(() => console.log('[Leave] Employee status email sent'))
                .catch(e => console.error('[Leave] Employee status email error:', e));
        }

        res.json(updatedRequest);
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(400).json({ message: 'Error updating leave request', error: error.message });
    }
});

// Delete leave request
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
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
