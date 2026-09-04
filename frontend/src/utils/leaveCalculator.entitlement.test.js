import {
    accrueLeaveDays,
    calculateEntitlementDays,
    computeExcelLeaveCalculation,
    countCompletedMonths,
    lastFiveLeaveYears,
} from "./leaveCalculator";

/** Use the 1st of the month so JS date overflow cannot shorten February/September. */
const asOf = "2026-08-01";

const monthsBefore = (months) => {
    const start = new Date(2026, 7 - months, 1);
    const y = start.getFullYear();
    const m = String(start.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
};

describe("leave entitlement: months × 2.5, cap 150", () => {
    test("completed months × 2.5 keeps half-day precision", () => {
        expect(accrueLeaveDays(1)).toBe(2.5);
        expect(accrueLeaveDays(12)).toBe(30);
        expect(accrueLeaveDays(18)).toBe(45);
        expect(accrueLeaveDays(34)).toBe(85);
        expect(accrueLeaveDays(35)).toBe(87.5);
        expect(accrueLeaveDays(36)).toBe(90);
        expect(accrueLeaveDays(48)).toBe(120);
        expect(accrueLeaveDays(60)).toBe(150);
        expect(accrueLeaveDays(72)).toBe(180);
    });

    test("2 years 10 months from DOJ is 34 completed months → 85 days", () => {
        expect(countCompletedMonths("2023-10-31", "2026-08-31")).toBe(34);
        expect(calculateEntitlementDays("2023-10-31", "2026-08-31")).toBe(85);
        expect(countCompletedMonths("2023-10-01", "2026-09-01")).toBe(35);
        expect(calculateEntitlementDays("2023-10-01", "2026-09-01")).toBe(87.5);
        expect(countCompletedMonths("2023-10-01", "2026-10-01")).toBe(36);
        expect(calculateEntitlementDays("2023-10-01", "2026-10-01")).toBe(90);
    });

    test.each([
        ["1 year", 12, 30],
        ["1 year 6 months", 18, 45],
        ["2 years", 24, 60],
        ["2 years 10 months", 34, 85],
        ["2 years 11 months", 35, 87.5],
        ["3 years", 36, 90],
        ["4 years", 48, 120],
        ["5 years", 60, 150],
        ["6 years", 72, 150],
        ["10 years", 120, 150],
        ["11 years", 132, 150],
    ])("%s → %i months → %s days", (_label, months, expected) => {
        const doj = monthsBefore(months);
        expect(countCompletedMonths(doj, asOf)).toBe(months);
        expect(calculateEntitlementDays(doj, asOf)).toBe(expected);
        const calc = computeExcelLeaveCalculation({ doj }, [], asOf);
        expect(calc.entitlement).toBe(expected);
        expect(calc.activeEligibleMonths).toBe(Math.min(months, 60));
    });

    test("does not use days/365 (the 86.22 bug)", () => {
        const entitlement = calculateEntitlementDays("2023-10-31", "2026-08-31");
        expect(entitlement).toBe(85);
        expect(entitlement).not.toBe(86.22);
    });

    test("Taken uses leave records; Available = entitlement − taken", () => {
        const doj = "2023-10-31";
        const leaves = [
            {
                _id: "l1",
                status: "Approved",
                employeeId: "IDMM-001",
                startDate: "2026-01-01",
                endDate: "2026-01-11",
                leaveDays: 10,
            },
        ];
        const emp = { _id: "e1", employeeId: "IDMM-001", doj };
        const calc = computeExcelLeaveCalculation(emp, leaves, "2026-08-31");
        expect(calc.entitlement).toBe(85);
        expect(calc.totalTaken).toBe(10);
        expect(calc.availableDays).toBe(75);
        expect(calc.balance).toBe(75);
        expect(calc.expiredDays).toBe(0);
    });

    test("Excel year 0 stays 0; live leave of another year is not copied", () => {
        const emp = {
            _id: "e1",
            employeeId: "IDMM-151",
            doj: "2023-06-27",
            excelLeaveYearTaken: { 2023: 0, 2024: 0, 2025: 0, 2026: 70 },
        };
        const leaves = [
            {
                _id: "bad",
                status: "Approved",
                employeeId: "IDMM-151",
                startDate: "2023-06-27",
                endDate: "2026-07-30",
                leaveDays: 1129,
            },
        ];
        const calc = computeExcelLeaveCalculation(emp, leaves, "2026-08-31");
        expect(calc.yearTotals[2023] ?? 0).toBe(0);
        expect(calc.yearTotals[2026]).toBe(70);
        expect(calc.totalTaken).toBe(70);
    });

    test("does not double-count Excel current-year total with the same live leave", () => {
        const emp = {
            _id: "e198",
            employeeId: "IDMO-198",
            doj: "2025-01-14",
            excelLeaveYearTaken: { 2026: 30 },
            excelLeaveImportedAt: "2026-08-26",
        };
        const leaves = [
            {
                _id: "nainika-live",
                status: "Approved",
                employeeId: "IDMO-198",
                startDate: "2026-08-18",
                endDate: "2026-09-18",
                leaveDays: 31,
            },
        ];
        const calc = computeExcelLeaveCalculation(emp, leaves, "2026-09-03");
        expect(calc.yearTotals[2026]).toBe(31);
        expect(calc.totalTaken).toBe(31);
        expect(calc.availableDays).toBe(calc.entitlement - 31);
    });

    test("post-import live leave still adds on top of Excel current-year snapshot", () => {
        const emp = {
            _id: "e2",
            employeeId: "IDMM-002",
            doj: "2023-01-01",
            excelLeaveYearTaken: { 2026: 20 },
            excelLeaveImportedAt: "2026-08-01",
        };
        const leaves = [
            {
                _id: "after-import",
                status: "Approved",
                employeeId: "IDMM-002",
                startDate: "2026-08-10",
                endDate: "2026-08-24",
                leaveDays: 14,
            },
        ];
        const calc = computeExcelLeaveCalculation(emp, leaves, "2026-08-31");
        expect(calc.yearTotals[2026]).toBe(34);
        expect(calc.totalTaken).toBe(34);
    });

    test("empty Excel year stays 0 and does not copy another year", () => {
        const emp = {
            _id: "e3",
            employeeId: "IDMM-003",
            doj: "2024-01-01",
            excelLeaveYearTaken: { 2024: 0, 2025: 30, 2026: 0 },
            excelLeaveImportedAt: "2026-08-01",
        };
        const calc = computeExcelLeaveCalculation(emp, [], "2026-08-31");
        expect(calc.yearTotals[2024] ?? 0).toBe(0);
        expect(calc.yearTotals[2025]).toBe(30);
        expect(calc.yearTotals[2026] ?? 0).toBe(0);
        expect(calc.totalTaken).toBe(30);
    });

    test("stale Master cached year total is ignored when map has yearly-sheet zeros", () => {
        const emp = {
            _id: "e-mahesh",
            employeeId: "IDMM-169",
            doj: "2024-03-06",
            // Correct map rebuilt from yearly sheets (not Master cached 55).
            excelLeaveYearTaken: { 2024: 0, 2025: 0, 2026: 0 },
            excelLeaveImportedAt: "2026-08-01",
        };
        const calc = computeExcelLeaveCalculation(emp, [], "2026-08-31");
        expect(calc.yearTotals[2024] ?? 0).toBe(0);
        expect(calc.yearTotals[2025] ?? 0).toBe(0);
        expect(calc.yearTotals[2026] ?? 0).toBe(0);
        expect(calc.totalTaken).toBe(0);
    });

    test("imported yearly-sheet leave is used when no Excel year map exists", () => {
        const emp = {
            _id: "e-kantesh",
            employeeId: "IDFO-000",
            doj: "2008-01-01",
            excelLeaveImportedAt: "2026-08-01",
        };
        const leaves = [
            {
                _id: "k1",
                status: "Approved",
                employeeId: "IDFO-000",
                startDate: "2026-02-03",
                endDate: "2026-02-05",
                leaveDays: 2,
                importSource: "excel-master-tracker",
            },
            {
                _id: "k2",
                status: "Approved",
                employeeId: "IDFO-000",
                startDate: "2026-07-13",
                endDate: "2026-07-15",
                leaveDays: 2,
                importSource: "excel-master-tracker",
            },
        ];
        const calc = computeExcelLeaveCalculation(emp, leaves, "2026-08-31");
        expect(calc.yearTotals[2026]).toBe(4);
        expect(calc.totalTaken).toBe(4);
    });

    test("sheet-built year map wins over duplicate imported leave rows", () => {
        const emp = {
            _id: "e-amal",
            employeeId: "IDMO-133",
            doj: "2022-01-01",
            excelLeaveYearTaken: { 2024: 52, 2025: 6, 2026: 30 },
            excelLeaveImportedAt: "2026-08-01",
        };
        const leaves = [
            {
                _id: "a1",
                status: "Approved",
                employeeId: "IDMO-133",
                startDate: "2024-02-12",
                endDate: "2024-02-18",
                leaveDays: 6,
                importSource: "excel-master-tracker",
            },
            {
                _id: "a1-dup",
                status: "Approved",
                employeeId: "IDMO-133",
                startDate: "2024-02-12",
                endDate: "2024-02-18",
                leaveDays: 6,
                importSource: "excel-master-tracker",
            },
            {
                _id: "a2",
                status: "Approved",
                employeeId: "IDMO-133",
                startDate: "2024-05-19",
                endDate: "2024-05-28",
                leaveDays: 9,
                importSource: "excel-master-tracker",
            },
            {
                _id: "a2-dup",
                status: "Approved",
                employeeId: "IDMO-133",
                startDate: "2024-05-19",
                endDate: "2024-05-28",
                leaveDays: 9,
                importSource: "excel-master-tracker",
            },
            {
                _id: "a3",
                status: "Approved",
                employeeId: "IDMO-133",
                startDate: "2024-08-12",
                endDate: "2024-09-18",
                leaveDays: 37,
                importSource: "excel-master-tracker",
            },
            {
                _id: "a3-dup",
                status: "Approved",
                employeeId: "IDMO-133",
                startDate: "2024-08-12",
                endDate: "2024-09-18",
                leaveDays: 37,
                importSource: "excel-master-tracker",
            },
        ];
        const calc = computeExcelLeaveCalculation(emp, leaves, "2026-08-31");
        expect(calc.yearTotals[2024]).toBe(52);
        expect(calc.yearTotals[2026]).toBe(30);
    });

    test("rejected and cancelled leave are not counted", () => {
        const emp = { _id: "e4", employeeId: "IDMM-004", doj: "2024-01-01" };
        const leaves = [
            {
                _id: "r1",
                status: "Rejected",
                employeeId: "IDMM-004",
                startDate: "2026-01-01",
                endDate: "2026-01-20",
                leaveDays: 19,
            },
            {
                _id: "c1",
                status: "Cancelled",
                employeeId: "IDMM-004",
                startDate: "2026-02-01",
                endDate: "2026-02-20",
                leaveDays: 19,
            },
            {
                _id: "a1",
                status: "Approved",
                employeeId: "IDMM-004",
                startDate: "2026-03-01",
                endDate: "2026-03-11",
                leaveDays: 10,
            },
        ];
        const calc = computeExcelLeaveCalculation(emp, leaves, "2026-08-31");
        expect(calc.totalTaken).toBe(10);
    });

    test("rolling window years are not hardcoded", () => {
        expect(lastFiveLeaveYears("2026-08-31")).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
        expect(lastFiveLeaveYears("2027-03-01")).toEqual([2022, 2023, 2024, 2025, 2026, 2027]);
        expect(lastFiveLeaveYears("2028-01-15")).toEqual([2023, 2024, 2025, 2026, 2027, 2028]);
    });

    test("service beyond 5 years still caps entitlement at 150", () => {
        const calc = computeExcelLeaveCalculation({ doj: "2015-08-01" }, [], asOf);
        expect(calc.entitlement).toBe(150);
        expect(calc.activeEligibleMonths).toBe(60);
        expect(calc.expiredDays).toBeGreaterThan(0);
    });
});
