const cron = require('node-cron');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const { workingStatusFilter } = require('../utils/employeeStatus');
const {
  resolveEmployeeVacationStatus,
  toCalendarDate,
  APPROVED_LEAVE_STATUSES,
} = require('../utils/vacationStatusFromDates');
const {
  invalidateListCache,
  invalidateApprovedLeavesCache,
} = require('../utils/employeeListCache');
const { invalidateVacationDashboardStats } = require('../utils/vacationDashboardStats');

const APPROVED_LEAVE_SELECT =
  'employee employeeRecordId employeeId employeeName leaveType startDate endDate status travellingDate returnDate firstWorkingDay lastWorkingDay department adminApprovedAt hodApprovedAt createdAt updatedAt';

/**
 * Automatically update vacation status for employees based on authoritative leave/return dates.
 *
 * Rules:
 * - Before approved vacation begins: "Vacation Pending" (displays as "Yet to Go")
 * - During vacation period (through return date): "On Vacation"
 * - After applicable return date has passed: "Onsite"
 * - Missing return date: does not invent a date; preserves "On Vacation"
 * - Preserves employeeStatus (Active/Inactive) untouched
 * - Idempotent: only modifies employees whose status actually changed
 */
async function autoUpdateVacationStatuses(referenceDate = new Date(), io = null) {
  try {
    const today = toCalendarDate(referenceDate);
    const workingFilter = workingStatusFilter();

    const [employees, approvedLeaves] = await Promise.all([
      Employee.find(workingFilter).lean(),
      LeaveRequest.find({
        status: { $in: APPROVED_LEAVE_STATUSES },
      })
        .select(APPROVED_LEAVE_SELECT)
        .lean(),
    ]);

    if (!Array.isArray(employees) || employees.length === 0) {
      return { updatedCount: 0, totalChecked: 0, updatedEmployees: [] };
    }

    const bulkOps = [];
    const updatedEmployees = [];

    for (const emp of employees) {
      const targetStatus = resolveEmployeeVacationStatus(emp, approvedLeaves, today);
      if (!targetStatus) continue;

      // Only perform update if stored status differs from authoritative target status
      if (emp.vacationStatus !== targetStatus) {
        const updateFields = {
          vacationStatus: targetStatus,
          vacationStatusSource: 'leave',
          vacationStatusUpdatedAt: new Date(),
        };

        // Align attendance with vacation status
        if (targetStatus === 'On Vacation') {
          updateFields.attendance = 'Leave';
        } else if (targetStatus === 'Onsite') {
          updateFields.attendance = 'Onsite';
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: emp._id },
            update: { $set: updateFields },
          },
        });

        updatedEmployees.push({
          _id: emp._id,
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          from: emp.vacationStatus,
          to: targetStatus,
        });
      }
    }

    if (bulkOps.length > 0) {
      await Employee.bulkWrite(bulkOps);

      // Invalidate caches to guarantee fresh data across all screens
      invalidateListCache();
      invalidateApprovedLeavesCache();
      invalidateVacationDashboardStats();

      if (io) {
        io.emit('vacationStatusAutoUpdated', {
          count: bulkOps.length,
          referenceDate: today,
          employees: updatedEmployees.map((e) => ({
            _id: e._id,
            employeeId: e.employeeId,
            vacationStatus: e.to,
          })),
        });
      }

      console.log(
        `[VacationStatusService] Auto-updated ${bulkOps.length} employee vacation status(es) on ${today?.toISOString().slice(0, 10)}`
      );
    }

    return {
      updatedCount: bulkOps.length,
      totalChecked: employees.length,
      updatedEmployees,
    };
  } catch (error) {
    console.error('[VacationStatusService] Error during autoUpdateVacationStatuses:', error);
    throw error;
  }
}

/**
 * Initializes the vacation status automatic update cron job.
 * - Runs at midnight daily (00:00) when calendar day boundaries roll over.
 * - Runs hourly (at minute 0) to catch any missed updates or date changes.
 * - Runs once immediately on server startup.
 */
function initVacationStatusCron(io) {
  // Run on startup
  autoUpdateVacationStatuses(new Date(), io).catch((err) => {
    console.error('[VacationStatusService] Initial startup auto-update error:', err);
  });

  // Daily midnight schedule (00:00:00)
  cron.schedule('0 0 * * *', () => {
    console.log('[VacationStatusService] Running midnight vacation status auto-update...');
    autoUpdateVacationStatuses(new Date(), io).catch((err) => {
      console.error('[VacationStatusService] Midnight cron error:', err);
    });
  });

  // Hourly schedule (every hour at :00)
  cron.schedule('0 * * * *', () => {
    autoUpdateVacationStatuses(new Date(), io).catch((err) => {
      console.error('[VacationStatusService] Hourly cron error:', err);
    });
  });

  console.log('[VacationStatusService] Cron scheduled (daily midnight + hourly).');
}

module.exports = {
  autoUpdateVacationStatuses,
  initVacationStatusCron,
};

