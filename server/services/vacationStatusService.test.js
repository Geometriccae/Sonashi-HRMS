const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveEmployeeVacationStatus,
  applyEffectiveVacationStatuses,
  toCalendarDate,
} = require('../utils/vacationStatusFromDates');

describe('Automatic Vacation Status Update Logic - One Full Month Rule', () => {
  const on = (y, m, d) => new Date(y, m - 1, d);

  function createEmployee(overrides = {}) {
    return {
      _id: 'emp_001',
      employeeId: 'ID-001',
      employeeName: 'John Doe',
      employeeStatus: 'Active',
      vacationStatus: 'Onsite',
      attendance: 'Onsite',
      travellingDate: null,
      leaveEndDate: null,
      returnDate: null,
      firstWorkingDay: null,
      ...overrides,
    };
  }

  function createLeave(overrides = {}) {
    const startDate = overrides.startDate || on(2026, 10, 20);
    const endDate = overrides.endDate !== undefined ? overrides.endDate : on(2026, 10, 29);
    return {
      _id: 'leave_001',
      status: 'Approved',
      employeeId: 'ID-001',
      employeeName: 'John Doe',
      leaveType: 'Vacation',
      startDate,
      travellingDate: overrides.travellingDate !== undefined ? overrides.travellingDate : startDate,
      endDate,
      returnDate: overrides.returnDate !== undefined ? overrides.returnDate : endDate,
      ...overrides,
    };
  }

  it('1. Before vacation begins: retains or displays Vacation Pending (Yet to Go)', () => {
    const emp = createEmployee({ vacationStatus: 'Onsite' });
    const leaves = [createLeave({ startDate: on(2026, 10, 20), endDate: on(2026, 10, 29) })];

    // Tested on Oct 15 (before Oct 20 start)
    const status = resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 15));
    assert.equal(status, 'Vacation Pending');
  });

  it('2. During vacation period: displays On Vacation', () => {
    const emp = createEmployee({ vacationStatus: 'Vacation Pending' });
    const leaves = [createLeave({ startDate: on(2026, 10, 20), endDate: on(2026, 10, 29) })];

    // Vacation start date (Oct 20)
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 20)), 'On Vacation');
    // Middle of vacation (Oct 25)
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 25)), 'On Vacation');
    // Return date itself (Oct 29): still in vacation period
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 29)), 'On Vacation');
  });

  it('3. One Full Calendar Month Rule: remains Returned Back until 1 month elapses, then Onsite', () => {
    const emp = createEmployee({ vacationStatus: 'On Vacation' });
    const leaves = [createLeave({
      startDate: on(2026, 10, 20),
      endDate: on(2026, 10, 29),
      returnDate: on(2026, 10, 29),
    })];

    // Oct 28: On Vacation
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 28)), 'On Vacation');
    // Oct 29 (return date): On Vacation
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 29)), 'On Vacation');
    // Oct 30 (day after return date): Vacation Approved (Returned Back)
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 30)), 'Vacation Approved');
    // Nov 15 (middle of 1-month period): Vacation Approved (Returned Back)
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 11, 15)), 'Vacation Approved');
    // Nov 29 (exactly 1 calendar month): Vacation Approved (Returned Back)
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 11, 29)), 'Vacation Approved');
    // Nov 30 (one full month has completed): Onsite!
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 11, 30)), 'Onsite');
  });

  it('4. User prompt examples for 1-month rule', () => {
    // Return Date: Sep 25 -> Returned Back until Oct 25 passes -> Onsite from Oct 26
    const empSep25 = createEmployee();
    const leaveSep25 = [createLeave({ startDate: on(2026, 9, 1), endDate: on(2026, 9, 25), returnDate: on(2026, 9, 25) })];
    assert.equal(resolveEmployeeVacationStatus(empSep25, leaveSep25, on(2026, 9, 25)), 'On Vacation');
    assert.equal(resolveEmployeeVacationStatus(empSep25, leaveSep25, on(2026, 9, 26)), 'Vacation Approved');
    assert.equal(resolveEmployeeVacationStatus(empSep25, leaveSep25, on(2026, 10, 25)), 'Vacation Approved');
    assert.equal(resolveEmployeeVacationStatus(empSep25, leaveSep25, on(2026, 10, 26)), 'Onsite');

    // Return Date: Sep 29 -> Returned Back until Oct 29 passes -> Onsite from Oct 30
    const empSep29 = createEmployee();
    const leaveSep29 = [createLeave({ startDate: on(2026, 9, 1), endDate: on(2026, 9, 29), returnDate: on(2026, 9, 29) })];
    assert.equal(resolveEmployeeVacationStatus(empSep29, leaveSep29, on(2026, 9, 29)), 'On Vacation');
    assert.equal(resolveEmployeeVacationStatus(empSep29, leaveSep29, on(2026, 9, 30)), 'Vacation Approved');
    assert.equal(resolveEmployeeVacationStatus(empSep29, leaveSep29, on(2026, 10, 29)), 'Vacation Approved');
    assert.equal(resolveEmployeeVacationStatus(empSep29, leaveSep29, on(2026, 10, 30)), 'Onsite');

    // Return Date: Oct 1 -> Returned Back until Nov 1 passes -> Onsite from Nov 2
    const empOct1 = createEmployee();
    const leaveOct1 = [createLeave({ startDate: on(2026, 9, 15), endDate: on(2026, 10, 1), returnDate: on(2026, 10, 1) })];
    assert.equal(resolveEmployeeVacationStatus(empOct1, leaveOct1, on(2026, 10, 1)), 'On Vacation');
    assert.equal(resolveEmployeeVacationStatus(empOct1, leaveOct1, on(2026, 10, 2)), 'Vacation Approved');
    assert.equal(resolveEmployeeVacationStatus(empOct1, leaveOct1, on(2026, 11, 1)), 'Vacation Approved');
    assert.equal(resolveEmployeeVacationStatus(empOct1, leaveOct1, on(2026, 11, 2)), 'Onsite');
  });

  it('5. Month-end clamping for shorter months (Oct 31 -> Nov 30 -> Dec 1)', () => {
    const empOct31 = createEmployee();
    const leaveOct31 = [createLeave({ startDate: on(2026, 10, 1), endDate: on(2026, 10, 31), returnDate: on(2026, 10, 31) })];
    assert.equal(resolveEmployeeVacationStatus(empOct31, leaveOct31, on(2026, 11, 1)), 'Vacation Approved');
    assert.equal(resolveEmployeeVacationStatus(empOct31, leaveOct31, on(2026, 11, 30)), 'Vacation Approved');
    assert.equal(resolveEmployeeVacationStatus(empOct31, leaveOct31, on(2026, 12, 1)), 'Onsite');
  });

  it('6. Missing return date and missing end date: preserves On Vacation and does NOT invent a return date', () => {
    const emp = createEmployee({
      vacationStatus: 'On Vacation',
      travellingDate: on(2026, 10, 1),
      leaveEndDate: null,
      returnDate: null,
    });
    const leaves = [createLeave({
      startDate: on(2026, 10, 1),
      endDate: null,
      returnDate: null,
    })];

    const status = resolveEmployeeVacationStatus(emp, leaves, on(2026, 11, 15));
    assert.equal(status, 'On Vacation');
  });

  it('7. Idempotency: already-onsite employees do not trigger changes when return date has passed', () => {
    const emp = createEmployee({
      vacationStatus: 'Onsite',
      attendance: 'Onsite',
    });
    const leaves = [createLeave({
      startDate: on(2026, 7, 1),
      endDate: on(2026, 7, 15),
      returnDate: on(2026, 7, 15),
    })];

    const targetStatus = resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 1));
    assert.equal(targetStatus, 'Onsite');
    assert.equal(emp.vacationStatus === targetStatus, true);
  });

  it('8. Consistency across list views (applyEffectiveVacationStatuses)', () => {
    const employees = [
      createEmployee({ _id: 'e1', employeeId: 'IDMM-001', employeeName: 'Employee One', vacationStatus: 'On Vacation' }),
      createEmployee({ _id: 'e2', employeeId: 'IDMM-002', employeeName: 'Employee Two', vacationStatus: 'On Vacation' }),
      createEmployee({ _id: 'e3', employeeId: 'IDMM-003', employeeName: 'Employee Three', vacationStatus: 'Onsite' }),
    ];
    const leaves = [
      // e1: return date Oct 29 -> on Oct 30 is within 1 month -> Vacation Approved
      createLeave({ _id: 'l1', employeeId: 'IDMM-001', employeeName: 'Employee One', startDate: on(2026, 10, 20), endDate: on(2026, 10, 29) }),
      // e2: vacation active on Oct 30 (Oct 25 to Nov 5) -> should be On Vacation
      createLeave({ _id: 'l2', employeeId: 'IDMM-002', employeeName: 'Employee Two', startDate: on(2026, 10, 25), endDate: on(2026, 11, 5) }),
      // e3: upcoming trip starting Nov 1 -> should be Vacation Pending
      createLeave({ _id: 'l3', employeeId: 'IDMM-003', employeeName: 'Employee Three', startDate: on(2026, 11, 1), endDate: on(2026, 11, 10) }),
    ];

    const resolved = applyEffectiveVacationStatuses(employees, leaves, on(2026, 10, 30));
    assert.equal(resolved[0].vacationStatus, 'Vacation Approved');
    assert.equal(resolved[1].vacationStatus, 'On Vacation');
    assert.equal(resolved[2].vacationStatus, 'Vacation Pending');
  });

  it('9. Timezone and date boundary handling: midnight roll-overs', () => {
    const emp = createEmployee({ vacationStatus: 'On Vacation' });
    const leaves = [createLeave({
      startDate: '2026-10-20',
      endDate: '2026-10-29',
      returnDate: '2026-10-29',
    })];

    // 23:59:59 on Oct 29 is still Oct 29 calendar day -> On Vacation
    const lateNightOct29 = new Date(2026, 9, 29, 23, 59, 59, 999);
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, lateNightOct29), 'On Vacation');

    // 00:00:00 on Oct 30 is Oct 30 calendar day -> Vacation Approved (Returned Back)
    const midnightOct30 = new Date(2026, 9, 30, 0, 0, 0, 0);
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, midnightOct30), 'Vacation Approved');

    // 00:00:00 on Nov 30 is after 1 month has elapsed -> Onsite
    const midnightNov30 = new Date(2026, 10, 30, 0, 0, 0, 0);
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, midnightNov30), 'Onsite');
  });

  it('10. Preserves manual status overrides unless dates have progressed past them', () => {
    const empManualOnsite = createEmployee({
      vacationStatus: 'Onsite',
      vacationStatusSource: 'manual',
    });
    const leaves = [createLeave({ startDate: on(2026, 10, 20), endDate: on(2026, 10, 30) })];
    assert.equal(resolveEmployeeVacationStatus(empManualOnsite, leaves, on(2026, 10, 25)), 'Onsite');

    const empManualPending = createEmployee({
      vacationStatus: 'Vacation Pending',
      vacationStatusSource: 'manual',
      travellingDate: on(2026, 10, 20),
      leaveEndDate: on(2026, 10, 29),
    });
    assert.equal(resolveEmployeeVacationStatus(empManualPending, [], on(2026, 10, 21)), 'On Vacation');
  });
});
