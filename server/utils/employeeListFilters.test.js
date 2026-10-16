const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEmployeeListFilter } = require('./employeeListFilters');

test('Team Members filters compose without replacing the active/ex-employees category', () => {
  const { filter, error } = buildEmployeeListFilter({
    status: 'Active',
    employeeName: 'ali',
    dojFrom: '2024-01-01',
    dojTo: '2024-12-31',
    companyCode: '0000000172509',
    employeeStatus: 'Provision Period',
    search: 'sales',
  });
  assert.equal(error, undefined);
  assert.equal(filter.$and.length, 6);
  assert.deepEqual(filter.$and[0].employeeStatus.$in, [
    'Active', 'Provision Period', 'Notice Period', 'Confirmed', 'On Hold',
  ]);
  assert.equal(filter.$and[1].employeeStatus, 'Provision Period');
  assert.equal(filter.$and[2].employeeName.test('ALI KHAN'), true);
  assert.deepEqual(filter.$and[3].companyCode, '0000000172509');
  assert.equal(filter.$and[4].doj.$gte.toISOString(), '2024-01-01T00:00:00.000Z');
  assert.equal(filter.$and[4].doj.$lte.toISOString(), '2024-12-31T23:59:59.999Z');
  assert.equal(filter.$and[5].$or[0].employeeName.test('Sales Person'), true);
});

test('name filtering is partial, case-insensitive, and treats regex characters literally', () => {
  const { filter } = buildEmployeeListFilter({ employeeName: 'Ann.' });
  assert.equal(filter.employeeName.test('Joann. Smith'), true);
  assert.equal(filter.employeeName.test('Joanna Smith'), false);
});

test('one joining date can be represented by the same from/to day', () => {
  const { filter } = buildEmployeeListFilter({ dojFrom: '2026-09-16', dojTo: '2026-09-16' });
  assert.equal(filter.doj.$gte.toISOString(), '2026-09-16T00:00:00.000Z');
  assert.equal(filter.doj.$lte.toISOString(), '2026-09-16T23:59:59.999Z');
});

test('company filtering includes employees whose displayed code is resolved from company data', () => {
  const { filter } = buildEmployeeListFilter(
    { companyCode: '0000000172509' },
    { companyFallbackIds: ['fallback-id'] }
  );
  assert.deepEqual(filter, {
    $or: [
      { companyCode: '0000000172509' },
      { _id: { $in: ['fallback-id'] } },
    ],
  });
});

test('invalid status and reversed date range are rejected', () => {
  assert.equal(buildEmployeeListFilter({ employeeStatus: 'Unknown' }).error, 'Invalid employee status filter');
  assert.equal(
    buildEmployeeListFilter({ dojFrom: '2026-10-02', dojTo: '2026-10-01' }).error,
    'Joining From Date cannot be after To Date'
  );
});

test('All tab with no filters produces an empty Mongo filter', () => {
  assert.deepEqual(buildEmployeeListFilter({ status: '' }), { filter: {}, hasFilters: false });
});
