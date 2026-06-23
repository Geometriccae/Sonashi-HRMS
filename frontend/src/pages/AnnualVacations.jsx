import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Side from "./sidebar/Sidebar";
import TopNavbar, { PageBody } from "../components/TopNavbar";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import DateInput from "../components/DateInput";
import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";
import styles from "./AnnualVacations.module.css";
import {
  FaSearch, FaTimes, FaEdit, FaUndoAlt,
  FaFilter, FaSyncAlt, FaChevronDown, FaChevronUp,
} from "react-icons/fa";
import { MdFlightTakeoff, MdBeachAccess, MdFlightLand } from "react-icons/md";

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB"); } catch { return "—"; }
};

const APPROVED_LEAVE_STATUSES = ["Approved", "HOD Approved"];

const computeExperienceYears = (doj, totalYearsExperience) => {
  if (totalYearsExperience != null && !Number.isNaN(Number(totalYearsExperience))) {
    return Number(totalYearsExperience);
  }
  if (!doj) return null;
  const joinDate = new Date(doj);
  if (Number.isNaN(joinDate.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - joinDate.getFullYear();
  const monthDiff = now.getMonth() - joinDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < joinDate.getDate())) {
    years -= 1;
  }
  return Math.max(0, years);
};

const leaveMatchesEmployee = (req, emp, empList) => {
  const linked = findLinkedEmployee(req, empList);
  if (linked && String(linked._id) === String(emp._id)) return true;

  const userEmpId = req.employee?.employeeId;
  if (userEmpId && String(userEmpId) === String(emp._id)) return true;

  const reqEmail = String(req.employee?.emailId || "").trim().toLowerCase();
  const empEmail = String(emp.emailId || "").trim().toLowerCase();
  if (reqEmail && empEmail && reqEmail === empEmail) return true;

  const reqName = normalizeName(req.employeeName || req.employee?.username);
  const empName = normalizeName(emp.employeeName);
  return Boolean(reqName && empName && reqName === empName);
};

const findLeaveForEmployee = (emp, leaveList, empList, tabKey) => {
  const candidates = leaveList.filter(
    (req) => APPROVED_LEAVE_STATUSES.includes(req.status) && leaveMatchesEmployee(req, emp, empList)
  );
  if (candidates.length === 0) return null;

  const vacationLeaves = candidates.filter((req) => req.leaveType === "Vacation");
  const pool = vacationLeaves.length > 0 ? vacationLeaves : candidates;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDay = (value) => {
    if (!value) return null;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    dt.setHours(0, 0, 0, 0);
    return dt;
  };

  if (tabKey === "onVacation") {
    const active = pool.find((req) => {
      const start = toDay(req.startDate);
      const end = toDay(req.endDate);
      return start && end && start <= today && end >= today;
    });
    if (active) return active;

    const open = pool
      .filter((req) => {
        const end = toDay(req.endDate);
        return end && end >= today;
      })
      .sort((a, b) => toDay(a.endDate) - toDay(b.endDate));
    if (open.length > 0) return open[0];
  }

  if (tabKey === "yetToGo") {
    const upcoming = pool
      .filter((req) => {
        const start = toDay(req.startDate);
        return start && start >= today;
      })
      .sort((a, b) => toDay(a.startDate) - toDay(b.startDate));
    if (upcoming.length > 0) return upcoming[0];
  }

  if (tabKey === "returned") {
    const past = pool
      .filter((req) => {
        const end = toDay(req.endDate);
        return end && end < today;
      })
      .sort((a, b) => toDay(b.endDate) - toDay(a.endDate));
    if (past.length > 0) return past[0];
  }

  return pool.sort(
    (a, b) => new Date(b.appliedOn || b.createdAt || 0) - new Date(a.appliedOn || a.createdAt || 0)
  )[0];
};

const VACATION_TABS = [
  { key: "onVacation", label: "On Vacation",  icon: <MdBeachAccess />,   color: "#3b82f6", bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)", statusVal: "On Vacation",      subLabel: "Currently away",          description: "Employees currently on vacation" },
  { key: "yetToGo",   label: "Yet to Go",     icon: <MdFlightTakeoff />, color: "#8b5cf6", bg: "linear-gradient(135deg,#ede9fe,#ddd6fe)", statusVal: "Vacation Pending",  subLabel: "Upcoming (next 60 days)", description: "Employees with approved leave starting in the next 60 days" },
  { key: "returned",  label: "Returned Back", icon: <MdFlightLand />,    color: "#10b981", bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)", statusVal: "Vacation Approved", subLabel: "Last 1 month",            description: "Employees who returned from vacation in the last month" },
];

