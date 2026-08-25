/**
 * Shared HR Metrics analytics layer.
 * KPIs, charts, and drill-downs must all derive from the same filtered employee set.
 */
import {
  getAgeAsOf,
  getSalaryAmount,
  isWithinRange,
  toDate,
  yearRangeBounds,
  employeeInWorkforceRange,
  MONTH_NAMES,
} from "./hrMetricsFilters";
import {
  isNonWorkingEmployeeStatus,
  isWorkingEmployeeStatus,
} from "./employeeStatusDisplay";

export const NOT_SPECIFIED = "Not Specified";

/** Unique employee key — prefer Mongo _id, then employeeId code. */
export const employeeKey = (employee) => {
  const id = employee?._id || employee?.id;
  if (id) return `id:${String(id)}`;
  const code = employee?.employeeId || employee?.employeeNumber;
  if (code) return `code:${String(code).trim().toLowerCase()}`;
  const name = String(employee?.employeeName || "").trim().toLowerCase();
  return name ? `name:${name}` : "";
};

/** Deduplicate employees by unique key (first occurrence wins). */
export const dedupeEmployees = (employees = []) => {
  const seen = new Set();
  const out = [];
  for (const employee of employees) {
    const key = employeeKey(employee);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(employee);
  }
  return out;
};

export const categoryLabel = (value) => {
  const label = String(value ?? "").trim();
  return label || NOT_SPECIFIED;
};

export const matchesCategory = (value, selected) =>
  categoryLabel(value) === categoryLabel(selected);

export const getDesignation = (employee) =>
  employee?.designation || employee?.role || "";

export const getLocation = (employee) => employee?.office || "";

