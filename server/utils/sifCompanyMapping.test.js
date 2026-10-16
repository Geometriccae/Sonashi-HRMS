const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCompanyEmployerMap,
  resolveEmployeeCompanyMapping,
  applyCompanyEmployerMapping,
} = require('./sifCompanyMapping');

test('SIF company mapping exposes every configured employer and groups employees by office', () => {
  const map = buildCompanyEmployerMap([
    { particulars: 'Company A', docNumber: '0000000172509' },
    { particulars: 'Company B', docNumber: '0000000246878' },
    { particulars: 'Company C', docNumber: '0000002795780' },
  ]);
  const employees = [
    { employeeId: 'A1', office: 'Company A', companyCode: '' },
    { employeeId: 'A2', office: 'Company A', companyCode: '0000000172509' },
    { employeeId: 'B1', office: 'Company B', companyCode: '0000000172509' },
    { employeeId: 'C1', office: 'Company C', companyCode: '' },
  ].map((employee) => applyCompanyEmployerMapping(employee, map));

  const counts = employees.reduce((result, employee) => {
    result[employee.sifEmployerId] = (result[employee.sifEmployerId] || 0) + 1;
    return result;
  }, {});

  assert.deepEqual(counts, {
    '0000000172509': 2,
    '0000000246878': 1,
    '0000002795780': 1,
  });
  assert.equal(employees[2].sifCompanyMapping.source, 'company-document');
  assert.equal(employees[2].sifCompanyMapping.status, 'Mismatch');
});

test('SIF mapping falls back to a valid stored company code when no company document exists', () => {
  const mapping = resolveEmployeeCompanyMapping(
    { office: 'Unconfigured Company', companyCode: '0000000246878' },
    new Map()
  );
  assert.equal(mapping.employerId, '0000000246878');
  assert.equal(mapping.source, 'employee');
  assert.equal(mapping.status, 'Pass');
});

