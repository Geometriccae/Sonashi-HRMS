/**
 * Period helpers for Salary Slips list / bulk download / Excel.
 * Slips are keyed by month name + year (no payroll recalculation).
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const PERIOD_PRESETS = [
  { value: "today", label: "Today" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

const toDayStart = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const match = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const monthIndex = (monthName) => {
  const idx = MONTH_NAMES.findIndex(
    (m) => m.toLowerCase() === String(monthName || "").trim().toLowerCase()
  );
  return idx >= 0 ? idx : null;
};

/** First and last calendar day of the slip's payroll month. */
export const slipPeriodBounds = (slip) => {
  const mi = monthIndex(slip?.month);
  const year = Number(String(slip?.year || "").trim());
  if (mi == null || !Number.isFinite(year)) return null;
  const start = new Date(year, mi, 1);
  const end = new Date(year, mi + 1, 0);
  return { start, end };
};

/** API month/year query derived from a period preset (avoids fetching all history). */
export const fetchParamsForPeriod = (period, customFrom, customTo, now = new Date()) => {
  const today = toDayStart(now) || new Date();
  const year = String(today.getFullYear());
  const month = MONTH_NAMES[today.getMonth()];

  switch (period) {
    case "today":
      // Narrow to current year; client filters createdAt to today.
      return { month: "All", year };
    case "this_month":
      return { month, year };
    case "this_year":
      return { month: "All", year };
    case "custom": {
      const from = toDayStart(customFrom);
      const to = toDayStart(customTo);
      if (!from || !to) return { month: "All", year: "All" };
      if (from.getFullYear() === to.getFullYear()) {
        return { month: "All", year: String(from.getFullYear()) };
      }
      return { month: "All", year: "All" };
    }
    default:
      return { month: "All", year: "All" };
  }
};

/**
 * Whether a stored salary slip matches the selected period.
 * Today → slip created today (local calendar).
 * This Month / Year / Custom → payroll month/year overlap with the range.
 */
export const slipMatchesPeriod = (slip, period, customFrom, customTo, now = new Date()) => {
  if (!slip) return false;
  const today = toDayStart(now);
  if (!today) return false;

  if (period === "today") {
    const created = toDayStart(slip.createdAt || slip.updatedAt);
    return Boolean(created && created.getTime() === today.getTime());
  }

  if (period === "this_month") {
    const bounds = slipPeriodBounds(slip);
    if (!bounds) return false;
    return (
      bounds.start.getFullYear() === today.getFullYear() &&
      bounds.start.getMonth() === today.getMonth()
    );
  }

  if (period === "this_year") {
    return String(slip.year || "").trim() === String(today.getFullYear());
  }

  if (period === "custom") {
    const from = toDayStart(customFrom);
    const to = toDayStart(customTo);
    if (!from || !to) return false;
    const rangeStart = from <= to ? from : to;
    const rangeEnd = from <= to ? to : from;
    const bounds = slipPeriodBounds(slip);
    if (!bounds) return false;
    // Inclusive overlap of payroll month with [from, to].
    return bounds.start <= rangeEnd && bounds.end >= rangeStart;
  }

  return true;
};

export const filterSlipsByPeriod = (slips, period, customFrom, customTo, now = new Date()) => {
  const list = Array.isArray(slips) ? slips : [];
  return list.filter((slip) => slipMatchesPeriod(slip, period, customFrom, customTo, now));
};

export const periodZipLabel = (period, customFrom, customTo, now = new Date()) => {
  const today = toDayStart(now) || new Date();
  if (period === "today") {
    return `Today_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }
  if (period === "this_month") {
    return `${MONTH_NAMES[today.getMonth()]}_${today.getFullYear()}`;
  }
  if (period === "this_year") {
    return `Year_${today.getFullYear()}`;
  }
  if (period === "custom") {
    const from = String(customFrom || "").trim() || "from";
    const to = String(customTo || "").trim() || "to";
    return `Custom_${from}_to_${to}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  }
  return "Salary_Slips";
};

export const safePayslipFileName = (slip, usedNames = new Set()) => {
  const base = `Payslip_${String(slip?.employeeName || "Unknown").replace(/[^a-zA-Z0-9]/g, "_")}_${slip?.month || "Month"}_${slip?.year || "Year"}`;
  let name = `${base}.pdf`;
  let n = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${base}_${n}.pdf`;
    n += 1;
  }
  usedNames.add(name.toLowerCase());
  return name;
};
