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
import { Button, Input, Modal, Table } from "antd";
import styles from "./HrMetricsDashboard.module.css";
import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";
import attendanceService from "../services/AttendanceService";
import salarySlipService from "../services/SalarySlipService";
import { calculateLeaveBalance, calculateLeaveDays } from "../utils/leaveCalculator";
import { CURRENCY_CODE } from "../utils/currency";
import { writePersistedPath } from "../hooks/usePersistedListPage";
import {
  HR_METRICS_BASE_PATH,
  HR_METRICS_STORAGE_KEY,
  buildHrMetricsYearOptions,
  leaveMonthParam,
  yearRangeBounds,
} from "../utils/hrMetricsFilters";
import {
  addPercentages,
  applyDashboardFilters,
  buildEmployeeDrillRows,
  buildPayrollDrillRows,
  computeKpis,
  countByCategory,
  employeeKey,
  filterByAgeBand,
  filterByDepartment,
  filterByDesignation,
  filterByExitStatus,
  filterByGender,
  filterByLocation,
  filterByNationality,
  filterBySalaryBand,
  filterSalarySlipsForWorkforce,
  getAgeAsOf,
  getDesignation,
  getLocation,
  getNewJoiners,
  getPeriodExits,
  getSalaryAmount,
  resolvePeriodRange,
  sumPayrollFromSlips,
  toDate,
  isWithinRange,
} from "../utils/hrMetricsAnalytics";

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

const getValueLabelPairs = (items, accessor) =>
  countByCategory(items, accessor);

