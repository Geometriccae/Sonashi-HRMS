/**
 * Pure date-formatting helpers for vacation-related display.
 * No React or router imports — safe to use in tests and utility modules.
 */

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
export const displayLastWorkingDay = (item) => fmtDate(item?.lastWorkingDay);

