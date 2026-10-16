const test = require('node:test');
const assert = require('node:assert/strict');

const { filterReturnedBackEmployees } = require('./vacationDashboardStats');

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
