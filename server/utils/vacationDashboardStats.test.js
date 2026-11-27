const test = require('node:test');
const assert = require('node:assert/strict');

const {
  filterReturnedBackEmployees,
  sortVacationTabRows,
  getTabDefaultSortField,
} = require('./vacationDashboardStats');

const NOW = new Date(2026, 9, 16);

function employee(id, overrides = {}) {
  return {
    _id: id,
    employeeId: `ID-${id}`,
    employeeName: `Employee ${id}`,
    employeeStatus: 'Active',
    vacationStatus: 'Vacation Approved',
    ...overrides,
  };
}

test('Return Back keeps one employee row and only the rolling six-month window', () => {
  const employees = [
    employee('recent'),
    employee('boundary'),
    employee('old'),
    employee('onsite', { vacationStatus: 'Onsite' }),
  ];
  const leaves = [
    { _id: 'l1', employeeId: 'ID-recent', employeeName: 'Employee recent', status: 'Approved', leaveType: 'Vacation', startDate: '2026-08-01', endDate: '2026-08-20' },
    // Duplicate historical row for the same employee must not duplicate the employee result.
    { _id: 'l2', employeeId: 'ID-recent', employeeName: 'Employee recent', status: 'Approved', leaveType: 'Vacation', startDate: '2026-08-01', endDate: '2026-08-20' },
    { _id: 'l3', employeeId: 'ID-boundary', employeeName: 'Employee boundary', status: 'Approved', leaveType: 'Vacation', startDate: '2026-04-01', endDate: '2026-04-16' },
    { _id: 'l4', employeeId: 'ID-old', employeeName: 'Employee old', status: 'Approved', leaveType: 'Vacation', startDate: '2026-03-01', endDate: '2026-04-15' },
    { _id: 'l5', employeeId: 'ID-onsite', employeeName: 'Employee onsite', status: 'Approved', leaveType: 'Vacation', startDate: '2026-09-01', endDate: '2026-09-10' },
  ];

  const result = filterReturnedBackEmployees(employees, leaves, NOW);
  assert.deepEqual(result.map((row) => row._id).sort(), ['boundary', 'recent']);
});

test('getTabDefaultSortField returns correct default fields for each tab', () => {
  assert.equal(getTabDefaultSortField('yetToGo'), 'travellingDate');
  assert.equal(getTabDefaultSortField('onVacation'), 'lastWorkingDay');
  assert.equal(getTabDefaultSortField('returned'), 'firstWorkingDay');
});

test('Yet to Go: default sorts by Travelling Date ascending (earliest first, nulls at bottom)', () => {
  const rows = [
    { _id: '1', employeeName: 'Charlie', travellingDate: '2026-12-15' },
    { _id: '2', employeeName: 'Alice', travellingDate: '2026-11-28' },
    { _id: '3', employeeName: 'Bob', travellingDate: '2026-12-01' },
    { _id: '4', employeeName: 'No Date', travellingDate: null },
    { _id: '5', employeeName: 'Dave', travellingDate: '2026-12-01' },
    { _id: '6', employeeName: 'Empty Date', travellingDate: '' },
  ];

  const sorted = sortVacationTabRows(rows, 'yetToGo');
  assert.deepEqual(
    sorted.map((r) => r.employeeName),
    ['Alice', 'Bob', 'Dave', 'Charlie', 'Empty Date', 'No Date']
  );
});

test('On Vacation: default sorts by Last Working Day ascending (earliest first, nulls at bottom)', () => {
  const rows = [
    { _id: '1', employeeName: 'Zack', lastWorkingDay: '2026-11-20' },
    { _id: '2', employeeName: 'Anna', lastWorkingDay: '2026-11-10' },
    { _id: '3', employeeName: 'No Last Working Day', lastWorkingDay: null },
    { _id: '4', employeeName: 'John', lastWorkingDay: '2026-11-15' },
  ];

  const sorted = sortVacationTabRows(rows, 'onVacation');
  assert.deepEqual(
    sorted.map((r) => r.employeeName),
    ['Anna', 'John', 'Zack', 'No Last Working Day']
  );
});

test('Returned Back: default sorts by First Working Day ascending (earliest first, nulls at bottom)', () => {
  const rows = [
    { _id: '1', employeeName: 'Sara', firstWorkingDay: '2026-11-05' },
    { _id: '2', employeeName: 'Leo', firstWorkingDay: '2026-10-25' },
    { _id: '3', employeeName: 'Unknown Return', firstWorkingDay: null },
    { _id: '4', employeeName: 'Mia', firstWorkingDay: '2026-11-01' },
  ];

  const sorted = sortVacationTabRows(rows, 'returned');
  assert.deepEqual(
    sorted.map((r) => r.employeeName),
    ['Leo', 'Mia', 'Sara', 'Unknown Return']
  );
});

test('Preserves manual sort order override when sortField / sortOrder are supplied', () => {
  const rows = [
    { _id: '1', employeeName: 'Charlie', travellingDate: '2026-12-15' },
    { _id: '2', employeeName: 'Alice', travellingDate: '2026-11-28' },
    { _id: '3', employeeName: 'Bob', travellingDate: '2026-12-01' },
  ];

  const desc = sortVacationTabRows(rows, 'yetToGo', { sortField: 'travellingDate', sortOrder: 'desc' });
  assert.deepEqual(
    desc.map((r) => r.employeeName),
    ['Charlie', 'Bob', 'Alice']
  );

  const byName = sortVacationTabRows(rows, 'yetToGo', { sortField: 'employeeName', sortOrder: 'asc' });
  assert.deepEqual(
    byName.map((r) => r.employeeName),
    ['Alice', 'Bob', 'Charlie']
  );
});
