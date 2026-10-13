/**
 * Leave calculation utilities based on Auxin Shipping Leave Policy
 * 
 * Policy Summary:
 * - Annual Leave: 21 working days (Privilege Leave: 10, Casual Leave: 6, Sick Leave: 5)
 * - Leave is calculated on pro-rata basis: 1.75 days per completed month
 * - Only working days are counted (excludes weekends and public holidays)
 * - Leave year: April to March (Financial Year)
 */

// Official Holidays for 2026
const OFFICIAL_HOLIDAYS_2026 = [
    '2026-01-01', // New Year's Day (Thursday)
    '2026-01-26', // Republic Day (Monday)
    '2026-02-19', // Chhatrapati Shivaji Maharaj Jayanti (Thursday)
    '2026-03-03', // Holi (Tuesday)
    '2026-03-19', // Gudi Padwa (Thursday)
    '2026-03-21', // Ramzan Id (Saturday)
    '2026-03-26', // Ram Navmi (Thursday)
    '2026-03-31', // Mahavir Jayanti (Tuesday)
    '2026-04-03', // Good Friday (Friday)
    '2026-04-14', // Dr. Babasaheb Ambedkar Jayanti (Tuesday)
    '2026-05-01', // Maharashtra Day (Friday)
    '2026-06-26', // Muharram - Bakri-Eid (Friday)
    '2026-08-15', // Independence Day / Parsi New Year (Saturday)
    '2026-08-26', // Eid-A-Milad (Wednesday)
    '2026-08-28', // Raksha Bandhan (Thursday)
    '2026-09-14', // Ganesh Chaturti (Monday)
    '2026-10-02', // Mahatma Gandhi Jayanti (Friday)
    '2026-10-20', // Dasara (Tuesday)
    '2026-11-06', // Diwali-Laxmi Pujan (Friday)
    '2026-11-10', // Diwali-Padva (Tuesday)
    '2026-11-11', // Diwali-Bhaubij (Wednesday)
    '2026-11-24', // Guru Nanak Jayanti (Tuesday)
    '2026-12-25', // Christmas (Friday)
];

// Convert dates to a Set for faster lookup (normalized to date-only strings)
const holidaySet = new Set(OFFICIAL_HOLIDAYS_2026);

/**
 * Check if a date is a weekend (Saturday or Sunday)
 * @param {Date} date - The date to check
 * @returns {boolean} - True if weekend
 */
function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if a date is a public holiday
 * @param {Date} date - The date to check
 * @returns {boolean} - True if public holiday
 */
function isPublicHoliday(date) {
    const dateString = formatDateString(date);
    return holidaySet.has(dateString);
}

/**
 * Format date to YYYY-MM-DD string
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Calculate the number of working days between two dates (inclusive)
 * Excludes weekends (Saturday and Sunday) and public holidays
 * 
 * @param {Date} startDate - Start date of the leave period
 * @param {Date} endDate - End date of the leave period
 * @returns {number} - Number of working days
 */
function calculateWorkingDays(startDate, endDate) {
    let workingDays = 0;
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Normalize to start of day to avoid timezone issues
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Iterate through each day
    const currentDate = new Date(start);
    while (currentDate <= end) {
        // Only count if it's not a weekend and not a public holiday
        if (!isWeekend(currentDate) && !isPublicHoliday(currentDate)) {
            workingDays++;
        }
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
}

/**
 * Calculate leave entitlement based on months of service
 * Pro-rata calculation: 1.75 days per completed month
 * 
 * @param {number} monthsOfService - Number of completed months
 * @returns {number} - Leave entitlement in days
 */
function calculateProRataLeave(monthsOfService) {
    const MONTHLY_ACCRUAL_RATE = 2.5;
    const MAX_ANNUAL_LEAVE = 30;

    const calculatedLeave = monthsOfService * MONTHLY_ACCRUAL_RATE;
    return Math.min(calculatedLeave, MAX_ANNUAL_LEAVE);
}

/**
 * Default annual leave balance for confirmed employees
 */
const DEFAULT_ANNUAL_LEAVE = 30;

/**
 * Leave accrual rate per month
 */
const MONTHLY_LEAVE_ACCRUAL = 2.5;

module.exports = {
    calculateWorkingDays,
    isWeekend,
    isPublicHoliday,
    calculateProRataLeave,
    DEFAULT_ANNUAL_LEAVE,
    MONTHLY_LEAVE_ACCRUAL,
    OFFICIAL_HOLIDAYS_2026
};
