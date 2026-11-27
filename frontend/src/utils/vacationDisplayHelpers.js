/**
 * Pure date-formatting helpers for vacation-related display.
 * No React or router imports — safe to use in tests and utility modules.
 */

import { calculateLeaveDays, excelDateDiffDays } from "./leaveCalculator";

/**
 * Formats a date value to DD/MM/YYYY for display in tables and exports.
 * Returns "—" when the value is absent, empty, or invalid.
 *
 * @param {string|Date|null|undefined} d
 * @returns {string}
 */
export const fmtDate = (d) => {
  if (!d) return "—";
  try {
    if (typeof d === "string") {
      const dateOnly = d.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
    }
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    const day = String(dt.getDate()).padStart(2, "0");
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "—";
  }
};

/**
 * Returns the formatted Last Working Day for a vacation item.
 * Intentionally has NO fallback to startDate, travellingDate, leaveEndDate,
 * returnDate, or any other field — if lastWorkingDay is blank, "—" is shown.
 *
 * @param {{ lastWorkingDay?: string|Date|null }} item
 * @returns {string}
 */
export const displayLastWorkingDay = (item) => {
  if (item?.vacationStatus === "Vacation Pending" || item?.vacationStatus === "Yet to Go") {
    return "—";
  }
  return fmtDate(item?.lastWorkingDay);
};

/**
 * Formats a day count for vacation tables/exports (e.g. "63 Days").
 * Returns "—" when missing or invalid. Never shows negative values.
 *
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
export const formatDaysCount = (n) => {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return "—";
  const days = Math.floor(v);
  return `${days} ${days === 1 ? "Day" : "Days"}`;
};

/**
 * Days of Vacation for Yet To Go / On Vacation rows.
 * Uses API daysOfVacation when present; otherwise derives from leaveDays or
 * the same Travelling Date → Leave End Date already shown on the row.
 *
 * @param {object} item
 * @returns {string}
 */
export const displayDaysOfVacation = (item) => {
  if (item?.daysOfVacation != null && item.daysOfVacation !== "") {
    return formatDaysCount(item.daysOfVacation);
  }
  if (item?.leaveDays != null && item.leaveDays !== "") {
    return formatDaysCount(item.leaveDays);
  }
  const start = item?.travellingDate || item?.startDate || null;
  const end = item?.leaveEndDate || item?.endDate || null;
  return formatDaysCount(calculateLeaveDays(start, end));
};

/**
 * Remaining days until expected return — recomputed from today so the value
 * stays correct without editing the leave record (Leave Management END−START).
 *
 * @param {{ leaveEndDate?: string|Date|null, endDate?: string|Date|null, remainingDays?: number|null }} item
 * @returns {string}
 */
export const displayRemainingDays = (item) => {
  const end = item?.leaveEndDate || item?.endDate;
  if (end) {
    return formatDaysCount(excelDateDiffDays(end, new Date()));
  }
  return formatDaysCount(item?.remainingDays);
};

/**
 * Returned Back Total Days: Last Working Day → First Working Day.
 *
 * @param {object} item
 * @returns {string}
 */
export const displayTotalDays = (item) => {
  const fromDates = calculateLeaveDays(item?.lastWorkingDay, item?.firstWorkingDay);
  if (fromDates != null) return formatDaysCount(fromDates);
  return formatDaysCount(item?.totalDays);
};

