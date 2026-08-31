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

  it('keeps HR Onsite when returnDate closes the current trip', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Onsite', returnDate: TODAY }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'Onsite');
  });

  it('keeps Returned Back when HR set Vacation Approved with returnDate', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Vacation Approved', returnDate: TODAY }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'Vacation Approved');
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

  it('keeps HR Onsite over a future Yet to Go trip after returnDate', () => {
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
    assert.equal(status, 'Onsite');
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

  it('keeps HR Onsite instead of Returned Back when returnDate is set', () => {
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
    assert.equal(status, 'Onsite');
  });

  it('keeps HR Yet to Go when stored Vacation Pending even if leave dates still say On Vacation', () => {
    const status = resolveEmployeeVacationStatus(
      employee({ vacationStatus: 'Vacation Pending', returnDate: null }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
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

  it('keeps Returned Back when HR set Vacation Approved even if leave is still open', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        returnDate: new Date(2026, 8, 15),
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'Vacation Approved');
  });

  it('keeps On Vacation when HR set it even if travelling date is still in the future', () => {
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
    assert.equal(status, 'On Vacation');
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

  it('moves On Vacation to Returned Back when returnDate has been reached even if stored label is still On Vacation', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'On Vacation',
        returnDate: new Date(2026, 7, 27),
        leaveEndDate: new Date(2026, 8, 4),
      }),
      [leave({ endDate: new Date(2026, 8, 4) })],
      TODAY
    );
    assert.equal(status, 'Vacation Approved');
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
});

describe('applyEffectiveVacationStatuses', () => {
  it('overlays the same resolved status onto list rows', () => {
    const [row] = applyEffectiveVacationStatuses(
      [employee({ vacationStatus: 'Onsite', returnDate: TODAY })],
      [leave()],
      TODAY
    );
    assert.equal(row.vacationStatus, 'Onsite');
  });

  it('keeps Yet to Go on list rows after HR saves Vacation Pending', () => {
    const [row] = applyEffectiveVacationStatuses(
      [employee({ vacationStatus: 'Vacation Pending', returnDate: null })],
      [leave()],
      TODAY
    );
    assert.equal(row.vacationStatus, 'Vacation Pending');
  });

  it('moves list rows to Returned Back after HR saves Vacation Approved', () => {
    const [row] = applyEffectiveVacationStatuses(
      [employee({ vacationStatus: 'Vacation Approved', returnDate: new Date(2026, 8, 15) })],
      [leave()],
      TODAY
    );
    assert.equal(row.vacationStatus, 'Vacation Approved');
  });
});
