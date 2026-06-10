export const CALENDAR_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const DEFAULT_MIN_YEAR = 1950;

export const getDefaultMaxYear = () => new Date().getFullYear() + 10;

export const buildYearOptions = (minYear = DEFAULT_MIN_YEAR, maxYear = getDefaultMaxYear()) => {
  const start = Math.min(minYear, maxYear);
  const end = Math.max(minYear, maxYear);
  return Array.from({ length: end - start + 1 }, (_, i) => end - i);
};

export const clampDayToMonth = (day, year, month) => {
  if (!day) return null;
  const maxDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, maxDay);
};
