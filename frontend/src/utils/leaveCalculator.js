/**
 * Sonashi leave: Excel master-tracker data + client month entitlement.
 *
 * DATA: yearly taken from the employee’s own imported Excel map (by staff ID / name match).
 * ENTITLEMENT: completed months × 2.5, cap 150 (last 5 years).
 * TAKEN: rolling window years — closed years from Excel map only; current year uses
 *        Excel snapshot with live leave, without double-counting a trip that exists
 *        both as an Excel year total and as a live approved request.
 * AVAILABLE: entitlement − taken.
 * EXPIRED: accrual before the active window (DOJ history minus window).
 */

export const LEAVE_POLICY = Object.freeze({
    ANNUAL_LEAVE_DAYS: 30,
    MONTHLY_ACCRUAL_DAYS: 2.5,
    MAX_ACTIVE_YEARS: 5,
    MAX_ACTIVE_MONTHS: 60,
    MAX_ACTIVE_ENTITLEMENT_DAYS: 150,
    DAYS_PER_YEAR: 365,
    /** One request cannot contribute more than the 5-year cap to Taken. */
    MAX_TAKEN_DAYS_PER_REQUEST: 150,
    MAX_MATERNITY_TAKEN_DAYS: 180,
});

const APPROVED_LEAVE_STATUSES = new Set(["Approved", "HOD Approved"]);
const HR_STAFF_CODE_RE = /^id[a-z]{2,4}-\d+/i;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const {
    ANNUAL_LEAVE_DAYS,
    MONTHLY_ACCRUAL_DAYS,
    MAX_ACTIVE_YEARS,
    MAX_ACTIVE_MONTHS,
    MAX_ACTIVE_ENTITLEMENT_DAYS,
    DAYS_PER_YEAR,
    MAX_TAKEN_DAYS_PER_REQUEST,
    MAX_MATERNITY_TAKEN_DAYS,
} = LEAVE_POLICY;

function isDevLeaveCalc() {
    return typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production";
}

function warnLeaveCalc(message, extra) {
    if (!isDevLeaveCalc()) return;
    console.warn("[leaveCalculator]", message, extra || "");
}

export function isHrStaffCode(value) {
    return HR_STAFF_CODE_RE.test(String(value || "").trim());
}

function hrStaffCode(value) {
    const s = String(value || "").trim();
    return isHrStaffCode(s) ? s.toLowerCase() : "";
}

function refId(value) {
    if (value == null || value === "") return "";
    if (typeof value === "object") return String(value._id || "").toLowerCase();
    return String(value).toLowerCase();
}

function maxTakenDaysForLeaveType(leaveType) {
    return /maternity|paternity/i.test(String(leaveType || ""))
        ? MAX_MATERNITY_TAKEN_DAYS
        : MAX_TAKEN_DAYS_PER_REQUEST;
}

function leaveDatesWereReplaced(req) {
    const remarks = String(req?.changeRemarks || "");
    if (/approved leave dates unchanged/i.test(remarks)) return false;
    return /leave end date updated|returned earlier|vacation extended/i.test(remarks);
}

export const calculateLeaveDays = (startDate, endDate, leaveDaysOverride = null) => {
    if (leaveDaysOverride != null && leaveDaysOverride !== "") {
        const stored = Number(leaveDaysOverride);
        if (Number.isFinite(stored) && stored >= 0) return stored;
    }
    const s = toLeaveCalendarDate(startDate);
    const e = toLeaveCalendarDate(endDate);
    if (!s || !e) return null;
    const days = Math.round((utcDay(e) - utcDay(s)) / MS_PER_DAY);
    if (days < 0) return null;
    // Excel Master Tracker: END − START. Same calendar day counts as 1 for live requests.
    return days === 0 ? 1 : days;
};

