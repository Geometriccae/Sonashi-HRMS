const express = require('express');
const router = express.Router();
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { calculateWorkingDays } = require('../utils/leaveUtils');

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
        } else if (req.user.role === 'admin') {
            // Admin sees only HOD Approved requests (waiting for admin approval)
            // and also sees requests they have already processed (Approved, Rejected)
            // STRICTLY exclude 'Pending' requests regardless of query params
            const visibleStatuses = ['HOD Approved', 'Approved', 'Rejected'];

            if (status && status !== 'All') {
                if (visibleStatuses.includes(status)) {
                    filter.status = status;
                } else {
                    // If requesting a status admin shouldn't see (like 'Pending'), return nothing
                    // We set it to a value that will never match a real status
                    filter.status = 'RESTRICTED_VIEW';
                }
            } else {
                // Default: show HOD Approved (for approval) and completed ones
                filter.status = { $in: visibleStatuses };
            }
            if (employeeId) {
                filter.employee = employeeId;
            }
        } else {
            // Employees can only see their own requests
            filter.employee = req.user.id;
            if (status && status !== 'All') {
                filter.status = status;
            }
        }

        const leaveRequests = await LeaveRequest.find(filter)
            .populate('employee', 'username email')
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
        const { employeeId, employeeName, company, leaveType, startDate, endDate, reason } = req.body;

        const newLeaveRequest = new LeaveRequest({
            employee: employeeId || req.user.id,
            employeeName: employeeName || req.user.username,
            company,
            leaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            status: 'Pending'
        });

        const savedRequest = await newLeaveRequest.save();
        res.status(201).json(savedRequest);
    } catch (error) {
        console.error('Error creating leave request:', error);
        res.status(400).json({ message: 'Error creating leave request', error: error.message });
    }
});


// Update leave request status (Admin/HOD) or edit request (Employee)
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { employeeId, employeeName, company, status, leaveType, startDate, endDate, reason } = req.body;
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
            // Admin Approval Logic
            else if (userRole === 'admin') {
                if (status === 'Approved') {
                    // Admin can only approve HOD Approved requests
                    if (currentStatus !== 'HOD Approved') {
                        return res.status(400).json({
                            message: 'Admin can only approve requests that have been approved by HOD first'
                        });
                    }
                    // Admin final approval
                    updateData.status = 'Approved';
                    updateData.adminApprovedBy = req.user.id;
                    updateData.adminApprovedAt = new Date();
                } else if (status === 'Rejected') {
                    // Admin can reject HOD Approved requests
                    if (currentStatus !== 'HOD Approved') {
                        return res.status(400).json({
                            message: 'Admin can only reject requests that have been approved by HOD first'
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

        const updatedRequest = await LeaveRequest.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('employee', 'username email')
            .populate('hodApprovedBy', 'username')
            .populate('adminApprovedBy', 'username');

        // Leave balance is now calculated dynamically in /me endpoint
        // based on monthly accrual minus approved leave days

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

module.exports = router;