const STATUS_CONFIG = {
  "Onsite":            { bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)", color: "#065f46", dot: "#10b981", label: "Onsite" },
  "On Vacation":       { bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)", color: "#1e3a8a", dot: "#3b82f6", label: "On Vacation" },
  "Vacation Approved": { bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)", color: "#065f46", dot: "#10b981", label: "Returned Back" },
  "Vacation Pending":  { bg: "linear-gradient(135deg,#fef9c3,#fde68a)", color: "#713f12", dot: "#f59e0b", label: "Yet to Go" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG["Onsite"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:999, background:cfg.bg, color:cfg.color, fontSize:12, fontWeight:700, border:`1px solid ${cfg.dot}30`, whiteSpace:"nowrap" }}>
      <span style={{ width:7, height:7, borderRadius:"50%", background:cfg.dot, flexShrink:0 }} />
      {cfg.label}
    </span>
  );
}

const MONTH_OPTIONS = [
  { value: "", label: "All Months" },
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

const DEFAULT_FILTERS = {
  department: "", role: "", dojFrom: "", dojTo: "",
  expMin: "", expMax: "", office: "", country: "",
  vacationMonth: "", vacationYear: "",
};

const itemMatchesVacationMonth = (item, monthStr, yearStr) => {
  if (!monthStr && !yearStr) return true;

  const dates = [item.travellingDate, item.startDate, item.lastWorkingDay].filter(Boolean);
  if (dates.length === 0) return false;

  const monthIdx = monthStr !== "" ? Number(monthStr) : null;
  const yearNum = yearStr !== ""
    ? Number(yearStr)
    : (monthStr !== "" ? new Date().getFullYear() : null);

  return dates.some((d) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return false;
    if (monthIdx !== null && dt.getMonth() !== monthIdx) return false;
    if (yearNum !== null && dt.getFullYear() !== yearNum) return false;
    return true;
  });
};

const normalizeName = (name) => String(name || "").toLowerCase().replace(/[\s_.-]+/g, "").trim();

const findLinkedEmployee = (req, empList) => {
  if (!Array.isArray(empList) || empList.length === 0) return null;

  const populated = req.employee;
  if (populated?.employeeId) {
    const byRef = empList.find((e) => String(e._id) === String(populated.employeeId));
    if (byRef) return byRef;
  }

  if (req.employeeId) {
    const byCode = empList.find((e) => String(e.employeeId) === String(req.employeeId));
    if (byCode) return byCode;
  }

  const reqName = normalizeName(req.employeeName || populated?.username);
  if (!reqName) return null;

  const exact = empList.find((e) => normalizeName(e.employeeName) === reqName);
  if (exact) return exact;

  return empList.find((e) => {
    const n = normalizeName(e.employeeName);
    return n && (n.includes(reqName) || reqName.includes(n));
  }) || null;
};

const mapLeaveRow = (req, empList, targetStatus) => {
  const linked = findLinkedEmployee(req, empList);
  const empName = req.employeeName || linked?.employeeName || req.employee?.username || "Unknown";

  return {
    ...req,
    employeeName: linked?.employeeName || empName,
    employeeId: linked?.employeeId || req.employeeId || "—",
    department: linked?.department || req.department || "",
    role: linked?.role || "",
    office: linked?.office || "",
    nationality: linked?.nationality || "",
    doj: linked?.doj || null,
    totalYearsExperience: linked?.totalYearsExperience ?? null,
    travellingDate: linked?.travellingDate || req.travellingDate || null,
    lastWorkingDay: linked?.lastWorkingDay || req.lastWorkingDay || null,
    firstWorkingDay: linked?.firstWorkingDay || req.firstWorkingDay || null,
    vacationStatus: linked?.vacationStatus || targetStatus,
    linkedEmployeeId: linked?._id || null,
    _source: "leave",
  };
};

const getNavEmployeeId = (item) => {
  if (item.linkedEmployeeId) return item.linkedEmployeeId;
  if (item._source === "leave") {
    return item.employee?.employeeId || null;
  }
  return item._id || item.id || null;
};

const displayLastWorkingDay = (item) => fmt(item.lastWorkingDay || item.startDate);

