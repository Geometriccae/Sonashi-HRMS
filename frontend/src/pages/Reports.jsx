import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Select from "react-select";
import styles from "./Reports.module.css";
import Side from "./sidebar/Sidebar";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import TopNavbar, { PageBody, pageLayoutStyles } from "../components/TopNavbar";
import DateInput from "../components/DateInput";
import clientService from "../services/ClientService";
import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";
import sifService from "../services/SifService";
import { buildYearList } from "../utils/yearOptions";
import { calculateLeaveDays } from "../utils/leaveCalculator";
import {
  buildLeaveMasterTrackerData,
  buildLeaveMasterTrackerSummaryRows,
  buildLeaveMasterTrackerWorkbook,
  downloadLeaveMasterTrackerWorkbook,
} from "../utils/leaveMasterTrackerExport";
import {
  buildStaffSalaryWorkbook,
  downloadStaffSalaryWorkbook,
  getSalaryReportDays,
} from "../utils/staffSalaryExport";
import {
  isNonWorkingEmployeeStatus,
  isWorkingEmployeeStatus,
  formatEmployeeStatusDisplay,
  toSearchableEmployeeOption,
  filterReactSelectEmployeeOption,
} from "../utils/employeeStatusDisplay";
import { findLinkedEmployee, formatVacationStatusLabel, mergeEffectiveVacationStatuses, formatExperienceLabel } from "../utils/yetToGoHelpers";
import { useUrlListView } from "../hooks/usePersistedListPage";

const REPORT_TYPES = [
  "Leave Report",
  "Document expiry",
  "Salary report",
  "Employee Experience",
  "Employees Master Data",
];

const REPORT_TYPE_TO_SLUG = {
  "Leave Report": "leave",
  "Document expiry": "document-expiry",
  "Salary report": "salary",
  "Employee Experience": "employee-experience",
  "Employees Master Data": "employees-master-data",
};

const formatReportDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB");
};

const formatYesNo = (value) => {
  if (value === true || value === "true" || value === "Yes") return "Yes";
  if (value === false || value === "false" || value === "No") return "No";
  return "";
};

/** Map one Employee Master record to report columns (existing schema fields only). */
const mapEmployeeMasterRow = (e) => {
  const emergency = e.emergencyContact || {};
  const uae = emergency.uae || {};
  const home = emergency.homeCountry || {};
  return {
    "Employee ID": e.employeeId || "",
    "Employee Name": e.employeeName || "",
    "Date of Birth": formatReportDate(e.dateOfBirth),
    Gender: e.gender || "",
    Nationality: e.nationality || "",
    Department: e.department || "",
    Designation: e.designation || "",
    Role: e.role || "",
    Company: e.office || "",
    "Company Code": e.companyCode || "",
    "Office Location": e.office || "",
    "Joining Date": formatReportDate(e.doj),
    "Employment Status": formatEmployeeStatusDisplay(e),
    "Employee Status (Raw)": e.employeeStatus || "",
    Email: e.emailId || "",
    "Contact Number": e.mobile || "",
    "Reporting Manager": e.reportingManager || "",
    "Notice Period": e.noticePeriod || "",
    "Notice Period Start": formatReportDate(e.noticePeriodStartDate),
    "Notice Period End": formatReportDate(e.noticePeriodEndDate),
    "Provision / Probation Period": e.provisionPeriod || "",
    "Provision Period Start": formatReportDate(e.provisionPeriodStartDate),
    "Provision Period End": formatReportDate(e.provisionPeriodEndDate),
    "Last Working Day": formatReportDate(e.lastWorkingDay),
    "Vacation Status": formatVacationStatusLabel(e.vacationStatus) || e.vacationStatus || "",
    Attendance: e.attendance || "",
    "Emirates ID": e.emiratesId || "",
    "Emirates ID Expiry": formatReportDate(e.emiratesIdExpiryDate),
    "Passport No": e.passportNo || "",
    "Passport Expiry": formatReportDate(e.passportExpiryDate),
    "Labour Card Number": e.labourCardNumber || "",
    "Labour Card Expiry": formatReportDate(e.labourCardExpiryDate),
    "Visa Expiry": formatReportDate(e.visaExpiryDate),
    "Work Permit No": e.workPermitNo || "",
    "Contract Renewal Date": formatReportDate(e.contractRenewalDate),
    "Total Years Experience": formatExperienceLabel(
      e.doj,
      e.totalYearsExperience,
      (isNonWorkingEmployeeStatus(e.employeeStatus) && e.lastWorkingDay) ? e.lastWorkingDay : new Date()
    ) || "",
    "Life Insurance": formatYesNo(e.lifeInsurance),
    "Medical Insurance": formatYesNo(e.medicalInsurance),
    Airfare: formatYesNo(e.airFare),
    "Emergency Contact (UAE) Name": uae.name || "",
    "Emergency Contact (UAE) Phone": uae.contactNo || "",
    "Emergency Contact (Home) Name": home.name || "",
    "Emergency Contact (Home) Phone": home.contactNo || "",
    Remarks: e.remarks || "",
  };
};

const SIF_HEADERS = [
  "StaffID", "EMPID", "EMPNAME", "EMPLOYERID", "AGENTCODE",
  "BANKACCOUNT", "STATUS", "BASIC", "HRA", "TRANSPOR",
  "OTHERALLOV", "DEDUCTIO", "TOTA",
];
const SIF_RED_HEADERS = new Set(["StaffID", "EMPID", "EMPLOYERID", "AGENTCODE", "BANKACCOUNT"]);

const EMPLOYEE_MENU_VISIBLE_COUNT = 5;
const EMPLOYEE_OPTION_HEIGHT = 48;
const EMPLOYEE_MENU_MAX_HEIGHT = EMPLOYEE_MENU_VISIBLE_COUNT * EMPLOYEE_OPTION_HEIGHT;