const limitCategories = (items, limit = DEFAULT_CATEGORY_LIMIT) => {
  if (items.length <= limit) return addPercentages(items);

  const topItems = items.slice(0, limit);
  const otherItems = items.slice(limit);
  const otherValue = otherItems.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const grouped = otherValue > 0
    ? [...topItems, {
      name: "Other",
      value: otherValue,
      isOther: true,
      otherNames: otherItems.map((item) => item.name),
    }]
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

  return addPercentages(buckets);
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
    return addPercentages([{ name: formatCurrency(min), value: salaries.length, min, max }]);
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

  return addPercentages(bands.map(({ name, value, min: bandMin, max: bandMax }) => ({
    name,
    value,
    min: bandMin,
    max: bandMax,
  })));
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

const EMPLOYEE_BASE_COLUMNS = [
  { title: "Employee Name", dataIndex: "employeeName", key: "employeeName", fixed: "left", width: 160 },
  { title: "Employee ID", dataIndex: "employeeId", key: "employeeId", width: 110 },
  { title: "Department", dataIndex: "department", key: "department", width: 130 },
  { title: "Designation", dataIndex: "designation", key: "designation", width: 140 },
  { title: "Joining Date", dataIndex: "doj", key: "doj", width: 110 },
  { title: "Status", dataIndex: "status", key: "status", width: 120 },
  { title: "Location", dataIndex: "location", key: "location", width: 160 },
];

const CURRENCY_COL = (title, key) => ({
  title,
  dataIndex: key,
  key,
  align: "right",
  width: 110,
  render: (value) => formatCurrency(value),
});

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
  const [drillDown, setDrillDown] = useState(null);
  const [drillSearch, setDrillSearch] = useState("");
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

  const selectedRange = useMemo(
    () => resolvePeriodRange({ ...filters, activeYear: Number(filters.year) || Number(currentYear) }),
    [filters, currentYear]
  );
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

  const filteredEmployees = useMemo(
    () => applyDashboardFilters(employees, filters, selectedRange),
    [employees, filters, selectedRange]
  );

  const employeeIdSet = useMemo(
    () => new Set(filteredEmployees.map((employee) => String(employee._id || employee.id || "")).filter(Boolean)),
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

  const filteredSalarySlips = useMemo(
    () => filterSalarySlipsForWorkforce(salarySlips, filteredEmployees, selectedRange, {
      year: String(activeYear),
      month: filters.month,
    }),
    [salarySlips, filteredEmployees, selectedRange, activeYear, filters.month]
  );

  const filteredAttendanceRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      const employeeRef = String(record.employee?._id || record.employee || "");
      if (!employeeRef) return false;
      return employeeIdSet.has(employeeRef);
    });
  }, [attendanceRecords, employeeIdSet]);

  const kpis = useMemo(() => {
    const computed = computeKpis(filteredEmployees, selectedRange, asOfDate);
    const payrollFromSlips = sumPayrollFromSlips(filteredSalarySlips);
    return {
      ...computed,
      // Total Payroll uses salary-slip net pay for the selected period (not headcount × average).
      totalPayroll: payrollFromSlips,
      payrollSlipCount: filteredSalarySlips.length,
    };
  }, [filteredEmployees, selectedRange, asOfDate, filteredSalarySlips]);

  const openEmployeeDrillDown = useCallback((title, employeeList, columns = EMPLOYEE_BASE_COLUMNS) => {
    const list = employeeList || [];
    setDrillSearch("");
    setDrillDown({
      mode: "employees",
      title: `${title} – ${list.length}`,
      count: list.length,
      columns,
      rows: buildEmployeeDrillRows(list, asOfDate),
    });
  }, [asOfDate]);

  const openPayrollDrillDown = useCallback((title, slips) => {
    const list = slips || [];
    setDrillSearch("");
    setDrillDown({
      mode: "payroll",
      title: `${title} – ${list.length} slip${list.length === 1 ? "" : "s"}`,
      count: list.length,
      columns: [
        { title: "Employee", dataIndex: "employeeName", key: "employeeName", fixed: "left", width: 150 },
        { title: "Department", dataIndex: "department", key: "department", width: 120 },
        { title: "Month", dataIndex: "month", key: "month", width: 100 },
        { title: "Year", dataIndex: "year", key: "year", width: 80 },
        CURRENCY_COL("Basic", "basicPay"),
        CURRENCY_COL("HRA", "hra"),
        CURRENCY_COL("Conveyance", "conveyanceAllowance"),
        CURRENCY_COL("Other", "otherAllowance"),
        CURRENCY_COL("Deductions", "totalDeduction"),
        CURRENCY_COL("Gross", "grossSalary"),
        CURRENCY_COL("Net", "netSalary"),
      ],
      rows: buildPayrollDrillRows(list),
    });
  }, []);

  const attendanceOverview = useMemo(() => {
    if (!filteredAttendanceRecords.length) return emptyAttendanceSummary;

    const present = filteredAttendanceRecords.filter((record) => record.status === "Onsite").length;
    const leave = filteredAttendanceRecords.filter((record) => record.status === "Leave").length;
    const total = present + leave;

    // Distinct employees for present/leave (avoid multi-day duplicate person counts in drill-down)
    const presentEmployees = [];
    const leaveEmployees = [];
    const presentSeen = new Set();
    const leaveSeen = new Set();
    filteredAttendanceRecords.forEach((record) => {
      const emp = filteredEmployees.find(
        (e) => String(e._id || e.id) === String(record.employee?._id || record.employee || "")
      );
      if (!emp) return;
      const key = employeeKey(emp);
      if (record.status === "Onsite" && !presentSeen.has(key)) {
        presentSeen.add(key);
        presentEmployees.push(emp);
      }
      if (record.status === "Leave" && !leaveSeen.has(key)) {
        leaveSeen.add(key);
        leaveEmployees.push(emp);
      }
    });

    return {
      percentage: total ? (present / total) * 100 : null,
      present,
      absent: null,
      late: null,
      leave,
      totalRecords: total,
      presentEmployees,
      leaveEmployees,
    };
  }, [filteredAttendanceRecords, filteredEmployees]);

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

    const employeesByLeaveType = (typeNames) => {
      const names = new Set(typeNames.map((t) => String(t).toLowerCase()));
      const seen = new Set();
      const out = [];
      approvedLeaves.forEach((leave) => {
        if (!names.has(String(leave.leaveType || "").toLowerCase())) return;
        const emp = filteredEmployees.find((e) => {
          const id = String(leave.employee?._id || leave.employee || "");
          const name = String(leave.employeeName || "").trim().toLowerCase();
          return (
            (id && String(e._id || e.id) === id) ||
            (name && String(e.employeeName || "").trim().toLowerCase() === name)
          );
        });
        if (!emp) return;
        const key = employeeKey(emp);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(emp);
      });
      return out;
    };

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
      sickEmployees: employeesByLeaveType(["Sick Leave"]),
      annualEmployees: employeesByLeaveType(["Annual Leave", "Vacation"]),
      anyLeaveEmployees: employeesByLeaveType(
        [...new Set(approvedLeaves.map((l) => l.leaveType).filter(Boolean))]
      ),
    };
  }, [filteredLeaves, filteredEmployees, leaves]);

  const salaryOverview = useMemo(() => {
    const withSalary = kpis.lists.withSalary;
    const salaries = withSalary.map(getSalaryAmount);

    if (!salaries.length) {
      return {
        average: null,
        minimum: null,
        maximum: null,
        total: null,
        employees: [],
      };
    }

    return {
      average: salaries.reduce((sum, amount) => sum + amount, 0) / salaries.length,
      minimum: Math.min(...salaries),
      maximum: Math.max(...salaries),
      total: salaries.reduce((sum, amount) => sum + amount, 0),
      employees: withSalary,
    };
  }, [kpis.lists.withSalary]);

  const exitOverview = useMemo(() => {
    const exitEmployees = getPeriodExits(filteredEmployees, selectedRange);
    const exitTypes = addPercentages(
      getValueLabelPairs(exitEmployees, (employee) => employee.employeeStatus)
    );

    return {
      totalExits: exitEmployees.length,
      attrition: kpis.attrition,
      exitReasons: [],
      exitTypes,
      exitEmployees,
      rehireEligible: null,
    };
  }, [filteredEmployees, selectedRange, kpis.attrition]);

  const employeeOverviewCharts = useMemo(() => {
    const departments = getValueLabelPairs(filteredEmployees, (employee) => employee.department);
    const designations = getValueLabelPairs(filteredEmployees, (employee) => getDesignation(employee));
    const locations = getValueLabelPairs(filteredEmployees, (employee) => getLocation(employee));
    const nationalities = getValueLabelPairs(filteredEmployees, (employee) => employee.nationality);
    const genders = addPercentages(
      getValueLabelPairs(filteredEmployees, (employee) => employee.gender)
    );

    return {
      departmentsAll: addPercentages(departments),
      departments: limitCategories(departments, DEFAULT_CATEGORY_LIMIT),
      designationsAll: addPercentages(designations),
      designations: limitCategories(designations, DEFAULT_CATEGORY_LIMIT),
      locationsAll: addPercentages(locations),
      locations: limitCategories(locations, DEFAULT_CATEGORY_LIMIT),
      genders,
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
      const monthRange = { start: monthStart, end: monthEnd };
      const headcount = filteredEmployees.filter((employee) => {
        const joinDate = toDate(employee.doj || employee.createdAt);
        if (!joinDate || joinDate > endOfMonthDate) return false;
        const lastWorkingDay = toDate(employee.lastWorkingDay);
        if (lastWorkingDay && lastWorkingDay < monthStart) return false;
        return true;
      }).length;
      const joiners = getNewJoiners(filteredEmployees, monthRange).length;
      const exits = getPeriodExits(filteredEmployees, monthRange).length;
      const attendance = attendanceMap.get(monthIndex);
      return {
        name: monthName.slice(0, 3),
        monthName,
        headcount,
        joiners,
        exits,
        attrition: headcount ? (exits / headcount) * 100 : null,
        attendance: attendance?.percentage ?? null,
        payroll: payrollMap.has(monthIndex) ? payrollMap.get(monthIndex) : null,
      };
    });
  }, [attendanceMonthlySummary, filteredEmployees, filteredSalarySlips, activeYear]);

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

    if (field === "department") {
      openEmployeeDrillDown(`${data.name} Employees`, filterByDepartment(filteredEmployees, data.name));
      return;
    }
    if (field === "designation") {
      openEmployeeDrillDown(`${data.name} Employees`, filterByDesignation(filteredEmployees, data.name));
      return;
    }
    if (field === "office") {
      openEmployeeDrillDown(`${data.name} Employees`, filterByLocation(filteredEmployees, data.name));
      return;
    }
    if (field === "nationality") {
      openEmployeeDrillDown(`${data.name} – Employees`, filterByNationality(filteredEmployees, data.name));
      return;
    }
    if (field === "gender") {
      openEmployeeDrillDown(`${data.name} Employees`, filterByGender(filteredEmployees, data.name), [
        ...EMPLOYEE_BASE_COLUMNS,
        { title: "Gender", dataIndex: "gender", key: "gender", width: 100 },
        { title: "Age", dataIndex: "age", key: "age", width: 70 },
        { title: "Nationality", dataIndex: "nationality", key: "nationality", width: 120 },
      ]);
      return;
    }
    if (field === "ageMin") {
      openEmployeeDrillDown(`Age Group ${data.name}`, filterByAgeBand(filteredEmployees, data.min, data.max, asOfDate), [
        { title: "Employee Name", dataIndex: "employeeName", key: "employeeName", fixed: "left", width: 160 },
        { title: "Employee ID", dataIndex: "employeeId", key: "employeeId", width: 110 },
        { title: "Age", dataIndex: "age", key: "age", width: 70 },
        { title: "DOB", dataIndex: "dateOfBirth", key: "dateOfBirth", width: 110 },
        { title: "Department", dataIndex: "department", key: "department", width: 130 },
        { title: "Designation", dataIndex: "designation", key: "designation", width: 140 },
        { title: "Location", dataIndex: "location", key: "location", width: 160 },
        { title: "Status", dataIndex: "status", key: "status", width: 120 },
      ]);
      return;
    }
    if (field === "salaryBand") {
      openEmployeeDrillDown(`Salary Band ${data.name}`, filterBySalaryBand(filteredEmployees, data.min, data.max), [
        ...EMPLOYEE_BASE_COLUMNS,
        CURRENCY_COL("Salary", "salary"),
      ]);
    }
  }, [filteredEmployees, asOfDate, openEmployeeDrillDown]);

  const handleTrendClick = useCallback((event, maybePayload) => {
    const payload = maybePayload?.payload || event?.payload || maybePayload || event;
    if (!payload?.name) return;
    const monthName = payload.monthName
      || MONTH_NAMES.find((month) => month.slice(0, 3) === payload.name);
    const monthRange = yearRangeBounds(activeYear, monthName);
    const dataKey = maybePayload?.dataKey || event?.dataKey;

    if (dataKey === "attendance") {
      openAttendance(monthName);
      return;
    }
    if (dataKey === "payroll") {
      const monthSlips = filteredSalarySlips.filter((slip) => {
        if (Number(slip.year) !== activeYear) return false;
        return monthNumberFromValue(slip.month) === (MONTH_NAMES.indexOf(monthName) + 1);
      });
      openPayrollDrillDown(`Payroll – ${monthName} ${activeYear}`, monthSlips);
      return;
    }
    if (dataKey === "joiners") {
      openEmployeeDrillDown(`New Joiners – ${monthName} ${activeYear}`, getNewJoiners(filteredEmployees, monthRange), [
        ...EMPLOYEE_BASE_COLUMNS.slice(0, 5),
        { title: "Status", dataIndex: "status", key: "status", width: 120 },
        { title: "Location", dataIndex: "location", key: "location", width: 160 },
      ]);
      return;
    }
    if (dataKey === "exits" || dataKey === "attrition") {
      openEmployeeDrillDown(`Exits – ${monthName} ${activeYear}`, getPeriodExits(filteredEmployees, monthRange), [
        ...EMPLOYEE_BASE_COLUMNS.slice(0, 4),
        { title: "Joining Date", dataIndex: "doj", key: "doj", width: 110 },
        { title: "Last Working Day", dataIndex: "lastWorkingDay", key: "lastWorkingDay", width: 130 },
        { title: "Exit Status", dataIndex: "status", key: "status", width: 120 },
        { title: "Location", dataIndex: "location", key: "location", width: 160 },
      ]);
      return;
    }
    // headcount — workforce present in that month
    const monthEmployees = filteredEmployees.filter((employee) => {
      const joinDate = toDate(employee.doj || employee.createdAt);
      if (!joinDate || joinDate > monthRange.end) return false;
      const lastWorkingDay = toDate(employee.lastWorkingDay);
      if (lastWorkingDay && lastWorkingDay < monthRange.start) return false;
      return true;
    });
    openEmployeeDrillDown(`Headcount – ${monthName} ${activeYear}`, monthEmployees);
  }, [
    activeYear,
    filteredEmployees,
    filteredSalarySlips,
    openAttendance,
    openEmployeeDrillDown,
    openPayrollDrillDown,
  ]);

  const filteredDrillRows = useMemo(() => {
    if (!drillDown?.rows) return [];
    const q = drillSearch.trim().toLowerCase();
    if (!q) return drillDown.rows;
    return drillDown.rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(q))
    );
  }, [drillDown, drillSearch]);

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
          onClick={() => openEmployeeDrillDown(`Total Employees (${activeYear})`, kpis.lists.workforce)}
        />
        <MetricCard
          label="Active Employees"
          value={formatCount(kpis.activeEmployees)}
          onClick={() => openEmployeeDrillDown(`Active Employees (${activeYear})`, kpis.lists.active)}
        />
        <MetricCard
          label="New Joiners"
          value={formatCount(kpis.newJoiners)}
          onClick={() => openEmployeeDrillDown(`New Joiners – ${activeYear}`, kpis.lists.joiners, [
            ...EMPLOYEE_BASE_COLUMNS.slice(0, 5),
            { title: "Status", dataIndex: "status", key: "status", width: 120 },
            { title: "Location", dataIndex: "location", key: "location", width: 160 },
          ])}
        />
        <MetricCard
          label="Total Exits"
          value={formatCount(kpis.totalExits)}
          onClick={() => openEmployeeDrillDown(`Exits – ${activeYear}`, kpis.lists.exits, [
            ...EMPLOYEE_BASE_COLUMNS.slice(0, 4),
            { title: "Joining Date", dataIndex: "doj", key: "doj", width: 110 },
            { title: "Last Working Day", dataIndex: "lastWorkingDay", key: "lastWorkingDay", width: 130 },
            { title: "Exit Status", dataIndex: "status", key: "status", width: 120 },
            { title: "Location", dataIndex: "location", key: "location", width: 160 },
          ])}
        />
        <MetricCard
          label="Average Age"
          value={kpis.averageAge == null ? "No data" : `${kpis.averageAge.toFixed(1)} yrs`}
          onClick={() => openEmployeeDrillDown("Age Analysis", kpis.lists.withAge, [
            { title: "Employee Name", dataIndex: "employeeName", key: "employeeName", fixed: "left", width: 160 },
            { title: "DOB", dataIndex: "dateOfBirth", key: "dateOfBirth", width: 110 },
            { title: "Current Age", dataIndex: "age", key: "age", width: 100 },
            { title: "Department", dataIndex: "department", key: "department", width: 130 },
            { title: "Designation", dataIndex: "designation", key: "designation", width: 140 },
          ])}
        />
        <MetricCard
          label="Average Salary"
          value={formatCurrency(kpis.averageSalary)}
          onClick={() => openEmployeeDrillDown("Employees – Salary Calculation", kpis.lists.withSalary, [
            ...EMPLOYEE_BASE_COLUMNS,
            CURRENCY_COL("Salary", "salary"),
          ])}
        />
        <MetricCard
          label="Total Payroll"
          value={formatCurrency(kpis.totalPayroll)}
          subtext={kpis.payrollSlipCount ? `${kpis.payrollSlipCount} salary slip(s)` : "No salary slips for period"}
          onClick={() => openPayrollDrillDown(`Total Payroll – ${activeYear}`, filteredSalarySlips)}
        />
        <MetricCard
          label="Attrition %"
          value={formatPercent(kpis.attrition)}
          subtext="Exits ÷ avg headcount in period"
          onClick={() => openEmployeeDrillDown(`Attrition Exits – ${activeYear}`, kpis.lists.exits, [
            ...EMPLOYEE_BASE_COLUMNS.slice(0, 4),
            { title: "Joining Date", dataIndex: "doj", key: "doj", width: 110 },
            { title: "Last Working Day", dataIndex: "lastWorkingDay", key: "lastWorkingDay", width: 130 },
            { title: "Exit Status", dataIndex: "status", key: "status", width: 120 },
            { title: "Location", dataIndex: "location", key: "location", width: 160 },
          ])}
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
                  onClick={(point) => handleCategoryClick("gender", point)}
                >
                  {employeeOverviewCharts.genders.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip labelPrefix="Gender" />} />
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
                <Tooltip content={<CategoryTooltip labelPrefix="Age Group" />} />
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
              { label: "Average Salary", value: formatCurrency(salaryOverview.average), onClick: () => openEmployeeDrillDown("Employees – Average Salary", salaryOverview.employees, [...EMPLOYEE_BASE_COLUMNS, CURRENCY_COL("Salary", "salary")]) },
              { label: "Minimum Salary", value: formatCurrency(salaryOverview.minimum), onClick: () => openEmployeeDrillDown("Employees – Minimum Salary Band", salaryOverview.employees.filter((e) => getSalaryAmount(e) === salaryOverview.minimum), [...EMPLOYEE_BASE_COLUMNS, CURRENCY_COL("Salary", "salary")]) },
              { label: "Maximum Salary", value: formatCurrency(salaryOverview.maximum), onClick: () => openEmployeeDrillDown("Employees – Maximum Salary Band", salaryOverview.employees.filter((e) => getSalaryAmount(e) === salaryOverview.maximum), [...EMPLOYEE_BASE_COLUMNS, CURRENCY_COL("Salary", "salary")]) },
              { label: "Total Salary (Master)", value: formatCurrency(salaryOverview.total), onClick: () => openEmployeeDrillDown("Employees – Total Salary", salaryOverview.employees, [...EMPLOYEE_BASE_COLUMNS, CURRENCY_COL("Salary", "salary")]) },
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
                <Tooltip content={<CategoryTooltip labelPrefix="Salary Band" />} />
                <Bar
                  dataKey="value"
                  fill="#f59e0b"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(point) => handleCategoryClick("salaryBand", point)}
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
              {
                label: "Attendance %",
                value: formatPercent(attendanceOverview.percentage),
                onClick: () => openAttendance(),
              },
              {
                label: "Present",
                value: formatCount(attendanceOverview.present),
                onClick: () => openEmployeeDrillDown(
                  "Present (distinct employees with Onsite)",
                  attendanceOverview.presentEmployees || []
                ),
              },
              { label: "Absent", value: attendanceOverview.absent == null ? "No data" : formatCount(attendanceOverview.absent) },
              { label: "Late", value: attendanceOverview.late == null ? "No data" : formatCount(attendanceOverview.late) },
              {
                label: "Leave",
                value: formatCount(attendanceOverview.leave),
                onClick: () => openEmployeeDrillDown(
                  "On Leave (distinct employees)",
                  attendanceOverview.leaveEmployees || []
                ),
              },
            ]}
          />
        </SectionCard>

        <SectionCard title="Leave Overview" note="Emergency and unpaid leave types are not present in the current leave workflow.">
          <SummaryList
            items={[
              { label: "Total Leave (days)", value: formatCount(leaveOverview.totalLeave), onClick: () => openLeaveList() },
              { label: "Leave Taken", value: formatCount(leaveOverview.leaveTaken), onClick: () => openLeaveList() },
              { label: "Leave Balance", value: leaveOverview.leaveBalance == null ? "No data" : formatCount(leaveOverview.leaveBalance), onClick: () => openLeaveList() },
              {
                label: "Sick Leave (days)",
                value: formatCount(leaveOverview.sickLeave),
                onClick: () => openEmployeeDrillDown("Sick Leave Employees", leaveOverview.sickEmployees || []),
              },
              {
                label: "Annual Leave (days)",
                value: formatCount(leaveOverview.annualLeave),
                onClick: () => openEmployeeDrillDown("Annual Leave Employees", leaveOverview.annualEmployees || []),
              },
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
              {
                label: "Total Exits",
                value: formatCount(exitOverview.totalExits),
                onClick: () => openEmployeeDrillDown(`Exits – ${activeYear}`, exitOverview.exitEmployees || [], [
                  ...EMPLOYEE_BASE_COLUMNS.slice(0, 4),
                  { title: "Joining Date", dataIndex: "doj", key: "doj", width: 110 },
                  { title: "Last Working Day", dataIndex: "lastWorkingDay", key: "lastWorkingDay", width: 130 },
                  { title: "Exit Status", dataIndex: "status", key: "status", width: 120 },
                  { title: "Location", dataIndex: "location", key: "location", width: 160 },
                ]),
              },
              {
                label: "Attrition %",
                value: formatPercent(exitOverview.attrition),
                onClick: () => openEmployeeDrillDown(`Attrition Exits – ${activeYear}`, exitOverview.exitEmployees || []),
              },
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
                <Tooltip content={<CategoryTooltip labelPrefix="Exit Status" />} />
                <Bar
                  dataKey="value"
                  fill="#ef4444"
                  radius={[8, 8, 0, 0]}
                  cursor="pointer"
                  onClick={(point) => {
                    const data = point?.payload || point;
                    openEmployeeDrillDown(
                      `${data?.name || "Exit"} Employees`,
                      filterByExitStatus(exitOverview.exitEmployees || [], data?.name),
                      [
                        ...EMPLOYEE_BASE_COLUMNS.slice(0, 4),
                        { title: "Joining Date", dataIndex: "doj", key: "doj", width: 110 },
                        { title: "Last Working Day", dataIndex: "lastWorkingDay", key: "lastWorkingDay", width: 130 },
                        { title: "Exit Status", dataIndex: "status", key: "status", width: 120 },
                        { title: "Location", dataIndex: "location", key: "location", width: 160 },
                      ]
                    );
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
              handleCategoryClick(activeBreakdown.field, row);
            },
            style: activeBreakdown?.field ? { cursor: "pointer" } : undefined,
          })}
        />
      </Modal>

      <Modal
        open={Boolean(drillDown)}
        title={drillDown?.title}
        footer={null}
        onCancel={() => {
          setDrillDown(null);
          setDrillSearch("");
        }}
        width={960}
        destroyOnClose
      >
        <div className={styles.drillDownToolbar}>
          <Input.Search
            allowClear
            placeholder="Search in results..."
            value={drillSearch}
            onChange={(event) => setDrillSearch(event.target.value)}
            style={{ maxWidth: 320 }}
          />
          <span className={styles.drillDownCount}>
            Showing {filteredDrillRows.length}
            {drillDown?.count != null ? ` of ${drillDown.count}` : ""}
          </span>
        </div>
        <Table
          columns={drillDown?.columns || EMPLOYEE_BASE_COLUMNS}
          dataSource={filteredDrillRows}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"] }}
          size="small"
          scroll={{ x: 900 }}
        />
      </Modal>
    </div>
  );
}