export function leaveRequestDays(req) {
    if (!req) return 0;
    if (req.excludeFromBalance) return 0;

    const maxDays = maxTakenDaysForLeaveType(req.leaveType);
    const storedRaw = req.leaveDays;
    const stored = storedRaw != null && storedRaw !== "" ? Number(storedRaw) : NaN;
    const hasStored = Number.isFinite(stored) && stored >= 0;

    // Trust a stored Excel/form day count only when it is a plausible leave length.
    if (hasStored && stored <= maxDays) return stored;

    if (leaveDatesWereReplaced(req)) return 0;

    const span = calculateLeaveDays(req.startDate, req.endDate) || 0;
    if (span > maxDays || (hasStored && stored > maxDays)) {
        warnLeaveCalc("excluded implausible leave days from Taken", {
            leaveId: req._id || null,
            employeeId: req.linkedEmployeeCode || req.employeeId || null,
            employeeName: req.employeeName || null,
            startDate: req.startDate,
            endDate: req.endDate,
            leaveDays: hasStored ? stored : null,
            spanDays: span,
        });
        return 0;
    }
    return span;
}

function getExcelYearTaken(employee, year) {
    const map = employee?.excelLeaveYearTaken;
    if (!map || typeof map !== "object") return null;
    const v = map[year] ?? map[String(year)];
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function isExcelImportedLeave(req) {
    return String(req?.importSource || "") === "excel-master-tracker";
}

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

/** Default Till Date = the calculation/report date (Excel TILL column). */
export function getLeaveTillDate(asOf = new Date()) {
    return toLeaveCalendarDate(asOf) || toLeaveCalendarDate(new Date());
}

/**
 * Rolling 5-year active window (Master Tracker CALCULATE LEAVE).
 * Window start = 1 Jan of (calculation year − 5), e.g. 2026 → 2021-01-01, 2027 → 2022-01-01.
 * Effective start = MAX(DOJ, window start). Never accrues before DOJ.
 */
export function getActiveLeaveWindow(calculationDateInput = null, joiningDate = null) {
    const end = toLeaveCalendarDate(calculationDateInput) || toLeaveCalendarDate(new Date());
    const join = toLeaveCalendarDate(joiningDate);
    const windowStart = new Date(end.getFullYear() - MAX_ACTIVE_YEARS, 0, 1);

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
export function leaveDaysOverlappingRange(leaveStart, leaveEnd, rangeStart, rangeEnd, leaveDaysOverride = null) {
    const start = toLeaveCalendarDate(leaveStart);
    const end = toLeaveCalendarDate(leaveEnd) || start;
    const rangeFrom = toLeaveCalendarDate(rangeStart);
    const rangeTo = toLeaveCalendarDate(rangeEnd);
    if (!start || !end || !rangeFrom || !rangeTo) return 0;

    const overlapStart = start > rangeFrom ? start : rangeFrom;
    const overlapEnd = end < rangeTo ? end : rangeTo;
    if (overlapStart > overlapEnd) return 0;

    return calculateLeaveDays(overlapStart, overlapEnd, leaveDaysOverride) || 0;
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
    const approved = getApprovedLeavesForEmployee(employee, allLeaveRequests).filter(
        (req) => leaveRequestDays(req) > 0
    );
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

    const approved = getApprovedLeavesForEmployee(employee, allLeaveRequests).filter(
        (req) => leaveRequestDays(req) > 0
    );
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

    const empMongoId = refId(emp._id || emp.id);
    const empStaffCode = hrStaffCode(emp.employeeId);
    const empEmail = String(emp.emailId || "").trim().toLowerCase();

    const reqStaffCode = hrStaffCode(req.linkedEmployeeCode) || hrStaffCode(req.employeeId);
    // A leave labeled with a different HR staff code must never enter this employee.
    if (empStaffCode && reqStaffCode && empStaffCode !== reqStaffCode) {
        warnLeaveCalc("skipped leave with mismatched employee ID", {
            leaveId: req._id || null,
            selectedEmployeeId: empStaffCode,
            leaveEmployeeId: reqStaffCode,
        });
        return false;
    }

    const recordId = refId(req.employeeRecordId);
    if (empMongoId && recordId && recordId === empMongoId) return true;

    if (empStaffCode && reqStaffCode && empStaffCode === reqStaffCode) return true;

    const reqRef = refId(req.employee);
    if (empMongoId && reqRef && reqRef === empMongoId) return true;

    const userEmpId = refId(req.employee?.employeeId);
    if (userEmpId && empMongoId && userEmpId === empMongoId) return true;

    if (req.employeeId) {
        const rid = String(req.employeeId).toLowerCase();
        if (empMongoId && rid === empMongoId) return true;
        if (empStaffCode && rid === empStaffCode) return true;
    }

    const hasEmployeeRef = Boolean(
        reqRef ||
        req.employeeId ||
        req.employeeRecordId ||
        req.linkedEmployeeCode ||
        req.employee?.employeeId
    );

    // Email is a fallback only when the leave has no staff code / record id.
    if (!reqStaffCode && !recordId && empEmail && empEmail.includes("@")) {
        const reqEmail = String(req.employee?.emailId || "").trim().toLowerCase();
        if (reqEmail && reqEmail === empEmail) return true;
    }

    if (!hasEmployeeRef) {
        const reqName = String(req.employeeName || "").toLowerCase().trim();
        const empName = String(emp.employeeName || emp.name || "").toLowerCase().trim();
        if (reqName && empName && reqName === empName) return true;
    }

    return false;
}

function dedupeLeaveRequests(rows) {
    const seen = new Set();
    return (rows || []).filter((req) => {
        const id = String(req?._id || "");
        if (!id) return true;
        if (seen.has(id)) {
            warnLeaveCalc("skipped duplicate leave record", { leaveId: id });
            return false;
        }
        seen.add(id);
        return true;
    });
}

export function filterLeavesForEmployee(employee, allLeaveRequests, options = {}) {
    const { statuses = null } = options;
    return dedupeLeaveRequests(allLeaveRequests).filter((req) => {
        if (statuses && !statuses.has(req.status)) return false;
        return matchesLeaveEmployee(req, employee);
    });
}

export function getApprovedLeavesForEmployee(employee, allLeaveRequests) {
    return dedupeLeaveRequests(allLeaveRequests).filter(
        (req) => APPROVED_LEAVE_STATUSES.has(req.status) && matchesLeaveEmployee(req, employee)
    );
}

/** Assign leave days to the start-date calendar year (Excel yearly-sheet convention). */
export function yearWiseLeaveTakenInWindow(employee, allLeaveRequests, rangeStart, rangeEnd) {
    const byYear = {};
    const liveBeforeImportByYear = {};
    const liveAfterImportByYear = {};
    const rangeFrom = toLeaveCalendarDate(rangeStart);
    const rangeTo = toLeaveCalendarDate(rangeEnd);
    if (!rangeFrom || !rangeTo) return byYear;

    const hasExcelMap =
        employee?.excelLeaveYearTaken != null && typeof employee.excelLeaveYearTaken === "object";
    const currentYear = rangeTo.getFullYear();
    const importAt = toLeaveCalendarDate(employee?.excelLeaveImportedAt);

    getApprovedLeavesForEmployee(employee, allLeaveRequests).forEach((req) => {
        const start = toLeaveCalendarDate(req.startDate);
        if (!start) return;
        const year = start.getFullYear();
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        if (yearEnd < rangeFrom || yearStart > rangeTo) return;
        if (year > currentYear) return;
        const days = leaveRequestDays(req);
        if (!days) return;
        if (!isExcelImportedLeave(req)) {
            // Split live leave around Excel import time so a vacation already
            // reflected in the Excel year cell is not counted again.
            if (importAt && start > importAt) {
                liveAfterImportByYear[year] = (liveAfterImportByYear[year] || 0) + days;
            } else {
                liveBeforeImportByYear[year] = (liveBeforeImportByYear[year] || 0) + days;
            }
        }
        byYear[year] = (byYear[year] || 0) + days;
    });

    const startYear = rangeFrom.getFullYear();
    const endYear = Math.min(rangeTo.getFullYear(), currentYear);
    for (let year = startYear; year <= endYear; year += 1) {
        const excelVal = getExcelYearTaken(employee, year);
        const before = liveBeforeImportByYear[year] || 0;
        const after = liveAfterImportByYear[year] || 0;
        if (hasExcelMap) {
            const excelDays = excelVal == null ? 0 : excelVal;
            if (year < currentYear) {
                // Closed years in the imported map are complete (0 means no leave).
                byYear[year] = roundLeaveNumber(excelDays);
            } else {
                // Current year: Excel cell is a snapshot through import.
                // Live leave that started on/before import replaces that cell
                // (max) instead of adding to it — otherwise 30+31=61 for one trip.
                // Live leave that started after import is truly additional.
                const excelOrReentry = before > 0 ? Math.max(excelDays, before) : excelDays;
                byYear[year] = roundLeaveNumber(excelOrReentry + after);
            }
        } else if (byYear[year] != null) {
            byYear[year] = roundLeaveNumber(byYear[year]);
        } else {
            byYear[year] = 0;
        }
    }
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
 * Active entitlement from DOJ and the calculation date: completed months × 2.5, cap 150.
 */
export function calculateEntitlementDays(joiningDate, calculationDateInput = null) {
    const calcDate = toLeaveCalendarDate(calculationDateInput) || toLeaveCalendarDate(new Date());
    const join = toLeaveCalendarDate(joiningDate);
    const { effectiveStart } = getActiveLeaveWindow(calcDate, join);
    const months = Math.min(countCompletedMonths(effectiveStart, calcDate), MAX_ACTIVE_MONTHS);
    return Math.min(accrueLeaveDays(months), MAX_ACTIVE_ENTITLEMENT_DAYS);
}

/**
 * Central leave summary.
 *
 * Entitlement = min(completed months, 60) × 2.5
 * Taken       = this employee’s leave in the rolling 5-year window (Excel year map by staff ID)
 * Available   = entitlement − taken
 * Expired     = months accrued before the active window
 */
export function computeExcelLeaveCalculation(employee, allLeaveRequests, calculationDateInput = null) {
    const calcDate = toLeaveCalendarDate(calculationDateInput) || toLeaveCalendarDate(new Date());
    const joiningDate = toLeaveCalendarDate(employee?.doj);
    const { windowStart, effectiveStart } = getActiveLeaveWindow(calcDate, joiningDate);
    const takenRangeStart = getTakenLeaveRangeStart(calcDate, joiningDate);

    const totalEligibleMonths = joiningDate ? countCompletedMonths(joiningDate, calcDate) : 0;
    const activeEligibleMonthsRaw = countCompletedMonths(effectiveStart, calcDate);
    const activeEligibleMonths = Math.min(activeEligibleMonthsRaw, MAX_ACTIVE_MONTHS);

    const workingDays = excelDateDiffDays(calcDate, effectiveStart);
    const totalWorkingDays = joiningDate ? excelDateDiffDays(calcDate, joiningDate) : workingDays;
    // Excel yrs / LEAVE DUE use day-count years. Entitlement does not.
    const workingYearsExact = workingDays / DAYS_PER_YEAR;
    const workingYears = roundLeaveNumber(workingYearsExact);

    const totalAccruedDays = accrueLeaveDays(totalEligibleMonths);
    const windowAccruedUncapped = accrueLeaveDays(activeEligibleMonthsRaw);
    const entitlement = calculateEntitlementDays(joiningDate, calcDate);
    const expiredDays = roundLeaveNumber(Math.max(totalAccruedDays - windowAccruedUncapped, 0));
    const windowYearsForAverage = Math.min(Math.max(workingYearsExact, 0), MAX_ACTIVE_YEARS);

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

    const averageLeave = roundLeaveNumber(
        windowYearsForAverage > 0 ? totalTaken / windowYearsForAverage : 0
    );
    const availableDays = roundLeaveNumber(entitlement - totalTaken);

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
        balance: availableDays,
        leaveDue: availableDays,
        availableDays,
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

/** Alias used by API docs / one-function contract. */
export function calculateEmployeeLeaveSummary(employee, allLeaveRequests, calculationDate = null) {
    const calc = computeExcelLeaveCalculation(employee, allLeaveRequests, calculationDate);
    return {
        employeeId: employee?.employeeId || "",
        employeeName: employee?.employeeName || employee?.name || "",
        doj: calc.joiningDate,
        currentDate: calc.calculationDate,
        rollingWindowStart: calc.windowStart,
        rollingWindowEnd: calc.calculationDate,
        entitlement: calc.entitlement,
        activeTaken: calc.activeTakenDays,
        expired: calc.expiredDays,
        available: calc.availableDays,
        historicalTaken: calc.historicalTakenDays,
        yearlyLeave: calc.historicalYearTotals,
        workingYears: calc.workingYears,
        last5Years: calc.last5Years,
    };
}