const getEmployeeSelectStyles = (menuWidth) => ({
  container: (base) => ({
    ...base,
    width: "100%",
  }),
  control: (base, state) => ({
    ...base,
    minHeight: "2.875rem",
    borderRadius: "0.625rem",
    borderColor: state.isFocused ? "#3b82f6" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(59, 130, 246, 0.12)" : "none",
    fontSize: "0.9rem",
    fontWeight: 500,
    cursor: "pointer",
    width: "100%",
    "&:hover": { borderColor: "#cbd5e1" },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 0.875rem",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
  }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({
    ...base,
    color: "#64748b",
    paddingRight: "0.75rem",
    "&:hover": { color: "#334155" },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 10000,
    width: menuWidth ? `${menuWidth}px` : "100%",
    minWidth: menuWidth ? `${menuWidth}px` : "28rem",
    borderRadius: "0.625rem",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
    overflow: "hidden",
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: `${EMPLOYEE_MENU_MAX_HEIGHT}px`,
    padding: "4px 0",
    overflowY: "auto",
  }),
  option: (base, state) => ({
    ...base,
    minHeight: `${EMPLOYEE_OPTION_HEIGHT}px`,
    padding: "0 14px",
    fontSize: "0.9rem",
    textTransform: "none",
    backgroundColor: state.isSelected ? "#2563eb" : state.isFocused ? "#eff6ff" : "#fff",
    color: state.isSelected ? "#fff" : "#0f172a",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
  }),
  singleValue: (base) => ({
    ...base,
    textTransform: "none",
    maxWidth: "100%",
    color: "#0f172a",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
    textTransform: "none",
  }),
  noOptionsMessage: (base) => ({
    ...base,
    fontSize: "0.875rem",
    color: "#64748b",
    padding: "12px 14px",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 10000,
  }),
});

function Reports() {
  // Resume last selected report (e.g. Leave) via URL + session — survives refresh & sidebar nav
  const [reportType, setReportType] = useUrlListView({
    storageKey: "reports",
    basePath: "/reports",
    paramName: "type",
    valueToSlug: REPORT_TYPE_TO_SLUG,
    fallback: "",
  });
  const [format, setFormat] = useState("");

  // Filters
  const [leadType, setLeadType] = useState("All");
  const [followupStatus, setFollowupStatus] = useState("All");
  const [employeeStatus, setEmployeeStatus] = useState("All");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterRole, setFilterRole] = useState("All");
  const [filterOffice, setFilterOffice] = useState("All");
  const [filterCountry, setFilterCountry] = useState("All");
  const [minExperience, setMinExperience] = useState("All");
  const [minExpMonths, setMinExpMonths] = useState("All");
  const [experienceMode, setExperienceMode] = useState("minimum"); // "minimum" | "exact"
  const [filterEmployee, setFilterEmployee] = useState("All");
  const employeeSelectWrapRef = useRef(null);
  const [employeeMenuWidth, setEmployeeMenuWidth] = useState(null);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterMonth, setFilterMonth] = useState("All");
  const [filterYear, setFilterYear] = useState(() => String(new Date().getFullYear()));

  const monthsList = ["All", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  // Wide historical + future year range so reports are not limited to the current year
  const yearsList = buildYearList({ pastYears: 25, futureYears: 5, includeAll: true });

  // Dynamic dropdown list selectors
  const [uniqueDepartments, setUniqueDepartments] = useState(["All"]);
  const [uniqueRoles, setUniqueRoles] = useState(["All"]);
  const [uniqueOffices, setUniqueOffices] = useState(["All"]);
  const [uniqueCountries, setUniqueCountries] = useState(["All"]);
  const [employeeList, setEmployeeList] = useState([]);

  const employeeOptions = useMemo(() => {
    const sorted = [...employeeList].sort((a, b) =>
      (a.employeeName || "").localeCompare(b.employeeName || "")
    );
    return [
      { value: "All", label: "All Employees", name: "All Employees", employeeId: "" },
      ...sorted.map((emp) => toSearchableEmployeeOption(emp, {
        value: emp.employeeId || emp._id,
        label: `${emp.employeeName || "Unknown"}${emp.employeeId ? ` (${emp.employeeId})` : ""}`,
      })),
    ];
  }, [employeeList]);

  const selectedEmployeeOption =
    employeeOptions.find((opt) => opt.value === filterEmployee) || employeeOptions[0];

  const showEmployeeSearchPlaceholder =
    employeeMenuOpen && filterEmployee === "All";

  const employeeSelectValue = showEmployeeSearchPlaceholder
    ? null
    : selectedEmployeeOption;

  const syncEmployeeMenuWidth = useCallback(() => {
    if (employeeSelectWrapRef.current) {
      setEmployeeMenuWidth(employeeSelectWrapRef.current.offsetWidth);
    }
  }, []);

  const handleEmployeeMenuOpen = useCallback(() => {
    syncEmployeeMenuWidth();
    setEmployeeMenuOpen(true);
  }, [syncEmployeeMenuWidth]);

  const handleEmployeeMenuClose = useCallback(() => {
    setEmployeeMenuOpen(false);
  }, []);

  const employeeSelectStyles = useMemo(
    () => getEmployeeSelectStyles(employeeMenuWidth),
    [employeeMenuWidth]
  );

  const formatEmployeeOption = useCallback((option) => {
    if (option.value === "All") {
      return <span className={styles.employeeOptionAll}>{option.label}</span>;
    }

    return (
      <span className={styles.employeeOptionLabel}>
        <span className={styles.employeeOptionName}>{option.name}</span>
        {option.employeeId ? (
          <span className={styles.employeeOptionId}>{option.employeeId}</span>
        ) : null}
      </span>
    );
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // SIF settings (Salary report)
  const [sifEmployerId, setSifEmployerId] = useState("");
  const [sifAgentCode, setSifAgentCode] = useState("");
  const sifInputRef = useRef(null);
  const [sifImportOpen, setSifImportOpen] = useState(false);
  const [sifDragOver, setSifDragOver] = useState(false);
  const [sifImporting, setSifImporting] = useState(false);
  const [sifPreviewRows, setSifPreviewRows] = useState([]);
  const [sifPreviewFile, setSifPreviewFile] = useState(null);

  // Preview States
  const [previewData, setPreviewData] = useState([]);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const data = await employeeService.getEmployeesList();
        const empList = Array.isArray(data)
          ? data
          : data.employees || data.data || [];

        const depts = ["All", ...[...new Set(empList.map(e => e.department).filter(Boolean))].sort()];
        const roles  = ["All", ...[...new Set(empList.flatMap(e => [e.role, e.designation]).filter(Boolean))].sort()];
        const offices = ["All", ...[...new Set(empList.map(e => e.office).filter(Boolean))].sort()];
        const countries = ["All", ...[...new Set(empList.map(e => e.nationality).filter(Boolean))].sort()];

        setUniqueDepartments(depts);
        setUniqueRoles(roles);
        setUniqueOffices(offices);
        setUniqueCountries(countries);
        setEmployeeList(empList);
      } catch (err) {
        console.error("Failed to load employees for report filters:", err);
      }
    };
    loadEmployees();
  }, []);

  useEffect(() => {
    sifService.getSettings()
      .then((s) => {
        setSifEmployerId(s.employerId || "");
        setSifAgentCode(s.defaultAgentRoutingCode || "");
      })
      .catch(() => {});
  }, []);

  // Employees Master Data: default Status=Active, then auto-load / refresh preview
  const masterDataReadyRef = useRef(false);
  useEffect(() => {
    if (reportType !== "Employees Master Data") {
      masterDataReadyRef.current = false;
      return undefined;
    }

    if (!masterDataReadyRef.current) {
      masterDataReadyRef.current = true;
      if (employeeStatus !== "Active") {
        setEmployeeStatus("Active");
        return undefined;
      }
    }

    let cancelled = false;
    const loadMasterPreview = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchReportData("Employees Master Data");
        if (cancelled) return;
        if (!data.length) {
          setPreviewData([]);
          setPreviewHeaders([]);
          setShowPreview(false);
          return;
        }
        setPreviewData(data);
        setPreviewHeaders(Object.keys(data[0]));
        setShowPreview(true);
      } catch (err) {
        console.error("Employees Master Data preview failed:", err);
        if (!cancelled) setError("Failed to load Employees Master Data. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMasterPreview();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reportType,
    employeeStatus,
    filterEmployee,
    filterDepartment,
    filterRole,
    filterOffice,
    filterCountry,
  ]);

  const saveSifSettings = useCallback(async (employerId, agentCode, { silent = true } = {}) => {
    try {
      await sifService.saveSettings({
        employerId: employerId,
        defaultAgentRoutingCode: agentCode,
      });
    } catch (err) {
      if (!silent) throw err;
    }
  }, []);

  const digitsOnly = (v) => String(v ?? "").replace(/\D/g, "");

  const getBankAccount = (sal) => {
    const iban = String(sal.ibanNumber || "").trim();
    const account = String(sal.accountNumber || "").trim();
    if (iban) return iban.replace(/\s+/g, "");
    return account.replace(/\s+/g, "");
  };

  const getFixedIncome = (sal) => {
    if (sal.totalSalary != null && Number(sal.totalSalary) > 0) {
      return Number(sal.totalSalary);
    }
    const basic = Number(sal.basicSalary) || 0;
    const house = Number(sal.houseRent) || 0;
    const travel = Number(sal.travelExp) || 0;
    const other = Number(sal.other) || 0;
    const allowance = Number(sal.totalAllowance) || house + travel + other;
    return basic + allowance;
  };

  // Full employee data (includes salaryDetails, increments, etc.)
  // needed for Salary report. Fetched once and cached.
  // Optional statusFilter: 'Active' | 'InActive' — applied server-side.
  const fetchFullEmployees = async (statusFilter) => {
    const data = await employeeService.getEmployees({
      force: true,
      status: statusFilter || undefined,
    });
    return Array.isArray(data) ? data : (data.employees || data.data || []);
  };

  /** Build Staff Leave Report Master tracker data (summary + yearly sheets). */
  const loadLeaveMasterTracker = async () => {
    let leaves = await leaveRequestService.getLeaveRequests();
    leaves = Array.isArray(leaves) ? leaves : (leaves.data || []);

    let empList = await fetchFullEmployees(
      employeeStatus === "Active" ? "Active" : employeeStatus === "InActive" ? "InActive" : undefined
    );
    if (!Array.isArray(empList)) empList = [];

    // Same status matching as other employee reports (Active / InActive)
    if (employeeStatus !== "All") {
      empList = empList.filter(
        (e) =>
          e.employeeStatus === employeeStatus ||
          e.attendance === employeeStatus ||
          (employeeStatus === "Active" && isActiveEmployee(e)) ||
          (employeeStatus === "InActive" && isInactiveEmployee(e))
      );
    }

    if (filterEmployee !== "All") {
      const selectedEmp = employeeList.find(e => (e.employeeId || e._id) === filterEmployee)
        || empList.find(e => (e.employeeId || e._id) === filterEmployee);
      if (selectedEmp) {
        empList = empList.filter(e =>
          (e.employeeId && e.employeeId === selectedEmp.employeeId) ||
          (e._id && String(e._id) === String(selectedEmp._id))
        );
        leaves = leaves.filter(l =>
          l.employeeName === selectedEmp.employeeName ||
          l.employeeId === selectedEmp.employeeId ||
          l.employeeId === filterEmployee
        );
      }
    }

    if (filterDepartment !== "All") {
      empList = empList.filter(e => e.department === filterDepartment);
      leaves = leaves.filter(l => l.department === filterDepartment);
    }

    // Do not strip leave history by month/year — master tracker needs full yearly totals for LEAVE DUE.
    // Year filter only affects the TILL (as-of) date used in calculations.

    empList = [...empList].sort((a, b) =>
      String(a.employeeName || "").localeCompare(String(b.employeeName || ""))
    );

    let tillDate = new Date(new Date().getFullYear(), 11, 31);
    if (filterYear !== "All" && !Number.isNaN(Number(filterYear))) {
      tillDate = new Date(Number(filterYear), 11, 31);
    } else if (endDate) {
      const ed = new Date(endDate);
      if (!Number.isNaN(ed.getTime())) tillDate = ed;
    }

    return buildLeaveMasterTrackerData({
      employees: empList,
      leaveRequests: leaves,
      tillDate,
    });
  };

  const isInactiveEmployee = (emp) => isNonWorkingEmployeeStatus(emp?.employeeStatus);
  const isActiveEmployee = (emp) => isWorkingEmployeeStatus(emp?.employeeStatus);

  const reportTypes = REPORT_TYPES;
  const formats = reportType === "Salary report"
    ? ["Excel", "PDF", "SIF"]
    : ["Excel", "PDF"];

  const leadTypeOptions = ["All", "Lead", "Client"];
  const followupStatusOptions = [
    "All", "Completed", "Contacted", "Demo Scheduled", "Lost",
    "Needs Analysis", "Pending", "Progress", "Proposal Sent", "Won"
  ];
  const employeeStatusOptions =
    reportType === "Employees Master Data"
      ? [
          { value: "Active", label: "Active" },
          { value: "InActive", label: "Ex-Employee / Inactive" },
          { value: "All", label: "All" },
        ]
      : [
          { value: "All", label: "All" },
          { value: "Active", label: "Active" },
          { value: "InActive", label: "InActive" },
        ];
  const minExperienceOptions = ["All", ...Array.from({ length: 21 }, (_, i) => String(i))];
  const minExpMonthsOptions = ["All", ...Array.from({ length: 12 }, (_, i) => String(i))];

  const clientDropdownOptions = {
    clientType: ["Agent", "Barge Operator", "Barge Owners", "Broker", "CHA", "Consignee", "Freigt Forwarder", "Other", "Ship Owners", "Shipper", "Transporter"],
    leadType: ["Client", "Lead"],
    leadSource: ["Advertisement", "Cold Call", "Conference", "Employee Referral", "Exhibitor", "Exhibition As Visitor", "External Referral", "SOCIAL MEDIA"],
    leadStatus: ["Attempted To Contact", "Contact In Future", "Contacted", "Junk Lead", "Lost Lead", "Negotiation", "New", "Qualified", "Quoted", "Won"],
    industryType: ["Bulk trading company", "Cement manufacturing companies", "Cryogenic tank manufacturers", "Dredging companies", "Drydocks", "Fiber pipe manufacturing company", "Freight forwarders", "Gypsum traders", "Heavy engineering", "Heavy transport companies in abroad", "Heavy transport companies in india", "Hydro power", "Industrial air filter companies", "Industrial boiler", "Industrial gases tank / cylinders", "Jack up rig owners", "Limestone traders", "Mining companies", "Navy", "Nuclear power", "Offshore companies", "Offshore windmill companies", "Oil and gas companies", "Pick up trucks", "Port infrastructure companies", "Railway wagon manufacturers", "Shipbuilding", "Shipyards", "Silica sand manufacturers", "Steel traders", "Straddle carrier manufacturer", "Thermal power", "Transformer manufacturers", "Windmill companies"],
    category: ["Breakbulk", "Bulk", "Project"],
    decisionMaker: ["No", "Yes"],
    relationshipStatus: ["Active", "Dormant", "Lost", "Prospect"],
    contractType: ["COA", "Long-term", "Spot", "Tender"],
    currentStatus: ["Contacted", "Lead", "Lost", "Negotiation", "Quoted", "Won"],
    followupStatus: ["Completed", "Contacted", "Demo Scheduled", "Lost", "Needs Analysis", "Pending", "Progress", "Proposal Sent", "Won"],
    incoterms: ["FOB", "CIF", "DAP"]
  };

  const employeeDropdownOptions = {
    attendance: ["Active", "InActive"],
    department: ["Operations", "Sales", "Marketing", "HR", "Finance", "IT", "Logistics", "Customer Service"],
    role: ["Operations Manager", "Sales Executive", "Logistics Coordinator", "Account Manager", "HR Manager", "Finance Analyst", "IT Specialist", "Customer Service Representative"]
  };

  const handleCancel = () => {
    setReportType("");
    setFormat("");
    setLeadType("All");
    setFollowupStatus("All");
    setEmployeeStatus("All");
    setFilterDepartment("All");
    setFilterRole("All");
    setFilterOffice("All");
    setFilterCountry("All");
    setMinExperience("All");
    setMinExpMonths("All");
    setExperienceMode("minimum");
    setFilterEmployee("All");
    setStartDate("");
    setEndDate("");
    setFilterMonth("All");
    setFilterYear("All");
    setError("");
    setPreviewData([]);
    setPreviewHeaders([]);
    setShowPreview(false);
  };

  // Compute experience in months from Date of Joining
  const computeExperienceFromDoj = (doj) => {
    if (!doj) return null;
    const joinDate = new Date(doj);
    if (isNaN(joinDate.getTime())) return null;
    const now = new Date();
    const years = now.getFullYear() - joinDate.getFullYear();
    const months = now.getMonth() - joinDate.getMonth();
    const totalMonths = years * 12 + months - (now.getDate() < joinDate.getDate() ? 1 : 0);
    return Math.max(0, totalMonths);
  };

  const formatExperience = (totalMonths) => {
    if (totalMonths == null) return "N/A";
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
    if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
    return `${y} year${y !== 1 ? 's' : ''} ${m} month${m !== 1 ? 's' : ''}`;
  };

  const getEmployeeExperienceMonths = (e) => {
    const fromDoj = computeExperienceFromDoj(e.doj);
    return fromDoj != null ? fromDoj : ((e.totalYearsExperience || 0) * 12);
  };

  // Filter by Minimum (>=) or Exact experience
  const filterByExperience = (empList) => {
    if (minExperience === "All" && minExpMonths === "All") return empList;

    const years = minExperience !== "All" ? parseInt(minExperience, 10) : 0;
    const months = minExpMonths !== "All" ? parseInt(minExpMonths, 10) : 0;
    const thresholdMonths = years * 12 + months;

    return empList.filter(e => {
      const expMonths = getEmployeeExperienceMonths(e);

      if (experienceMode === "exact") {
        // Exact years only (months = All): match completed years, e.g. "1 year" => 12–23 months
        if (minExperience !== "All" && minExpMonths === "All") {
          return Math.floor(expMonths / 12) === years;
        }
        // Exact months only (years = All): match residual months, e.g. "3 months" => 3, 15, 27...
        if (minExperience === "All" && minExpMonths !== "All") {
          return expMonths % 12 === months;
        }
        // Exact years + months: total months must match exactly
        return expMonths === thresholdMonths;
      }

      // Minimum: experience must be at least the selected years + months
      return expMonths >= thresholdMonths;
    });
  };

  const fetchReportData = async (type) => {
    const hasDateFilter = (startDate && endDate) || filterMonth !== "All" || filterYear !== "All";

    const isDateMatch = (dateVal) => {
      if (!dateVal) return false;
      const date = new Date(dateVal);
      if (isNaN(date.getTime())) return false;

      let match = true;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (date < start || date > end) match = false;
      }
      if (filterMonth !== "All") {
        const monthMap = { "January": 0, "February": 1, "March": 2, "April": 3, "May": 4, "June": 5, "July": 6, "August": 7, "September": 8, "October": 9, "November": 10, "December": 11 };
        if (date.getUTCMonth() !== monthMap[filterMonth]) match = false;
      }
      if (filterYear !== "All") {
        const y =
          typeof dateVal === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateVal)
            ? Number(dateVal.slice(0, 4))
            : date.getUTCFullYear();
        if (String(y) !== String(filterYear)) match = false;
      }
      return match;
    };

    if (type === "Leave Report") {
      // Flat historical leave rows for preview/PDF (Excel master tracker keeps its own calc path).
      let leaves = [];
      try {
        const leaveData = await leaveRequestService.getLeaveRequests();
        leaves = Array.isArray(leaveData) ? leaveData : (leaveData?.data || []);
      } catch (err) {
        console.error("Leave report: failed to load leave history", err);
        leaves = [];
      }

      let empList = await fetchFullEmployees(
        employeeStatus === "Active"
          ? "Active"
          : employeeStatus === "InActive"
            ? "InActive"
            : undefined
      );
      if (!Array.isArray(empList)) empList = [];

      // Same status matching as other employee reports (Active / InActive)
      if (employeeStatus !== "All") {
        empList = empList.filter(
          (e) =>
            e.employeeStatus === employeeStatus ||
            e.attendance === employeeStatus ||
            (employeeStatus === "Active" && isActiveEmployee(e)) ||
            (employeeStatus === "InActive" && isInactiveEmployee(e))
        );
      }

      if (filterEmployee !== "All") {
        const selectedEmp =
          employeeList.find((e) => (e.employeeId || e._id) === filterEmployee) ||
          empList.find((e) => (e.employeeId || e._id) === filterEmployee);
        if (selectedEmp) {
          empList = empList.filter(
            (e) =>
              (e.employeeId && e.employeeId === selectedEmp.employeeId) ||
              (e._id && String(e._id) === String(selectedEmp._id))
          );
          leaves = leaves.filter(
            (l) =>
              l.employeeName === selectedEmp.employeeName ||
              l.employeeId === selectedEmp.employeeId ||
              l.employeeId === filterEmployee ||
              findLinkedEmployee(l, [selectedEmp])
          );
        }
      }

      if (filterDepartment !== "All") {
        empList = empList.filter((e) => e.department === filterDepartment);
        leaves = leaves.filter((l) => {
          const emp = findLinkedEmployee(l, empList);
          return (
            l.department === filterDepartment ||
            (emp && emp.department === filterDepartment)
          );
        });
      }

      const rows = [];
      for (const leave of leaves) {
        if (!leave || leave.status === "Cancelled") continue;

        const emp = findLinkedEmployee(leave, empList);
        // Keep orphan historical leaves only when no status/employee filter requires a linked employee
        if (filterEmployee !== "All" && !emp) continue;
        if (employeeStatus !== "All" && !emp) continue;
        if (filterDepartment !== "All" && !emp && leave.department !== filterDepartment) {
          continue;
        }

        const start = leave.startDate ? new Date(leave.startDate) : null;
        const end = leave.endDate ? new Date(leave.endDate) : start;
        if (!start || Number.isNaN(start.getTime())) continue;

        if (hasDateFilter && !isDateMatch(start)) continue;

        const days = calculateLeaveDays(start, end || start) || 0;

        rows.push({
          "Employee ID": emp?.employeeId || leave.employeeId || "",
          "Employee Name":
            emp?.employeeName || leave.employeeName || leave.employee?.username || "",
          "Leave Year": String(
            typeof leave.startDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(leave.startDate)
              ? Number(leave.startDate.slice(0, 4))
              : start.getUTCFullYear()
          ),
          "Number of Leave Days": days,
          "Start Date": start.toLocaleDateString("en-GB"),
          "End Date":
            end && !Number.isNaN(end.getTime())
              ? end.toLocaleDateString("en-GB")
              : "",
          "Leave Type": leave.leaveType || "",
          Status: leave.status || "",
          Department: emp?.department || leave.department || "",
          Company: emp?.office || leave.company || "",
          "Airfare Requested": leave.requestAirfare ? "Yes" : "No",
          Reason: leave.reason || leave.changeRemarks || "",
        });
      }

      rows.sort((a, b) => {
        const y = String(a["Leave Year"]).localeCompare(String(b["Leave Year"]));
        if (y !== 0) return y;
        return String(a["Employee Name"]).localeCompare(String(b["Employee Name"]));
      });

      return rows;
    }

    if (type === "Document expiry") {
      let data = await employeeService.getEmployeesList({ force: true });
      let empList = Array.isArray(data) ? data : (data.employees || data.data || []);

      if (filterEmployee !== "All") empList = empList.filter(e => (e.employeeId || e._id) === filterEmployee);
      // Document Expiry: Active (Working) employees only — exclude InActive/Non-Working
      empList = empList.filter(isActiveEmployee);
      if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
      if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
      if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
      if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
      empList = filterByExperience(empList);

      if (hasDateFilter) {
        empList = empList.filter(e => {
          return isDateMatch(e.passportExpiryDate) || isDateMatch(e.visaExpiryDate) || isDateMatch(e.labourCardExpiryDate);
        });
      }

      const today = new Date();
      const getStatus = (expiryDate) => {
        if (!expiryDate) return "N/A";
        const exp = new Date(expiryDate);
        const diffTime = exp - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return "EXPIRED";
        if (diffDays <= 30) return "Expiring in < 30 Days";
        if (diffDays <= 90) return "Expiring in < 90 Days";
        return "Active / Valid";
      };

      return empList.map(e => {
        const passportStatus = getStatus(e.passportExpiryDate);
        const visaStatus = getStatus(e.visaExpiryDate);
        const laborStatus = getStatus(e.labourCardExpiryDate);

        return {
          "Employee ID": e.employeeId || "",
          "Name": e.employeeName || "",
          "Department": e.department || "",
          "Role": e.role || "",
          "Company": e.office || "",
          "Company Code": e.companyCode || "",
          "Passport No": e.passportNo || "",
          "Passport Expiry": e.passportExpiryDate ? new Date(e.passportExpiryDate).toLocaleDateString('en-GB') : "Not set",
          "Passport Status": passportStatus,
          "Visa Expiry": e.visaExpiryDate ? new Date(e.visaExpiryDate).toLocaleDateString('en-GB') : "Not set",
          "Visa Status": visaStatus,
          "Labour Card Expiry": e.labourCardExpiryDate ? new Date(e.labourCardExpiryDate).toLocaleDateString('en-GB') : "Not set",
          "Labour Card Status": laborStatus
        };
      });
    }

    if (type === "Salary report") {
      // All / Active → Active only; InActive → InActive only (server + client)
      const statusForApi = employeeStatus === "InActive" ? "InActive" : "Active";
      let empList = await fetchFullEmployees(statusForApi);

      if (filterEmployee !== "All") empList = empList.filter(e => (e.employeeId || e._id) === filterEmployee);
      if (employeeStatus === "InActive") {
        empList = empList.filter(isInactiveEmployee);
      } else {
        empList = empList.filter(isActiveEmployee);
      }
      if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
      if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
      if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
      if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
      empList = filterByExperience(empList);

      const rows = empList.map(e => {
        const sal = e.salaryDetails || {};
        return {
          "Employee ID": e.employeeId || "",
          "Name": e.employeeName || "",
          "Status": e.employeeStatus || "",
          "Department": e.department || "",
          "Role": e.role || "",
          "Company": e.office || "",
          "Company Code": e.companyCode || "",
          "Basic Salary": Number(sal.basicSalary) || 0,
          "House Rent Allowance": Number(sal.houseRent) || 0,
          "Travel Allowance": Number(sal.travelExp) || 0,
          "Other Allowance": Number(sal.other) || 0,
          "Total Allowance": Number(sal.totalAllowance) || 0,
          "Deduction": Number(sal.deduction) || 0,
          "Total / Net Salary": Number(sal.totalSalary) || 0,
          "Bank Name": sal.bankName || "",
          "Account Number": sal.accountNumber || "",
          "IBAN": sal.ibanNumber || "",
          "Sort Code": sal.bankSortCode || ""
        };
      });

      // Final safety net so Excel/PDF never include the opposite status
      if (employeeStatus === "InActive") {
        return rows.filter((r) => isInactiveEmployee({ employeeStatus: r.Status }));
      }
      return rows.filter((r) => isActiveEmployee({ employeeStatus: r.Status }));
    }

    if (type === "Employee Experience") {
      let data = await employeeService.getEmployeesList();
      let empList = Array.isArray(data) ? data : (data.employees || data.data || []);

      if (filterEmployee !== "All") empList = empList.filter(e => (e.employeeId || e._id) === filterEmployee);
      if (employeeStatus !== "All") empList = empList.filter(e => e.employeeStatus === employeeStatus || e.attendance === employeeStatus);
      if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
      if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
      if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
      if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
      empList = filterByExperience(empList);

      return empList.map(e => {
        const expMonths = getEmployeeExperienceMonths(e);
        return {
          "Employee ID": e.employeeId || "",
          "Name": e.employeeName || "",
          "Department": e.department || "",
          "Role": e.role || "",
          "Office Location": e.office || "",
          "Company Code": e.companyCode || "",
          "Nationality": e.nationality || "",
          "Status": e.employeeStatus || "",
          "Date of Joining": e.doj ? new Date(e.doj).toLocaleDateString('en-GB') : "Not set",
          "Experience": formatExperience(expMonths),
          "Total Years (Stored)": e.totalYearsExperience != null ? e.totalYearsExperience : "N/A",
        };
      });
    }

    if (type === "Employees Master Data") {
      // Default Active; InActive = ex-employees; All = both (server status when possible)
      const statusForApi =
        employeeStatus === "Active"
          ? "Active"
          : employeeStatus === "InActive"
            ? "InActive"
            : undefined;
      let empList = await fetchFullEmployees(statusForApi);
      if (!Array.isArray(empList)) empList = [];

      // Same live vacation status as Annual Vacations (includeVacation merge)
      try {
        const vacList = await employeeService.getEmployeesList({ includeVacation: true });
        empList = mergeEffectiveVacationStatuses(empList, vacList);
      } catch (vacErr) {
        console.warn("Employees Master Data: vacation status overlay failed:", vacErr?.message || vacErr);
      }

      // Deduplicate by employeeId / _id
      const seen = new Set();
      empList = empList.filter((e) => {
        const key = String(e.employeeId || e._id || "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (employeeStatus === "Active") {
        empList = empList.filter(isActiveEmployee);
      } else if (employeeStatus === "InActive") {
        empList = empList.filter(isInactiveEmployee);
      }

      if (filterEmployee !== "All") {
        empList = empList.filter((e) => (e.employeeId || e._id) === filterEmployee);
      }
      if (filterDepartment !== "All") {
        empList = empList.filter((e) => e.department === filterDepartment);
      }
      if (filterRole !== "All") {
        empList = empList.filter(
          (e) => e.role === filterRole || e.designation === filterRole
        );
      }
      if (filterOffice !== "All") {
        empList = empList.filter((e) => e.office === filterOffice);
      }
      if (filterCountry !== "All") {
        empList = empList.filter((e) => e.nationality === filterCountry);
      }

      empList = [...empList].sort((a, b) =>
        String(a.employeeName || "").localeCompare(String(b.employeeName || ""))
      );

      return empList.map(mapEmployeeMasterRow);
    }

    return [];
  };

  const handlePreview = async () => {
    if (!reportType) { alert("Please select a report type."); return; }
    setLoading(true);
    setError("");
    setPreviewData([]);
    setPreviewHeaders([]);
    setShowPreview(false);

    try {
      const data = await fetchReportData(reportType);
      if (data.length === 0) {
        alert("No data found for the selected filters.");
        return;
      }
      setPreviewData(data);
      setPreviewHeaders(Object.keys(data[0]));
      setShowPreview(true);
    } catch (err) {
      console.error("Preview generation failed:", err);
      setError("Failed to load preview. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!reportType) { alert("Please select a report type."); return; }
    if (!format) { alert("Please select a format."); return; }

    setLoading(true);
    setError("");

    try {
      if (reportType === "Leave Report") {
        await generateLeaveReport();
      } else if (reportType === "Document expiry") {
        await generateDocumentExpiryReport();
      } else if (reportType === "Salary report") {
        await generateSalaryReport();
      } else if (reportType === "Employee Experience") {
        await generateEmployeeExperienceReport();
      } else if (reportType === "Employees Master Data") {
        await generateEmployeesMasterDataReport();
      }
    } catch (err) {
      console.error("Report generation failed:", err);
      setError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateLeaveReport = async () => {
    if (format === "Excel") {
      // Excel keeps existing master-tracker workbook + calculations unchanged
      const tracker = await loadLeaveMasterTracker();
      const exportData = buildLeaveMasterTrackerSummaryRows(tracker);
      if (exportData.length === 0) {
        alert("No data found for the selected filters.");
        return;
      }
      const wb = buildLeaveMasterTrackerWorkbook(tracker);
      await downloadLeaveMasterTrackerWorkbook(wb, "Staff_Leave_Report_Master_tracker", saveAs);
      return;
    }

    // PDF / other: full historical leave rows (2022–2026+)
    const exportData = await fetchReportData("Leave Report");
    if (exportData.length === 0) {
      alert("No data found for the selected filters.");
      return;
    }
    if (format === "PDF") {
      exportToPDF(exportData, "Leave_Report");
    }
  };

  const generateDocumentExpiryReport = async () => {
    const exportData = await fetchReportData("Document expiry");
    if (exportData.length === 0) { alert("No data found for the selected filters."); return; }
    if (format === "Excel") {
      exportToExcel(exportData, "Document_Expiry_Report");
    } else if (format === "PDF") {
      exportToPDF(exportData, "Document_Expiry_Report");
    }
  };

  const generateSalaryReport = async () => {
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const now = new Date();
    const m = filterMonth !== "All"
      ? monthNames.indexOf(filterMonth) + 1
      : now.getMonth() + 1;
    const y = filterYear !== "All" ? Number(filterYear) : now.getFullYear();

    if (format === "SIF") {
      await saveSifSettings(sifEmployerId, sifAgentCode, { silent: true });
      const result = await sifService.exportSif(m, y);
      if (result.skippedCount > 0) {
        alert(`SIF exported (${result.edrCount} records). ${result.skippedCount} employee(s) skipped due to missing data.`);
      }
      return;
    }

    // Excel: Staff Salary report layout (department sections + /30*days + SUM + yearly increments)
    if (format === "Excel") {
      const statusForApi = employeeStatus === "InActive" ? "InActive" : "Active";
      let empList = await fetchFullEmployees(statusForApi);
      if (filterEmployee !== "All") empList = empList.filter(e => (e.employeeId || e._id) === filterEmployee);
      if (employeeStatus === "InActive") {
        empList = empList.filter(isInactiveEmployee);
      } else {
        empList = empList.filter(isActiveEmployee);
      }
      if (filterDepartment !== "All") empList = empList.filter(e => e.department === filterDepartment);
      if (filterRole !== "All") empList = empList.filter(e => e.role === filterRole);
      if (filterOffice !== "All") empList = empList.filter(e => e.office === filterOffice);
      if (filterCountry !== "All") empList = empList.filter(e => e.nationality === filterCountry);
      empList = filterByExperience(empList);

      if (!empList.length) {
        alert("No data found for the selected filters.");
        return;
      }

      const days = getSalaryReportDays(filterMonth, filterYear);
      const wb = buildStaffSalaryWorkbook(empList, { days, tillYear: y });
      await downloadStaffSalaryWorkbook(wb, "Staff_Salary_Report", saveAs);
      return;
    }

    const exportData = await fetchReportData("Salary report");
    if (exportData.length === 0) { alert("No data found for the selected filters."); return; }
    if (format === "PDF") {
      exportToPDF(exportData, "Salary_Report");
    }
  };

  const generateEmployeeExperienceReport = async () => {
    const exportData = await fetchReportData("Employee Experience");
    if (exportData.length === 0) { alert("No data found for the selected filters."); return; }
    if (format === "Excel") {
      exportToExcel(exportData, "Employee_Experience_Report");
    } else if (format === "PDF") {
      exportToPDF(exportData, "Employee_Experience_Report");
    }
  };

  const generateEmployeesMasterDataReport = async () => {
    const exportData = await fetchReportData("Employees Master Data");
    if (exportData.length === 0) {
      alert("No data found for the selected filters.");
      return;
    }
    if (format === "Excel") {
      exportToExcel(exportData, "Employees_Master_Data_Report");
    } else if (format === "PDF") {
      exportToPDF(exportData, "Employees_Master_Data_Report");
    }
  };

  const isAllowedSifImportFile = (file) => {
    if (!file) return false;
    const name = (file.name || "").toLowerCase();
    return (
      name.endsWith(".sif") ||
      name.endsWith(".txt") ||
      name.endsWith(".csv") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      (file.type || "").includes("spreadsheet") ||
      (file.type || "").includes("excel") ||
      (file.type || "").includes("text")
    );
  };

  const SIF_IMPORT_HEADER_ALIASES = {
    STAFFID: "StaffID", EMPID: "EMPID", EMPNAME: "EMPNAME",
    EMPLOYERID: "EMPLOYERID", AGENTCODE: "AGENTCODE", AGENTCODI: "AGENTCODE",
    BANKACCOUNT: "BANKACCOUNT", STATUS: "STATUS", BASIC: "BASIC",
    HRA: "HRA", TRANSPOR: "TRANSPOR", TRANSPORT: "TRANSPOR",
    OTHERALLOV: "OTHERALLOV", OTHERALLOW: "OTHERALLOV",
    DEDUCTIO: "DEDUCTIO", DEDUCTION: "DEDUCTIO", TOTA: "TOTA", TOTAL: "TOTA",
  };

  const normalizeHeader = (h) => String(h || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  const parseImportFileForPreview = async (file) => {
    const name = (file.name || "").toLowerCase();
    const isExcel =
      name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv") ||
      (file.type || "").includes("spreadsheet") || (file.type || "").includes("excel");

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) return [];
      const json = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
      return json.map((row) => {
        const mapped = {};
        Object.keys(row).forEach((key) => {
          const norm = normalizeHeader(key);
          const canonical = SIF_IMPORT_HEADER_ALIASES[norm];
          if (canonical) mapped[canonical] = row[key];
        });
        return mapped;
      });
    }

    // Text-based SIF — parse lines
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.startsWith("EDR"));
    return lines.map((line) => {
      const parts = line.split(",");
      return {
        EMPID: parts[1] || "",
        AGENTCODE: parts[2] || "",
        BANKACCOUNT: parts[3] || "",
        BASIC: parts[7] || "",
        TOTA: parts[7] || "",
      };
    });
  };

  const handleFileForPreview = async (file) => {
    if (!file) return;
    if (!isAllowedSifImportFile(file)) {
      setError("Please upload a .SIF, .xlsx, .xls, .csv, or .txt file.");
      return;
    }
    setError("");
    try {
      const rows = await parseImportFileForPreview(file);
      if (!rows.length) {
        setError("File is empty or has no valid data rows.");
        return;
      }
      setSifPreviewRows(rows);
      setSifPreviewFile(file);
    } catch (err) {
      setError("Failed to parse file: " + (err.message || "unknown error"));
    }
  };

  const confirmSifImport = async () => {
    if (!sifPreviewFile) return;
    setSifImporting(true);
    setLoading(true);
    setError("");
    try {
      const name = (sifPreviewFile.name || "").toLowerCase();
      const isExcel =
        name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv") ||
        (sifPreviewFile.type || "").includes("spreadsheet") ||
        (sifPreviewFile.type || "").includes("excel");

      const result = isExcel
        ? await sifService.importExcel(sifPreviewFile)
        : await sifService.importSif(sifPreviewFile);

      const updated = result.updated ?? result.updatedCount ?? 0;
      const skipped = result.skipped?.length || 0;

      setSifImportOpen(false);
      setSifDragOver(false);
      setSifPreviewRows([]);
      setSifPreviewFile(null);
      alert(
        `Import complete. ${updated} employee(s) updated.${skipped ? ` ${skipped} skipped.` : ""}`
      );

      // Reload SIF settings (EMPLOYERID may have been updated from file)
      try {
        const s = await sifService.getSettings();
        setSifEmployerId(s.employerId || "");
        setSifAgentCode(s.defaultAgentRoutingCode || "");
      } catch {}

      if (reportType === "Salary report") {
        await handlePreview();
      }
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setSifImporting(false);
      setLoading(false);
      if (sifInputRef.current) sifInputRef.current.value = "";
    }
  };

  const handleImportSif = async (e) => {
    const file = e.target.files?.[0];
    if (sifInputRef.current) sifInputRef.current.value = "";
    if (!file) return;
    await handleFileForPreview(file);
  };

  const handleSifDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSifDragOver(false);
    if (sifImporting) return;
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    await handleFileForPreview(file);
  };

  const exportToExcel = (data, fileName, dropdownOptions) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    if (ws['!ref']) ws['!autofilter'] = { ref: ws['!ref'] };
    XLSX.utils.book_append_sheet(wb, ws, "Report Data");

    if (dropdownOptions) {
      const legendRows = [];
      Object.keys(dropdownOptions).forEach(key => {
        legendRows.push({ "Field": key.toUpperCase(), "Options": "" });
        dropdownOptions[key].forEach(opt => legendRows.push({ "Field": "", "Options": opt }));
        legendRows.push({ "Field": "", "Options": "" });
      });
      const wsLegend = XLSX.utils.json_to_sheet(legendRows);
      XLSX.utils.book_append_sheet(wb, wsLegend, "Dropdown Options");
    }

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
    saveAs(dataBlob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = (data, fileName) => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    // Add title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(fileName.replace("_", " ").toUpperCase(), 14, 15);
    
    // Add subtitle / date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${data.length}`, 14, 21);

    let filteredData = data;

    const headers = Object.keys(filteredData[0]);
    const rows = filteredData.map(item => 
      headers.map(header => 
        item[header] !== null && item[header] !== undefined ? String(item[header]) : ""
      )
    );

    autoTable(doc, {
      startY: 26,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle'
      },
      headStyles: {
        fillColor: [22, 163, 74], // green color matching the UI #16a34a
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252] // light grey for alternate rows
      },
      margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
      <Side />
      <main className={pageLayoutStyles.pageMain}>
        <TopNavbar title="Generate a Report" breadcrumb="Reports" />

        <PageBody as="section" className={styles["main-content"]}>
          <div className={styles.reportCard}>
          <div className={styles["report-container"]}>
            <div className={styles["report-header"]}>
              <div className={styles.reportHeaderText}>
                <div className={styles["report-title"]}>Generate Reports</div>
                <p className={styles.reportSubtitle}>
                  Configure filters below, then preview or download your report.
                </p>
              </div>
              <div className={styles["report-actions"]}>
                <button type="button" className={styles["cancel-button"]} onClick={handleCancel}>Cancel</button>
                {reportType === "Salary report" && (
                  <button
                    type="button"
                    className={styles["import-sif-button"]}
                    onClick={() => {
                      setError("");
                      setSifPreviewRows([]);
                      setSifPreviewFile(null);
                      setSifImportOpen(true);
                    }}
                    disabled={loading}
                  >
                    Import SIF / Excel
                  </button>
                )}
                <input
                  ref={sifInputRef}
                  type="file"
                  accept=".sif,.SIF,.txt,.csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  hidden
                  onChange={handleImportSif}
                />
                <button type="button" className={styles["preview-button"]} onClick={handlePreview} disabled={loading}>
                  {loading ? "Loading..." : "Preview"}
                </button>
                <button type="button" className={styles["generate-button"]} onClick={handleGenerateReport} disabled={loading}>
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </div>
          </div>

          <div className={styles["report-form"]}>
            <div className={styles["form-section"]}>

              {/* Report Type */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Select Type of Report</div>
                <div className={styles["form-field"]}>
                  <select
                    className={styles["select-field"]}
                    value={reportType}
                    onChange={e => {
                      const nextType = e.target.value;
                      setReportType(nextType);
                      setFormat("");
                      setLeadType("All");
                      setFollowupStatus("All");
                      // Employees Master Data defaults to Active employees only
                      setEmployeeStatus(nextType === "Employees Master Data" ? "Active" : "All");
                      setFilterDepartment("All");
                      setFilterRole("All");
                      setFilterOffice("All");
                      setFilterCountry("All");
                      setMinExperience("All");
                      setMinExpMonths("All");
                      setExperienceMode("minimum");
                      setFilterEmployee("All");
                      setFilterMonth("All");
                      setShowPreview(false);
                      setPreviewData([]);
                      setPreviewHeaders([]);
                      // Leave: default Year = current (existing Year filter)
                      if (nextType === "Leave Report") {
                        setFilterYear(String(new Date().getFullYear()));
                      } else {
                        setFilterYear("All");
                      }
                    }}
                  >
                    <option value="">Select type</option>
                    {reportTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>



              {/* Individual Employee Filter */}
              {reportType && (
                <div className={`${styles["form-row"]} ${styles.employeeSelectRow}`}>
                  <div className={styles["form-label"]}>Individual Employee</div>
                  <div
                    ref={employeeSelectWrapRef}
                    className={`${styles["form-field"]} ${styles.employeeSelectWrap}`}
                  >
                    <Select
                      inputId="report-employee-filter"
                      options={employeeOptions}
                      value={employeeSelectValue}
                      onChange={(opt) => setFilterEmployee(opt?.value || "All")}
                      placeholder={
                        showEmployeeSearchPlaceholder
                          ? "Search all employees"
                          : "All Employees"
                      }
                      isSearchable
                      openMenuOnFocus
                      blurInputOnSelect={false}
                      noOptionsMessage={() => "No employees found"}
                      styles={employeeSelectStyles}
                      classNamePrefix="report-employee-select"
                      menuPortalTarget={document.body}
                      menuPlacement="auto"
                      menuShouldScrollIntoView
                      maxMenuHeight={EMPLOYEE_MENU_MAX_HEIGHT}
                      formatOptionLabel={formatEmployeeOption}
                      onMenuOpen={handleEmployeeMenuOpen}
                      onMenuClose={handleEmployeeMenuClose}
                      filterOption={(option, inputValue) => {
                        if (option.value === "All") {
                          if (!inputValue) return true;
                          return String(option.label || "").toLowerCase().includes(inputValue.trim().toLowerCase());
                        }
                        return filterReactSelectEmployeeOption(option, inputValue);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Employee & Leave Report Filters */}
              {(reportType === "Document expiry" ||
                reportType === "Salary report" ||
                reportType === "Employee Experience" ||
                reportType === "Leave Report" ||
                reportType === "Employees Master Data") && (
                <div className={styles.filtersPanel}>
                  {/* Status — same as other employee reports (filters Active / InActive) */}
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Status</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={employeeStatus} onChange={e => setEmployeeStatus(e.target.value)}>
                        {employeeStatusOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Department Filter (Show for all of them) */}
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Department</div>
                    <div className={styles["form-field"]}>
                      <select className={styles["select-field"]} value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}>
                        {uniqueDepartments.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
    

                  {/* Role/Office/Country/Experience filters (Show only for non-leave reports) */}
                  {(reportType !== "Leave Report") && (
                    <>
                      <div className={styles["form-row"]}>
                        <div className={styles["form-label"]}>
                          {reportType === "Employees Master Data" ? "Role / Designation" : "Role"}
                        </div>
                        <div className={styles["form-field"]}>
                          <select className={styles["select-field"]} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                            {uniqueRoles.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
        

                      <div className={styles["form-row"]}>
                        <div className={styles["form-label"]}>
                          {reportType === "Employees Master Data" ? "Company / Office Location" : "Office Location"}
                        </div>
                        <div className={styles["form-field"]}>
                          <select className={styles["select-field"]} value={filterOffice} onChange={e => setFilterOffice(e.target.value)}>
                            {uniqueOffices.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>
        

                      <div className={styles["form-row"]}>
                        <div className={styles["form-label"]}>Country (Nationality)</div>
                        <div className={styles["form-field"]}>
                          <select className={styles["select-field"]} value={filterCountry} onChange={e => setFilterCountry(e.target.value)}>
                            {uniqueCountries.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </div>

                      {reportType !== "Document expiry" && reportType !== "Employees Master Data" && (
                        <>
                          <div className={`${styles["form-row"]} ${styles.experienceModeRow}`}>
                            <div className={styles["form-label"]}>Experience Filter</div>
                            <div className={`${styles["form-field"]} ${styles.experienceModeToggle}`}>
                              <button
                                type="button"
                                className={`${styles.experienceModeBtn} ${experienceMode === "minimum" ? styles.experienceModeBtnActive : ""}`}
                                onClick={() => setExperienceMode("minimum")}
                              >
                                Minimum
                              </button>
                              <button
                                type="button"
                                className={`${styles.experienceModeBtn} ${experienceMode === "exact" ? styles.experienceModeBtnActive : ""}`}
                                onClick={() => setExperienceMode("exact")}
                              >
                                Exact
                              </button>
                            </div>
                            <p className={styles.experienceModeHint}>
                              {experienceMode === "minimum"
                                ? "Shows employees with this experience or more."
                                : "Shows only employees matching this experience."}
                            </p>
                          </div>
                          <div className={styles["form-row"]}>
                            <div className={styles["form-label"]}>
                              {experienceMode === "minimum" ? "Min Years of Experience" : "Years of Experience"}
                            </div>
                            <div className={styles["form-field"]}>
                              <select
                                className={styles["select-field"]}
                                value={minExperience}
                                onChange={e => setMinExperience(e.target.value)}
                              >
                                {minExperienceOptions.map(o => <option key={o} value={o}>{o === "All" ? "All" : `${o} year${o !== "1" ? "s" : ""}`}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className={styles["form-row"]}>
                            <div className={styles["form-label"]}>
                              {experienceMode === "minimum" ? "Min Months of Experience" : "Months of Experience"}
                            </div>
                            <div className={styles["form-field"]}>
                              <select
                                className={styles["select-field"]}
                                value={minExpMonths}
                                onChange={e => setMinExpMonths(e.target.value)}
                              >
                                {minExpMonthsOptions.map(o => <option key={o} value={o}>{o === "All" ? "All" : `${o} month${o !== "1" ? "s" : ""}`}</option>)}
                              </select>
                            </div>
                          </div>
                        </>
                      )}
        
                    </>
                  )}
                </div>
              )}

              {reportType === "Document expiry" && (
                <>
                  <div className={`${styles["form-row"]} ${styles.experienceModeRow}`}>
                    <div className={styles["form-label"]}>Experience Filter</div>
                    <div className={`${styles["form-field"]} ${styles.experienceModeToggle}`}>
                      <button
                        type="button"
                        className={`${styles.experienceModeBtn} ${experienceMode === "minimum" ? styles.experienceModeBtnActive : ""}`}
                        onClick={() => setExperienceMode("minimum")}
                      >
                        Minimum
                      </button>
                      <button
                        type="button"
                        className={`${styles.experienceModeBtn} ${experienceMode === "exact" ? styles.experienceModeBtnActive : ""}`}
                        onClick={() => setExperienceMode("exact")}
                      >
                        Exact
                      </button>
                    </div>
                    <p className={styles.experienceModeHint}>
                      {experienceMode === "minimum"
                        ? "Shows employees with this experience or more."
                        : "Shows only employees matching this experience."}
                    </p>
                  </div>
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>
                      {experienceMode === "minimum" ? "Min Years of Experience" : "Years of Experience"}
                    </div>
                    <div className={styles["form-field"]}>
                      <select
                        className={styles["select-field"]}
                        value={minExperience}
                        onChange={e => setMinExperience(e.target.value)}
                      >
                        {minExperienceOptions.map(o => <option key={o} value={o}>{o === "All" ? "All" : `${o} year${o !== "1" ? "s" : ""}`}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>
                      {experienceMode === "minimum" ? "Min Months of Experience" : "Months of Experience"}
                    </div>
                    <div className={styles["form-field"]}>
                      <select
                        className={styles["select-field"]}
                        value={minExpMonths}
                        onChange={e => setMinExpMonths(e.target.value)}
                      >
                        {minExpMonthsOptions.map(o => <option key={o} value={o}>{o === "All" ? "All" : `${o} month${o !== "1" ? "s" : ""}`}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {reportType !== "Employees Master Data" && (
              <div className={styles.datePeriodPanel}>
              {/* Date Range */}
              <div className={`${styles["form-row"]} ${styles.dateRangeRow}`}>
                <div className={styles["form-label"]}>Choose a date range</div>
                <div className={`${styles["form-field"]} ${styles.dateRangeGroup}`}>
                  <DateInput className={styles["date-field"]} value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <span className={styles.dateRangeSep}>to</span>
                  <DateInput className={styles["date-field"]} value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className={styles.periodGroup}>
              {/* Month */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Month</div>
                <div className={styles["form-field"]}>
                  <select className={styles["select-field"]} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                    {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Year */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Year</div>
                <div className={styles["form-field"]}>
                  <select className={styles["select-field"]} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                    {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              </div>
              </div>
              )}



              {reportType === "Salary report" && (
                <div className={styles.sifSettingsPanel}>
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Employer ID</div>
                    <div className={styles["form-field"]}>
                      <input
                        type="text"
                        className={styles["select-field"]}
                        placeholder="13-digit Employer ID"
                        maxLength={13}
                        value={sifEmployerId}
                        onChange={(e) => setSifEmployerId(e.target.value.replace(/\D/g, "").slice(0, 13))}
                        onBlur={() => saveSifSettings(sifEmployerId, sifAgentCode)}
                      />
                    </div>
                  </div>
                  <div className={styles["form-row"]}>
                    <div className={styles["form-label"]}>Agent Code</div>
                    <div className={styles["form-field"]}>
                      <input
                        type="text"
                        className={styles["select-field"]}
                        placeholder="9-digit Agent Routing Code"
                        maxLength={9}
                        value={sifAgentCode}
                        onChange={(e) => setSifAgentCode(e.target.value.replace(/\D/g, "").slice(0, 9))}
                        onBlur={() => saveSifSettings(sifEmployerId, sifAgentCode)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Format */}
              <div className={styles["form-row"]}>
                <div className={styles["form-label"]}>Select Format</div>
                <div className={styles["form-field"]}>
                  <select className={styles["select-field"]} value={format} onChange={e => setFormat(e.target.value)}>
                    <option value="">Select a format</option>
                    {formats.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              {error && <div className={styles.errorMessage}>{error}</div>}

            </div>

            {showPreview && previewData.length > 0 && (
              <div className={styles["preview-section"]}>
                <div className={styles["preview-title-row"]}>
                  <div className={styles["report-title"]}>Report Preview ({reportType})</div>
                  <div className={styles["preview-subtitle"]}>Showing {previewData.length} records</div>
                </div>
                <div className={styles["preview-table-container"]}>
                  <table className={styles["preview-table"]}>
                    <thead>
                      <tr>
                        {previewHeaders.map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx}>
                          {previewHeaders.map(h => <td key={h}>{row[h] !== null && row[h] !== undefined ? String(row[h]) : ""}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.length > 0 && (
                  <div className={styles.previewNote}>
                    Scroll inside the table to view all records. Use Generate to download the full report as Excel, PDF{reportType === "Salary report" ? ", or SIF" : ""}.
                  </div>
                )}
              </div>
            )}
          </div>
          </div>

        </PageBody>
      </main>

      {sifImportOpen && (
        <div
          className={styles.sifImportOverlay}
          onClick={() => {
            if (!sifImporting) {
              setSifImportOpen(false);
              setSifDragOver(false);
              setSifPreviewRows([]);
              setSifPreviewFile(null);
            }
          }}
        >
          <div
            className={`${styles.sifImportModal} ${sifPreviewRows.length > 0 ? styles.sifImportModalWide : ""}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sif-import-title"
          >
            <div className={styles.sifImportHeader}>
              <div>
                <h3 id="sif-import-title" className={styles.sifImportTitle}>
                  Import SIF / Excel
                </h3>
                <p className={styles.sifImportSubtitle}>
                  {sifPreviewRows.length > 0
                    ? `Preview — ${sifPreviewRows.length} record(s) found in ${sifPreviewFile?.name || "file"}`
                    : "Drag and drop your salary file, or browse to upload."}
                </p>
              </div>
              <button
                type="button"
                className={styles.sifImportClose}
                onClick={() => {
                  if (!sifImporting) {
                    setSifImportOpen(false);
                    setSifDragOver(false);
                    setSifPreviewRows([]);
                    setSifPreviewFile(null);
                  }
                }}
                disabled={sifImporting}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {sifPreviewRows.length === 0 ? (
              <div
                className={`${styles.sifDropZone} ${sifDragOver ? styles.sifDropZoneActive : ""} ${sifImporting ? styles.sifDropZoneDisabled : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!sifImporting) setSifDragOver(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!sifImporting) setSifDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSifDragOver(false);
                }}
                onDrop={handleSifDrop}
                onClick={() => {
                  if (!sifImporting) sifInputRef.current?.click();
                }}
              >
                <div className={styles.sifDropIcon} aria-hidden="true">
                  ⬆
                </div>
                <p className={styles.sifDropTitle}>
                  {sifDragOver
                    ? "Drop file to import"
                    : "Drag & drop file here"}
                </p>
                <p className={styles.sifDropHint}>
                  Supports .SIF, .xlsx, .xls, .csv, .txt
                </p>
                <button
                  type="button"
                  className={styles.sifBrowseButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    sifInputRef.current?.click();
                  }}
                >
                  Browse files
                </button>
              </div>
            ) : (
              <>
                <div className={styles.sifPreviewTableWrap}>
                  <table className={styles.sifPreviewTable}>
                    <thead>
                      <tr>
                        {SIF_HEADERS.filter((h) => sifPreviewRows.some((r) => r[h] !== undefined && r[h] !== "")).map((h) => (
                          <th key={h} className={SIF_RED_HEADERS.has(h) ? styles.sifRedHeader : undefined}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sifPreviewRows.slice(0, 200).map((row, idx) => (
                        <tr key={idx}>
                          {SIF_HEADERS.filter((h) => sifPreviewRows.some((r) => r[h] !== undefined && r[h] !== "")).map((h) => (
                            <td key={h}>{row[h] !== undefined && row[h] !== null ? String(row[h]) : ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {sifPreviewRows.length > 200 && (
                    <p className={styles.sifPreviewTruncated}>
                      Showing first 200 of {sifPreviewRows.length} rows
                    </p>
                  )}
                </div>
                <div className={styles.sifPreviewActions}>
                  <button
                    type="button"
                    className={styles["cancel-button"]}
                    onClick={() => {
                      setSifPreviewRows([]);
                      setSifPreviewFile(null);
                    }}
                    disabled={sifImporting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={styles["generate-button"]}
                    onClick={confirmSifImport}
                    disabled={sifImporting}
                  >
                    {sifImporting ? "Importing..." : `Confirm Import (${sifPreviewRows.length} rows)`}
                  </button>
                </div>
              </>
            )}

            {error && <div className={styles.sifImportError}>{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default Reports;