export const resolvePeriodRange = ({ year, month, startDate, endDate, activeYear }) => {
  if (startDate && endDate) {
    const start = toDate(startDate);
    const end = toDate(endDate);
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // Year = All → no workforce date window (same pool as Dashboard total headcount)
  if (!year || year === "All") {
    return { start: null, end: null };
  }
  const y = year;
  return yearRangeBounds(y, month && month !== "All" ? month : "All");
};

/**
 * Apply dashboard filters once. All KPIs/charts/drill-downs use this list.
 */
export const applyDashboardFilters = (employees, filters, periodRange) => {
  const list = dedupeEmployees(employees);
  return list.filter((employee) => {
    if (!employeeInWorkforceRange(employee, periodRange)) return false;
    if (filters.department !== "All" && !matchesCategory(employee.department, filters.department)) {
      return false;
    }
    if (
      filters.designation !== "All" &&
      !matchesCategory(getDesignation(employee), filters.designation)
    ) {
      return false;
    }
    if (filters.location !== "All" && !matchesCategory(getLocation(employee), filters.location)) {
      return false;
    }
    if (
      filters.employeeType !== "All" &&
      !matchesCategory(employee.employeeStatus, filters.employeeType)
    ) {
      return false;
    }
    if (filters.gender !== "All" && !matchesCategory(employee.gender, filters.gender)) {
      return false;
    }
    return true;
  });
};

export const getNewJoiners = (workforce, periodRange) =>
  workforce.filter((employee) => isWithinRange(employee.doj, periodRange));

/**
 * Exits: non-working status AND last working day in the selected period.
 * Notice/provision alone does not count as exit.
 */
export const getPeriodExits = (workforce, periodRange) =>
  workforce.filter(
    (employee) =>
      isNonWorkingEmployeeStatus(employee.employeeStatus) &&
      employee.lastWorkingDay &&
      isWithinRange(employee.lastWorkingDay, periodRange)
  );

export const getActiveEmployees = (workforce) =>
  workforce.filter((employee) => isWorkingEmployeeStatus(employee.employeeStatus));

export const getEmployeesWithValidAge = (workforce, asOfDate) =>
  workforce.filter((employee) => getAgeAsOf(employee, asOfDate) != null);

export const getEmployeesWithSalary = (workforce) =>
  workforce.filter((employee) => {
    const amount = getSalaryAmount(employee);
    return Number.isFinite(amount) && amount > 0;
  });

/** Headcount at a point in time within the filtered workforce. */
export const headcountAsOf = (workforce, asOf) => {
  if (!asOf) return workforce.length;
  return workforce.filter((employee) => {
    const joinDate = toDate(employee.doj || employee.createdAt);
    if (joinDate && joinDate > asOf) return false;
    const lastWorkingDay = toDate(employee.lastWorkingDay);
    if (lastWorkingDay && lastWorkingDay < asOf) return false;
    return true;
  }).length;
};

/**
 * Attrition % = (Exits during period / Average headcount during period) × 100
 * Average headcount = (headcount at period start + headcount at period end) / 2
 */
export const computeAttritionPercent = (workforce, exits, periodRange) => {
  if (!exits.length) return 0;
  let denominator = workforce.length;
  if (periodRange?.start && periodRange?.end) {
    const startHc = headcountAsOf(workforce, periodRange.start);
    const endHc = headcountAsOf(workforce, periodRange.end);
    denominator = (startHc + endHc) / 2;
  }
  if (!denominator) return null;
  return (exits.length / denominator) * 100;
};

export const computeKpis = (workforce, periodRange, asOfDate) => {
  const active = getActiveEmployees(workforce);
  const joiners = getNewJoiners(workforce, periodRange);
  const exits = getPeriodExits(workforce, periodRange);
  const withAge = getEmployeesWithValidAge(workforce, asOfDate);
  const withSalary = getEmployeesWithSalary(workforce);
  const ages = withAge.map((e) => getAgeAsOf(e, asOfDate));
  const salaries = withSalary.map(getSalaryAmount);

  return {
    totalEmployees: workforce.length,
    activeEmployees: active.length,
    newJoiners: joiners.length,
    totalExits: exits.length,
    averageAge: ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null,
    averageSalary: salaries.length
      ? salaries.reduce((s, a) => s + a, 0) / salaries.length
      : null,
    /** Master salary sum (current compensation). Prefer slip-based totalPayroll when slips exist. */
    masterSalaryTotal: salaries.length ? salaries.reduce((s, a) => s + a, 0) : null,
    attrition: computeAttritionPercent(workforce, exits, periodRange),
    lists: {
      workforce,
      active,
      joiners,
      exits,
      withAge,
      withSalary,
    },
  };
};

export const countByCategory = (items, accessor) => {
  const counts = new Map();
  items.forEach((item) => {
    const label = categoryLabel(accessor(item));
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

export const addPercentages = (items) => {
  const total = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  return items.map((item) => ({
    ...item,
    percentage: total ? ((Number(item.value) || 0) / total) * 100 : 0,
  }));
};

export const filterByDepartment = (workforce, name) =>
  workforce.filter((e) => matchesCategory(e.department, name));

export const filterByDesignation = (workforce, name) =>
  workforce.filter((e) => matchesCategory(getDesignation(e), name));

export const filterByLocation = (workforce, name) =>
  workforce.filter((e) => matchesCategory(getLocation(e), name));

export const filterByGender = (workforce, name) =>
  workforce.filter((e) => matchesCategory(e.gender, name));

export const filterByNationality = (workforce, name) =>
  workforce.filter((e) => matchesCategory(e.nationality, name));

export const filterByAgeBand = (workforce, min, max, asOfDate) =>
  workforce.filter((employee) => {
    const age = getAgeAsOf(employee, asOfDate);
    if (age == null) return false;
    if (age < min) return false;
    if (Number.isFinite(max) && age > max) return false;
    return true;
  });

export const filterBySalaryBand = (workforce, min, max) =>
  workforce.filter((employee) => {
    const salary = getSalaryAmount(employee);
    if (!Number.isFinite(salary) || salary <= 0) return false;
    if (min != null && salary < min) return false;
    if (max != null && salary > max) return false;
    return true;
  });

export const filterByExitStatus = (exits, statusName) =>
  exits.filter((e) => matchesCategory(e.employeeStatus, statusName));

export const filterByOtherCategories = (workforce, accessor, otherNames) => {
  const set = new Set((otherNames || []).map(categoryLabel));
  return workforce.filter((e) => set.has(categoryLabel(accessor(e))));
};

export const slipMatchesEmployee = (slip, employee) => {
  const slipEmail = String(slip.emailId || "").trim().toLowerCase();
  const empEmail = String(employee.emailId || "").trim().toLowerCase();
  if (slipEmail && empEmail && slipEmail === empEmail) return true;
  const slipName = String(slip.employeeName || "").trim().toLowerCase();
  const empName = String(employee.employeeName || "").trim().toLowerCase();
  return Boolean(slipName && empName && slipName === empName);
};

export const filterSalarySlipsForWorkforce = (slips, workforce, periodRange, filters) => {
  const monthFilter =
    filters.month && filters.month !== "All" ? String(filters.month).toLowerCase() : null;
  const yearFilter = filters.year && filters.year !== "All" ? String(filters.year) : null;

  return (slips || []).filter((slip) => {
    if (yearFilter && String(slip.year) !== yearFilter) return false;
    if (monthFilter) {
      const slipMonth = String(slip.month || "").trim().toLowerCase();
      if (slipMonth !== monthFilter) return false;
    }
    return workforce.some((employee) => slipMatchesEmployee(slip, employee));
  });
};

export const sumPayrollFromSlips = (slips) => {
  if (!slips?.length) return null;
  // One slip per employee-month (unique email+month+year on server). Sum net pay.
  const total = slips.reduce((sum, slip) => {
    const amount =
      Number(slip.netSalary) ||
      Number(slip.grossSalary) ||
      Number(slip.totalSalary) ||
      0;
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  return total;
};

export const formatDateDisplay = (value) => {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-GB");
};

export const buildEmployeeDrillRows = (employees, asOfDate) =>
  (employees || []).map((employee, index) => ({
    key: employeeKey(employee) || String(index),
    employeeName: employee.employeeName || "—",
    employeeId: employee.employeeId || "—",
    department: categoryLabel(employee.department),
    designation: categoryLabel(getDesignation(employee)),
    doj: formatDateDisplay(employee.doj),
    lastWorkingDay: formatDateDisplay(employee.lastWorkingDay),
    status: categoryLabel(employee.employeeStatus || "Active"),
    location: categoryLabel(getLocation(employee)),
    gender: categoryLabel(employee.gender),
    nationality: categoryLabel(employee.nationality),
    dateOfBirth: formatDateDisplay(employee.dateOfBirth),
    age: getAgeAsOf(employee, asOfDate) ?? "—",
    salary: getSalaryAmount(employee) || 0,
  }));

export const buildPayrollDrillRows = (slips) =>
  (slips || []).map((slip, index) => ({
    key: slip._id || `${slip.emailId}-${slip.month}-${slip.year}-${index}`,
    employeeName: slip.employeeName || "—",
    emailId: slip.emailId || "—",
    department: categoryLabel(slip.department),
    designation: categoryLabel(slip.designation),
    month: slip.month || "—",
    year: slip.year || "—",
    basicPay: Number(slip.basicPay) || 0,
    hra: Number(slip.hra) || 0,
    conveyanceAllowance: Number(slip.conveyanceAllowance) || 0,
    otherAllowance: Number(slip.otherAllowance) || 0,
    totalDeduction: Number(slip.totalDeduction) || 0,
    grossSalary: Number(slip.grossSalary) || 0,
    netSalary: Number(slip.netSalary) || 0,
  }));

export { MONTH_NAMES, getAgeAsOf, getSalaryAmount, isWithinRange, toDate };
