const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCompanyEmployerMap,
  resolveEmployeeCompanyMapping,
  applyCompanyEmployerMapping,
} = require('./sifCompanyMapping');

test('SIF company mapping keeps the employee company assignment authoritative', () => {
  const map = buildCompanyEmployerMap([
    { particulars: 'Company A', docNumber: 'CODE-A', employerId: '0000000172509' },
    { particulars: 'Company B', docNumber: 'CODE-B', employerId: '0000000246878' },
    { particulars: 'Company C', docNumber: 'CODE-C', employerId: '0000002795780' },
  ]);
  const employees = [
    { employeeId: 'A1', office: 'Company A', companyCode: '' },
    { employeeId: 'A2', office: 'Company A', companyCode: 'CODE-A' },
    { employeeId: 'B1', office: 'Company B', companyCode: 'CODE-A' },
    { employeeId: 'C1', office: 'Company C', companyCode: '' },
  ].map((employee) => applyCompanyEmployerMapping(employee, map));

  const counts = employees.reduce((result, employee) => {
    result[employee.sifEmployerId] = (result[employee.sifEmployerId] || 0) + 1;
    return result;
  }, {});

  assert.deepEqual(counts, {
    '': 2,
    '0000000172509': 2,
  });
  assert.equal(employees[2].sifCompanyMapping.source, 'company-configuration');
  assert.equal(employees[2].sifCompanyMapping.status, 'Pass');
});

test('SIF mapping uses the configured Employer ID without overwriting an alphanumeric Company Code', () => {
  const map = buildCompanyEmployerMap([
    { particulars: 'Joint Ven FZCO', docNumber: 'EZJ00001364308', employerId: '0000001364308' },
  ]);
  const mapping = resolveEmployeeCompanyMapping(
    { office: 'Joint Ven FZCO', companyCode: 'EZJ00001364308' },
    map
  );
  assert.equal(mapping.storedCompanyCode, 'EZJ00001364308');
  assert.equal(mapping.employerId, '0000001364308');
  assert.equal(mapping.source, 'company-configuration');
});

test('Company Code and Employer ID remain separate configured identifiers', () => {
  const map = buildCompanyEmployerMap([
    { particulars: 'New Company', docNumber: 'COMPANY42', employerId: '0000001234567' },
  ]);
  const mapping = resolveEmployeeCompanyMapping({ companyCode: 'COMPANY42' }, map);
  assert.equal(mapping.storedCompanyCode, 'COMPANY42');
  assert.equal(mapping.employerId, '0000001234567');
});

test('an empty employee Company Code remains empty even when the office has Company Documents', () => {
  const map = buildCompanyEmployerMap([
    { particulars: 'Branch', docNumber: '192692', employerId: '0000000192692' },
  ]);
  const mapping = resolveEmployeeCompanyMapping(
    { office: 'Branch', companyCode: '' },
    map
  );
  assert.equal(mapping.employerId, '');
  assert.equal(mapping.source, 'missing');
});

test('SIF mapping reports missing configuration instead of copying Company Code to Employer ID', () => {
  const mapping = resolveEmployeeCompanyMapping(
    { office: 'Unconfigured Company', companyCode: '0000000246878' },
    new Map()
  );
  assert.equal(mapping.employerId, '');
  assert.equal(mapping.source, 'missing');
  assert.equal(mapping.status, 'Missing Data');
});

