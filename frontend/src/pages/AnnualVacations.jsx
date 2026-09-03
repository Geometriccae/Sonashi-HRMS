import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Side from "./sidebar/Sidebar";
import TopNavbar, { PageBody } from "../components/TopNavbar";
import ModalPortal from "../components/ModalPortal";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import DateInput from "../components/DateInput";
import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";
import styles from "./AnnualVacations.module.css";
import {
  FaSearch, FaTimes, FaEdit, FaUndoAlt,
  FaFilter, FaSyncAlt, FaChevronDown, FaChevronUp,
  FaFileExcel, FaFilePdf, FaChevronLeft, FaChevronRight,
} from "react-icons/fa";
import { MdFlightTakeoff, MdBeachAccess, MdFlightLand } from "react-icons/md";
import { saveAs } from "file-saver";
import {
  formatExperienceLabel,
} from "../utils/yetToGoHelpers";
import { canUpdateVacationReturn } from "../utils/permissions";
import { writePersistedPath } from "../hooks/usePersistedListPage";

const PAGE_SIZE = 20;

const loadXlsx = async () => {
  const mod = await import("xlsx");
  return mod.default || mod;
};
const loadJsPdf = async () => {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable: autoTableMod.default || autoTableMod };
};

const TAB_STORAGE_KEY = "hrms:listPage:annual-vacations-tab";
const VALID_TABS = new Set(["onVacation", "yetToGo", "returned"]);

// ─── helpers ────────────────────────────────────────────────────────────────
const fmt = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB"); } catch { return "—"; }
};

const VACATION_TABS = [
  { key: "onVacation", label: "On Vacation",  icon: <MdBeachAccess />,   color: "#3b82f6", bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)", statusVal: "On Vacation",      subLabel: "Currently away",          description: "Employees currently on vacation" },
  { key: "yetToGo",   label: "Yet to Go",     icon: <MdFlightTakeoff />, color: "#8b5cf6", bg: "linear-gradient(135deg,#ede9fe,#ddd6fe)", statusVal: "Vacation Pending",  subLabel: "Approved & pending", description: "Employees with approved or pending leave (any type) who are yet to travel" },
  { key: "returned",  label: "Returned Back", icon: <MdFlightLand />,    color: "#10b981", bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)", statusVal: "Vacation Approved", subLabel: "Last 6 months",            description: "Employees who returned from vacation in the last 6 months" },
];

const STATUS_LABEL = {
  "On Vacation": "On Vacation",
  "Vacation Pending": "Yet to Go",
  "Vacation Approved": "Returned Back",
};

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

const getNavEmployeeId = (item) => {
  if (item.linkedEmployeeId) return item.linkedEmployeeId;
  if (item._source === "leave") {
    return item.employee?.employeeId || null;
  }
  return item._id || item.id || null;
};

const displayLastWorkingDay = (item) => fmt(item.lastWorkingDay || item.startDate);

const experienceAsOfForRow = (item) => item?.startDate || item?.travellingDate || new Date();

const buildVacationExportRows = (list, tabKey) =>
  (list || []).map((item, idx) => {
    const vs =
      item.vacationStatus ||
      (tabKey === "onVacation"
        ? "On Vacation"
        : tabKey === "yetToGo"
          ? "Vacation Pending"
          : "Vacation Approved");
    const expLabel =
      formatExperienceLabel(item.doj, item.totalYearsExperience, experienceAsOfForRow(item)) ||
      (item.experienceYears != null && !Number.isNaN(Number(item.experienceYears))
        ? formatExperienceLabel(null, item.experienceYears)
        : "");

    const base = {
      "#": idx + 1,
      Employee: item.employeeName || item.name || "",
      ID: item.employeeId || "",
      Department: item.department || "",
      Role: item.role || "",
      Office: item.office || "",
      Country: item.nationality || "",
      DOJ: fmt(item.doj),
      Experience: expLabel,
      Status: STATUS_LABEL[vs] || vs || "",
    };

    if (tabKey === "onVacation") {
      return {
        ...base,
        "Leave End Date": fmt(item.endDate || item.leaveEndDate),
        "Travelling Date": fmt(item.travellingDate),
        "Last Working Day": fmt(item.lastWorkingDay),
      };
    }
    if (tabKey === "yetToGo") {
      return {
        ...base,
        "Last Working Day": displayLastWorkingDay(item),
        "Travelling Date": fmt(item.travellingDate),
        "Leave End Date": fmt(item.endDate || item.leaveEndDate),
      };
    }
    return {
      ...base,
      "Return Date": fmt(item.returnDate),
      "First Working Day": fmt(item.firstWorkingDay),
    };
  });

