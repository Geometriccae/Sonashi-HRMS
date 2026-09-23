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

  it('an extended Leave Management end date outranks a leftover Master return date', () => {
    const today = new Date(2026, 8, 23); // 23 Sep 2026
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        vacationStatusSource: 'leave',
        travellingDate: new Date(2026, 4, 1),
        leaveEndDate: new Date(2026, 11, 31),
        returnDate: new Date(2026, 8, 16),
        firstWorkingDay: new Date(2026, 8, 17),
      }),
      [leave({
        startDate: new Date(2026, 4, 1),
        travellingDate: new Date(2026, 4, 1),
        endDate: new Date(2026, 11, 31),
      })],
      today
    );
    assert.equal(status, 'On Vacation');
  });

  it('honors a persisted actual return date for the current approved trip', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        vacationStatusSource: 'manual',
        returnDate: TODAY,
        leaveEndDate: TODAY,
      }),
      [leave({ endDate: TODAY, returnDate: TODAY })],
      TODAY
    );
    assert.equal(status, 'Vacation Approved');
  });

  it('honors manual Yet to Go even when approved leave dates are currently active', () => {
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
    assert.equal(status, 'Vacation Pending');
  });

  it('honors manual Onsite even when a future approved leave exists', () => {
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
    assert.equal(status, 'Onsite');
  });

  it('honors Return Back → Onsite and does not snap back to Returned Back', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        vacationStatusSource: 'manual',
        returnDate: TODAY,
        travellingDate: new Date(2026, 6, 1),
        leaveEndDate: new Date(2026, 7, 20),
      }),
      [leave({ travellingDate: new Date(2026, 6, 1), startDate: new Date(2026, 6, 1), endDate: new Date(2026, 7, 20) })],
      TODAY
    );
    assert.equal(status, 'Onsite');
  });

  it('honors On Vacation → Yet to Go when the new travel date is still ahead', () => {
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
    assert.equal(status, 'Vacation Pending');
  });

  it('drops a manual Yet to Go once its travelling date has arrived', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Pending',
        vacationStatusSource: 'manual',
        returnDate: null,
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('honors On Vacation → Onsite while leave dates are still active', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        vacationStatusSource: 'manual',
        returnDate: TODAY,
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'Onsite');
  });

  it('honors Return Back → Yet to Go', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Pending',
        vacationStatusSource: 'manual',
        returnDate: null,
        travellingDate: new Date(2026, 9, 1),
        leaveEndDate: new Date(2026, 9, 15),
      }),
      [leave({ travellingDate: new Date(2026, 2, 1), startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 20) })],
      TODAY
    );
    assert.equal(status, 'Vacation Pending');
  });

  it('honors Return Back → On Vacation', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'On Vacation',
        vacationStatusSource: 'manual',
        returnDate: null,
      }),
      [leave({ travellingDate: new Date(2026, 2, 1), startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 20) })],
      TODAY
    );
    assert.equal(status, 'On Vacation');
  });

  it('still date-derives leave-sourced Onsite into On Vacation for active trips', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Onsite',
        vacationStatusSource: 'leave',
        returnDate: null,
      }),
      [leave()],
      TODAY
    );
    assert.equal(status, 'On Vacation');
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

  it('keeps manual Onsite on list rows despite an active approved leave', () => {
    const [row] = applyEffectiveVacationStatuses(
      [employee({ vacationStatus: 'Onsite', vacationStatusSource: 'manual', returnDate: TODAY })],
      [leave()],
      TODAY
    );
    assert.equal(row.vacationStatus, 'Onsite');
  });

  it('does not keep Returned Back when the Leave Management end date is still ahead', () => {
    const [row] = applyEffectiveVacationStatuses(
      [employee({
        vacationStatus: 'Vacation Approved',
        vacationStatusSource: 'leave',
        returnDate: TODAY,
      })],
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

  it('moves manual Returned Back to Yet to Go when the next travel date is still ahead', () => {
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

  it('stays On Vacation when Returned Back was saved with a future return date', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        vacationStatusSource: 'manual',
        travellingDate: new Date(2026, 8, 1),
        leaveEndDate: new Date(2026, 10, 3),
        returnDate: new Date(2026, 10, 3),
        firstWorkingDay: new Date(2026, 10, 3),
      }),
      [],
      new Date(2026, 8, 16)
    );
    assert.equal(status, 'On Vacation');
  });

  it('date-derives leave-sourced Returned Back to Yet to Go from future employee travel dates', () => {
    const status = resolveEmployeeVacationStatus(
      employee({
        vacationStatus: 'Vacation Approved',
        vacationStatusSource: 'leave',
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

/**
 * The status every page displays must follow the trip dates on its own, for any
 * employee, in any month or year, whatever label happens to be stored.
 * These run through applyEffectiveVacationStatuses — the function the employee
 * list, single employee, dashboard and vacation tab routes all call.
 */
describe('date-driven status for every employee', () => {
  const on = (y, m, d) => new Date(y, m - 1, d);

  /** An employee carrying no vacation dates of their own. */
  const plain = (id, overrides = {}) => ({
    _id: id,
    employeeId: `IDMM-${id}`,
    employeeName: `Employee ${id}`,
    employeeStatus: 'Active',
    vacationStatus: 'Onsite',
    travellingDate: null,
    leaveEndDate: null,
    returnDate: null,
    firstWorkingDay: null,
    ...overrides,
  });

  const approved = (id, travel, end, extra = {}) => ({
    _id: `leave-${id}`,
    status: 'Approved',
    employeeId: `IDMM-${id}`,
    employeeName: `Employee ${id}`,
    startDate: travel,
    travellingDate: travel,
    endDate: end,
    ...extra,
  });

  const statusOn = (employeeRecord, leaves, today) =>
    applyEffectiveVacationStatuses([employeeRecord], leaves, today)[0].vacationStatus;

  const today = on(2026, 9, 8);

  const cases = [
    {
      name: 'travel date is tomorrow → Yet to Go',
      employee: plain('a'),
      leaves: [approved('a', on(2026, 9, 9), on(2026, 9, 30))],
      expected: 'Vacation Pending',
    },
    {
      name: 'travel date is today → On Vacation',
      employee: plain('b'),
      leaves: [approved('b', on(2026, 9, 8), on(2026, 9, 30))],
      expected: 'On Vacation',
    },
    {
      name: 'travel date passed and leave has not ended → On Vacation',
      employee: plain('c'),
      leaves: [approved('c', on(2026, 9, 2), on(2026, 9, 20))],
      expected: 'On Vacation',
    },
    {
      name: 'leave ended and return recorded → Returned Back',
      employee: plain('d', { returnDate: on(2026, 9, 6), firstWorkingDay: on(2026, 9, 7) }),
      leaves: [approved('d', on(2026, 8, 1), on(2026, 9, 5))],
      expected: 'Vacation Approved',
    },
    {
      name: 'leave end passed with no return recorded → Returned Back',
      employee: plain('e'),
      leaves: [approved('e', on(2026, 8, 1), on(2026, 9, 5))],
      expected: 'Vacation Approved',
    },
    {
      name: 'no vacation at all → Onsite',
      employee: plain('f'),
      leaves: [],
      expected: 'Onsite',
    },
    {
      name: 'future vacation months ahead → Yet to Go',
      employee: plain('g'),
      leaves: [approved('g', on(2026, 12, 1), on(2026, 12, 20))],
      expected: 'Vacation Pending',
    },
    {
      name: 'last day of the leave is still On Vacation',
      employee: plain('h'),
      leaves: [approved('h', on(2026, 9, 1), on(2026, 9, 8))],
      expected: 'On Vacation',
    },
    {
      name: 'an early actual return ends the trip before its end date',
      employee: plain('i'),
      leaves: [approved('i', on(2026, 9, 1), on(2026, 9, 30), { returnDate: on(2026, 9, 7) })],
      expected: 'Vacation Approved',
    },
  ];

  cases.forEach(({ name, employee: record, leaves, expected }) => {
    it(name, () => {
      assert.equal(statusOn(record, leaves, today), expected);
    });
  });

  it('resolves a mixed set of employees independently in one call', () => {
    const resolved = applyEffectiveVacationStatuses(
      cases.map((c) => c.employee),
      cases.flatMap((c) => c.leaves),
      today
    );
    assert.deepEqual(
      resolved.map((r) => r.vacationStatus),
      cases.map((c) => c.expected)
    );
  });

  it('crosses a month boundary without help', () => {
    const record = plain('m');
    const leaves = [approved('m', on(2026, 10, 1), on(2026, 10, 20))];
    assert.equal(statusOn(record, leaves, on(2026, 9, 30)), 'Vacation Pending');
    assert.equal(statusOn(record, leaves, on(2026, 10, 1)), 'On Vacation');
    assert.equal(statusOn(record, leaves, on(2026, 10, 21)), 'Vacation Approved');
  });

  it('crosses a year boundary without help', () => {
    const record = plain('y');
    const leaves = [approved('y', on(2027, 1, 2), on(2027, 1, 20))];
    assert.equal(statusOn(record, leaves, on(2026, 12, 31)), 'Vacation Pending');
    assert.equal(statusOn(record, leaves, on(2027, 1, 2)), 'On Vacation');
    assert.equal(statusOn(record, leaves, on(2027, 1, 25)), 'Vacation Approved');
  });

  it('follows the new dates when a leave is edited or re-approved', () => {
    const record = plain('r');
    const movedEarlier = [approved('r', on(2026, 9, 2), on(2026, 9, 20))];
    const movedLater = [approved('r', on(2026, 9, 20), on(2026, 10, 10))];
    assert.equal(statusOn(record, movedEarlier, today), 'On Vacation');
    assert.equal(statusOn(record, movedLater, today), 'Vacation Pending');
  });

  it('advances a stored Yet to Go once the travel date arrives, whatever the source', () => {
    const leaves = [approved('s', on(2026, 9, 2), on(2026, 9, 20))];
    ['leave', 'manual', undefined].forEach((source) => {
      const record = plain('s', {
        vacationStatus: 'Vacation Pending',
        vacationStatusSource: source,
      });
      assert.equal(statusOn(record, leaves, on(2026, 9, 1)), 'Vacation Pending');
      assert.equal(statusOn(record, leaves, on(2026, 9, 2)), 'On Vacation', `source=${source}`);
      assert.equal(statusOn(record, leaves, today), 'On Vacation', `source=${source}`);
    });
  });

  it('ignores another employee\'s leave when resolving a status', () => {
    const record = plain('own');
    const someoneElse = [approved('other', on(2026, 9, 2), on(2026, 9, 20))];
    assert.equal(statusOn(record, someoneElse, today), 'Onsite');
  });

  /**
   * Team Management stores Yet to Go with the dates the user typed, and the
   * Leave End Date is optional in that dialog. An employee set up that way has
   * no approved leave row to fall back on, so the travel date is the only
   * signal that the trip has begun.
   */
  describe('a trip recorded on the employee only, with no leave end date', () => {
    const travelled = (source) =>
      plain('t', {
        vacationStatus: 'Vacation Pending',
        vacationStatusSource: source,
        travellingDate: on(2026, 9, 9),
        leaveEndDate: null,
        returnDate: null,
      });

    ['manual', 'leave', undefined].forEach((source) => {
      it(`stays Yet to Go the day before travelling (source=${source})`, () => {
        assert.equal(statusOn(travelled(source), [], on(2026, 9, 8)), 'Vacation Pending');
      });

      it(`becomes On Vacation on the travelling date (source=${source})`, () => {
        assert.equal(statusOn(travelled(source), [], on(2026, 9, 9)), 'On Vacation');
      });

      it(`stays On Vacation after the travelling date (source=${source})`, () => {
        assert.equal(statusOn(travelled(source), [], on(2026, 10, 4)), 'On Vacation');
      });
    });

    it('reaches Returned Back once the recorded return date arrives', () => {
      const record = plain('t', {
        vacationStatus: 'On Vacation',
        vacationStatusSource: 'manual',
        travellingDate: on(2026, 9, 9),
        leaveEndDate: null,
        returnDate: on(2026, 10, 1),
        firstWorkingDay: on(2026, 10, 2),
      });
      assert.equal(statusOn(record, [], on(2026, 9, 30)), 'On Vacation');
      assert.equal(statusOn(record, [], on(2026, 10, 1)), 'Vacation Approved');
    });

    it('advances a stored On Vacation once the recorded leave end passes', () => {
      const record = plain('u', {
        vacationStatus: 'On Vacation',
        vacationStatusSource: 'manual',
        travellingDate: on(2026, 9, 1),
        leaveEndDate: on(2026, 9, 20),
        returnDate: null,
      });
      assert.equal(statusOn(record, [], on(2026, 9, 20)), 'On Vacation');
      assert.equal(statusOn(record, [], on(2026, 9, 21)), 'Vacation Approved');
    });

    it('never drags a finished trip back with a leftover travel date', () => {
      const record = plain('v', {
        vacationStatus: 'Vacation Approved',
        vacationStatusSource: 'manual',
        travellingDate: on(2024, 3, 1),
        leaveEndDate: null,
        returnDate: null,
      });
      assert.equal(statusOn(record, [], today), 'Vacation Approved');
    });

    it('leaves an Onsite employee onsite despite a leftover travel date', () => {
      const record = plain('w', {
        vacationStatus: 'Onsite',
        vacationStatusSource: 'manual',
        travellingDate: on(2024, 3, 1),
        leaveEndDate: null,
        returnDate: null,
      });
      assert.equal(statusOn(record, [], today), 'Onsite');
    });

    it('crosses month and year boundaries on the employee dates alone', () => {
      const record = plain('x', {
        vacationStatus: 'Vacation Pending',
        travellingDate: on(2027, 1, 1),
        leaveEndDate: null,
        returnDate: null,
      });
      assert.equal(statusOn(record, [], on(2026, 12, 31)), 'Vacation Pending');
      assert.equal(statusOn(record, [], on(2027, 1, 1)), 'On Vacation');
    });

    /**
     * A long-serving employee accumulates leave history, and the next trip is
     * often already approved. The employee's own live dates must still win, or
     * that future request answers for them all the way through the trip they
     * are actually on.
     */
    it('is On Vacation on live employee dates despite a future approved leave', () => {
      const record = plain('f1', {
        vacationStatus: 'Vacation Pending',
        vacationStatusSource: 'manual',
        travellingDate: on(2026, 9, 2),
        leaveEndDate: on(2026, 10, 30),
        returnDate: null,
      });
      const leaves = [
        approved('f1', on(2011, 9, 1), on(2011, 12, 31)),
        approved('f1', on(2022, 10, 4), on(2022, 12, 11)),
        approved('f1', on(2026, 10, 2), on(2026, 10, 30)),
      ];
      assert.equal(statusOn(record, leaves, on(2026, 9, 1)), 'Vacation Pending');
      assert.equal(statusOn(record, leaves, on(2026, 9, 2)), 'On Vacation');
      assert.equal(statusOn(record, leaves, today), 'On Vacation');
      assert.equal(statusOn(record, leaves, on(2026, 10, 30)), 'On Vacation');
      assert.equal(statusOn(record, leaves, on(2026, 10, 31)), 'Vacation Approved');
    });

    it('still follows re-approved leave dates when the record is not manual', () => {
      const record = plain('f2', {
        vacationStatus: 'Vacation Approved',
        travellingDate: on(2026, 8, 1),
        leaveEndDate: on(2026, 9, 15),
        returnDate: null,
      });
      const leaves = [approved('f2', on(2026, 9, 20), on(2026, 9, 30))];
      assert.equal(statusOn(record, leaves, today), 'Vacation Pending');
    });

    it('reads an ISO date string as the calendar day it names', () => {
      const record = plain('z', {
        vacationStatus: 'Vacation Pending',
        travellingDate: '2026-09-09T00:00:00.000Z',
        leaveEndDate: null,
        returnDate: null,
      });
      assert.equal(statusOn(record, [], on(2026, 9, 8)), 'Vacation Pending');
      assert.equal(statusOn(record, [], on(2026, 9, 9)), 'On Vacation');
    });
  });
});

describe('leave data consistency: one valid leave, one status', () => {
  it('does not mark On Vacation for a future 2026 trip because of a 2022 history row', () => {
    const emp = employee({
      vacationStatus: 'Vacation Pending',
      vacationStatusSource: 'leave',
      travellingDate: new Date(2026, 8, 11),
      leaveEndDate: new Date(2026, 8, 11),
      returnDate: null,
    });
    const leaves = [
      leave({
        startDate: new Date(2022, 9, 4),
        travellingDate: new Date(2022, 9, 4),
        endDate: new Date(2022, 11, 11),
      }),
      leave({
        startDate: new Date(2026, 8, 11),
        travellingDate: new Date(2026, 8, 11),
        endDate: new Date(2026, 8, 11),
      }),
    ];
    assert.equal(
      resolveEmployeeVacationStatus(emp, leaves, new Date(2026, 8, 10)),
      'Vacation Pending'
    );
    assert.equal(
      resolveEmployeeVacationStatus(emp, leaves, new Date(2026, 8, 11)),
      'On Vacation'
    );
  });

  it('keeps 11-09-2026 as calendar year 2026', () => {
    const { toCalendarDate } = require('./vacationStatusFromDates');
    const stored = '2026-09-11T00:00:00.000Z';
    const cal = toCalendarDate(stored);
    assert.equal(cal.getFullYear(), 2026);
    assert.equal(cal.getMonth(), 8);
    assert.equal(cal.getDate(), 11);
  });

  it('uses each leave\'s own end date so a finished trip cannot cover a future one', () => {
    const emp = employee({
      vacationStatusSource: 'leave',
      travellingDate: new Date(2026, 9, 1),
      leaveEndDate: new Date(2026, 9, 20),
      returnDate: null,
    });
    const leaves = [
      leave({
        startDate: new Date(2026, 0, 1),
        travellingDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 0, 15),
      }),
      leave({
        startDate: new Date(2026, 9, 1),
        travellingDate: new Date(2026, 9, 1),
        endDate: new Date(2026, 9, 20),
      }),
    ];
    assert.equal(resolveEmployeeVacationStatus(emp, leaves, TODAY), 'Vacation Pending');
  });
});