const getDateConfigForStatus = (status) => {
  const configs = {
    "On Vacation": {
      label: "Last Working Day",
      fieldKey: "lastWorkingDay",
      secondaryLabel: "Travelling Date",
      secondaryFieldKey: "travellingDate",
    },
    "Vacation Pending": {
      label: "Last Working Day",
      fieldKey: "lastWorkingDay",
      secondaryLabel: "Travelling Date",
      secondaryFieldKey: "travellingDate",
    },
    "Vacation Approved": {
      label: "Return / Entry Date",
      fieldKey: "firstWorkingDay",
    },
  };
  return configs[status] || { label: "Date", fieldKey: "date" };
};

const toDateInputValue = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return "";
  }
};

const buildEditModalState = (item, status, mode = "date") => {
  const cfg = getDateConfigForStatus(status);
  return {
    item,
    newStatus: status,
    label: cfg.label,
    fieldKey: cfg.fieldKey,
    dateValue: toDateInputValue(item[cfg.fieldKey]),
    secondaryLabel: cfg.secondaryLabel,
    secondaryFieldKey: cfg.secondaryFieldKey,
    secondaryDateValue: cfg.secondaryFieldKey ? toDateInputValue(item[cfg.secondaryFieldKey]) : "",
    mode,
  };
};

const getEmployeeIdFromItem = (item) => {
  const navId = getNavEmployeeId(item);
  if (navId) return navId;
  if (item._source === "leave") {
    return item.employee?.employeeId || item.employee?._id || item.employee;
  }
  return item._id || item.id;
};