const getDateConfigForStatus = (status) => {
  const configs = {
    "On Vacation": {
      label: "Last Working Day",
      fieldKey: "lastWorkingDay",
      secondaryLabel: "Travelling Date",
      secondaryFieldKey: "travellingDate",
      tertiaryLabel: "Leave End Date",
      tertiaryFieldKey: "leaveEndDate",
    },
    "Vacation Pending": {
      label: "Last Working Day",
      fieldKey: "lastWorkingDay",
      secondaryLabel: "Travelling Date",
      secondaryFieldKey: "travellingDate",
      tertiaryLabel: "Leave End Date",
      tertiaryFieldKey: "leaveEndDate",
    },
    "Vacation Approved": {
      label: "Return / Entry Date",
      fieldKey: "returnDate",
      secondaryLabel: "First Working Day",
      secondaryFieldKey: "firstWorkingDay",
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
    tertiaryLabel: cfg.tertiaryLabel,
    tertiaryFieldKey: cfg.tertiaryFieldKey,
    tertiaryDateValue: cfg.tertiaryFieldKey
      ? toDateInputValue(item.endDate || item.leaveEndDate)
      : "",
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
  const canReturn = canUpdateVacationReturn(userRole);
  const [searchParams, setSearchParams] = useSearchParams();

  const [isLoading, setIsLoading]       = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [counts, setCounts]             = useState({ onVacation: 0, yetToGo: 0, returned: 0 });
  const [filterOptions, setFilterOptions] = useState({
    departments: [], roles: [], offices: [], countries: [],
  });

  // Resume last vacation tab via URL (?tab=) + session (same pattern as Leave/Team)
  const activeTab = (() => {
    const fromUrl = searchParams.get("tab");
    if (fromUrl && VALID_TABS.has(fromUrl)) return fromUrl;
    try {
      const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
      if (saved && VALID_TABS.has(saved)) return saved;
    } catch { /* ignore */ }
    return null;
  })();

  const setActiveTab = useCallback((tab) => {
    const next = tab && VALID_TABS.has(tab) ? tab : null;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set("tab", next);
      else params.delete("tab");
      return params;
    }, { replace: true });
    try {
      if (next) sessionStorage.setItem(TAB_STORAGE_KEY, next);
      else sessionStorage.removeItem(TAB_STORAGE_KEY);
    } catch { /* ignore */ }
    const path = next ? `/annual-vacations?tab=${next}` : "/annual-vacations";
    writePersistedPath("annual-vacations", path);
  }, [setSearchParams]);

  // Server-paginated tab rows (page 1 first — never load full history upfront)
  const [tabList, setTabList]           = useState([]);
  const [tabTotal, setTabTotal]         = useState(0);
  const [page, setPage]                 = useState(1);
  const [searchQuery, setSearchQuery]   = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filters — sent to vacation-tab API
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ─── Unique dropdown options ─────────────────────────────────────────────
  const options = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = ["", ...Array.from({ length: currentYear - 2011 }, (_, i) => String(currentYear - i))];
    return {
      departments: filterOptions.departments || [],
      roles: filterOptions.roles || [],
      offices: filterOptions.offices || [],
      countries: filterOptions.countries || [],
      years,
    };
  }, [filterOptions]);

  // ─── Active filter count ─────────────────────────────────────────────────
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(v => v !== "").length,
    [filters]
  );

  const applySummaryCounts = (summary) => {
    setCounts({
      onVacation: summary.onVacation ?? 0,
      yetToGo: summary.yetToGo ?? summary.upcomingVacation ?? 0,
      returned: summary.returnedBack ?? summary.vacationReturn ?? 0,
    });
    if (summary.filterOptions) {
      setFilterOptions({
        departments: summary.filterOptions.departments || [],
        roles: summary.filterOptions.roles || [],
        offices: summary.filterOptions.offices || [],
        countries: summary.filterOptions.countries || [],
      });
    }
  };

  // ─── Fetch counts only (cards) ───────────────────────────────────────────
  const fetchCounts = useCallback(async ({ force = false } = {}) => {
    setIsLoading(true);
    try {
      const summary = await employeeService.getEmployeeStats({ force });
      applySummaryCounts(summary);
    } catch (err) {
      console.error("Failed to fetch vacation counts:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTabPage = useCallback(async () => {
    if (!activeTab) {
      setTabList([]);
      setTabTotal(0);
      return;
    }
    setTableLoading(true);
    try {
      const result = await employeeService.getVacationTab({
        tab: activeTab,
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        filters,
      });
      setTabList(Array.isArray(result?.employees) ? result.employees : []);
      setTabTotal(Number(result?.total) || 0);
    } catch (err) {
      console.error("Failed to fetch vacation tab page:", err);
      setTabList([]);
      setTabTotal(0);
    } finally {
      setTableLoading(false);
    }
  }, [activeTab, page, debouncedSearch, filters]);

  // ─── Fetch Data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    employeeService.invalidateCache();
    await fetchCounts({ force: true });
    if (activeTab) {
      await fetchTabPage();
    }
  }, [fetchCounts, fetchTabPage, activeTab]);

  useEffect(() => { fetchCounts({ force: true }); }, [fetchCounts]);

  // Keep URL + sidebar path in sync when restoring tab from session
  useEffect(() => {
    if (!activeTab) {
      writePersistedPath("annual-vacations", "/annual-vacations");
      return;
    }
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch { /* ignore */ }
    writePersistedPath("annual-vacations", `/annual-vacations?tab=${activeTab}`);
    if (!searchParams.get("tab")) {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev);
        params.set("tab", activeTab);
        return params;
      }, { replace: true });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load page when tab / page / search / filters change
  useEffect(() => {
    fetchTabPage();
  }, [fetchTabPage]);

  // Reset to page 1 when tab, search, or filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch, filters]);

  // Server already filtered — display as-is
  const filteredList = tabList;
  const totalPages = Math.max(1, Math.ceil(tabTotal / PAGE_SIZE));

  // ─── Card Click ──────────────────────────────────────────────────────────
  const handleCardClick = (tabKey) => {
    setSearchQuery("");
    setDebouncedSearch("");
    setPage(1);
    setActiveTab(tabKey);
  };

  // ─── Filter UI Helpers ───────────────────────────────────────────────────
  const handleApplyFilters = () => {
    setFilters({ ...pendingFilters });
    setPage(1);
    setFilterOpen(false);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPendingFilters(DEFAULT_FILTERS);
    setPage(1);
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
    setPage(1);
  };

  const handleExportExcel = async () => {
    if (!activeTab) {
      alert("No records to export for this category.");
      return;
    }
    try {
      const result = await employeeService.getVacationTab({
        tab: activeTab,
        page: 1,
        search: debouncedSearch,
        filters,
        all: true,
      });
      const exportList = Array.isArray(result?.employees) ? result.employees : [];
      if (exportList.length === 0) {
        alert("No records to export for this category.");
        return;
      }
      const tab = getTabConfig(activeTab);
      const rows = buildVacationExportRows(exportList, activeTab);
      const XLSX = await loadXlsx();
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(rows);
      if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
      XLSX.utils.book_append_sheet(wb, ws, (tab?.label || "Report").slice(0, 31));
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
      });
      const slug = (tab?.label || activeTab).replace(/\s+/g, "_");
      saveAs(blob, `Annual_Vacations_${slug}_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      alert(err?.message || "Export failed.");
    }
  };

  const handleExportPdf = async () => {
    if (!activeTab) {
      alert("No records to export for this category.");
      return;
    }
    try {
      const result = await employeeService.getVacationTab({
        tab: activeTab,
        page: 1,
        search: debouncedSearch,
        filters,
        all: true,
      });
      const exportList = Array.isArray(result?.employees) ? result.employees : [];
      if (exportList.length === 0) {
        alert("No records to export for this category.");
        return;
      }
      const tab = getTabConfig(activeTab);
      const rows = buildVacationExportRows(exportList, activeTab);
      const headers = Object.keys(rows[0]);
      const body = rows.map((row) => headers.map((h) => (row[h] != null ? String(row[h]) : "")));

      const { jsPDF, autoTable } = await loadJsPdf();
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(`Annual Vacations — ${tab?.label || activeTab}`, 14, 15);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Generated on: ${new Date().toLocaleDateString("en-GB")} | Total Records: ${rows.length}`,
        14,
        21
      );

      autoTable(doc, {
        startY: 26,
        head: [headers],
        body,
        theme: "grid",
        styles: { fontSize: 7.5, cellPadding: 2.5, overflow: "linebreak", valign: "middle" },
        headStyles: {
          fillColor: [22, 163, 74],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 25, bottom: 15, left: 10, right: 10 },
      });

      const slug = (tab?.label || activeTab).replace(/\s+/g, "_");
      doc.save(`Annual_Vacations_${slug}_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err) {
      alert(err?.message || "Export failed.");
    }
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
    if (!canReturn) return;
    const todayStr = toDateInputValue(new Date());
    const planned = toDateInputValue(item.endDate) || todayStr;
    const state = buildEditModalState(
      {
        ...item,
        returnDate: item.returnDate || item.endDate || new Date(),
        firstWorkingDay: item.firstWorkingDay || item.returnDate || item.endDate || new Date(),
      },
      "Vacation Approved",
      "markReturn"
    );
    setEditModal({
      ...state,
      dateValue: state.dateValue || planned,
      secondaryDateValue: state.secondaryDateValue || planned,
    });
  };

  const doMarkReturned = async (item, returnDate, firstWorkingDay) => {
    try {
      const empId = getEmployeeIdFromItem(item);
      if (!empId) {
        showToast("Employee record not found for this leave.", "error");
        return;
      }
      await employeeService.markVacationReturn(empId, {
        returnDate,
        firstWorkingDay: firstWorkingDay || returnDate,
        leaveId: item.linkedLeaveId || null,
      });
      showToast(`${item.employeeName || item.name} return date updated.`);
      employeeService.invalidateCache();
      leaveRequestService.invalidateCache();
      await fetchCounts({ force: true });
      await fetchTabPage();
    } catch (err) {
      showToast(err?.message || "Failed to update return date.", "error");
      throw err;
    }
  };

  const handleEditDateConfirm = async () => {
    if (!editModal || editModalSaving) return;
    const {
      item, newStatus, fieldKey, dateValue,
      secondaryFieldKey, secondaryDateValue,
      tertiaryFieldKey, tertiaryDateValue, mode,
    } = editModal;

    if ((newStatus === "Vacation Approved" || mode === "markReturn") && !dateValue) {
      showToast("Please select the Return / Entry Date.", "error");
      return;
    }

    setEditModalSaving(true);
    try {
      if (newStatus === "Vacation Approved" || mode === "markReturn") {
        const returnDate = new Date(dateValue).toISOString();
        const firstWorkingDay = secondaryDateValue
          ? new Date(secondaryDateValue).toISOString()
          : returnDate;
        await doMarkReturned(item, returnDate, firstWorkingDay);
      } else {
        const extra = {};
        if (newStatus !== "Onsite") {
          if (dateValue) extra[fieldKey] = new Date(dateValue).toISOString();
          if (secondaryFieldKey && secondaryDateValue) {
            extra[secondaryFieldKey] = new Date(secondaryDateValue).toISOString();
          }
          if (tertiaryFieldKey && tertiaryDateValue) {
            extra[tertiaryFieldKey] = new Date(tertiaryDateValue).toISOString();
          }
        }
        const empId = getEmployeeIdFromItem(item);
        if (!empId) {
          showToast("Employee record not found for this leave.", "error");
          return;
        }
        await employeeService.updateVacationStatus(empId, { vacationStatus: newStatus, ...extra });
        showToast("Status updated successfully.");
        employeeService.invalidateCache();
        leaveRequestService.invalidateCache();
        await fetchCounts({ force: true });
        await fetchTabPage();
      }
      setEditModal(null);
    } catch (err) {
      if (newStatus !== "Vacation Approved" && mode !== "markReturn") {
        showToast(err?.message || "Failed to update status.", "error");
      }
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
                        <button
                          type="button"
                          className={styles.exportExcelBtn}
                          onClick={handleExportExcel}
                          disabled={filteredList.length === 0}
                          title="Download Excel for this category"
                        >
                          <FaFileExcel /> Excel
                        </button>
                        <button
                          type="button"
                          className={styles.exportPdfBtn}
                          onClick={handleExportPdf}
                          disabled={filteredList.length === 0}
                          title="Download PDF for this category"
                        >
                          <FaFilePdf /> PDF
                        </button>
                        <button className={styles.closeDetailBtn} onClick={() => setActiveTab(null)}>
                          <FaTimes /> Close
                        </button>
                      </div>
                    </div>

                    {tableLoading ? (
                      <div className={styles.emptyState}>
                        <p>Loading {getTabConfig(activeTab)?.label}…</p>
                      </div>
                    ) : filteredList.length === 0 ? (
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
                              <th>Experience</th>
                              {activeTab === "onVacation" && <><th>Leave End Date</th><th>Travelling Date</th><th>Last Working Day</th></>}
                              {activeTab === "yetToGo"   && <><th>Last Working Day</th><th>Travelling Date</th><th>Leave End Date</th></>}
                              {activeTab === "returned"  && <><th>Return Date</th><th>First Working Day</th></>}
                              <th>Status</th>
                              {canReturn && <th>Actions</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredList.map((item, idx) => {
                              const empId = item._id || item.id;
                              const vs    = item.vacationStatus || (activeTab === "onVacation" ? "On Vacation" : activeTab === "yetToGo" ? "Vacation Pending" : "Vacation Approved");
                              const expLabel = formatExperienceLabel(item.doj, item.totalYearsExperience, experienceAsOfForRow(item));
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
                                    {expLabel
                                      ? <span className={styles.expBadge}>{expLabel}</span>
                                      : "—"}
                                  </td>

                                  {activeTab === "onVacation" && <><td>{fmt(item.endDate || item.leaveEndDate)}</td><td>{fmt(item.travellingDate)}</td><td>{fmt(item.lastWorkingDay)}</td></>}
                                  {activeTab === "yetToGo"   && <><td>{displayLastWorkingDay(item)}</td><td>{fmt(item.travellingDate)}</td><td>{fmt(item.endDate || item.leaveEndDate)}</td></>}
                                  {activeTab === "returned"  && <><td>{fmt(item.returnDate)}</td><td>{fmt(item.firstWorkingDay)}</td></>}

                                  <td onClick={e => e.stopPropagation()}>
                                    {canReturn && item._source === "employee" ? (
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

                                  {canReturn && (
                                    <td onClick={e => e.stopPropagation()}>
                                      <div className={styles.actionBtns}>
                                        <button className={styles.actionBtn} title="Edit return / vacation dates" onClick={() => {
                                          setEditModal(buildEditModalState(item, vs === "On Vacation" || vs === "Vacation Pending" || vs === "Vacation Approved" ? vs : "Vacation Approved", "date"));
                                        }}><FaEdit /></button>
                                        {activeTab === "onVacation" && (
                                          <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`}
                                            title="Mark as returned (select date)" onClick={() => handleMarkReturned(item)}><FaUndoAlt /></button>
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
                      <span className={styles.footerCount}>
                        {tabTotal === 0
                          ? "0 records"
                          : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, tabTotal)} of ${tabTotal}`}
                      </span>
                      {tabTotal > PAGE_SIZE && (
                        <div className={styles.pagination}>
                          <button
                            type="button"
                            className={styles.pageBtn}
                            disabled={page <= 1 || tableLoading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                          >
                            <FaChevronLeft /> Prev
                          </button>
                          <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
                          <button
                            type="button"
                            className={styles.pageBtn}
                            disabled={page >= totalPages || tableLoading}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          >
                            Next <FaChevronRight />
                          </button>
                        </div>
                      )}
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
        <ModalPortal>
        <div className={styles.modalBackdrop} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalAccent} />
            <button className={styles.modalClose} onClick={() => setEditModal(null)}>×</button>
            <div className={styles.modalAvatar}>
              {(editModal.item.employeeName||editModal.item.name||"?")[0].toUpperCase()}
            </div>
            <h3 className={styles.modalTitle}>
              {editModal.mode === "markReturn"
                ? "Mark Returned from Vacation"
                : editModal.mode === "date"
                  ? `Update ${editModal.label}`
                  : "Change Vacation Status"}
            </h3>
            <p className={styles.modalSub}>
              for <strong>{editModal.item.employeeName||editModal.item.name}</strong>
              {editModal.mode === "markReturn" ? " — select actual return date (early or extended)." : ""}
            </p>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Vacation Status</label>
              <select className={styles.modalSelect} value={editModal.newStatus}
                disabled={editModal.mode === "markReturn"}
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
                {editModal.tertiaryFieldKey && (
                  <div className={styles.modalField}>
                    <label className={styles.modalLabel}>{editModal.tertiaryLabel}</label>
                    <DateInput className={styles.modalInput} value={editModal.tertiaryDateValue}
                      onChange={e => setEditModal(prev => ({ ...prev, tertiaryDateValue:e.target.value }))} />
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
        </ModalPortal>
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
