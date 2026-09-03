const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveEmployeeVacationStatus,
  applyEffectiveVacationStatuses,
} = require('./vacationStatusFromDates');

const TODAY = new Date(2026, 7, 31); // 31 Aug 2026

function employee(overrides = {}) {
  return {
    _id: 'emp1',
    employeeId: 'IDMM-001',
    employeeName: 'Test Employee',
    vacationStatus: 'Onsite',
    travellingDate: new Date(2026, 7, 1),
    leaveEndDate: new Date(2026, 8, 15),
    ...overrides,
  };
}

function leave(overrides = {}) {
  return {
    status: 'Approved',
    employeeId: 'IDMM-001',
    employeeName: 'Test Employee',
    travellingDate: new Date(2026, 7, 1),
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 8, 15),
    ...overrides,
  };
}

describe('resolveEmployeeVacationStatus', () => {
  it('derives On Vacation from current leave when stored Onsite has no returnDate', () => {
    const status = resolveEmployeeVacationStatus(employee(), [leave()], TODAY);
    assert.equal(status, 'On Vacation');
  });

  it('uses approved active dates instead of a stale Onsite/returnDate', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Onsite', returnDate: TODAY }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('recalculates stale Returned Back from approved active dates', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        vacationStatusSource: 'leave',
        returnDate: new Date(2026, 6, 1),
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('derives Yet to Go from a future travelling date', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        travellingDate: new Date(2026, 8, 10),
        leaveEndDate: new Date(2026, 8, 20),
        returnDate: null,
      }),
      [leave({ travellingDate: new Date(2026, 8, 10), startDate: new Date(2026, 8, 10), endDate: new Date(2026, 8, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
  });

  it('matches legacy employee codes case-insensitively for Yet to Go', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ employeeId: 'legacy-001', travellingDate: null, leaveEndDate: null }),
      [leave({
        employeeId: 'LEGACY-001',
        travellingDate: new Date(2026, 8, 10),
        startDate: new Date(2026, 8, 10),
        endDate: new Date(2026, 8, 20),
      })],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
  });

  it('recalculates stale Onsite as Yet to Go for a future approved trip', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        travellingDate: new Date(2026, 8, 10),
        leaveEndDate: new Date(2026, 8, 20),
        returnDate: TODAY,
      }),
      [leave({ travellingDate: new Date(2026, 8, 10), startDate: new Date(2026, 8, 10), endDate: new Date(2026, 8, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
  });

  it('auto-advances Onsite to On Vacation once a later trip travel date is reached', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        travellingDate: new Date(2026, 7, 25),
        leaveEndDate: new Date(2026, 8, 20),
        returnDate: new Date(2026, 7, 20),
      }),
      [leave({ travellingDate: new Date(2026, 7, 25), startDate: new Date(2026, 7, 25), endDate: new Date(2026, 8, 20) })],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('derives Returned Back from a leave that ended in the last 6 months', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        travellingDate: new Date(2026, 2, 1),
        leaveEndDate: new Date(2026, 2, 20),
        returnDate: null,
      }),
      [leave({ travellingDate: new Date(2026, 2, 1), startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Approved');
  });

  it('derives Returned Back from completed approved dates despite stale Onsite', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        travellingDate: new Date(2026, 2, 1),
        leaveEndDate: new Date(2026, 2, 20),
        returnDate: new Date(2026, 2, 20),
      }),
      [leave({ travellingDate: new Date(2026, 2, 1), startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Approved');
  });

  it('moves Yet to Go to On Vacation when approved dates are active', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Vacation Pending', returnDate: null }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('auto-advances Yet to Go to On Vacation on the travelling date', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Pending',
        travellingDate: TODAY,
        leaveEndDate: new Date(2026, 8, 15),
        returnDate: null,
      }),
      [leave({ travellingDate: TODAY, startDate: TODAY, endDate: new Date(2026, 8, 15) })],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('moves Returned Back to On Vacation when re-approved dates are active', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        returnDate: new Date(2026, 8, 15),
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('moves On Vacation to Yet to Go when re-approved dates are future', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'On Vacation',
        travellingDate: new Date(2026, 8, 10),
        leaveEndDate: new Date(2026, 8, 20),
        returnDate: null,
      }),
      [leave({ travellingDate: new Date(2026, 8, 10), startDate: new Date(2026, 8, 10), endDate: new Date(2026, 8, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
  });

  it('keeps On Vacation when HR moved the employee back from Returned Back', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'On Vacation',
        returnDate: null,
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('does not let a previous trip returnDate end a currently approved leave', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'On Vacation',
        returnDate: new Date(2026, 6, 20),
        leaveEndDate: new Date(2026, 8, 4),
      }),
      [leave({ endDate: new Date(2026, 8, 4) })],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('preserves Onboarding when there is no leave-derived status', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onboarding',
        travellingDate: null,
        leaveEndDate: null,
        returnDate: null,
      }),
      [],
      TODAY
    );
    assert.equal(status, 'Onboarding');
  });

  it('preserves a manual vacation status when no approved dated leave exists', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'On Vacation',
        travellingDate: null,
        leaveEndDate: null,
        returnDate: null,
      }),
      [],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('honors a persisted actual return date for the current approved trip', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        returnDate: new Date(2026, 7, 27),
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'Vacation Approved');
  });

  it('uses approved leave dates instead of a stale manual Yet to Go label', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Pending',
        vacationStatusSource: 'manual',
        travellingDate: new Date(2026, 8, 10),
        leaveEndDate: new Date(2026, 8, 20),
        returnDate: null,
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('keeps Yet to Go when approved leave dates are still in the future', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        vacationStatusSource: 'manual',
        travellingDate: new Date(2026, 8, 10),
        leaveEndDate: new Date(2026, 8, 20),
        returnDate: null,
      }),
      [leave({ travellingDate: new Date(2026, 8, 10), startDate: new Date(2026, 8, 10), endDate: new Date(2026, 8, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
  });
});

