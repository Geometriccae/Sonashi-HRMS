const mongoose = require('mongoose');

const CHANGE_STATUSES = ['Created', 'Modified', 'Cancelled', 'Approved', 'Rejected', 'Error'];

const statusChangeEntrySchema = new mongoose.Schema({
    changeStatus: {
        type: String,
        enum: CHANGE_STATUSES,
        required: true
    },
    changedBy: {
        type: String,
        default: ''
    },
    changedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    changedOn: {
        type: Date,
        default: Date.now
    },
    remarks: {
        type: String,
        default: ''
    }
}, { _id: false });

const leaveRequestSchema = new mongoose.Schema({
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    /**
     * Canonical Team Management Employee._id.
     * leave.employee may be User._id or Employee._id; this field always points
     * at the Employee record when known (set on create/update/import; enriched on read).
     */
    employeeRecordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
        index: true
    },
    /** HR employee code (e.g. IDMO-032) — not a Mongo ObjectId */
    employeeId: {
        type: String,
        default: ''
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
        enum: ['Sick Leave', 'Vacation', 'Personal Leave', 'Annual Leave', 'Maternity/Paternity', 'Other'],
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
    /**
     * Excel / imported day count when it differs from a live date-diff.
     * Leave totals use this value when present.
     */
    leaveDays: {
        type: Number,
        default: null
    },
    /** excel-master-tracker = imported historical row; live requests leave this empty. */
    importSource: {
        type: String,
        default: ''
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'HOD Approved', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending'
    },
    // Audit / Change Status tracking for Leave Report
    changeStatus: {
        type: String,
        enum: CHANGE_STATUSES,
        default: 'Created'
    },
    changedBy: {
        type: String,
        default: ''
    },
    changedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    changedOn: {
        type: Date,
        default: Date.now
    },
    changeRemarks: {
        type: String,
        default: ''
    },
    statusChangeHistory: {
        type: [statusChangeEntrySchema],
        default: []
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
    },
    isPastLeave: {
        type: Boolean,
        default: false
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // Role of the user the leave belongs to (used for Admin → Authorize approval routing)
    requesterRole: {
        type: String,
        default: ''
    }
}, { timestamps: true });

leaveRequestSchema.index({ status: 1, startDate: 1 });
leaveRequestSchema.index({ employee: 1, status: 1 });
leaveRequestSchema.index({ employeeId: 1, status: 1 });
leaveRequestSchema.index({ status: 1, appliedOn: -1 });
leaveRequestSchema.index({ department: 1, status: 1 });
leaveRequestSchema.index({ employeeName: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
module.exports.CHANGE_STATUSES = CHANGE_STATUSES;