// ─── Main Component ──────────────────────────────────────────────────────────
function AnnualVacations() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem("role");
  const isAdmin  = userRole === "admin" || userRole === "hod";

  const [isLoading, setIsLoading]       = useState(true);
  const [employees, setEmployees]       = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [counts, setCounts]             = useState({ onVacation: 0, yetToGo: 0, returned: 0 });
  const [activeTab, setActiveTab]       = useState(null);

  // tabList = full unfiltered category list (rebuilt only when tab or raw data changes)
  const [tabList, setTabList]           = useState([]);
  const [searchQuery, setSearchQuery]   = useState("");

  // Filters — applied only inside filteredList useMemo
  const [filters, setFilters]           = useState(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen]     = useState(false);

  const [editModal, setEditModal]       = useState(null);
  const [editModalSaving, setEditModalSaving] = useState(false);
  const [toast, setToast]               = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Unique dropdown options ─────────────────────────────────────────────
  const options = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    const currentYear = new Date().getFullYear();
    const years = ["", ...Array.from({ length: currentYear - 2011 }, (_, i) => String(currentYear - i))];
    return {
      departments: uniq(employees.map(e => e.department)),
      roles:       uniq(employees.map(e => e.role)),
      offices:     uniq(employees.map(e => e.office)),
      countries:   uniq(employees.map(e => e.nationality)),
      years,
    };
  }, [employees]);

  // ─── Active filter count ─────────────────────────────────────────────────
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(v => v !== "").length,
    [filters]
  );

  // ─── Fetch Data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [empRes, leaveRes] = await Promise.all([
        employeeService.getEmployeesList(),
        leaveRequestService.getLeaveRequests(),
      ]);
      const empList   = Array.isArray(empRes)   ? empRes   : empRes?.data   || [];
      const leaveList = Array.isArray(leaveRes)  ? leaveRes : leaveRes?.data || [];
      setEmployees(empList);
      setLeaveRequests(leaveList);
      computeCounts(empList, leaveList);
    } catch (err) {
      console.error("Failed to fetch vacation data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Compute Counts (no filters applied to counts) ──────────────────────
  // Only the employee's vacationStatus field is authoritative.
  // Leave-request date ranges are NOT used to inflate counts — the status
  // dropdown on Team Management / Dashboard is the single source of truth.
  const computeCounts = (empList, _leaveList) => {
    const onVacation = empList.filter(e => e.vacationStatus === "On Vacation").length;
    const yetToGo    = empList.filter(e => e.vacationStatus === "Vacation Pending").length;
    const returned   = empList.filter(e => e.vacationStatus === "Vacation Approved").length;
    setCounts({ onVacation, yetToGo, returned });
  };

  // ─── Build Tab List (category-only, NO user filters here) ───────────────
  // Only employees whose vacationStatus matches the tab are shown.
  // We enrich each row with leave-request dates when available.
  const buildTabList = useCallback((tabKey, empList, leaveList) => {
    const statusMap = { onVacation: "On Vacation", yetToGo: "Vacation Pending", returned: "Vacation Approved" };
    const targetStatus = statusMap[tabKey];

    return empList
      .filter(e => e.vacationStatus === targetStatus)
      .map(e => {
        const leave = findLeaveForEmployee(e, leaveList, empList, tabKey);
        return {
          ...e,
          _source: "employee",
          linkedEmployeeId: e._id,
          linkedLeaveId: leave?._id || null,
          startDate: leave?.startDate || null,
          endDate: leave?.endDate || null,
          experienceYears: computeExperienceYears(e.doj, e.totalYearsExperience),
        };
      });
  }, []);

  // ─── Card Click ──────────────────────────────────────────────────────────
  const handleCardClick = (tabKey) => {
    setActiveTab(tabKey);
    setSearchQuery("");
    setTabList(buildTabList(tabKey, employees, leaveRequests));
  };

  // ─── filteredList — apply search + ALL 6 user filters reactively ─────────
  // This is a pure useMemo: whenever tabList, searchQuery, or filters change,
  // it recomputes automatically — no stale closure issues.
  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return tabList.filter(item => {
      // ── Search ──
      if (q) {
        const haystack = [
          item.employeeName || item.name || "",
          item.employeeId   || "",
          item.department   || "",
          item.role         || "",
          item.office       || "",
          item.nationality  || "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // ── Department ──
      if (filters.department) {
        const dept = item.department || "";
        if (dept !== filters.department) return false;
      }

      // ── Role ──
      if (filters.role) {
        const role = item.role || "";
        if (role !== filters.role) return false;
      }

      // ── Office Location ──
      if (filters.office) {
        const office = item.office || "";
        if (office !== filters.office) return false;
      }

      // ── Country (Nationality) ──
      if (filters.country) {
        const nat = item.nationality || "";
        if (nat !== filters.country) return false;
      }

      // ── DOJ Range ──
      if (filters.dojFrom || filters.dojTo) {
        const doj = item.doj ? new Date(item.doj) : null;
        if (!doj) return false;
        if (filters.dojFrom && doj < new Date(filters.dojFrom)) return false;
        if (filters.dojTo   && doj > new Date(filters.dojTo))   return false;
      }

      // ── Years of Experience Range ──
      const exp = item.experienceYears ?? computeExperienceYears(item.doj, item.totalYearsExperience);
      if (filters.expMin !== "" && filters.expMin !== null) {
        if (exp == null || exp < Number(filters.expMin)) return false;
      }
      if (filters.expMax !== "" && filters.expMax !== null) {
        if (exp == null || exp > Number(filters.expMax)) return false;
      }

      // ── Vacation month / year (travelling date or leave start) ──
      if (filters.vacationMonth || filters.vacationYear) {
        if (!itemMatchesVacationMonth(item, filters.vacationMonth, filters.vacationYear)) {
          return false;
        }
      }

      return true;
    });
  }, [tabList, searchQuery, filters]);

  // ─── Filter UI Helpers ───────────────────────────────────────────────────
  const handleApplyFilters = () => {
    setFilters({ ...pendingFilters });
    setFilterOpen(false);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPendingFilters(DEFAULT_FILTERS);
    setFilterOpen(false);
  };

  const removeFilterPill = (key) => {
    const updated = { ...filters };
    if (key === "doj") { updated.dojFrom = ""; updated.dojTo = ""; }
    else if (key === "exp") { updated.expMin = ""; updated.expMax = ""; }
    else if (key === "vacation") { updated.vacationMonth = ""; updated.vacationYear = ""; }
    else updated[key] = "";
    setFilters(updated);
    setPendingFilters(updated);
  };

  const activePills = useMemo(() => {
    const pills = [];
    if (filters.department)                        pills.push({ key:"department", label:`Dept: ${filters.department}` });
    if (filters.role)                              pills.push({ key:"role",       label:`Role: ${filters.role}` });
    if (filters.office)                            pills.push({ key:"office",     label:`Office: ${filters.office}` });
    if (filters.country)                           pills.push({ key:"country",    label:`Country: ${filters.country}` });
    if (filters.dojFrom || filters.dojTo)          pills.push({ key:"doj",        label:`DOJ: ${filters.dojFrom||"—"} → ${filters.dojTo||"—"}` });
    if (filters.expMin !== "" || filters.expMax !== "") pills.push({ key:"exp",   label:`Exp: ${filters.expMin||"0"}–${filters.expMax||"∞"} yrs` });
    if (filters.vacationMonth || filters.vacationYear) {
      const monthLabel = MONTH_OPTIONS.find(m => m.value === filters.vacationMonth)?.label;
      const yearLabel = filters.vacationYear || String(new Date().getFullYear());
      const parts = [];
      if (monthLabel && monthLabel !== "All Months") parts.push(monthLabel);
      parts.push(yearLabel);
      pills.push({ key: "vacation", label: `Vacation: ${parts.join(" ")}` });
    }
    return pills;
  }, [filters]);

  // ─── Operations ──────────────────────────────────────────────────────────
  const handleStatusChange = (item, newStatus) => {
    setEditModal(buildEditModalState(item, newStatus, "status"));
  };

  const handleMarkReturned = (item) => {
    if (!window.confirm(`Mark ${item.employeeName||item.name} as returned early? This will update the leave end date to today.`)) return;
    doMarkReturned(item);
  };

  const doMarkReturned = async (item) => {
    const today = new Date(); today.setHours(0,0,0,0);
    try {
      if (item.linkedLeaveId) {
        await leaveRequestService.updateLeaveRequest(item.linkedLeaveId, { endDate:today.toISOString(), status:"Approved" });
        const empId = getEmployeeIdFromItem(item);
        if (empId) await employeeService.updateEmployee(empId, { vacationStatus:"Vacation Approved", firstWorkingDay:today.toISOString() });
      } else {
        await employeeService.updateEmployee(item._id, { vacationStatus:"Vacation Approved", firstWorkingDay:today.toISOString() });
      }
      showToast(`${item.employeeName||item.name} marked as returned.`);
      const [empRes, leaveRes] = await Promise.all([employeeService.getEmployeesList(), leaveRequestService.getLeaveRequests()]);
      const empList   = Array.isArray(empRes)   ? empRes   : empRes?.data   || [];
      const leaveList = Array.isArray(leaveRes)  ? leaveRes : leaveRes?.data || [];
      setEmployees(empList); setLeaveRequests(leaveList);
      computeCounts(empList, leaveList);
      setTabList(buildTabList(activeTab, empList, leaveList));
    } catch { showToast("Failed to mark as returned.", "error"); }
  };

  const handleEditDateConfirm = async () => {
    if (!editModal || editModalSaving) return;
    const { item, newStatus, fieldKey, dateValue, secondaryFieldKey, secondaryDateValue } = editModal;
    const extra = {};
    if (newStatus !== "Onsite") {
      if (dateValue) extra[fieldKey] = new Date(dateValue).toISOString();
      if (secondaryFieldKey && secondaryDateValue) {
        extra[secondaryFieldKey] = new Date(secondaryDateValue).toISOString();
      }
    }
    setEditModalSaving(true);
    try {
      const empId = getEmployeeIdFromItem(item);
      if (empId) {
        await employeeService.updateEmployee(empId, { vacationStatus: newStatus, ...extra });
      }
      showToast("Status updated successfully.");
      setEditModal(null);
      const [empRes, leaveRes] = await Promise.all([employeeService.getEmployeesList(), leaveRequestService.getLeaveRequests()]);
      const empList   = Array.isArray(empRes)   ? empRes   : empRes?.data   || [];
      const leaveList = Array.isArray(leaveRes)  ? leaveRes : leaveRes?.data || [];
      setEmployees(empList); setLeaveRequests(leaveList);
      computeCounts(empList, leaveList);
      setTabList(buildTabList(activeTab, empList, leaveList));
    } catch {
      showToast("Failed to update status.", "error");
    } finally {
      setEditModalSaving(false);
    }
  };

  const getTabConfig = (tabKey) => VACATION_TABS.find(t => t.key === tabKey);
  const wrapperStyle = { display:"flex", height:"100vh", overflow:"hidden", background:"#f8fafc" };

  return (
    <div style={wrapperStyle}>
      <Side />
      <main className={styles.main}>
        <TopNavbar title="Annual Vacations" breadcrumb="Annual Vacations" />
        <PageBody>
          <div className={styles.pageWrapper}>

            {/* ── Page Header ── */}
            <div className={styles.pageHeader}>
              <div>
                <h1 className={styles.pageTitle}>Annual Vacations</h1>
                <p className={styles.pageSubtitle}>Track and manage employee vacation statuses</p>
              </div>
              <div className={styles.headerActions}>
                <button
                  className={`${styles.filterToggleBtn} ${filterOpen ? styles.filterToggleBtnActive : ""}`}
                  onClick={() => { setPendingFilters({ ...filters }); setFilterOpen(v => !v); }}
                >
                  <FaFilter />
                  Filters
                  {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
                  {filterOpen ? <FaChevronUp style={{fontSize:11}} /> : <FaChevronDown style={{fontSize:11}} />}
                </button>
                <button className={styles.refreshBtn} onClick={fetchData} title="Refresh">
                  <FaSyncAlt className={isLoading ? styles.spinning : ""} />
                  Refresh
                </button>
              </div>
            </div>

            {/* ── Filter Panel ── */}
            {filterOpen && (
              <div className={styles.filterPanel}>
                <div className={styles.filterPanelHeader}>
                  <span className={styles.filterPanelTitle}><FaFilter /> Filter Employees</span>
                  <button className={styles.filterResetLink} onClick={handleResetFilters}>Reset all</button>
                </div>

                <div className={styles.filterGrid}>
                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Department</label>
                    <select className={styles.filterSelect} value={pendingFilters.department}
                      onChange={e => setPendingFilters(p => ({ ...p, department: e.target.value }))}>
                      <option value="">All Departments</option>
                      {options.departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Role</label>
                    <select className={styles.filterSelect} value={pendingFilters.role}
                      onChange={e => setPendingFilters(p => ({ ...p, role: e.target.value }))}>
                      <option value="">All Roles</option>
                      {options.roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Office Location</label>
                    <select className={styles.filterSelect} value={pendingFilters.office}
                      onChange={e => setPendingFilters(p => ({ ...p, office: e.target.value }))}>
                      <option value="">All Offices</option>
                      {options.offices.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Country (Nationality)</label>
                    <select className={styles.filterSelect} value={pendingFilters.country}
                      onChange={e => setPendingFilters(p => ({ ...p, country: e.target.value }))}>
                      <option value="">All Countries</option>
                      {options.countries.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>DOJ From</label>
                    <DateInput className={styles.filterInput} value={pendingFilters.dojFrom}
                      onChange={e => setPendingFilters(p => ({ ...p, dojFrom: e.target.value }))} />
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>DOJ To</label>
                    <DateInput className={styles.filterInput} value={pendingFilters.dojTo}
                      onChange={e => setPendingFilters(p => ({ ...p, dojTo: e.target.value }))} />
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Min Experience (yrs)</label>
                    <input type="number" min="0" max="50" placeholder="e.g. 2" className={styles.filterInput}
                      value={pendingFilters.expMin}
                      onChange={e => setPendingFilters(p => ({ ...p, expMin: e.target.value }))} />
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Max Experience (yrs)</label>
                    <input type="number" min="0" max="50" placeholder="e.g. 10" className={styles.filterInput}
                      value={pendingFilters.expMax}
                      onChange={e => setPendingFilters(p => ({ ...p, expMax: e.target.value }))} />
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Vacation Month</label>
                    <select className={styles.filterSelect} value={pendingFilters.vacationMonth}
                      onChange={e => setPendingFilters(p => ({ ...p, vacationMonth: e.target.value }))}>
                      {MONTH_OPTIONS.map(m => (
                        <option key={m.value || "all"} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>Vacation Year</label>
                    <select className={styles.filterSelect} value={pendingFilters.vacationYear}
                      onChange={e => setPendingFilters(p => ({ ...p, vacationYear: e.target.value }))}>
                      <option value="">Current year (default)</option>
                      {options.years.filter(Boolean).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.filterPanelFooter}>
                  <button className={styles.filterCancelBtn} onClick={() => setFilterOpen(false)}>Cancel</button>
                  <button className={styles.filterApplyBtn} onClick={handleApplyFilters}>Apply Filters</button>
                </div>
              </div>
            )}

            {/* ── Active Filter Pills ── */}
            {activePills.length > 0 && (
              <div className={styles.filterPills}>
                {activePills.map(pill => (
                  <span key={pill.key} className={styles.filterPill}>
                    {pill.label}
                    <button className={styles.pillRemove} onClick={() => removeFilterPill(pill.key)}><FaTimes /></button>
                  </span>
                ))}
                <button className={styles.clearAllPills} onClick={handleResetFilters}>Clear all</button>
              </div>
            )}

            {/* ── Summary Cards ── */}
            {isLoading ? (
              <div className={styles.loadingSection}>
                <div className={styles.spinner} />
                <span>Loading vacation data…</span>
              </div>
            ) : (
              <>
                <div className={styles.cardsGrid}>
                  {VACATION_TABS.map(tab => (
                    <div key={tab.key}
                      className={`${styles.vacCard} ${activeTab === tab.key ? styles.vacCardActive : ""}`}
                      style={{ "--card-color": tab.color, "--card-bg": tab.bg }}
                      onClick={() => handleCardClick(tab.key)}
                    >
                      <div className={styles.vacCardIcon} style={{ background:tab.bg, color:tab.color }}>{tab.icon}</div>
                      <div className={styles.vacCardBody}>
                        <div className={styles.vacCardCount}>{counts[tab.key]}</div>
                        <div className={styles.vacCardLabel}>{tab.label}</div>
                        <div className={styles.vacCardSub}>{tab.subLabel}</div>
                      </div>
                      <div className={styles.vacCardHint}>Click to view →</div>
                      {activeTab === tab.key && <div className={styles.activeIndicator} style={{ background:tab.color }} />}
                    </div>
                  ))}
                </div>

                {/* ── Detail Table ── */}
                {activeTab && (
                  <div className={styles.detailSection}>
                    <div className={styles.detailHeader}>
                      <div className={styles.detailTitleRow}>
                        <span className={styles.detailIcon} style={{ color:getTabConfig(activeTab)?.color, background:getTabConfig(activeTab)?.bg }}>
                          {getTabConfig(activeTab)?.icon}
                        </span>
                        <div>
                          <h2 className={styles.detailTitle}>{getTabConfig(activeTab)?.label}</h2>
                          <p className={styles.detailDesc}>
                            {getTabConfig(activeTab)?.description} — <strong>{filteredList.length}</strong> records
                            {activeFilterCount > 0 && <span className={styles.filterNote}> (filtered)</span>}
                          </p>
                        </div>
                      </div>
                      <div className={styles.detailActions}>
                        <div className={styles.searchBox}>
                          <FaSearch className={styles.searchIcon} />
                          <input type="text" placeholder="Search by name, ID, dept, role…"
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className={styles.searchInput} />
                          {searchQuery && <button className={styles.clearSearch} onClick={() => setSearchQuery("")}><FaTimes /></button>}
                        </div>
                        <button className={styles.closeDetailBtn} onClick={() => setActiveTab(null)}>
                          <FaTimes /> Close
                        </button>
                      </div>
                    </div>

                    {filteredList.length === 0 ? (
                      <div className={styles.emptyState}>
                        <span style={{fontSize:40}}>{getTabConfig(activeTab)?.icon}</span>
                        <p>No employees found{activeFilterCount > 0 ? " matching the active filters" : " for this category"}.</p>
                        {activeFilterCount > 0 && (
                          <button className={styles.clearAllPills} style={{marginTop:8}} onClick={handleResetFilters}>Clear all filters</button>
                        )}
                      </div>
                    ) : (
                      <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Employee</th>
                              <th>ID</th>
                              <th>Department</th>
                              <th>Role</th>
                              <th>Office</th>
                              <th>Country</th>
                              <th>DOJ</th>
                              <th>Exp (yrs)</th>
                              {activeTab === "onVacation" && <><th>Leave End Date</th><th>Travelling Date</th><th>Last Working Day</th></>}
                              {activeTab === "yetToGo"   && <><th>Last Working Day</th><th>Travelling Date</th><th>Leave End Date</th></>}
                              {activeTab === "returned"  && <><th>Return Date</th><th>Leave Start</th><th>Leave End</th></>}
                              <th>Status</th>
                              {isAdmin && <th>Actions</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredList.map((item, idx) => {
                              const empId = item._id || item.id;
                              const vs    = item.vacationStatus || (activeTab === "onVacation" ? "On Vacation" : activeTab === "yetToGo" ? "Vacation Pending" : "Vacation Approved");
                              const expYears = item.experienceYears ?? computeExperienceYears(item.doj, item.totalYearsExperience);
                              return (
                                <tr key={item._source === "leave" ? `leave-${item._id}` : (empId || idx)} className={styles.tableRow}
                                  onClick={() => { const navId = getNavEmployeeId(item); if (navId) navigate(`/teammanagement_salesleads/${navId}`); }}>
                                  <td className={styles.tdNum}>{idx + 1}</td>
                                  <td>
                                    <div className={styles.empCell}>
                                      <div className={styles.empAvatar} style={{ background:getTabConfig(activeTab)?.bg, color:getTabConfig(activeTab)?.color }}>
                                        {(item.employeeName||item.name||"?")[0].toUpperCase()}
                                      </div>
                                      <div>
                                        <div className={styles.empName}>{item.employeeName||item.name||"N/A"}</div>
                                        {item.role && <div className={styles.empRole}>{item.role}</div>}
                                      </div>
                                    </div>
                                  </td>
                                  <td className={styles.tdMono}>{item.employeeId||"—"}</td>
                                  <td>{item.department||"—"}</td>
                                  <td>{item.role||"—"}</td>
                                  <td>{item.office||"—"}</td>
                                  <td>{item.nationality||"—"}</td>
                                  <td>{fmt(item.doj)}</td>
                                  <td className={styles.tdCenter}>
                                    {expYears != null
                                      ? <span className={styles.expBadge}>{expYears} yrs</span>
                                      : "—"}
                                  </td>

                                  {activeTab === "onVacation" && <><td>{fmt(item.endDate)}</td><td>{fmt(item.travellingDate)}</td><td>{fmt(item.lastWorkingDay)}</td></>}
                                  {activeTab === "yetToGo"   && <><td>{displayLastWorkingDay(item)}</td><td>{fmt(item.travellingDate)}</td><td>{fmt(item.endDate)}</td></>}
                                  {activeTab === "returned"  && <><td>{fmt(item.firstWorkingDay)}</td><td>{fmt(item.startDate)}</td><td>{fmt(item.endDate)}</td></>}

                                  <td onClick={e => e.stopPropagation()}>
                                    {isAdmin && item._source === "employee" ? (
                                      <div style={{ position:"relative", display:"inline-flex", alignItems:"center" }}>
                                        <StatusBadge status={vs} />
                                        <select style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer", width:"100%", height:"100%" }}
                                          value={vs} onChange={e => { e.stopPropagation(); handleStatusChange(item, e.target.value); }}>
                                          <option value="Onsite">Onsite</option>
                                          <option value="On Vacation">On Vacation</option>
                                          <option value="Vacation Pending">Yet to Go</option>
                                          <option value="Vacation Approved">Returned Back</option>
                                        </select>
                                      </div>
                                    ) : <StatusBadge status={vs} />}
                                  </td>

                                  {isAdmin && (
                                    <td onClick={e => e.stopPropagation()}>
                                      <div className={styles.actionBtns}>
                                        <button className={styles.actionBtn} title="Edit dates" onClick={() => {
                                          setEditModal(buildEditModalState(item, vs, "date"));
                                        }}><FaEdit /></button>
                                        {activeTab === "onVacation" && (
                                          <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`}
                                            title="Mark as returned" onClick={() => handleMarkReturned(item)}><FaUndoAlt /></button>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className={styles.detailFooter}>
                      <span className={styles.footerCount}>{filteredList.length} records shown</span>
                      <button className={styles.viewAllBtn} onClick={() => navigate("/leave-requests")}>
                        View All in Leave Management →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </PageBody>
      </main>

      {/* ── Edit Modal ── */}
      {editModal && (
        <div className={styles.modalBackdrop} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalAccent} />
            <button className={styles.modalClose} onClick={() => setEditModal(null)}>×</button>
            <div className={styles.modalAvatar}>
              {(editModal.item.employeeName||editModal.item.name||"?")[0].toUpperCase()}
            </div>
            <h3 className={styles.modalTitle}>
              {editModal.mode === "date" ? `Update ${editModal.label}` : "Change Vacation Status"}
            </h3>
            <p className={styles.modalSub}>for <strong>{editModal.item.employeeName||editModal.item.name}</strong></p>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Vacation Status</label>
              <select className={styles.modalSelect} value={editModal.newStatus}
                onChange={e => {
                  const ns = e.target.value;
                  setEditModal(prev => ({
                    ...buildEditModalState(prev.item, ns, prev.mode),
                  }));
                }}>
                <option value="Onsite">Onsite</option>
                <option value="On Vacation">On Vacation</option>
                <option value="Vacation Pending">Yet to Go</option>
                <option value="Vacation Approved">Returned Back</option>
              </select>
            </div>
            {editModal.newStatus !== "Onsite" && (
              <>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>{editModal.label}</label>
                  <DateInput className={styles.modalInput} value={editModal.dateValue}
                    onChange={e => setEditModal(prev => ({ ...prev, dateValue:e.target.value }))} />
                </div>
                {editModal.secondaryFieldKey && (
                  <div className={styles.modalField}>
                    <label className={styles.modalLabel}>{editModal.secondaryLabel}</label>
                    <DateInput className={styles.modalInput} value={editModal.secondaryDateValue}
                      onChange={e => setEditModal(prev => ({ ...prev, secondaryDateValue:e.target.value }))} />
                  </div>
                )}
              </>
            )}
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={() => setEditModal(null)} disabled={editModalSaving}>Cancel</button>
              <button className={styles.modalSaveBtn} onClick={handleEditDateConfirm} disabled={editModalSaving}>
                {editModalSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === "error" ? "✗" : "✓"} {toast.msg}
        </div>
      )}

      <MobileBottomNavigation />
    </div>
  );
}

export default AnnualVacations;