describe('applyEffectiveVacationStatuses', () => {
  it('overlays the approved date-derived status onto list rows', () => {
    const [row] = applyEffectiveVacationStatuses(
      [employee({ vacationStatus: 'Onsite', returnDate: TODAY })],
      [leave()],
      TODAY
    );
    assert.equal(row.vacationStatus, 'On Vacation');
  });

  it('moves stale Yet to Go list rows to On Vacation', () => {
    const [row] = applyEffectiveVacationStatuses(
      [employee({ vacationStatus: 'Vacation Pending', returnDate: null })],
      [leave()],
      TODAY
    );
    assert.equal(row.vacationStatus, 'On Vacation');
  });

  it('moves stale Returned Back list rows to On Vacation', () => {
    const [row] = applyEffectiveVacationStatuses(
      [employee({ vacationStatus: 'Vacation Approved', returnDate: new Date(2026, 8, 15) })],
      [leave()],
      TODAY
    );
    assert.equal(row.vacationStatus, 'On Vacation');
  });
});

describe('approval/re-approval transitions', () => {
  it('treats the leave end date as On Vacation (inclusive)', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Vacation Pending' }),
      [leave({ startDate: new Date(2026, 7, 1), endDate: TODAY })],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('moves On Vacation to Returned Back only after the approved end date', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'On Vacation' }),
      [leave({ startDate: new Date(2026, 6, 1), endDate: new Date(2026, 7, 30) })],
      TODAY
    );
    assert.equal(status, 'Vacation Approved');
  });

  it('moves Returned Back to Yet to Go from re-approved future dates', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Vacation Approved' }),
      [leave({ travellingDate: new Date(2026, 8, 10), startDate: new Date(2026, 8, 10), endDate: new Date(2026, 8, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
  });

  it('keeps one current category when past, active, and future leaves coexist', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Vacation Approved' }),
      [
        leave({ travellingDate: new Date(2026, 5, 1), startDate: new Date(2026, 5, 1), endDate: new Date(2026, 5, 10) }),
        leave({ travellingDate: new Date(2026, 7, 25), startDate: new Date(2026, 7, 25), endDate: new Date(2026, 8, 3) }),
        leave({ travellingDate: new Date(2026, 9, 1), startDate: new Date(2026, 9, 1), endDate: new Date(2026, 9, 10) }),
      ],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('never uses Applied On as the vacation start date', () => {
    const today = new Date(2026, 8, 3); // 03/09/2026
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Onsite', travellingDate: null, leaveEndDate: null }),
      [leave({
        appliedOn: new Date(2026, 7, 1),
        travellingDate: new Date(2026, 10, 10),
        startDate: new Date(2026, 10, 10),
        endDate: new Date(2027, 0, 10),
      })],
      today
    );
    assert.equal(status, 'Vacation Pending');
  });

  it('moves to On Vacation when today reaches the approved start date', () => {
    const today = new Date(2026, 10, 15);
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Vacation Pending' }),
      [leave({
        startDate: new Date(2026, 10, 10),
        travellingDate: new Date(2026, 10, 10),
        endDate: new Date(2027, 0, 10),
      })],
      today
    );
    assert.equal(status, 'On Vacation');
  });

  it('moves Returned Back to Yet to Go when employee travel dates are set in the future', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        vacationStatusSource: 'manual',
        travellingDate: new Date(2026, 9, 1),
        leaveEndDate: new Date(2026, 9, 15),
        returnDate: null,
      }),
      [leave({ travellingDate: new Date(2026, 2, 1), startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
  });

  it('moves to Returned Back when the actual return/entry date is reached', () => {
    const today = new Date(2027, 0, 11);
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'On Vacation',
        returnDate: new Date(2027, 0, 11),
        firstWorkingDay: new Date(2027, 0, 11),
      }),
      [leave({
        startDate: new Date(2026, 10, 10),
        travellingDate: new Date(2026, 10, 10),
        endDate: new Date(2027, 0, 10),
      })],
      today
    );
    assert.equal(status, 'Vacation Approved');
  });
});
