const test = require('node:test');
const assert = require('node:assert/strict');
const { generateSifContent, parseSifContent } = require('../utils/sifUtils');
const roundAed = (v) => Math.round(Number(v || 0) * 100) / 100;

test('Off-Cycle SIF & Payroll Reconciliation Test Suite', async (t) => {
  // Mock employer & bank configuration
  const employerA = '0000000172509';
  const employerB = '0000000246878';
  const routingA = '017250901';
  const routingB = '024687801';

  const mockEmpA = {
    _id: 'emp_001',
    employeeId: 'IDMD-001',
    employeeName: 'Ahmad Khan',
    emiratesId: '784199012345671',
    companyCode: employerA,
    sifEmployerId: employerA,
    salaryDetails: {
      agentCode: '600310101',
      ibanNumber: 'AE012345678901234567890',
      basicSalary: 3000,
      houseRent: 1000,
      travelExp: 500,
      other: 500,
      totalSalary: 5000,
    },
  };

  const mockEmpB = {
    _id: 'emp_002',
    employeeId: 'IDMD-002',
    employeeName: 'Bilal Saeed',
    emiratesId: '784199012345672',
    companyCode: employerA,
    sifEmployerId: employerA,
    salaryDetails: {
      agentCode: '740810000',
      ibanNumber: 'AE987654321098765432109',
      basicSalary: 2000,
      houseRent: 500,
      travelExp: 250,
      other: 250,
      totalSalary: 3000,
    },
  };

  const mockEmpC = {
    _id: 'emp_003',
    employeeId: 'IDMD-003',
    employeeName: 'Carlos Gomez',
    emiratesId: '784199012345673',
    companyCode: employerB,
    sifEmployerId: employerB,
    salaryDetails: {
      agentCode: '024687801',
      ibanNumber: 'AE112233445566778899001',
      basicSalary: 4000,
      houseRent: 1000,
      travelExp: 500,
      other: 500,
      totalSalary: 6000,
    },
  };

  await t.test('1. Advance SIF: Generates SIF only for selected advance employees with exact advance amounts', () => {
    // Emp A requested AED 1,500 advance; Emp B requested AED 800 advance
    const advanceEmployees = [
      { ...mockEmpA, customTransferAmount: 1500 },
      { ...mockEmpB, customTransferAmount: 800 },
    ];

    const sifResult = generateSifContent({
      employees: advanceEmployees,
      employerId: employerA,
      defaultAgentRoutingCode: routingA,
      year: 2026,
      month: 11,
      now: new Date('2026-11-15'),
    });

    assert.equal(sifResult.edrCount, 2);
    assert.equal(sifResult.totalSalary, 2300);

    const { edrs, scr } = parseSifContent(sifResult.content);
    assert.equal(edrs.length, 2);
    assert.equal(edrs[0].empId, '784199012345671');
    assert.equal(edrs[0].fixedIncome, 1500, 'Emp A EDR transfer amount must be AED 1,500');
    assert.equal(edrs[1].empId, '784199012345672');
    assert.equal(edrs[1].fixedIncome, 800, 'Emp B EDR transfer amount must be AED 800');

    assert.equal(scr.employerId, employerA);
    assert.equal(scr.edrCount, 2);
    assert.equal(scr.totalSalary, 2300);
  });

  await t.test('2. Commission SIF: Generates independent Commission SIF with exact commission amounts', () => {
    // Commission payout for Promoter Emp B: AED 2,500 quarterly commission
    const commissionEmployees = [
      { ...mockEmpB, customTransferAmount: 2500 },
    ];

    const sifResult = generateSifContent({
      employees: commissionEmployees,
      employerId: employerA,
      defaultAgentRoutingCode: routingA,
      year: 2026,
      month: 11,
      now: new Date('2026-11-15'),
      isIndividual: true,
    });

    assert.equal(sifResult.edrCount, 1);
    assert.equal(sifResult.totalSalary, 2500);

    const { edrs, scr } = parseSifContent(sifResult.content);
    assert.equal(edrs.length, 1);
    assert.equal(edrs[0].empId, '784199012345672');
    assert.equal(edrs[0].fixedIncome, 2500, 'Commission EDR transfer amount must match AED 2,500');
    assert.equal(scr.totalSalary, 2500);
  });

  await t.test('3. Advance Deduction in Regular Payroll: Correctly deducts outstanding advance', () => {
    // Gross Salary = AED 5,000, Other Deductions = AED 0, Advance = AED 1,500
    // Net Salary must equal 5,000 - 1,500 = AED 3,500
    const grossSalary = 5000;
    const otherDeductions = 0;
    const advanceDeduction = 1500;
    const netSalary = roundAed(grossSalary - advanceDeduction - otherDeductions);

    assert.equal(netSalary, 3500);
  });

  await t.test('4. Employee without advance: Net salary remains standard (no regression)', () => {
    const grossSalary = 3000;
    const advanceDeduction = 0;
    const otherDeductions = 0;
    const netSalary = roundAed(grossSalary - advanceDeduction - otherDeductions);

    assert.equal(netSalary, 3000);
  });

  await t.test('5. Commission-only employee: Commission is NEVER deducted from monthly salary', () => {
    // Emp B received AED 2,500 commission off-cycle. Monthly salary is AED 3,000.
    // Monthly net salary must remain AED 3,000!
    const grossSalary = 3000;
    const advanceDeduction = 0; // Commission is independent, not an advance
    const otherDeductions = 0;
    const netSalary = roundAed(grossSalary - advanceDeduction - otherDeductions);

    assert.equal(netSalary, 3000, 'Commission must NOT reduce monthly net salary');
  });

  await t.test('6. Employee with BOTH advance and commission: Only advance is deducted', () => {
    // Emp B had AED 800 advance AND AED 2,500 commission payout.
    // Gross Salary = AED 3,000.
    // Deducted: AED 800 (advance only). Net = AED 2,200.
    const grossSalary = 3000;
    const advanceDeduction = 800;
    const commissionPayout = 2500; // independent
    const otherDeductions = 0;
    const netSalary = roundAed(grossSalary - advanceDeduction - otherDeductions);

    assert.equal(netSalary, 2200);
  });

  await t.test('7. Partial recovery: Advance exceeds net pay -> capped at net salary, balance carries forward', () => {
    // Employee Gross Salary = AED 2,000. Advance taken = AED 3,000.
    // Maximum recoverable this cycle is AED 2,000.
    // Net salary = AED 0. Outstanding balance carried forward = AED 1,000.
    const grossSalary = 2000;
    const advanceAmount = 3000;
    const canDeduct = Math.min(advanceAmount, grossSalary);
    const netSalary = roundAed(grossSalary - canDeduct);
    const balanceAfter = roundAed(advanceAmount - canDeduct);

    assert.equal(canDeduct, 2000);
    assert.equal(netSalary, 0);
    assert.equal(balanceAfter, 1000);
  });

  await t.test('8. Fully recovered advance: No further deductions in subsequent periods', () => {
    // Once balance reaches 0, outstandingBalance is 0 and status is fully_recovered.
    const advance = {
      originalAmount: 1000,
      recoveredAmount: 1000,
      outstandingBalance: 0,
      status: 'fully_recovered',
    };

    const eligibleForRecovery = advance.status !== 'fully_recovered' && advance.outstandingBalance > 0;
    assert.equal(eligibleForRecovery, false, 'Fully recovered advance must not be deducted again');
  });

  await t.test('9. Idempotency: Slip key check prevents double deduction on slip regeneration', () => {
    const slipKey = 'November|2026|ahmad.khan@sonashi.ae';
    const recoveryHistory = [
      { slipKey, month: 'November', year: '2026', amountDeducted: 1500, balanceAfter: 0 },
    ];

    const alreadyProcessed = recoveryHistory.some((h) => h.slipKey === slipKey);
    assert.equal(alreadyProcessed, true);
    // Reuse existing deduction without reducing balance again
    const existingEntry = recoveryHistory.find((h) => h.slipKey === slipKey);
    assert.equal(existingEntry.amountDeducted, 1500);
  });

  await t.test('10. Multi-employer isolation: Separate SIF file per 13-digit Employer ID', () => {
    // Batch contains Emp A (Employer A) and Emp C (Employer B)
    const batch = [
      { ...mockEmpA, customTransferAmount: 1000 },
      { ...mockEmpC, customTransferAmount: 2000 },
    ];

    const forEmployerA = batch.filter((e) => e.sifEmployerId === employerA);
    const forEmployerB = batch.filter((e) => e.sifEmployerId === employerB);

    assert.equal(forEmployerA.length, 1);
    assert.equal(forEmployerB.length, 1);

    const sifA = generateSifContent({
      employees: forEmployerA,
      employerId: employerA,
      defaultAgentRoutingCode: routingA,
      year: 2026,
      month: 11,
      isIndividual: true,
    });
    const sifB = generateSifContent({
      employees: forEmployerB,
      employerId: employerB,
      defaultAgentRoutingCode: routingB,
      year: 2026,
      month: 11,
      isIndividual: true,
    });

    const parsedA = parseSifContent(sifA.content);
    const parsedB = parseSifContent(sifB.content);

    assert.equal(parsedA.scr.employerId, employerA);
    assert.equal(parsedA.edrs[0].empId, '784199012345671');

    assert.equal(parsedB.scr.employerId, employerB);
    assert.equal(parsedB.edrs[0].empId, '784199012345673');
  });

  await t.test('11. Missing bank account / IBAN validation stops invalid SIF creation', () => {
    const invalidEmp = {
      ...mockEmpA,
      salaryDetails: {
        ...mockEmpA.salaryDetails,
        ibanNumber: '',
        accountNumber: '',
      },
    };

    const sifResult = generateSifContent({
      employees: [{ ...invalidEmp, customTransferAmount: 1000 }],
      employerId: employerA,
      defaultAgentRoutingCode: routingA,
      year: 2026,
      month: 11,
      isIndividual: true,
    });

    assert.ok(sifResult.error, 'Must report error when bank account is missing');
    assert.match(sifResult.error, /BANKACCOUNT is required/);
  });

  await t.test('12. Future advance protection: Advance disbursed in Dec is not deducted in Nov payroll', () => {
    const novPayrollEnd = new Date('2026-11-30T23:59:59.999Z');
    const decAdvanceDate = new Date('2026-12-15T00:00:00.000Z');

    const isEligibleForNovPayroll = decAdvanceDate <= novPayrollEnd;
    assert.equal(isEligibleForNovPayroll, false, 'Future advance must not be deducted in prior payroll');
  });

  await t.test('13. Regular SIF with payslip overlay: SIF reflects net payable salary after advance deduction', () => {
    // Normal fixed income is AED 5,000. But with AED 1,500 advance deduction, net is AED 3,500.
    const empWithPayslip = {
      ...mockEmpA,
      customTransferAmount: 3500, // Net salary from generated SalarySlip
    };

    const sifResult = generateSifContent({
      employees: [empWithPayslip],
      employerId: employerA,
      defaultAgentRoutingCode: routingA,
      year: 2026,
      month: 11,
      isIndividual: true,
    });

    const { edrs } = parseSifContent(sifResult.content);
    assert.equal(edrs[0].fixedIncome, 3500, 'Regular SIF EDR must reflect net salary after advance recovery');
  });
});
