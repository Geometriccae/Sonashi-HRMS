const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const HR_METRICS_STORAGE_KEY = "hr-metrics";
export const HR_METRICS_BASE_PATH = "/hr-metrics-dashboard";

export const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getYearFromDate = (value) => {
  const date = toDate(value);
  return date ? date.getFullYear() : null;
};

export const getAgeAsOf = (employee, asOfDate = new Date()) => {
  const dob = toDate(employee?.dateOfBirth);
  if (!dob) return null;
  const asOf = toDate(asOfDate) || new Date();
  let age = asOf.getFullYear() - dob.getFullYear();
  const hasBirthdayPassed =
    asOf.getMonth() > dob.getMonth() ||
    (asOf.getMonth() === dob.getMonth() && asOf.getDate() >= dob.getDate());
  if (!hasBirthdayPassed) age -= 1;
  return age >= 0 ? age : null;
};

export const yearRangeBounds = (year, month = "All") => {
  const numericYear = Number(year);
  if (!Number.isFinite(numericYear)) return { start: null, end: null };
  if (month && month !== "All") {
    const monthIndex = MONTH_NAMES.indexOf(month);
    if (monthIndex >= 0) {
      return {
        start: new Date(numericYear, monthIndex, 1, 0, 0, 0, 0),
        end: new Date(numericYear, monthIndex + 1, 0, 23, 59, 59, 999),
      };
    }
  }
  return {
    start: new Date(numericYear, 0, 1, 0, 0, 0, 0),
    end: new Date(numericYear, 11, 31, 23, 59, 59, 999),
  };
};

export const isWithinRange = (value, range) => {
  const date = toDate(value);
  if (!date) return false;
  if (range?.start && date < range.start) return false;
  if (range?.end && date > range.end) return false;
  return true;
};

/** Employee was on payroll / in workforce during the date range. */
export const employeeInWorkforceRange = (employee, range) => {
  if (!range?.start && !range?.end) return true;
  const joinDate = toDate(employee?.doj || employee?.createdAt);
  if (joinDate && range.end && joinDate > range.end) return false;
  const lastWorkingDay = toDate(employee?.lastWorkingDay);
  if (lastWorkingDay && range.start && lastWorkingDay < range.start) return false;
  return true;
};

/** Earliest employee joining year through the live current year. No future years. */
export const buildHrMetricsYearOptions = (employees = [], asOf = new Date()) => {
  const currentYear = asOf.getFullYear();
  let minYear = currentYear;
  (employees || []).forEach((employee) => {
    const year = getYearFromDate(employee?.doj || employee?.createdAt);
    if (year != null && year >= 1990 && year <= currentYear) {
      minYear = Math.min(minYear, year);
    }
  });
  const years = [];
  for (let year = currentYear; year >= minYear; year -= 1) years.push(String(year));
  return years;
};

const getSalaryAmount = (employee) => {
  const salary = employee?.salaryDetails || {};
  if (Number(salary.totalSalary) > 0) return Number(salary.totalSalary);
  const basic = Number(salary.basicSalary) || 0;
  const house = Number(salary.houseRent) || 0;
  const travel = Number(salary.travelExp) || 0;
  const other = Number(salary.other) || 0;
  const allowance = Number(salary.totalAllowance) || house + travel + other;
  const deduction = Number(salary.deduction) || 0;
  const total = basic + allowance - deduction;
  return total > 0 ? total : 0;
};

/**
 * Extra employee-list filters used by HR Metrics drill-down.
 * Existing Active/Inactive + search still apply separately.
 */
export const matchesHrMetricsListFilters = (employee, params, asOfDate) => {
  const year = params.year && params.year !== "All" ? params.year : "";
  const month = params.month && params.month !== "All" ? params.month : "All";
  const range = year ? yearRangeBounds(year, month) : null;

  if (range && !employeeInWorkforceRange(employee, range)) return false;

  if (params.joined === "1") {
    if (!range || !isWithinRange(employee.doj || employee.createdAt, range)) return false;
  }
  if (params.exited === "1") {
    if (!range || !isWithinRange(employee.lastWorkingDay, range)) return false;
  }
  if (params.gender && employee.gender !== params.gender) return false;
  if (params.department && employee.department !== params.department) return false;
  if (params.designation) {
    const role = employee.designation || employee.role;
    if (role !== params.designation) return false;
  }
  if (params.office && employee.office !== params.office) return false;
  if (params.nationality && employee.nationality !== params.nationality) return false;
  if (params.employeeType && employee.employeeStatus !== params.employeeType) return false;

  if (params.ageMin != null || params.ageMax != null) {
    const age = getAgeAsOf(employee, asOfDate || range?.end || new Date());
    if (age == null) return false;
    if (params.ageMin != null && age < Number(params.ageMin)) return false;
    if (params.ageMax != null && Number.isFinite(Number(params.ageMax)) && age > Number(params.ageMax)) return false;
  }

  if (params.salaryMin != null || params.salaryMax != null) {
    const salary = getSalaryAmount(employee);
    if (!salary) return false;
    if (params.salaryMin != null && salary < Number(params.salaryMin)) return false;
    if (params.salaryMax != null && salary > Number(params.salaryMax)) return false;
  }

  return true;
};

export const readHrMetricsListParams = (searchParams) => {
  const num = (key) => {
    const raw = searchParams.get(key);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return {
    year: searchParams.get("year") || "",
    month: searchParams.get("month") || "",
    gender: searchParams.get("gender") || "",
    department: searchParams.get("department") || "",
    designation: searchParams.get("designation") || "",
    office: searchParams.get("office") || "",
    nationality: searchParams.get("nationality") || "",
    employeeType: searchParams.get("employeeType") || "",
    joined: searchParams.get("joined") || "",
    exited: searchParams.get("exited") || "",
    ageMin: num("ageMin"),
    ageMax: num("ageMax"),
    salaryMin: num("salaryMin"),
    salaryMax: num("salaryMax"),
  };
};

export const buildEmployeeListPath = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value == null || value === "" || value === "All") return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `/teammanagement?${qs}` : "/teammanagement";
};

export const leaveMonthParam = (monthName) => {
  const index = MONTH_NAMES.indexOf(monthName);
  return index >= 0 ? String(index) : "";
};

export { MONTH_NAMES, getSalaryAmount };
