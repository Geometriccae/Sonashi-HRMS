import {
    accrueLeaveDays,
    calculateEntitlementDays,
    calculateLeaveBalance,
    computeExcelLeaveCalculation,
    countCompletedMonths,
    getRollingFiveYearWindow,
    hasFiveYearsOfService,
    lastFiveLeaveYears,
    totalLeaveTakenFromDoj,
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

    test("stale excelLeaveYearTaken is not added on top of approved LeaveRequests", () => {
        const emp = {
            _id: "e-pramod",
            employeeId: "IDMM-101",
            doj: "2018-01-01",
            excelLeaveYearTaken: { 2024: 26, 2025: 1, 2026: 8 },
        };
        const leaves = [
            {
                _id: "a1",
                status: "Approved",
                employeeId: "IDMM-101",
                startDate: "2026-07-15",
                endDate: "2026-07-22",
                leaveDays: 7,
            },
            {
                _id: "a2",
                status: "Approved",
                employeeId: "IDMM-101",
                startDate: "2026-02-15",
                endDate: "2026-02-16",
                leaveDays: 1,
            },
            {
                _id: "a3",
                status: "Approved",
                employeeId: "IDMM-101",
                startDate: "2024-07-05",
                endDate: "2024-07-31",
                leaveDays: 26,
            },
        ];
        const calc = computeExcelLeaveCalculation(emp, leaves, "2026-09-16");
        expect(calc.historicalYearTotals[2024]).toBe(26);
        expect(calc.historicalYearTotals[2025] ?? 0).toBe(0);
        expect(calc.historicalYearTotals[2026]).toBe(8);
        expect(calc.historicalTakenDays).toBe(34);
        expect(calc.totalTaken).toBe(34);
    });

    test("implausible stored leaveDays are excluded; map cannot invent taken", () => {
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
        expect(calc.yearTotals[2026] ?? 0).toBe(0);
        expect(calc.totalTaken).toBe(0);
    });

    test("the same approved leave is counted once even if also stored on the excel map", () => {
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

    test("post-import live leave is taken from the LeaveRequest only", () => {
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
        expect(calc.yearTotals[2026]).toBe(14);
        expect(calc.totalTaken).toBe(14);
    });

    test("excel map leftover days are ignored when there are no approved rows", () => {
        const emp = {
            _id: "e3",
            employeeId: "IDMM-003",
            doj: "2024-01-01",
            excelLeaveYearTaken: { 2024: 0, 2025: 30, 2026: 0 },
            excelLeaveImportedAt: "2026-08-01",
        };
        const calc = computeExcelLeaveCalculation(emp, [], "2026-08-31");
        expect(calc.yearTotals[2024] ?? 0).toBe(0);
        expect(calc.yearTotals[2025] ?? 0).toBe(0);
        expect(calc.yearTotals[2026] ?? 0).toBe(0);
        expect(calc.totalTaken).toBe(0);
    });

    test("stale Master cached year total is ignored without matching LeaveRequests", () => {
        const emp = {
            _id: "e-mahesh",
            employeeId: "IDMM-169",
            doj: "2024-03-06",
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

    test("duplicate imported rows with the same span count once", () => {
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
        expect(calc.yearTotals[2026] ?? 0).toBe(0);
        expect(calc.totalTaken).toBe(52);
    });

    test("rejected, cancelled, and pending leave are not counted", () => {
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
                _id: "p1",
                status: "Pending",
                employeeId: "IDMM-004",
                startDate: "2026-04-01",
                endDate: "2026-04-10",
                leaveDays: 9,
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

    test("deleted leave is not in Taken even if the year map still has those days", () => {
        const emp = {
            _id: "e-del",
            employeeId: "IDMM-900",
            doj: "2023-01-01",
            excelLeaveYearTaken: { 2024: 20, 2025: 10, 2026: 15 },
        };
        const imported = {
            _id: "imp-1",
            status: "Approved",
            employeeId: "IDMM-900",
            importSource: "excel-master-tracker",
            startDate: "2025-06-01",
            endDate: "2025-06-11",
            leaveDays: 10,
        };
        const before = computeExcelLeaveCalculation(emp, [imported], "2026-08-31");
        expect(before.yearTotals[2025]).toBe(10);

        const afterDelete = computeExcelLeaveCalculation(emp, [], "2026-08-31");
        expect(afterDelete.yearTotals[2025]).toBe(0);
        expect(afterDelete.totalTaken).toBe(0);
        expect(afterDelete.entitlement).toBe(before.entitlement);
    });

    test("a leave spanning two calendar years is split across both years", () => {
        const emp = { _id: "e-span", employeeId: "IDMM-010", doj: "2024-01-01" };
        const leaves = [
            {
                _id: "span",
                status: "Approved",
                employeeId: "IDMM-010",
                startDate: "2026-12-20",
                endDate: "2027-01-10",
            },
        ];
        const calc = computeExcelLeaveCalculation(emp, leaves, "2027-02-01");
        expect(calc.historicalYearTotals[2026]).toBe(11);
        expect(calc.historicalYearTotals[2027]).toBe(10);
        expect(calc.historicalTakenDays).toBe(21);
    });
});

describe("rolling 5-year window from the Leave Start Date (5+ years of service)", () => {
    const ymd = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const senior = { _id: "e-senior", employeeId: "IDMM-500", doj: "2015-03-10" };
    const leave = (id, startDate, endDate, extra = {}) => ({
        _id: id,
        status: "Approved",
        employeeId: "IDMM-500",
        startDate,
        endDate,
        ...extra,
    });

    test.each([
        ["Case 1", "2026-10-05", "2021-10-05"],
        ["Case 2", "2026-12-20", "2021-12-20"],
        ["Case 3 (previous year)", "2025-06-15", "2020-06-15"],
        ["Case 5 (edited date)", "2026-11-10", "2021-11-10"],
        ["leap day → 28 Feb", "2024-02-29", "2019-02-28"],
        ["month end", "2026-08-31", "2021-08-31"],
        ["year end", "2026-12-31", "2021-12-31"],
        ["new year", "2027-01-01", "2022-01-01"],
    ])("%s: %s → window starts %s", (_label, leaveStart, expectedStart) => {
        const period = getRollingFiveYearWindow(leaveStart);
        expect(ymd(period.start)).toBe(expectedStart);
        expect(ymd(period.end)).toBe(leaveStart);

        const calc = computeExcelLeaveCalculation(senior, [], leaveStart);
        expect(calc.rollingFiveYear).toBe(true);
        expect(ymd(calc.rollingWindowStart)).toBe(expectedStart);
        expect(ymd(calc.rollingWindowEnd)).toBe(leaveStart);
        expect(calc.entitlement).toBe(150);
    });

    test("5+ years is decided from DOJ on the Leave Start Date", () => {
        expect(hasFiveYearsOfService("2021-10-05", "2026-10-05")).toBe(true);
        expect(hasFiveYearsOfService("2021-10-06", "2026-10-05")).toBe(false);
        expect(hasFiveYearsOfService(null, "2026-10-05")).toBe(false);
    });

    test("only approved leave inside the rolling period counts", () => {
        const leaves = [
            leave("before", "2021-06-01", "2021-06-21"), // before 05/10/2021 → excluded
            leave("inside-2022", "2022-03-01", "2022-03-11"), // 10
            leave("inside-2026", "2026-07-01", "2026-07-15"), // 14
            leave("after", "2026-11-01", "2026-11-11"), // after leave start → excluded
            leave("rejected", "2024-01-01", "2024-01-20", { status: "Rejected" }),
            leave("other-emp", "2024-01-01", "2024-01-20", { employeeId: "IDMM-999" }),
        ];
        const calc = computeExcelLeaveCalculation(senior, leaves, "2026-10-05");
        expect(calc.totalTaken).toBe(24);
        expect(calc.yearTotals[2021]).toBe(0);
        expect(calc.yearTotals[2022]).toBe(10);
        expect(calc.yearTotals[2026]).toBe(14);
        expect(calc.availableDays).toBe(150 - 24);
        // Calendar-year history keeps every approved record unchanged.
        expect(calc.historicalYearTotals[2021]).toBe(20);
        expect(calc.historicalYearTotals[2026]).toBe(24);
    });

    test("changing the Leave Start Date moves the period with it", () => {
        const leaves = [
            leave("oct-2021", "2021-10-20", "2021-10-30"), // 10
            leave("nov-2026", "2026-11-01", "2026-11-06"), // 5
        ];
        expect(computeExcelLeaveCalculation(senior, leaves, "2026-10-05").totalTaken).toBe(10);
        // 10/11/2021 → 10/11/2026: Oct 2021 drops out, Nov 2026 comes in.
        expect(computeExcelLeaveCalculation(senior, leaves, "2026-11-10").totalTaken).toBe(5);
    });

    test("a leave crossing the window start is prorated to days inside the period", () => {
        const leaves = [leave("cross", "2021-10-01", "2021-10-11")]; // 10 days, 6 inside
        const calc = computeExcelLeaveCalculation(senior, leaves, "2026-10-05");
        expect(calc.totalTaken).toBe(6);
    });

    test("the leave being edited is not counted in its own history", () => {
        const editing = leave("editing", "2026-10-05", "2026-10-15");
        const prior = leave("prior", "2025-01-01", "2025-01-11"); // 10
        const moved = calculateLeaveBalance(senior, [editing, prior], "2026-11-10", {
            excludeLeaveId: "editing",
        });
        expect(moved.totalTaken).toBe(10);
        const same = calculateLeaveBalance(senior, [editing, prior], "2026-10-05", {
            excludeLeaveId: "editing",
        });
        expect(same.totalTaken).toBe(10);
    });

    test("Case 4: under 5 years keeps the existing calendar-year window", () => {
        const junior = { _id: "e-junior", employeeId: "IDMM-501", doj: "2023-01-01" };
        const leaves = [
            { _id: "j1", status: "Approved", employeeId: "IDMM-501", startDate: "2026-11-01", endDate: "2026-11-11" },
        ];
        const calc = computeExcelLeaveCalculation(junior, leaves, "2026-10-05", { excludeLeaveId: "j1" });
        expect(calc.rollingFiveYear).toBe(false);
        expect(calc.rollingWindowStart).toBeNull();
        expect(ymd(calc.windowStart)).toBe("2021-01-01");
        // Existing rule: taken runs to 31 Dec of the calculation year.
        expect(calc.totalTaken).toBe(10);
        expect(calc.entitlement).toBe(calculateEntitlementDays("2023-01-01", "2026-10-05"));
    });
});

describe("Total Leave Taken (DOJ → today)", () => {
    const emp = { _id: "e-doj", employeeId: "IDMM-200", doj: "2021-01-01" };

    test("returns 0 when there is no approved leave", () => {
        expect(totalLeaveTakenFromDoj(emp, [], "2026-09-23")).toBe(0);
        expect(calculateLeaveBalance(emp, [], "2026-09-23").totalLeaveTakenFromDoj).toBe(0);
    });

    test("sums approved leave from DOJ through as-of date across years", () => {
        const leaves = [
            { _id: "a", status: "Approved", employeeId: "IDMM-200", startDate: "2021-06-01", endDate: "2021-06-21" }, // 20
            { _id: "b", status: "Approved", employeeId: "IDMM-200", startDate: "2023-03-01", endDate: "2023-03-11" }, // 10
            { _id: "c", status: "Approved", employeeId: "IDMM-200", startDate: "2025-01-01", endDate: "2025-01-16" }, // 15
        ];
        // END−START: 20, 10, 15 → 45
        expect(totalLeaveTakenFromDoj(emp, leaves, "2026-09-23")).toBe(45);
    });

    test("ignores pending, rejected, and future leave", () => {
        const leaves = [
            { _id: "ok", status: "Approved", employeeId: "IDMM-200", startDate: "2024-01-01", endDate: "2024-01-11" }, // 10
            { _id: "pend", status: "Pending", employeeId: "IDMM-200", startDate: "2024-02-01", endDate: "2024-02-20" },
            { _id: "rej", status: "Rejected", employeeId: "IDMM-200", startDate: "2024-03-01", endDate: "2024-03-20" },
            { _id: "fut", status: "Approved", employeeId: "IDMM-200", startDate: "2026-12-01", endDate: "2026-12-31" },
        ];
        expect(totalLeaveTakenFromDoj(emp, leaves, "2026-09-23")).toBe(10);
    });

    test("clips an active leave to days taken up to today", () => {
        const leaves = [
            {
                _id: "active",
                status: "Approved",
                employeeId: "IDMM-200",
                startDate: "2026-09-18",
                endDate: "2026-09-30",
            },
        ];
        // 18 → 23 = 5 days (END−START)
        expect(totalLeaveTakenFromDoj(emp, leaves, "2026-09-23")).toBe(5);
    });

    test("does not change the existing 5-year Leave Taken field", () => {
        const longService = { _id: "e-doj", employeeId: "IDMM-200", doj: "2018-01-01" };
        const leaves = [
            { _id: "old", status: "Approved", employeeId: "IDMM-200", startDate: "2019-06-01", endDate: "2019-06-21" }, // 20 — outside 5yr window
            { _id: "new", status: "Approved", employeeId: "IDMM-200", startDate: "2025-06-01", endDate: "2025-06-11" }, // 10 — inside window
        ];
        const balance = calculateLeaveBalance(longService, leaves, "2026-09-23");
        expect(balance.totalLeaveTakenFromDoj).toBe(30);
        // Existing totalTaken stays the rolling-window value (unchanged API).
        expect(typeof balance.totalTaken).toBe("number");
        expect(balance.totalTaken).toBe(balance.activeTakenDays);
        expect(balance.totalTaken).toBe(10);
        expect(balance.totalLeaveTakenFromDoj).toBeGreaterThan(balance.totalTaken);
    });
});
