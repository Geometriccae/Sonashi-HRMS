import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Button, Modal, Table } from "antd";
import styles from "./HrMetricsDashboard.module.css";
import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";
import attendanceService from "../services/AttendanceService";
import salarySlipService from "../services/SalarySlipService";
import {
  isNonWorkingEmployeeStatus,
  isWorkingEmployeeStatus,
} from "../utils/employeeStatusDisplay";
import { calculateLeaveBalance, calculateLeaveDays } from "../utils/leaveCalculator";
import { CURRENCY_CODE } from "../utils/currency";
import { writePersistedPath } from "../hooks/usePersistedListPage";
import {
  HR_METRICS_BASE_PATH,
  HR_METRICS_STORAGE_KEY,
  buildEmployeeListPath,
  buildHrMetricsYearOptions,
  employeeInWorkforceRange,
  getAgeAsOf,
  getSalaryAmount as getSalaryAmountFromFilters,
  leaveMonthParam,
  yearRangeBounds,
} from "../utils/hrMetricsFilters";

const MONTH_NAMES = [
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

const PIE_COLORS = ["#3b82f6", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9"];
const DEFAULT_CATEGORY_LIMIT = 8;
const NATIONALITY_CATEGORY_LIMIT = 5;

const emptyAttendanceSummary = {
  percentage: null,
  present: 0,
  absent: null,
  late: null,
  leave: 0,
  totalRecords: 0,
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.employees)) return value.employees;
  return [];
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value) => {
  const date = toDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value) => {
  const date = toDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const formatCount = (value) => {
  if (value == null) return "No data";
  return Number(value).toLocaleString();
};

const formatPercent = (value) => {
  if (value == null) return "No data";
  return `${Number(value).toFixed(1)}%`;
};

const formatCurrency = (value) => {
  if (value == null) return "No data";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: CURRENCY_CODE,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
};

const getSalaryAmount = getSalaryAmountFromFilters;

const getValueLabelPairs = (items, accessor) => {
  const counts = new Map();
  items.forEach((item) => {
    const label = String(accessor(item) || "Unspecified").trim() || "Unspecified";
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const addPercentages = (items) => {
  const total = items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  return items.map((item) => ({
    ...item,
    percentage: total ? ((Number(item.value) || 0) / total) * 100 : 0,
  }));
};

const limitCategories = (items, limit = DEFAULT_CATEGORY_LIMIT) => {
  if (items.length <= limit) return addPercentages(items);

  const topItems = items.slice(0, limit);
  const otherValue = items.slice(limit).reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const grouped = otherValue > 0
    ? [...topItems, { name: "Other", value: otherValue, isOther: true }]
    : topItems;
  return addPercentages(grouped);
};

const truncateLabel = (value, maxLength = 18) => {
  const label = String(value || "");
  if (label.length <= maxLength) return label;
  return `${label.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const getAgeBands = (employees, asOfDate) => {
  const buckets = [
    { name: "18-25", min: 18, max: 25, value: 0 },
    { name: "26-35", min: 26, max: 35, value: 0 },
    { name: "36-45", min: 36, max: 45, value: 0 },
    { name: "46-55", min: 46, max: 55, value: 0 },
    { name: "56+", min: 56, max: Infinity, value: 0 },
  ];

  employees.forEach((employee) => {
    const age = getAgeAsOf(employee, asOfDate);
    if (age == null) return;
    const bucket = buckets.find((item) => age >= item.min && age <= item.max);
    if (bucket) bucket.value += 1;
  });

  return buckets;
};

const getSalaryBands = (employees) => {
  const salaries = employees
    .map(getSalaryAmount)
    .filter((amount) => Number.isFinite(amount) && amount > 0)
    .sort((a, b) => a - b);

  if (!salaries.length) return [];

  const min = salaries[0];
  const max = salaries[salaries.length - 1];

  if (min === max) {
    return [{ name: formatCurrency(min), value: salaries.length }];
  }

  const bandCount = Math.min(5, salaries.length);
  const step = Math.ceil((max - min + 1) / bandCount);
  const bands = Array.from({ length: bandCount }, (_, index) => {
    const start = min + index * step;
    const end = index === bandCount - 1 ? max : start + step - 1;
    return {
      name: `${formatCurrency(start)} - ${formatCurrency(end)}`,
      min: start,
      max: end,
      value: 0,
    };
  });

  salaries.forEach((salary) => {
    const band =
      bands.find((item, index) => {
        if (index === bands.length - 1) return salary >= item.min && salary <= item.max;
        return salary >= item.min && salary < item.max + 1;
      }) || bands[bands.length - 1];
    band.value += 1;
  });

  return bands.map(({ name, value, min, max }) => ({ name, value, min, max }));
};

const getDateRangeFromFilters = ({ year, month, startDate, endDate }) => {
  if (startDate && endDate) {
    return {
      start: startOfDay(startDate),
      end: endOfDay(endDate),
    };
  }

  if (year === "All") return { start: null, end: null };

  const numericYear = Number(year);
  if (!Number.isFinite(numericYear)) return { start: null, end: null };

  if (month !== "All") {
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

const isWithinRange = (value, range) => {
  const date = toDate(value);
  if (!date) return false;
  if (range.start && date < range.start) return false;
  if (range.end && date > range.end) return false;
  return true;
};

const monthNumberFromValue = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && value >= 1 && value <= 12) return value;
  const normalized = String(value).trim().toLowerCase();
  const nameIndex = MONTH_NAMES.findIndex((month) => month.toLowerCase() === normalized);
  if (nameIndex >= 0) return nameIndex + 1;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
};

function MetricCard({ label, value, subtext, onClick }) {
  return (
    <div
      className={`${styles.metricCard} ${onClick ? styles.metricCardClickable : ""}`}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {subtext ? <div className={styles.metricSubtext}>{subtext}</div> : null}
    </div>
  );
}

function SectionCard({ title, children, note, action }) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionHeaderText}>
          <h3>{title}</h3>
          {note ? <span className={styles.sectionNote}>{note}</span> : null}
        </div>
        {action ? <div className={styles.sectionAction}>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ message = "No data available" }) {
  return <div className={styles.emptyState}>{message}</div>;
}

function SummaryList({ items }) {
  return (
    <div className={styles.summaryList}>
      {items.map((item) => (
        <div
          key={item.label}
          className={`${styles.summaryRow} ${item.onClick ? styles.summaryRowClickable : ""}`}
          onClick={item.onClick}
          onKeyDown={item.onClick ? (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              item.onClick();
            }
          } : undefined}
          role={item.onClick ? "button" : undefined}
          tabIndex={item.onClick ? 0 : undefined}
        >
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function DashboardChart({ hasData, children }) {
  if (!hasData) return <EmptyState />;
  return <div className={styles.chartWrap}>{children}</div>;
}

function CategoryTooltip({ active, payload, labelPrefix = "Category" }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className={styles.chartTooltip}>
      <div><strong>{labelPrefix}:</strong> {point.name}</div>
      <div><strong>Employees:</strong> {formatCount(point.value)}</div>
      <div><strong>Percentage:</strong> {formatPercent(point.percentage)}</div>
    </div>
  );
}

export default function HrMetricsDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [salarySlips, setSalarySlips] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceMonthlySummary, setAttendanceMonthlySummary] = useState([]);
  const [activeBreakdown, setActiveBreakdown] = useState(null);
  const currentYear = String(new Date().getFullYear());
  const yearFromUrl = searchParams.get("year");
  const [filters, setFilters] = useState({
    year: yearFromUrl && yearFromUrl !== "All" ? yearFromUrl : currentYear,
    month: searchParams.get("month") || "All",
    startDate: searchParams.get("startDate") || "",
    endDate: searchParams.get("endDate") || "",
    department: searchParams.get("department") || "All",
    designation: searchParams.get("designation") || "All",
    location: searchParams.get("location") || "All",
    employeeType: searchParams.get("employeeType") || "All",
    gender: searchParams.get("gender") || "All",
  });

  const selectedRange = useMemo(() => getDateRangeFromFilters(filters), [filters]);
  const activeYear = useMemo(() => {
    const parsed = Number(filters.year);
    const liveYear = new Date().getFullYear();
    if (!Number.isFinite(parsed) || parsed > liveYear) return liveYear;
    return parsed;
  }, [filters.year]);
  const asOfDate = useMemo(
    () => selectedRange.end || new Date(activeYear, 11, 31, 23, 59, 59, 999),
    [selectedRange.end, activeYear]
  );

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("year", String(activeYear));
    if (filters.month && filters.month !== "All") params.set("month", filters.month);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);
    if (filters.department !== "All") params.set("department", filters.department);
    if (filters.designation !== "All") params.set("designation", filters.designation);
    if (filters.location !== "All") params.set("location", filters.location);
    if (filters.employeeType !== "All") params.set("employeeType", filters.employeeType);
    if (filters.gender !== "All") params.set("gender", filters.gender);
    const qs = params.toString();
    const path = qs ? `${HR_METRICS_BASE_PATH}?${qs}` : HR_METRICS_BASE_PATH;
    writePersistedPath(HR_METRICS_STORAGE_KEY, path);
    if (searchParams.toString() !== qs) {
      setSearchParams(params, { replace: true });
    }
  }, [activeYear, filters, searchParams, setSearchParams]);

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      setLoading(true);
      setError("");

      try {
        const [employeeResponse, leaveResponse, attendanceTrendResponse, salarySlipResponse] =
          await Promise.all([
            employeeService.getEmployees({ force: true }),
            leaveRequestService.getLeaveRequests(),
            attendanceService.getMonthlySummary(activeYear),
            salarySlipService.getAllSalarySlips("", filters.year || currentYear),
          ]);

        const employeeList = toArray(employeeResponse);
        const leaveList = toArray(leaveResponse);
        const slipList = Array.isArray(salarySlipResponse) ? salarySlipResponse : [];

        let attendanceRangeList = [];
        if (selectedRange.start && selectedRange.end) {
          try {
            attendanceRangeList = await attendanceService.getByRange(
              selectedRange.start.toISOString().slice(0, 10),
              selectedRange.end.toISOString().slice(0, 10)
            );
          } catch (attendanceError) {
            console.error("Failed to load attendance range data:", attendanceError);
          }
        }

        if (!isMounted) return;
        setEmployees(employeeList);
        setLeaves(leaveList);
        setSalarySlips(slipList);
        setAttendanceMonthlySummary(Array.isArray(attendanceTrendResponse) ? attendanceTrendResponse : []);
        setAttendanceRecords(Array.isArray(attendanceRangeList) ? attendanceRangeList : []);
      } catch (loadError) {
        console.error("Failed to load HR metrics dashboard:", loadError);
        if (isMounted) setError(loadError.message || "Failed to load dashboard data.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [filters.year, currentYear, selectedRange.start, selectedRange.end, activeYear]);

  const filterOptions = useMemo(() => {
    const buildOptions = (getter) => [
      "All",
      ...[...new Set(employees.map(getter).filter(Boolean).map((value) => String(value).trim()))].sort(),
    ];

    const yearsFromJoining = buildHrMetricsYearOptions(employees);
    if (!yearsFromJoining.includes(String(activeYear))) {
      yearsFromJoining.push(String(activeYear));
      yearsFromJoining.sort((a, b) => Number(b) - Number(a));
    }

    return {
      years: yearsFromJoining,
      departments: buildOptions((employee) => employee.department),
      designations: buildOptions((employee) => employee.designation || employee.role),
      locations: buildOptions((employee) => employee.office),
      employeeTypes: buildOptions((employee) => employee.employeeStatus),
      genders: buildOptions((employee) => employee.gender),
    };
  }, [employees, activeYear]);

  const filteredEmployees = useMemo(() => {
    const workforceRange = selectedRange.start && selectedRange.end
      ? selectedRange
      : yearRangeBounds(activeYear, filters.month);

    return employees.filter((employee) => {
      if (!employeeInWorkforceRange(employee, workforceRange)) return false;
      if (filters.department !== "All" && employee.department !== filters.department) return false;
      if (filters.designation !== "All" && (employee.designation || employee.role) !== filters.designation) return false;
      if (filters.location !== "All" && employee.office !== filters.location) return false;
      if (filters.employeeType !== "All" && employee.employeeStatus !== filters.employeeType) return false;
      if (filters.gender !== "All" && employee.gender !== filters.gender) return false;
      return true;
    });
  }, [employees, filters, selectedRange, activeYear]);

  const employeeIdSet = useMemo(
    () => new Set(filteredEmployees.map((employee) => String(employee._id || employee.id || employee.employeeId || ""))),
    [filteredEmployees]
  );

  const employeeNameSet = useMemo(
    () => new Set(filteredEmployees.map((employee) => String(employee.employeeName || "").trim().toLowerCase()).filter(Boolean)),
    [filteredEmployees]
  );

  const filteredLeaves = useMemo(() => {
    return leaves.filter((leave) => {
      const employeeId = String(
        leave.employee?._id || leave.employee || leave.employeeId || ""
      );
      const employeeName = String(leave.employeeName || "").trim().toLowerCase();
      const matchesEmployee =
        (employeeId && employeeIdSet.has(employeeId)) ||
        (employeeName && employeeNameSet.has(employeeName));
      if (!matchesEmployee) return false;

      if (selectedRange.start && selectedRange.end) {
        return isWithinRange(leave.startDate, selectedRange);
      }
      return true;
    });
  }, [leaves, employeeIdSet, employeeNameSet, selectedRange]);

  const filteredSalarySlips = useMemo(() => {
    const validNames = employeeNameSet;
    return salarySlips.filter((slip) => {
      const slipName = String(slip.employeeName || "").trim().toLowerCase();
      return !slipName || validNames.has(slipName);
    });
  }, [salarySlips, employeeNameSet]);

  const filteredAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      const employeeRef = String(record.employee?._id || record.employee || "");
      if (!employeeRef) return false;
      return employeeIdSet.has(employeeRef);
    });
  }, [attendanceRecords, employeeIdSet]);

  const kpis = useMemo(() => {
    const workforce = filteredEmployees;
    const dateFilteredEmployees = workforce.filter((employee) =>
      selectedRange.start && selectedRange.end
        ? isWithinRange(employee.doj || employee.createdAt, selectedRange)
        : isWithinRange(employee.doj || employee.createdAt, {
            start: new Date(activeYear, 0, 1),
            end: new Date(activeYear, 11, 31, 23, 59, 59, 999),
          })
    );

    const exits = workforce.filter(
      (employee) =>
        isNonWorkingEmployeeStatus(employee.employeeStatus) &&
        employee.lastWorkingDay &&
        (!selectedRange.start || isWithinRange(employee.lastWorkingDay, selectedRange))
    );

    const salaries = workforce.map(getSalaryAmount).filter((amount) => Number.isFinite(amount) && amount > 0);
    const ages = workforce.map((employee) => getAgeAsOf(employee, asOfDate)).filter((age) => age != null);

    return {
      totalEmployees: workforce.length,
      activeEmployees: workforce.filter((employee) => isWorkingEmployeeStatus(employee.employeeStatus)).length,
      newJoiners: dateFilteredEmployees.length,
      totalExits: exits.length,
      averageAge: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null,
      averageSalary: salaries.length ? salaries.reduce((sum, amount) => sum + amount, 0) / salaries.length : null,
      totalPayroll: salaries.length ? salaries.reduce((sum, amount) => sum + amount, 0) : null,
      attrition: workforce.length ? (exits.length / workforce.length) * 100 : null,
    };
  }, [filteredEmployees, selectedRange, activeYear, asOfDate]);

  const attendanceOverview = useMemo(() => {
    if (!filteredAttendanceRecords.length) return emptyAttendanceSummary;

    const present = filteredAttendanceRecords.filter((record) => record.status === "Onsite").length;
    const leave = filteredAttendanceRecords.filter((record) => record.status === "Leave").length;
    const total = present + leave;

    return {
      percentage: total ? (present / total) * 100 : null,
      present,
      absent: null,
      late: null,
      leave,
      totalRecords: total,
    };
  }, [filteredAttendanceRecords]);

  const leaveOverview = useMemo(() => {
    const approvedLeaves = filteredLeaves.filter((leave) =>
      ["Approved", "HOD Approved"].includes(leave.status)
    );

    const totalsByType = approvedLeaves.reduce((acc, leave) => {
      const key = leave.leaveType || "Other";
      const days = calculateLeaveDays(leave.startDate, leave.endDate) || 0;
      acc[key] = (acc[key] || 0) + days;
      acc.total += days;
      return acc;
    }, { total: 0 });

    const aggregateBalance = filteredEmployees.reduce(
      (acc, employee) => {
        const balance = calculateLeaveBalance(employee, leaves);
        acc.entitlement += balance.entitlement || 0;
        acc.taken += balance.totalTaken || 0;
        acc.balance += balance.balance || 0;
        return acc;
      },
      { entitlement: 0, taken: 0, balance: 0 }
    );

    return {
      totalLeave: totalsByType.total || 0,
      leaveTaken: aggregateBalance.taken,
      leaveBalance: Number.isFinite(aggregateBalance.balance) ? aggregateBalance.balance : null,
      sickLeave: totalsByType["Sick Leave"] || 0,
      annualLeave: totalsByType["Annual Leave"] || totalsByType["Vacation"] || 0,
      emergencyLeave: null,
      unpaidLeave: null,
    };
  }, [filteredLeaves, filteredEmployees, leaves]);

  const salaryOverview = useMemo(() => {
    const salaries = filteredEmployees
      .map(getSalaryAmount)
      .filter((amount) => Number.isFinite(amount) && amount > 0);

    if (!salaries.length) {
      return {
        average: null,
        minimum: null,
        maximum: null,
        total: null,
      };
    }

    return {
      average: salaries.reduce((sum, amount) => sum + amount, 0) / salaries.length,
      minimum: Math.min(...salaries),
      maximum: Math.max(...salaries),
      total: salaries.reduce((sum, amount) => sum + amount, 0),
    };
  }, [filteredEmployees]);

  const exitOverview = useMemo(() => {
    const exitEmployees = filteredEmployees.filter((employee) => isNonWorkingEmployeeStatus(employee.employeeStatus));
    const exitReasons = [];
    const exitTypes = getValueLabelPairs(exitEmployees, (employee) => employee.employeeStatus);

    return {
      totalExits: exitEmployees.length,
      attrition: filteredEmployees.length ? (exitEmployees.length / filteredEmployees.length) * 100 : null,
      exitReasons,
      exitTypes,
      rehireEligible: null,
    };
  }, [filteredEmployees]);

  const employeeOverviewCharts = useMemo(() => {
    const departments = getValueLabelPairs(filteredEmployees, (employee) => employee.department);
    const designations = getValueLabelPairs(filteredEmployees, (employee) => employee.designation || employee.role);
    const locations = getValueLabelPairs(filteredEmployees, (employee) => employee.office);
    const nationalities = getValueLabelPairs(filteredEmployees, (employee) => employee.nationality);

    return {
      departmentsAll: addPercentages(departments),
      departments: limitCategories(departments, DEFAULT_CATEGORY_LIMIT),
      designationsAll: addPercentages(designations),
      designations: limitCategories(designations, DEFAULT_CATEGORY_LIMIT),
      locationsAll: addPercentages(locations),
      locations: limitCategories(locations, DEFAULT_CATEGORY_LIMIT),
      genders: getValueLabelPairs(filteredEmployees, (employee) => employee.gender),
      ageGroups: getAgeBands(filteredEmployees, asOfDate),
      nationalitiesAll: addPercentages(nationalities),
      nationalities: limitCategories(nationalities, NATIONALITY_CATEGORY_LIMIT),
      salaryBands: getSalaryBands(filteredEmployees),
    };
  }, [filteredEmployees, asOfDate]);

  const breakdownColumns = useMemo(
    () => [
      {
        title: activeBreakdown?.label || "Name",
        dataIndex: "name",
        key: "name",
      },
      {
        title: "Employees",
        dataIndex: "value",
        key: "value",
        align: "right",
        render: (value) => formatCount(value),
      },
      {
        title: "Percentage",
        dataIndex: "percentage",
        key: "percentage",
        align: "right",
        render: (value) => formatPercent(value),
      },
    ],
    [activeBreakdown]
  );

  const monthlyTrend = useMemo(() => {
    const selectedYear = activeYear;

    const attendanceMap = new Map();
    attendanceMonthlySummary.forEach((item) => {
      const month = Number(item?._id);
      if (!month) return;
      let present = 0;
      let leave = 0;
      (item.byStatus || []).forEach((statusRow) => {
        if (statusRow.status === "Onsite") present = statusRow.count || 0;
        if (statusRow.status === "Leave") leave = statusRow.count || 0;
      });
      const total = present + leave;
      attendanceMap.set(month, {
        present,
        leave,
        percentage: total ? (present / total) * 100 : null,
      });
    });

    const payrollMap = new Map();
    filteredSalarySlips.forEach((slip) => {
      if (Number(slip.year) !== selectedYear) return;
      const month = monthNumberFromValue(slip.month);
      if (!month) return;
      const amount =
        Number(slip.netSalary) ||
        Number(slip.grossSalary) ||
        Number(slip.totalSalary) ||
        0;
      payrollMap.set(month, (payrollMap.get(month) || 0) + amount);
    });

    return MONTH_NAMES.map((monthName, index) => {
      const monthIndex = index + 1;
      const endOfMonthDate = new Date(selectedYear, monthIndex, 0, 23, 59, 59, 999);
      const monthStart = new Date(selectedYear, index, 1, 0, 0, 0, 0);
      const monthEnd = new Date(selectedYear, index + 1, 0, 23, 59, 59, 999);
      const headcount = filteredEmployees.filter((employee) => {
        const joinDate = toDate(employee.doj || employee.createdAt);
        if (!joinDate || joinDate > endOfMonthDate) return false;
        const lastWorkingDay = toDate(employee.lastWorkingDay);
        if (lastWorkingDay && lastWorkingDay < monthStart) return false;
        return true;
      }).length;
      const joiners = filteredEmployees.filter((employee) =>
        isWithinRange(employee.doj || employee.createdAt, { start: monthStart, end: monthEnd })
      ).length;
      const exits = filteredEmployees.filter(
        (employee) =>
          isNonWorkingEmployeeStatus(employee.employeeStatus) &&
          isWithinRange(employee.lastWorkingDay, { start: monthStart, end: monthEnd })
      ).length;
      const attendance = attendanceMap.get(monthIndex);
      return {
        name: monthName.slice(0, 3),
        headcount,
        joiners,
        exits,
        attrition: headcount ? (exits / headcount) * 100 : null,
        attendance: attendance?.percentage ?? null,
        payroll: payrollMap.has(monthIndex) ? payrollMap.get(monthIndex) : null,
      };
    });
  }, [attendanceMonthlySummary, filteredEmployees, filteredSalarySlips, activeYear]);

  const listContext = useMemo(() => ({
    year: String(activeYear),
    month: filters.month !== "All" ? filters.month : undefined,
    department: filters.department !== "All" ? filters.department : undefined,
    designation: filters.designation !== "All" ? filters.designation : undefined,
    office: filters.location !== "All" ? filters.location : undefined,
    gender: filters.gender !== "All" ? filters.gender : undefined,
    employeeType: filters.employeeType !== "All" ? filters.employeeType : undefined,
  }), [activeYear, filters]);

  const openEmployeeList = useCallback((extra = {}) => {
    navigate(buildEmployeeListPath({ ...listContext, ...extra }));
  }, [navigate, listContext]);

  const openLeaveList = useCallback((extra = {}) => {
    const params = new URLSearchParams();
    params.set("year", String(activeYear));
    const monthParam = leaveMonthParam(filters.month);
    if (monthParam) params.set("month", monthParam);
    if (extra.leaveType) params.set("leaveType", extra.leaveType);
    navigate(`/leave-requests?${params.toString()}`);
  }, [navigate, activeYear, filters.month]);

  const openAttendance = useCallback((monthName) => {
    const range = yearRangeBounds(activeYear, monthName || filters.month);
    const params = new URLSearchParams();
    if (range.start) params.set("start", range.start.toISOString().slice(0, 10));
    if (range.end) params.set("end", range.end.toISOString().slice(0, 10));
    params.set("year", String(activeYear));
    navigate(`/attendance-management?${params.toString()}`);
  }, [navigate, activeYear, filters.month]);

  const openSalarySlips = useCallback((monthName) => {
    const params = new URLSearchParams();
    params.set("year", String(activeYear));
    const month = monthName || (filters.month !== "All" ? filters.month : "");
    if (month) params.set("month", month);
    navigate(`/salary-slips?${params.toString()}`);
  }, [navigate, activeYear, filters.month]);

  const handleCategoryClick = useCallback((field, point, allRows, breakdownTitle) => {
    const data = point?.payload || point;
    if (!data) return;
    if (data.isOther && allRows) {
      setActiveBreakdown({
        title: breakdownTitle,
        label: breakdownTitle,
        field,
        rows: allRows.map((item) => ({ ...item, key: item.name })),
      });
      return;
    }
    if (field === "ageMin") {
      openEmployeeList({
        filter: "All",
        ageMin: data.min,
        ageMax: Number.isFinite(data.max) ? data.max : undefined,
      });
      return;
    }
    openEmployeeList({ [field]: data.name, filter: "All" });
  }, [openEmployeeList]);

  const handleTrendClick = useCallback((event, maybePayload) => {
    const payload = maybePayload?.payload || event?.payload || maybePayload || event;
    if (!payload?.name) return;
    const monthName = MONTH_NAMES.find((month) => month.slice(0, 3) === payload.name);
    const dataKey = maybePayload?.dataKey || event?.dataKey;
    if (dataKey === "attendance") {
      openAttendance(monthName);
      return;
    }
    if (dataKey === "payroll") {
      openSalarySlips(monthName);
      return;
    }
    const extra = { filter: "All", month: monthName };
    if (dataKey === "joiners") extra.joined = "1";
    if (dataKey === "exits" || dataKey === "attrition") {
      extra.exited = "1";
      extra.filter = "Inactive";
    }
    openEmployeeList(extra);
  }, [openAttendance, openSalarySlips, openEmployeeList]);

  const sectionNoData = {
    recruitment: true,
    training: true,
  };

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <span>Loading HR metrics dashboard...</span>
      </div>
    );
  }

  if (error) {
    return <div className={styles.errorState}>{error}</div>;
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.headerIntro}>
        <h2>Dashboard Summary</h2>
        <p>Read-only HR insights from existing workforce, leave, attendance and payroll records.</p>
      </div>

      <section className={styles.filterBar}>
        <label>
          <span>Year</span>
          <select
            value={filters.year}
            onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}
          >
            {filterOptions.years.map((yearOption) => (
              <option key={yearOption} value={String(yearOption)}>
                {yearOption}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Month</span>
          <select
            value={filters.month}
            onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}
          >
            <option value="All">All</option>
            {MONTH_NAMES.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Date Range Start</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
          />
        </label>
        <label>
          <span>Date Range End</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
          />
        </label>
        <label>
          <span>Department</span>
          <select
            value={filters.department}
            onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}
          >
            {filterOptions.departments.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Designation</span>
          <select
            value={filters.designation}
            onChange={(event) => setFilters((current) => ({ ...current, designation: event.target.value }))}
          >
            {filterOptions.designations.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Location</span>
          <select
            value={filters.location}
            onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
          >
            {filterOptions.locations.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Employee Type</span>
          <select
            value={filters.employeeType}
            onChange={(event) => setFilters((current) => ({ ...current, employeeType: event.target.value }))}
          >
            {filterOptions.employeeTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Gender</span>
          <select
            value={filters.gender}
            onChange={(event) => setFilters((current) => ({ ...current, gender: event.target.value }))}
          >
            {filterOptions.genders.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className={styles.metricsGrid}>
        <MetricCard
          label={`Total Employees (${activeYear})`}
          value={formatCount(kpis.totalEmployees)}
          onClick={() => openEmployeeList({ filter: "All" })}
        />
        <MetricCard
          label="Active Employees"
          value={formatCount(kpis.activeEmployees)}
          onClick={() => openEmployeeList({ filter: "Active" })}
        />
        <MetricCard
          label="New Joiners"
          value={formatCount(kpis.newJoiners)}
          onClick={() => openEmployeeList({ filter: "All", joined: "1" })}
        />
        <MetricCard
          label="Total Exits"
          value={formatCount(kpis.totalExits)}
          onClick={() => openEmployeeList({ filter: "Inactive", exited: "1" })}
        />
        <MetricCard
          label="Average Age"
          value={kpis.averageAge == null ? "No data" : `${kpis.averageAge.toFixed(1)} yrs`}
          onClick={() => openEmployeeList({ filter: "All" })}
        />
        <MetricCard
          label="Average Salary"
          value={formatCurrency(kpis.averageSalary)}
          onClick={() => openEmployeeList({ filter: "All" })}
        />
        <MetricCard
          label="Total Payroll"
          value={formatCurrency(kpis.totalPayroll)}
          onClick={() => openSalarySlips()}
        />
        <MetricCard
          label="Attrition %"
          value={formatPercent(kpis.attrition)}
          onClick={() => openEmployeeList({ filter: "Inactive", exited: "1" })}
        />
      </div>

      <div className={styles.threeColumnGrid}>
        <SectionCard title="Employee Overview: Department Distribution">
          <DashboardChart hasData={employeeOverviewCharts.departments.length > 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeOverviewCharts.departments} layout="vertical" margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => truncateLabel(value, 16)}
                />
                <Tooltip content={<CategoryTooltip labelPrefix="Department" />} />
                <Bar
                  dataKey="value"
                  fill="#3b82f6"
                  radius={[0, 8, 8, 0]}
                  cursor="pointer"
                  onClick={(point) => handleCategoryClick(
                    "department",
                    point,
                    employeeOverviewCharts.departmentsAll,
                    "All Departments"
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </DashboardChart>
        </SectionCard>

        <SectionCard
          title="Employee Overview: Designation Distribution"
          action={
            employeeOverviewCharts.designationsAll.length > DEFAULT_CATEGORY_LIMIT ? (
              <Button
                type="link"
                size="small"
                className={styles.viewAllButton}
                onClick={() =>
                  setActiveBreakdown({
                    title: "All Designations",
                    label: "Designation",
                    field: "designation",
                    rows: employeeOverviewCharts.designationsAll.map((item) => ({ ...item, key: item.name })),
                  })
                }
              >
                View All
              </Button>
            ) : null
          }
        >
          <DashboardChart hasData={employeeOverviewCharts.designations.length > 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={employeeOverviewCharts.designations}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  data={employeeOverviewCharts.designations}
                  nameKey="name"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => truncateLabel(value, 16)}
                />
                <Tooltip content={<CategoryTooltip labelPrefix="Designation" />} />
                <Bar
                  dataKey="value"
                  fill="#14b8a6"
                  radius={[0, 8, 8, 0]}
                  cursor="pointer"
                  onClick={(point) => handleCategoryClick(
                    "designation",
                    point,
                    employeeOverviewCharts.designationsAll,
                    "All Designations"
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </DashboardChart>
        </SectionCard>

        <SectionCard
          title="Employee Overview: Location Distribution"
          action={
            employeeOverviewCharts.locationsAll.length > DEFAULT_CATEGORY_LIMIT ? (
              <Button
                type="link"
                size="small"
                className={styles.viewAllButton}
                onClick={() =>
                  setActiveBreakdown({
                    title: "All Locations",
                    label: "Location",
                    field: "office",
                    rows: employeeOverviewCharts.locationsAll.map((item) => ({ ...item, key: item.name })),
                  })
                }
              >
                View All
              </Button>
            ) : null
          }
        >
          <DashboardChart hasData={employeeOverviewCharts.locations.length > 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={employeeOverviewCharts.locations}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  data={employeeOverviewCharts.locations}
                  nameKey="name"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => truncateLabel(value, 16)}
                />
                <Tooltip content={<CategoryTooltip labelPrefix="Location" />} />
                <Bar
                  dataKey="value"
                  fill="#8b5cf6"
                  radius={[0, 8, 8, 0]}
                  cursor="pointer"
                  onClick={(point) => handleCategoryClick(
                    "office",
                    point,
                    employeeOverviewCharts.locationsAll,
                    "All Locations"
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </DashboardChart>
        </SectionCard>
      </div>

      <div className={styles.threeColumnGrid}>
        <SectionCard title="Demographics: Gender">
          <DashboardChart hasData={employeeOverviewCharts.genders.length > 0}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={employeeOverviewCharts.genders}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  cursor="pointer"
                  onClick={(point) => openEmployeeList({ filter: "All", gender: (point?.payload || point)?.name })}
                >
                  {employeeOverviewCharts.genders.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </DashboardChart>
        </SectionCard>

        <SectionCard title="Demographics: Age Group">
          <DashboardChart hasData={employeeOverviewCharts.ageGroups.some((item) => item.value > 0)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeOverviewCharts.ageGroups}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#14b8a6"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(point) => handleCategoryClick("ageMin", point)}
                />
              </BarChart>
            </ResponsiveContainer>
          </DashboardChart>
        </SectionCard>

        <SectionCard title="Demographics: Nationality">
          <DashboardChart hasData={employeeOverviewCharts.nationalities.length > 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={employeeOverviewCharts.nationalities}
                layout="vertical"
                margin={{ top: 8, right: 12, left: 12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => truncateLabel(value, 16)}
                />
                <Tooltip content={<CategoryTooltip labelPrefix="Nationality" />} />
                <Bar
                  dataKey="value"
                  fill="#8b5cf6"
                  radius={[0, 8, 8, 0]}
                  cursor="pointer"
                  onClick={(point) => handleCategoryClick(
                    "nationality",
                    point,
                    employeeOverviewCharts.nationalitiesAll,
                    "All Nationalities"
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </DashboardChart>
        </SectionCard>
      </div>

      <div className={styles.twoColumnGrid}>
        <SectionCard title="Salary Analysis: Salary Overview">
          <SummaryList
            items={[
              { label: "Average Salary", value: formatCurrency(salaryOverview.average), onClick: () => openEmployeeList({ filter: "All" }) },
              { label: "Minimum Salary", value: formatCurrency(salaryOverview.minimum), onClick: () => openEmployeeList({ filter: "All" }) },
              { label: "Maximum Salary", value: formatCurrency(salaryOverview.maximum), onClick: () => openEmployeeList({ filter: "All" }) },
              { label: "Total Salary", value: formatCurrency(salaryOverview.total), onClick: () => openSalarySlips() },
            ]}
          />
        </SectionCard>

        <SectionCard title="Salary Analysis: Salary Distribution">
          <DashboardChart hasData={employeeOverviewCharts.salaryBands.length > 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeOverviewCharts.salaryBands}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#f59e0b"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(point) => {
                    const data = point?.payload || point;
                    openEmployeeList({
                      filter: "All",
                      salaryMin: data?.min,
                      salaryMax: data?.max,
                    });
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </DashboardChart>
        </SectionCard>
      </div>

      <div className={styles.twoColumnGrid}>
        <SectionCard title="Attendance Overview" note="Late and absent values are not available in the current attendance dataset.">
          <SummaryList
            items={[
              { label: "Attendance %", value: formatPercent(attendanceOverview.percentage), onClick: () => openAttendance() },
              { label: "Present", value: formatCount(attendanceOverview.present), onClick: () => openAttendance() },
              { label: "Absent", value: attendanceOverview.absent == null ? "No data" : formatCount(attendanceOverview.absent) },
              { label: "Late", value: attendanceOverview.late == null ? "No data" : formatCount(attendanceOverview.late) },
              { label: "Leave", value: formatCount(attendanceOverview.leave), onClick: () => openAttendance() },
            ]}
          />
        </SectionCard>

        <SectionCard title="Leave Overview" note="Emergency and unpaid leave types are not present in the current leave workflow.">
          <SummaryList
            items={[
              { label: "Total Leave", value: formatCount(leaveOverview.totalLeave), onClick: () => openLeaveList() },
              { label: "Leave Taken", value: formatCount(leaveOverview.leaveTaken), onClick: () => openLeaveList() },
              { label: "Leave Balance", value: leaveOverview.leaveBalance == null ? "No data" : formatCount(leaveOverview.leaveBalance), onClick: () => openLeaveList() },
              { label: "Sick Leave", value: formatCount(leaveOverview.sickLeave), onClick: () => openLeaveList({ leaveType: "Sick Leave" }) },
              { label: "Annual Leave", value: formatCount(leaveOverview.annualLeave), onClick: () => openLeaveList({ leaveType: "Annual Leave" }) },
              { label: "Emergency Leave", value: "No data" },
              { label: "Unpaid Leave", value: "No data" },
            ]}
          />
        </SectionCard>
      </div>

      <div className={styles.twoColumnGrid}>
        <SectionCard title="Recruitment Overview">
          {sectionNoData.recruitment ? (
            <EmptyState message="No recruitment module data is available in the current system." />
          ) : null}
        </SectionCard>

        <SectionCard title="Training Overview">
          {sectionNoData.training ? (
            <EmptyState message="No training records are available in the current system." />
          ) : null}
        </SectionCard>
      </div>

      <div className={styles.twoColumnGrid}>
        <SectionCard title="Exit Analysis">
          <SummaryList
            items={[
              { label: "Total Exits", value: formatCount(exitOverview.totalExits), onClick: () => openEmployeeList({ filter: "Inactive", exited: "1" }) },
              { label: "Attrition %", value: formatPercent(exitOverview.attrition), onClick: () => openEmployeeList({ filter: "Inactive", exited: "1" }) },
              { label: "Rehire Eligible", value: "No data" },
            ]}
          />
        </SectionCard>

        <SectionCard title="Exit Types">
          <DashboardChart hasData={exitOverview.exitTypes.length > 0}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={exitOverview.exitTypes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#ef4444"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(point) => {
                    const data = point?.payload || point;
                    openEmployeeList({ filter: "Inactive", employeeType: data?.name, exited: "1" });
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </DashboardChart>
        </SectionCard>
      </div>

      <SectionCard title="Monthly HR KPI Trend" note="Payroll trend uses salary slip records when available for the selected year.">
        <DashboardChart hasData={monthlyTrend.length > 0}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="headcount" stroke="#2563eb" strokeWidth={2} activeDot={{ r: 6, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "headcount" }) }} dot={{ r: 3, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "headcount" }) }} />
              <Line yAxisId="left" type="monotone" dataKey="joiners" stroke="#14b8a6" strokeWidth={2} activeDot={{ r: 6, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "joiners" }) }} dot={{ r: 3, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "joiners" }) }} />
              <Line yAxisId="left" type="monotone" dataKey="exits" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 6, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "exits" }) }} dot={{ r: 3, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "exits" }) }} />
              <Line yAxisId="right" type="monotone" dataKey="attrition" stroke="#8b5cf6" strokeWidth={2} activeDot={{ r: 6, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "attrition" }) }} dot={{ r: 3, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "attrition" }) }} />
              <Line yAxisId="right" type="monotone" dataKey="attendance" stroke="#f59e0b" strokeWidth={2} activeDot={{ r: 6, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "attendance" }) }} dot={{ r: 3, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "attendance" }) }} />
              <Line yAxisId="right" type="monotone" dataKey="payroll" stroke="#0f766e" strokeWidth={2} activeDot={{ r: 6, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "payroll" }) }} dot={{ r: 3, cursor: "pointer", onClick: (event) => handleTrendClick(event, { payload: event?.payload, dataKey: "payroll" }) }} />
            </LineChart>
          </ResponsiveContainer>
        </DashboardChart>
      </SectionCard>

      <Modal
        open={Boolean(activeBreakdown)}
        title={activeBreakdown?.title}
        footer={null}
        onCancel={() => setActiveBreakdown(null)}
        width={720}
      >
        <Table
          columns={breakdownColumns}
          dataSource={activeBreakdown?.rows || []}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          size="small"
          scroll={{ x: 500 }}
          onRow={(row) => ({
            onClick: () => {
              if (!activeBreakdown?.field || row.isOther) return;
              setActiveBreakdown(null);
              openEmployeeList({ filter: "All", [activeBreakdown.field]: row.name });
            },
            style: activeBreakdown?.field ? { cursor: "pointer" } : undefined,
          })}
        />
      </Modal>
    </div>
  );
}
