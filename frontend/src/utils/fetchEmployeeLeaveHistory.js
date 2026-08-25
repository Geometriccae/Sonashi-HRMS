import leaveRequestService from "../services/LeaveRequestService";

/**
 * Full leave history for one Team Management employee (Employee._id).
 * Used by Leave Entitlement / Add / Edit balance panels — never the
 * year-filtered Leave Management table page.
 */
export async function fetchEmployeeLeaveHistory(employeeMongoId) {
  if (!employeeMongoId) return [];
  const data = await leaveRequestService.getLeaveRequests({
    employeeRecordId: String(employeeMongoId),
    force: true,
  });
  return Array.isArray(data) ? data : data?.data || [];
}
