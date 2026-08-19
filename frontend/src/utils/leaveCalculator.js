/** Staff Leave Report / Master Tracker calculation (Excel reference). */

const APPROVED_LEAVE_STATUSES = new Set(["Approved", "HOD Approved"]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_YEAR = 365;
const ANNUAL_LEAVE_DAYS = 30;
const AVERAGE_LEAVE_CAP_YEARS = 5;

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

/** Excel date subtraction: Till Date − Calculate Leave Date (not inclusive of start). */
export function excelDateDiffDays(endDate, startDate) {
    const end = toLeaveCalendarDate(endDate);
    const start = toLeaveCalendarDate(startDate);
    if (!end || !start) return 0;
    return Math.max(0, Math.round((utcDay(end) - utcDay(start)) / MS_PER_DAY));
}

/** Default Till Date = 31 Dec of the live/selected year. */
export function getLeaveTillDate(asOf = new Date()) {
    const d = toLeaveCalendarDate(asOf) || new Date();
    return new Date(d.getFullYear(), 11, 31);
}

export function getCalculateLeaveDate(joiningDate, tillDate) {
    const join = toLeaveCalendarDate(joiningDate);
    const till = toLeaveCalendarDate(tillDate) || getLeaveTillDate();
    if (!join) return till;
    return join > till ? till : join;
}

export function lastFiveLeaveYears(tillDate) {
    const tillYear = (toLeaveCalendarDate(tillDate) || getLeaveTillDate()).getFullYear();
    const years = [];
    for (let year = tillYear - 4; year <= tillYear; year += 1) years.push(year);
    return years;
}

export function matchesLeaveEmployee(req, emp) {
    const reqName = String(req?.employeeName || "").toLowerCase().trim();
    const empName = String(emp?.employeeName || emp?.name || "").toLowerCase().trim();
    if (reqName && empName && reqName === empName) return true;

    const empMongoId = String(emp?._id || "").toLowerCase();
    const empCode = String(emp?.employeeId || "").toLowerCase();
    const linked = req?.employee;
    if (linked) {
        const linkedId = String(
            linked.employeeId?._id || linked._id || linked.employeeId || linked || ""
        ).toLowerCase();
        if (linkedId && (linkedId === empMongoId || linkedId === empCode)) return true;
    }
    if (req?.employeeId && empCode && String(req.employeeId).toLowerCase() === empCode) {
        return true;
    }
    return false;
}

export function getApprovedLeavesForEmployee(employee, allLeaveRequests) {
    return (allLeaveRequests || []).filter(
        (req) => APPROVED_LEAVE_STATUSES.has(req.status) && matchesLeaveEmployee(req, employee)
    );
}

export function yearWiseLeaveTaken(employee, allLeaveRequests) {
    const byYear = {};
    getApprovedLeavesForEmployee(employee, allLeaveRequests).forEach((req) => {
        const start = toLeaveCalendarDate(req.startDate);
        const end = toLeaveCalendarDate(req.endDate) || start;
        if (!start) return;
        const year = start.getFullYear();
        const days = calculateLeaveDays(start, end) || 0;
        byYear[year] = (byYear[year] || 0) + days;
    });
    return byYear;
}

/**
 * Excel master-tracker leave due:
 * Working Days = Till Date − Calculate Leave Date (joining date)
 * Working Years = Working Days / 365
 * Average Leave = min(Working Years, 5)
 * Leave Taken = sum of approved leave in last 5 calendar years through Till year
 * Leave Due = (Average Leave × 30) − Leave Taken
 */
export function computeExcelLeaveCalculation(employee, allLeaveRequests, tillDateInput = null) {
    const till = toLeaveCalendarDate(tillDateInput) || getLeaveTillDate();
    const calculateLeaveDate = getCalculateLeaveDate(employee?.doj, till);
    const workingDays = excelDateDiffDays(till, calculateLeaveDate);
    const workingYearsExact = workingDays / DAYS_PER_YEAR;
    const workingYears = roundLeaveNumber(workingYearsExact);
    const averageLeave = Math.min(workingYears, AVERAGE_LEAVE_CAP_YEARS);
    const yearTotals = yearWiseLeaveTaken(employee, allLeaveRequests);
    const last5Years = lastFiveLeaveYears(till);
    const totalTaken = last5Years.reduce((sum, year) => sum + (yearTotals[year] || 0), 0);
    const cutoffYear = last5Years[0];
    const expiredDays = Object.entries(yearTotals).reduce((sum, [year, days]) => {
        return Number(year) < cutoffYear ? sum + days : sum;
    }, 0);
    const entitlement = roundLeaveNumber(averageLeave * ANNUAL_LEAVE_DAYS);
    const leaveDue = roundLeaveNumber(entitlement - totalTaken);

    return {
        tillDate: till,
        calculateLeaveDate,
        joiningDate: toLeaveCalendarDate(employee?.doj),
        workingDays,
        workingYearsExact,
        workingYears,
        averageLeave,
        yearTotals,
        last5Years,
        totalTaken,
        expiredDays,
        entitlement,
        balance: leaveDue,
        leaveDue,
    };
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

    const calc = computeExcelLeaveCalculation(
        employee,
        allLeaveRequests,
        getLeaveTillDate(calculationDate || new Date())
    );

    const workingMonths = Math.floor(calc.workingDays / 30.44);
    const today = toLeaveCalendarDate(calculationDate) || toLeaveCalendarDate(new Date());

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

    const hasMinExperience = calc.workingYearsExact >= 2;
    const airfareEligible = hasMinExperience;
    const airfareAvailable = hasMinExperience;
    const airfareStatus = hasMinExperience ? "Available" : "Personal Ticket Only";

    return {
        workingMonths,
        workingYears: calc.workingYears.toFixed(2),
        workingDays: calc.workingDays,
        averageLeave: calc.averageLeave,
        entitlement: calc.entitlement,
        expiredDays: calc.expiredDays,
        totalTaken: calc.totalTaken,
        balance: calc.balance,
        leaveDue: calc.leaveDue,
        calculateLeaveDate: calc.calculateLeaveDate,
        tillDate: calc.tillDate,
        yearTotals: calc.yearTotals,
        airfareStatus,
        airfareEligible,
        airfareAvailable,
        lastAirfareDate,
        airfareUsedRecently,
    };
};
