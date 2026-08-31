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
