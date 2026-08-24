/**
 * Sonashi leave entitlement (Master Tracker business rules).
 *
 * Accrual: 2.5 days per completed month (30 / 12).
 * Active window: rolling 5 years ending on the calculation date.
 * Active entitlement: min(active completed months × 2.5, 150).
 * Expired: total service accrued − active entitlement (never negative).
 * Available: active entitlement − leave taken inside the active window.
 * Historical leave outside the window stays in history only.
 */

export const LEAVE_POLICY = Object.freeze({
    ANNUAL_LEAVE_DAYS: 30,
    MONTHLY_ACCRUAL_DAYS: 2.5,
    MAX_ACTIVE_YEARS: 5,
    MAX_ACTIVE_MONTHS: 60,
    MAX_ACTIVE_ENTITLEMENT_DAYS: 150,
    DAYS_PER_YEAR: 365,
});

const APPROVED_LEAVE_STATUSES = new Set(["Approved", "HOD Approved"]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const {
    ANNUAL_LEAVE_DAYS,
    MONTHLY_ACCRUAL_DAYS,
    MAX_ACTIVE_YEARS,
    MAX_ACTIVE_MONTHS,
    MAX_ACTIVE_ENTITLEMENT_DAYS,
    DAYS_PER_YEAR,
} = LEAVE_POLICY;

export const calculateLeaveDays = (startDate, endDate) => {
    const s = toLeaveCalendarDate(startDate);
    const e = toLeaveCalendarDate(endDate);
    if (!s || !e) return null;
    const days = Math.round((utcDay(e) - utcDay(s)) / MS_PER_DAY) + 1;
    return days > 0 ? days : null;
};

export function toLeaveCalendarDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    if (typeof value === "string") {
        const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (match) {
            return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        }
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function utcDay(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function roundLeaveNumber(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

/** Excel date subtraction: end − start (exclusive of start day). */
export function excelDateDiffDays(endDate, startDate) {
    const end = toLeaveCalendarDate(endDate);
    const start = toLeaveCalendarDate(startDate);
    if (!end || !start) return 0;
    return Math.max(0, Math.round((utcDay(end) - utcDay(start)) / MS_PER_DAY));
}

/**
 * Completed calendar months between start and end (inclusive of start anniversary).
 * Example: 24/02/2026 → 24/08/2026 = 6. Partial months do not count.
 */
export function countCompletedMonths(startDate, endDate) {
    const start = toLeaveCalendarDate(startDate);
    const end = toLeaveCalendarDate(endDate);
    if (!start || !end || end < start) return 0;

    let months =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth());

    if (end.getDate() < start.getDate()) {
        months -= 1;
    }

    return Math.max(0, months);
}

/** Accrued leave days from completed months (keeps .5 precision). */
export function accrueLeaveDays(completedMonths) {
    const months = Math.max(0, Number(completedMonths) || 0);
    return roundLeaveNumber(months * MONTHLY_ACCRUAL_DAYS);
}

/** Default Till Date for year-end Excel export = 31 Dec of asOf year. */
export function getLeaveTillDate(asOf = new Date()) {
    const d = toLeaveCalendarDate(asOf) || new Date();
    return new Date(d.getFullYear(), 11, 31);
}

/**
 * Rolling 5-year active window.
 * Effective start = MAX(DOJ, calculationDate − 5 years) — used for entitlement months.
 */
export function getActiveLeaveWindow(calculationDateInput = null, joiningDate = null) {
    const end = toLeaveCalendarDate(calculationDateInput) || toLeaveCalendarDate(new Date());
    const join = toLeaveCalendarDate(joiningDate);

    const windowStart = new Date(end);
    windowStart.setFullYear(windowStart.getFullYear() - MAX_ACTIVE_YEARS);

    let effectiveStart = windowStart;
    if (join) {
        effectiveStart = join > windowStart ? join : windowStart;
        if (join > end) {
            effectiveStart = join;
        }
    }

    return {
        calculationDate: end,
        tillDate: end,
        windowStart,
        effectiveStart,
        calculationEndDate: end,
        joiningDate: join,
    };
}

/**
 * Taken / Leave History day range start.
 * Uses 1 Jan of the joining year (not the exact DOJ day) so imported leave in the
 * joining year still counts, while years before joining stay excluded.
 * Still capped by the 5-year window start.
 */
export function getTakenLeaveRangeStart(calculationDateInput = null, joiningDate = null) {
    const { windowStart, joiningDate: join } = getActiveLeaveWindow(
        calculationDateInput,
        joiningDate
    );
    if (!join) return windowStart;
    const joiningYearStart = new Date(join.getFullYear(), 0, 1);
    return joiningYearStart > windowStart ? joiningYearStart : windowStart;
}

/** @deprecated Prefer getActiveLeaveWindow().effectiveStart */
export function getCalculateLeaveDate(joiningDate, tillDate) {
    const { effectiveStart } = getActiveLeaveWindow(tillDate, joiningDate);
    return effectiveStart;
}

/** Calendar years touched by the active window (labels/export). */
export function lastFiveLeaveYears(tillDate) {
    const till = toLeaveCalendarDate(tillDate) || toLeaveCalendarDate(new Date());
    const { windowStart } = getActiveLeaveWindow(till);
    const startYear = windowStart.getFullYear();
    const endYear = till.getFullYear();
    const years = [];
    for (let year = startYear; year <= endYear; year += 1) {
        years.push(year);
    }
    return years;
}

/** Inclusive overlap day count between a leave span and a date range. */
export function leaveDaysOverlappingRange(leaveStart, leaveEnd, rangeStart, rangeEnd) {
    const start = toLeaveCalendarDate(leaveStart);
    const end = toLeaveCalendarDate(leaveEnd) || start;
    const rangeFrom = toLeaveCalendarDate(rangeStart);
    const rangeTo = toLeaveCalendarDate(rangeEnd);
    if (!start || !end || !rangeFrom || !rangeTo) return 0;

    const overlapStart = start > rangeFrom ? start : rangeFrom;
    const overlapEnd = end < rangeTo ? end : rangeTo;
    if (overlapStart > overlapEnd) return 0;

    return calculateLeaveDays(overlapStart, overlapEnd) || 0;
}

function mergeLeaveIntervals(leaves) {
    const intervals = (leaves || [])
        .map((req) => {
            const start = toLeaveCalendarDate(req.startDate);
            const end = toLeaveCalendarDate(req.endDate) || start;
            if (!start || !end || end < start) return null;
            return { start, end };
        })
        .filter(Boolean)
        .sort((a, b) => a.start - b.start);

    const merged = [];
    intervals.forEach((interval) => {
        const last = merged[merged.length - 1];
        if (!last || interval.start > last.end) {
            merged.push({ ...interval });
            return;
        }
        if (interval.end > last.end) {
            last.end = interval.end;
        }
    });
    return merged;
}

/** Approved leave days overlapping [rangeStart, rangeEnd], merged to avoid double-count. */
export function sumApprovedLeaveInWindow(employee, allLeaveRequests, rangeStart, rangeEnd) {
    const approved = getApprovedLeavesForEmployee(employee, allLeaveRequests);
    const merged = mergeLeaveIntervals(approved);
    return roundLeaveNumber(
        merged.reduce(
            (sum, interval) =>
                sum + leaveDaysOverlappingRange(interval.start, interval.end, rangeStart, rangeEnd),
            0
        )
    );
}

/** Historical leave taken strictly before the active window (informational). */
export function sumApprovedLeaveBeforeDate(employee, allLeaveRequests, beforeDate) {
    const before = toLeaveCalendarDate(beforeDate);
    if (!before) return 0;

    const approved = getApprovedLeavesForEmployee(employee, allLeaveRequests);
    const merged = mergeLeaveIntervals(approved);
    const lastDayBefore = new Date(before);
    lastDayBefore.setDate(lastDayBefore.getDate() - 1);

    return roundLeaveNumber(
        merged.reduce((sum, interval) => {
            if (interval.start >= before) return sum;
            const end = interval.end < lastDayBefore ? interval.end : lastDayBefore;
            return sum + (calculateLeaveDays(interval.start, end) || 0);
        }, 0)
    );
}

export function matchesLeaveEmployee(req, emp) {
    if (!req || !emp) return false;

    const empMongoId = String(emp._id || "").toLowerCase();
    const empCode = String(emp.employeeId || "").toLowerCase();
    const empEmail = String(emp.emailId || "").trim().toLowerCase();

    const reqRef = String(req.employee?._id || req.employee || "").toLowerCase();
    if (empMongoId && reqRef && reqRef === empMongoId) return true;

    const userEmpId = req.employee?.employeeId;
    if (userEmpId && empMongoId && String(userEmpId).toLowerCase() === empMongoId) return true;

    if (req.employeeId) {
        const rid = String(req.employeeId).toLowerCase();
        if (empMongoId && rid === empMongoId) return true;
        if (empCode && rid === empCode) return true;
    }

    if (empEmail) {
        const reqEmail = String(req.employee?.emailId || "").trim().toLowerCase();
        if (reqEmail && reqEmail === empEmail) return true;
    }

    const hasEmployeeRef = Boolean(reqRef || req.employeeId || req.employee?.employeeId);
    if (!hasEmployeeRef) {
        const reqName = String(req.employeeName || "").toLowerCase().trim();
        const empName = String(emp.employeeName || emp.name || "").toLowerCase().trim();
        if (reqName && empName && reqName === empName) return true;
    }

    return false;
}

export function filterLeavesForEmployee(employee, allLeaveRequests, options = {}) {
    const { statuses = null } = options;
    return (allLeaveRequests || []).filter((req) => {
        if (statuses && !statuses.has(req.status)) return false;
        return matchesLeaveEmployee(req, employee);
    });
}

export function getApprovedLeavesForEmployee(employee, allLeaveRequests) {
    return (allLeaveRequests || []).filter(
        (req) => APPROVED_LEAVE_STATUSES.has(req.status) && matchesLeaveEmployee(req, employee)
    );
}

/** Assign merged leave days to calendar years within [rangeStart, rangeEnd]. */
export function yearWiseLeaveTakenInWindow(employee, allLeaveRequests, rangeStart, rangeEnd) {
    const byYear = {};
    const rangeFrom = toLeaveCalendarDate(rangeStart);
    const rangeTo = toLeaveCalendarDate(rangeEnd);
    if (!rangeFrom || !rangeTo) return byYear;

    const merged = mergeLeaveIntervals(getApprovedLeavesForEmployee(employee, allLeaveRequests));

    merged.forEach((interval) => {
        const overlapStart = interval.start > rangeFrom ? interval.start : rangeFrom;
        const overlapEnd = interval.end < rangeTo ? interval.end : rangeTo;
        if (overlapStart > overlapEnd) return;

        let cursor = new Date(overlapStart);
        while (cursor <= overlapEnd) {
            const year = cursor.getFullYear();
            byYear[year] = (byYear[year] || 0) + 1;
            cursor.setDate(cursor.getDate() + 1);
        }
    });

    return byYear;
}

/** Full historical calendar-year totals from DOJ onward (display). */
export function yearWiseLeaveTaken(employee, allLeaveRequests, rangeStart = null) {
    const join = toLeaveCalendarDate(rangeStart ?? employee?.doj);
    const end = new Date(new Date().getFullYear(), 11, 31);
    if (!join) {
        return yearWiseLeaveTakenInWindow(employee, allLeaveRequests, new Date(1900, 0, 1), end);
    }
    return yearWiseLeaveTakenInWindow(employee, allLeaveRequests, join, end);
}

/**
 * Central leave summary.
 *
 * ACTIVE_ENTITLEMENT = min(activeCompletedMonths × 2.5, 150)
 * EXPIRED            = max(totalServiceAccrued − ACTIVE_ENTITLEMENT, 0)
 * TAKEN              = approved leave overlapping active window
 * AVAILABLE          = ACTIVE_ENTITLEMENT − TAKEN
 */
export function computeExcelLeaveCalculation(employee, allLeaveRequests, calculationDateInput = null) {
    const calcDate = toLeaveCalendarDate(calculationDateInput) || toLeaveCalendarDate(new Date());
    const joiningDate = toLeaveCalendarDate(employee?.doj);
    const { windowStart, effectiveStart } = getActiveLeaveWindow(calcDate, joiningDate);
    const takenRangeStart = getTakenLeaveRangeStart(calcDate, joiningDate);

    const totalEligibleMonths = joiningDate ? countCompletedMonths(joiningDate, calcDate) : 0;
    const activeEligibleMonthsRaw = countCompletedMonths(effectiveStart, calcDate);
    const activeEligibleMonths = Math.min(activeEligibleMonthsRaw, MAX_ACTIVE_MONTHS);

    const totalAccruedDays = accrueLeaveDays(totalEligibleMonths);
    const entitlement = Math.min(
        accrueLeaveDays(activeEligibleMonths),
        MAX_ACTIVE_ENTITLEMENT_DAYS
    );
    const expiredDays = roundLeaveNumber(Math.max(totalAccruedDays - entitlement, 0));

    const workingDays = excelDateDiffDays(calcDate, effectiveStart);
    const totalWorkingDays = joiningDate ? excelDateDiffDays(calcDate, joiningDate) : workingDays;
    const workingYearsExact = activeEligibleMonths / 12;
    const workingYears = roundLeaveNumber(workingYearsExact);
    const averageLeave = Math.min(workingYears, MAX_ACTIVE_YEARS);

    const takenWindowEnd = new Date(calcDate.getFullYear(), 11, 31);
    const historyStart = joiningDate
        ? new Date(joiningDate.getFullYear(), 0, 1)
        : takenRangeStart;

    // History: joining year → current year. Active taken: same day merge within taken window.
    const yearTotals = yearWiseLeaveTakenInWindow(
        employee,
        allLeaveRequests,
        historyStart,
        takenWindowEnd
    );
    const activeYearTotals = yearWiseLeaveTakenInWindow(
        employee,
        allLeaveRequests,
        takenRangeStart,
        takenWindowEnd
    );
    const totalTaken = roundLeaveNumber(
        Object.values(activeYearTotals).reduce((sum, days) => sum + (days || 0), 0)
    );
    const historicalTakenOutsideWindow = sumApprovedLeaveBeforeDate(
        employee,
        allLeaveRequests,
        takenRangeStart
    );
    const historicalTakenDays = roundLeaveNumber(
        Object.values(yearTotals).reduce((sum, days) => sum + (days || 0), 0)
    );
    const last5Years = lastFiveLeaveYears(calcDate);

    const leaveDue = roundLeaveNumber(entitlement - totalTaken);

    return {
        tillDate: calcDate,
        calculationDate: calcDate,
        calculateLeaveDate: effectiveStart,
        calculationStartDate: effectiveStart,
        takenRangeStart,
        calculationEndDate: calcDate,
        windowStart,
        joiningDate,
        totalEligibleMonths,
        activeEligibleMonths,
        totalAccruedDays,
        workingDays,
        totalWorkingDays,
        workingYearsExact,
        workingYears,
        averageLeave,
        yearTotals: activeYearTotals,
        historicalYearTotals: yearTotals,
        last5Years,
        totalTaken,
        activeTakenDays: totalTaken,
        historicalTakenDays,
        historicalTakenOutsideWindow,
        expiredDays,
        entitlement,
        balance: leaveDue,
        leaveDue,
        availableDays: leaveDue,
    };
}

/** Status label for a year row in Leave History. */
export function getLeaveHistoryYearStatus(year, doj, calculationDateInput, takenDays) {
    const calcDate = toLeaveCalendarDate(calculationDateInput) || toLeaveCalendarDate(new Date());
    const currentYear = calcDate.getFullYear();
    const join = toLeaveCalendarDate(doj);
    const joinYear = join ? join.getFullYear() : null;

    if (year > currentYear) return "Not Applicable";
    if (joinYear != null && year < joinYear) return "Not Applicable";

    const yearEnd = new Date(year, 11, 31);
    const { effectiveStart } = getActiveLeaveWindow(calcDate, doj);
    if (yearEnd < effectiveStart) {
        return takenDays > 0 ? "Expired" : "No Leave";
    }

    if (!takenDays) return "No Leave";
    return takenDays > ANNUAL_LEAVE_DAYS ? "Exceeded" : "Within Limit";
}

export const calculateLeaveBalance = (employee, allLeaveRequests, calculationDate = null) => {
    if (!employee) {
        return {
            workingMonths: 0,
            workingYears: 0,
            entitlement: 0,
            totalTaken: 0,
            balance: 0,
            expiredDays: 0,
            airfareStatus: "N/A",
            airfareEligible: false,
            airfareAvailable: false,
            lastAirfareDate: null,
        };
    }

    // Live entitlement uses the actual calculation date (not forced year-end).
    const calcDate = toLeaveCalendarDate(calculationDate) || toLeaveCalendarDate(new Date());
    const calc = computeExcelLeaveCalculation(employee, allLeaveRequests, calcDate);

    const today = calcDate;

    let lastAirfareDate = null;
    let airfareUsedRecently = false;
    const twoYearsAgo = new Date(today);
    twoYearsAgo.setFullYear(today.getFullYear() - 2);

    getApprovedLeavesForEmployee(employee, allLeaveRequests).forEach((req) => {
        if (!req.requestAirfare) return;
        const airfareDate = toLeaveCalendarDate(req.startDate);
        if (!airfareDate) return;
        if (!lastAirfareDate || airfareDate > lastAirfareDate) lastAirfareDate = airfareDate;
        if (airfareDate > twoYearsAgo) airfareUsedRecently = true;
    });

    const hasMinExperience = (calc.totalEligibleMonths || 0) >= 24;
    const airfareEligible = hasMinExperience;
    const airfareAvailable = hasMinExperience;
    const airfareStatus = hasMinExperience ? "Available" : "Personal Ticket Only";

    return {
        workingMonths: calc.activeEligibleMonths,
        totalEligibleMonths: calc.totalEligibleMonths,
        activeEligibleMonths: calc.activeEligibleMonths,
        workingYears: calc.workingYears.toFixed(2),
        workingDays: calc.workingDays,
        totalWorkingDays: calc.totalWorkingDays,
        averageLeave: calc.averageLeave,
        entitlement: calc.entitlement,
        expiredDays: calc.expiredDays,
        totalTaken: calc.totalTaken,
        activeTakenDays: calc.activeTakenDays,
        historicalTakenDays: calc.historicalTakenDays,
        balance: calc.balance,
        leaveDue: calc.leaveDue,
        availableDays: calc.availableDays,
        totalAccruedDays: calc.totalAccruedDays,
        calculateLeaveDate: calc.calculateLeaveDate,
        calculationStartDate: calc.calculationStartDate,
        calculationEndDate: calc.calculationEndDate,
        windowStart: calc.windowStart,
        tillDate: calc.tillDate,
        yearTotals: calc.yearTotals,
        historicalYearTotals: calc.historicalYearTotals,
        takenRangeStart: calc.takenRangeStart,
        last5Years: calc.last5Years,
        airfareStatus,
        airfareEligible,
        airfareAvailable,
        lastAirfareDate,
        airfareUsedRecently,
    };
};
