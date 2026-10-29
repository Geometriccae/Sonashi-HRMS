const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveEmployeeVacationStatus,
  applyEffectiveVacationStatuses,
  toCalendarDate,
} = require('../utils/vacationStatusFromDates');

describe('Automatic Vacation Status Update Logic', () => {
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

  it('3. After applicable return date has passed: automatically transitions to Onsite (October 29 example)', () => {
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
    // Oct 30 (return date has passed): Onsite!
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 30)), 'Onsite');
    // Nov 5 (subsequent days): Onsite
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 11, 5)), 'Onsite');
  });

  it('4. Early return date overrides planned end date', () => {
    const emp = createEmployee({ vacationStatus: 'On Vacation' });
    // Planned end is Nov 10, but actual return is Oct 25
    const leaves = [createLeave({
      startDate: on(2026, 10, 20),
      endDate: on(2026, 11, 10),
      returnDate: on(2026, 10, 25),
    })];

    // Oct 25: return date itself -> On Vacation
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 25)), 'On Vacation');
    // Oct 26: return date has passed -> Onsite
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 26)), 'Onsite');
  });

  it('5. Missing return date and missing end date: preserves On Vacation and does NOT invent a return date', () => {
    const emp = createEmployee({
      vacationStatus: 'On Vacation',
      travellingDate: on(2026, 10, 1),
      leaveEndDate: null,
      returnDate: null,
    });
    // Travel has started, no return date in leave or employee
    const leaves = [createLeave({
      startDate: on(2026, 10, 1),
      endDate: null,
      returnDate: null,
    })];

    // Months after travel date, with no return date, it does not invent one
    const status = resolveEmployeeVacationStatus(emp, leaves, on(2026, 11, 15));
    assert.equal(status, 'On Vacation');
  });

  it('6. Idempotency: already-onsite employees do not trigger changes when return date has passed', () => {
    const emp = createEmployee({
      vacationStatus: 'Onsite',
      attendance: 'Onsite',
    });
    const leaves = [createLeave({
      startDate: on(2026, 9, 1),
      endDate: on(2026, 9, 15),
      returnDate: on(2026, 9, 15),
    })];

    const targetStatus = resolveEmployeeVacationStatus(emp, leaves, on(2026, 10, 1));
    assert.equal(targetStatus, 'Onsite');
    // Stored matches target -> 0 mutations required
    assert.equal(emp.vacationStatus === targetStatus, true);
  });

  it('7. Consistency across list views (applyEffectiveVacationStatuses)', () => {
    const employees = [
      createEmployee({ _id: 'e1', employeeId: 'IDMM-001', employeeName: 'Employee One', vacationStatus: 'On Vacation' }),
      createEmployee({ _id: 'e2', employeeId: 'IDMM-002', employeeName: 'Employee Two', vacationStatus: 'On Vacation' }),
      createEmployee({ _id: 'e3', employeeId: 'IDMM-003', employeeName: 'Employee Three', vacationStatus: 'Onsite' }),
    ];
    const leaves = [
      // e1: return date Oct 29 has passed on Oct 30 -> should be Onsite
      createLeave({ _id: 'l1', employeeId: 'IDMM-001', employeeName: 'Employee One', startDate: on(2026, 10, 20), endDate: on(2026, 10, 29) }),
      // e2: vacation active on Oct 30 (Oct 25 to Nov 5) -> should be On Vacation
      createLeave({ _id: 'l2', employeeId: 'IDMM-002', employeeName: 'Employee Two', startDate: on(2026, 10, 25), endDate: on(2026, 11, 5) }),
      // e3: upcoming trip starting Nov 1 -> should be Vacation Pending
      createLeave({ _id: 'l3', employeeId: 'IDMM-003', employeeName: 'Employee Three', startDate: on(2026, 11, 1), endDate: on(2026, 11, 10) }),
    ];

    const resolved = applyEffectiveVacationStatuses(employees, leaves, on(2026, 10, 30));
    assert.equal(resolved[0].vacationStatus, 'Onsite');
    assert.equal(resolved[1].vacationStatus, 'On Vacation');
    assert.equal(resolved[2].vacationStatus, 'Vacation Pending');
  });

  it('8. Timezone and date boundary handling: midnight roll-overs', () => {
    const emp = createEmployee({ vacationStatus: 'On Vacation' });
    const leaves = [createLeave({
      startDate: '2026-10-20',
      endDate: '2026-10-29',
      returnDate: '2026-10-29',
    })];

    // 23:59:59 on Oct 29 is still Oct 29 calendar day -> On Vacation
    const lateNightOct29 = new Date(2026, 9, 29, 23, 59, 59, 999);
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, lateNightOct29), 'On Vacation');

    // 00:00:00 on Oct 30 is Oct 30 calendar day -> Onsite
    const midnightOct30 = new Date(2026, 9, 30, 0, 0, 0, 0);
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, midnightOct30), 'Onsite');
  });

  it('9. Preserves manual status overrides unless dates have progressed past them', () => {
    // Admin set Onsite override
    const empManualOnsite = createEmployee({
      vacationStatus: 'Onsite',
      vacationStatusSource: 'manual',
    });
    // Active leave exists
    const leaves = [createLeave({ startDate: on(2026, 10, 20), endDate: on(2026, 10, 30) })];
    // Manual Onsite survives active leave
    assert.equal(resolveEmployeeVacationStatus(empManualOnsite, leaves, on(2026, 10, 25)), 'Onsite');

    // Manual Vacation Pending ("Yet to Go")
    const empManualPending = createEmployee({
      vacationStatus: 'Vacation Pending',
      vacationStatusSource: 'manual',
      travellingDate: on(2026, 10, 20),
      leaveEndDate: on(2026, 10, 29),
    });
    // Once travel date arrives, live stage "On Vacation" overtakes manual "Vacation Pending"
    assert.equal(resolveEmployeeVacationStatus(empManualPending, [], on(2026, 10, 21)), 'On Vacation');
  });
});
