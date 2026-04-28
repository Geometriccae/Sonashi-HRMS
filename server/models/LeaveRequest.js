const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    employeeName: {
        type: String,
        required: true
    },
    company: {
        type: String,
        required: true
    },
    department: {
        type: String,
        default: ""
    },
    reportingManager: {
        type: String,
        default: ""
    },
    leaveType: {
        type: String,
        enum: ['Sick Leave', 'Vacation', 'Personal Leave', 'Maternity/Paternity', 'Other'],
        default: 'Personal Leave'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'HOD Approved', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    appliedOn: {
        type: Date,
        default: Date.now
    },
    // HOD approval tracking
    hodApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    hodApprovedAt: {
        type: Date,
        default: null
    },
    // Admin approval tracking
    adminApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    adminApprovedAt: {
        type: Date,
        default: null
    },
    requestAirfare: {
        type: Boolean,
        default: false
    },
    airfareStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Not Applicable'],
        default: 'Not Applicable'
    }
}, { timestamps: true });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
