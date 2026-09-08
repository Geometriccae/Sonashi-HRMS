const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALLOWED_VACATION_STATUSES,
  normalizeVacationStatusValue,
  isAllowedVacationStatus,
  isManualStatusChange,
  vacationReturnDatePatch,
} = require('./vacationStatusWrite');

const { resolveEmployeeVacationStatus } = require('./vacationStatusFromDates');

const TODAY = new Date(2026, 8, 8); // 08 Sep 2026
const day = (y, m, d) => new Date(y, m, d);
/** Local calendar day, matching how the routes store these dates. */
const iso = (value) => {
  if (!value) return value;
  const dt = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

test('status values and legacy aliases', async (t) => {
  await t.test('accepts every status the employee schema allows', () => {
    for (const status of ALLOWED_VACATION_STATUSES) {
      assert.equal(isAllowedVacationStatus(status), true, status);
    }
  });

  await t.test('maps the legacy "Not on Vacation" label to Onsite', () => {
    assert.equal(normalizeVacationStatusValue('Not on Vacation'), 'Onsite');
    assert.equal(isAllowedVacationStatus('Not on Vacation'), true);
  });

  await t.test('rejects unknown values', () => {
    assert.equal(isAllowedVacationStatus('Returned Back'), false);
    assert.equal(isAllowedVacationStatus(''), false);
    assert.equal(isAllowedVacationStatus(undefined), false);
  });
});

test('isManualStatusChange', async (t) => {
  await t.test('a form resubmitting the live status is not a manual override', () => {
    assert.equal(isManualStatusChange('On Vacation', 'On Vacation'), false);
    assert.equal(isManualStatusChange('Not on Vacation', 'Onsite'), false);
  });

  await t.test('a different status is a manual override', () => {
    assert.equal(isManualStatusChange('Onsite', 'On Vacation'), true);
    assert.equal(isManualStatusChange('Vacation Approved', 'On Vacation'), true);
  });

  await t.test('treats a write as manual when no live status could be derived', () => {
    assert.equal(isManualStatusChange('On Vacation', null), true);
  });

  await t.test('ignores an empty submitted status', () => {
    assert.equal(isManualStatusChange('', 'Onsite'), false);
  });
});

test('vacationReturnDatePatch', async (t) => {
  await t.test('Onsite stamps today so leave dates cannot overlay it back', () => {
    for (const derived of ['On Vacation', 'Vacation Pending', 'Vacation Approved']) {
      const patch = vacationReturnDatePatch({
        status: 'Onsite',
        derivedStatus: derived,
        today: TODAY,
      });
      assert.equal(iso(patch.returnDate), '2026-09-08', derived);
    }
  });

  await t.test('Onsite leaves dates alone when the live status is already Onsite', () => {
    const patch = vacationReturnDatePatch({
      status: 'Onsite',
      derivedStatus: 'Onsite',
      today: TODAY,
    });
    assert.deepEqual(patch, {});
  });

  await t.test('an explicit returnDate is never overwritten', () => {
    const patch = vacationReturnDatePatch({
      status: 'Onsite',
      derivedStatus: 'On Vacation',
      hasReturnDate: true,
      returnDate: day(2026, 7, 20),
      today: TODAY,
    });
    assert.deepEqual(patch, {});
  });

  await t.test('Yet to Go and On Vacation clear a stale return date', () => {
    for (const status of ['Vacation Pending', 'On Vacation']) {
      const patch = vacationReturnDatePatch({
        status,
        derivedStatus: 'Vacation Approved',
        today: TODAY,
      });
      assert.equal(patch.returnDate, null, status);
    }
  });

  await t.test('Returned Back defaults the return date to today', () => {
    const patch = vacationReturnDatePatch({
      status: 'Vacation Approved',
      derivedStatus: 'On Vacation',
      today: TODAY,
    });
    assert.equal(iso(patch.returnDate), '2026-09-08');
  });

  await t.test('Returned Back keeps a supplied return date', () => {
    const patch = vacationReturnDatePatch({
      status: 'Vacation Approved',
      derivedStatus: 'On Vacation',
      hasReturnDate: true,
      returnDate: day(2026, 8, 1),
      today: TODAY,
    });
    assert.deepEqual(patch, {});
  });
});

/**
 * Every transition a user can make from the status dropdown must survive the next
 * read, for any employee, including one whose approved leave dates are still active.
 */
test('manual transitions persist against active approved leave', async (t) => {
  const employeeWithActiveLeave = () => ({
    _id: 'emp-1',
    employeeId: 'E-001',
    employeeName: 'Any Employee',
    employeeStatus: 'Active',
    vacationStatus: 'On Vacation',
    vacationStatusSource: 'leave',
    travellingDate: day(2026, 8, 1),
    leaveEndDate: day(2026, 8, 30),
    returnDate: null,
    firstWorkingDay: null,
  });

  const activeLeave = [
    {
      _id: 'leave-1',
      employeeId: 'E-001',
      staffName: 'Any Employee',
      status: 'Approved',
      startDate: day(2026, 8, 1),
      travellingDate: day(2026, 8, 1),
      endDate: day(2026, 8, 30),
    },
  ];

  const transitions = ['Onsite', 'On Vacation', 'Vacation Pending', 'Vacation Approved'];

  for (const target of transitions) {
    await t.test(`saving ${target} is what the next read returns`, () => {
      const employee = employeeWithActiveLeave();
      const derived = resolveEmployeeVacationStatus(employee, activeLeave, TODAY);

      assert.equal(isManualStatusChange(target, derived), target !== derived);

      const patch = {
        vacationStatus: target,
        vacationStatusSource: 'manual',
        ...vacationReturnDatePatch({
          status: target,
          derivedStatus: derived,
          today: TODAY,
        }),
      };

      const saved = { ...employee, ...patch };
      assert.equal(
        resolveEmployeeVacationStatus(saved, activeLeave, TODAY),
        target,
        `${derived} -> ${target}`
      );
    });
  }
});

/** An unrelated master-data save must not freeze a date-driven employee. */
test('master-data save that echoes the live status stays leave-driven', () => {
  const employee = {
    _id: 'emp-2',
    employeeId: 'E-002',
    employeeName: 'Another Employee',
    employeeStatus: 'Active',
    vacationStatus: 'Vacation Pending',
    vacationStatusSource: 'leave',
    travellingDate: day(2026, 9, 10),
    leaveEndDate: day(2026, 9, 25),
  };
  const leaves = [
    {
      _id: 'leave-2',
      employeeId: 'E-002',
      staffName: 'Another Employee',
      status: 'Approved',
      startDate: day(2026, 9, 10),
      travellingDate: day(2026, 9, 10),
      endDate: day(2026, 9, 25),
    },
  ];

  const derived = resolveEmployeeVacationStatus(employee, leaves, TODAY);
  assert.equal(derived, 'Vacation Pending');

  // The edit form resubmits the status it loaded; no manual pin should be applied.
  assert.equal(isManualStatusChange('Vacation Pending', derived), false);

  // Once the trip becomes active the employee still advances automatically.
  const duringTrip = new Date(2026, 9, 12);
  assert.equal(
    resolveEmployeeVacationStatus(employee, leaves, duringTrip),
    'On Vacation'
  );
});
