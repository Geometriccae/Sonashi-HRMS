import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Side from "./sidebar/Sidebar";
import TopNavbar, { PageBody } from "../components/TopNavbar";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
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

const DEFAULT_FILTERS = {
  department: "", role: "", dojFrom: "", dojTo: "",
  expMin: "", expMax: "", office: "", country: "",
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
  const [toast, setToast]               = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Unique dropdown options ─────────────────────────────────────────────
  const options = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    return {
      departments: uniq(employees.map(e => e.department)),
      roles:       uniq(employees.map(e => e.role)),
      offices:     uniq(employees.map(e => e.office)),
      countries:   uniq(employees.map(e => e.nationality)),
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
        employeeService.getEmployees(),
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
  const computeCounts = (empList, leaveList) => {
    const today     = new Date(); today.setHours(0,0,0,0);
    const next60    = new Date(today); next60.setDate(today.getDate() + 60);
    const lastMonth = new Date(today); lastMonth.setMonth(today.getMonth() - 1);
    const attMap    = {};
    empList.forEach(e => { if (e.vacationStatus && e.vacationStatus !== "Onsite") attMap[e._id] = e.vacationStatus; });
    let onVacation = empList.filter(e => e.vacationStatus === "On Vacation").length;
    let yetToGo    = empList.filter(e => e.vacationStatus === "Vacation Pending").length;
    let returned   = empList.filter(e => e.vacationStatus === "Vacation Approved").length;
    leaveList.forEach(req => {
      if (req.status !== "Approved") return;
      const empId = req.employee?._id || req.employee;
      if (attMap[empId]) return;
      const s = new Date(req.startDate); const e = new Date(req.endDate);
      if (today >= s && today <= e) onVacation++;
      else if (s > today && s <= next60) yetToGo++;
      else if (e >= lastMonth && e < today) returned++;
    });
    setCounts({ onVacation, yetToGo, returned });
  };

  // ─── Build Tab List (category-only, NO user filters here) ───────────────
  const buildTabList = useCallback((tabKey, empList, leaveList) => {
    const today     = new Date(); today.setHours(0,0,0,0);
    const next60    = new Date(today); next60.setDate(today.getDate() + 60);
    const lastMonth = new Date(today); lastMonth.setMonth(today.getMonth() - 1);
    const statusMap = { onVacation: "On Vacation", yetToGo: "Vacation Pending", returned: "Vacation Approved" };
    const targetStatus = statusMap[tabKey];

    const attEmps = empList
      .filter(e => e.vacationStatus === targetStatus)
      .map(e => ({ ...e, _source: "employee" }));
    const attEmpIds = new Set(attEmps.map(e => e._id));

    const leaveEmps = leaveList
      .filter(req => {
        if (req.status !== "Approved") return false;
        const empId = req.employee?._id || req.employee;
        if (attEmpIds.has(empId)) return false;
        const s = new Date(req.startDate); const e = new Date(req.endDate);
        if (tabKey === "onVacation") return today >= s && today <= e;
        if (tabKey === "yetToGo")   return s > today && s <= next60;
        if (tabKey === "returned")  return e >= lastMonth && e < today;
        return false;
      })
      .map(req => {
        const empName = req.employeeName || req.employee?.employeeName || "Unknown";
        const linked  = empList.find(e => e._id === (req.employee?._id || req.employee));
        return {
          ...req,
          employeeName:          empName,
          employeeId:            linked?.employeeId            || req.employeeId || "—",
          department:            linked?.department            || req.department  || "",
          role:                  linked?.role                  || "",
          office:                linked?.office                || "",
          nationality:           linked?.nationality           || "",
          doj:                   linked?.doj                   || null,
          totalYearsExperience:  linked?.totalYearsExperience  ?? null,
          _source: "leave",
        };
      });

    return [...attEmps, ...leaveEmps];
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
      const exp = item.totalYearsExperience;
      if (filters.expMin !== "" && filters.expMin !== null) {
        if (exp == null || exp < Number(filters.expMin)) return false;
      }
      if (filters.expMax !== "" && filters.expMax !== null) {
        if (exp == null || exp > Number(filters.expMax)) return false;
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
    return pills;
  }, [filters]);

  // ─── Operations ──────────────────────────────────────────────────────────
  const handleStatusChange = (item, newStatus) => {
    const dateConfig = {
      "On Vacation":       { label:"Last Working Day",    fieldKey:"lastWorkingDay" },
      "Vacation Pending":  { label:"Travelling Date",     fieldKey:"travellingDate" },
      "Vacation Approved": { label:"Return / Entry Date", fieldKey:"firstWorkingDay" },
    };
    const cfg = dateConfig[newStatus];
    setEditModal({ item, newStatus, label:cfg?.label||"Date", fieldKey:cfg?.fieldKey||"date", dateValue:"", mode:"status" });
  };

  const handleMarkReturned = (item) => {
    if (!window.confirm(`Mark ${item.employeeName||item.name} as returned early? This will update the leave end date to today.`)) return;
    doMarkReturned(item);
  };

  const doMarkReturned = async (item) => {
    const today = new Date(); today.setHours(0,0,0,0);
    try {
      if (item._source === "leave" || item.startDate) {
        await leaveRequestService.updateLeaveRequest(item._id, { endDate:today.toISOString(), status:"Approved" });
        const empId = item.employee?._id || item.employee;
        if (empId) await employeeService.updateEmployee(empId, { vacationStatus:"Vacation Approved", firstWorkingDay:today.toISOString() });
      } else {
        await employeeService.updateEmployee(item._id, { vacationStatus:"Vacation Approved", firstWorkingDay:today.toISOString() });
      }
      showToast(`${item.employeeName||item.name} marked as returned.`);
      const [empRes, leaveRes] = await Promise.all([employeeService.getEmployees(), leaveRequestService.getLeaveRequests()]);
      const empList   = Array.isArray(empRes)   ? empRes   : empRes?.data   || [];
      const leaveList = Array.isArray(leaveRes)  ? leaveRes : leaveRes?.data || [];
      setEmployees(empList); setLeaveRequests(leaveList);
      computeCounts(empList, leaveList);
      setTabList(buildTabList(activeTab, empList, leaveList));
    } catch { showToast("Failed to mark as returned.", "error"); }
  };

  const handleEditDateConfirm = async () => {
    if (!editModal) return;
    const { item, newStatus, fieldKey, dateValue } = editModal;
    const extra = dateValue ? { [fieldKey]: new Date(dateValue).toISOString() } : {};
    try {
      if (item._source === "employee" || item.vacationStatus) {
        await employeeService.updateEmployee(item._id||item.id, { vacationStatus:newStatus, ...extra });
      }
      showToast("Status updated successfully.");
      setEditModal(null);
      const [empRes, leaveRes] = await Promise.all([employeeService.getEmployees(), leaveRequestService.getLeaveRequests()]);
      const empList   = Array.isArray(empRes)   ? empRes   : empRes?.data   || [];
      const leaveList = Array.isArray(leaveRes)  ? leaveRes : leaveRes?.data || [];
      setEmployees(empList); setLeaveRequests(leaveList);
      computeCounts(empList, leaveList);
      setTabList(buildTabList(activeTab, empList, leaveList));
    } catch { showToast("Failed to update status.", "error"); }
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
                    <input type="date" className={styles.filterInput} value={pendingFilters.dojFrom}
                      onChange={e => setPendingFilters(p => ({ ...p, dojFrom: e.target.value }))} />
                  </div>

                  <div className={styles.filterField}>
                    <label className={styles.filterLabel}>DOJ To</label>
                    <input type="date" className={styles.filterInput} value={pendingFilters.dojTo}
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
                              {activeTab === "onVacation" && <><th>Start Date</th><th>End Date</th><th>Last Working Day</th></>}
                              {activeTab === "yetToGo"   && <><th>Travelling Date</th><th>Leave Start</th><th>Leave End</th></>}
                              {activeTab === "returned"  && <><th>Return Date</th><th>Leave Start</th><th>Leave End</th></>}
                              <th>Status</th>
                              {isAdmin && <th>Actions</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredList.map((item, idx) => {
                              const empId = item._id || item.id;
                              const vs    = item.vacationStatus || (activeTab === "onVacation" ? "On Vacation" : activeTab === "yetToGo" ? "Vacation Pending" : "Vacation Approved");
                              return (
                                <tr key={empId || idx} className={styles.tableRow}
                                  onClick={() => { const navId = item._id||item.id||item.employee?._id; if (navId) navigate(`/teammanagement_salesleads/${navId}`); }}>
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
                                    {item.totalYearsExperience != null
                                      ? <span className={styles.expBadge}>{item.totalYearsExperience} yrs</span>
                                      : "—"}
                                  </td>

                                  {activeTab === "onVacation" && <><td>{fmt(item.startDate)}</td><td>{fmt(item.endDate)}</td><td>{fmt(item.lastWorkingDay)}</td></>}
                                  {activeTab === "yetToGo"   && <><td>{fmt(item.travellingDate)}</td><td>{fmt(item.startDate)}</td><td>{fmt(item.endDate)}</td></>}
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
                                          const dateConfig = {
                                            "On Vacation":       { label:"Last Working Day",    fieldKey:"lastWorkingDay" },
                                            "Vacation Pending":  { label:"Travelling Date",     fieldKey:"travellingDate" },
                                            "Vacation Approved": { label:"Return / Entry Date", fieldKey:"firstWorkingDay" },
                                          };
                                          const cfg = dateConfig[vs] || { label:"Date", fieldKey:"date" };
                                          setEditModal({ item, newStatus:vs, label:cfg.label, fieldKey:cfg.fieldKey,
                                            dateValue: item[cfg.fieldKey] ? new Date(item[cfg.fieldKey]).toISOString().split("T")[0] : "",
                                            mode:"date" });
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
            <div className={styles.modalStatusRow}>
              <span className={styles.modalStatusLabel}>Status:</span>
              <StatusBadge status={editModal.newStatus} />
            </div>
            {editModal.mode === "status" && (
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>New Status</label>
                <select className={styles.modalSelect} value={editModal.newStatus}
                  onChange={e => {
                    const ns = e.target.value;
                    const dcfg = {
                      "On Vacation":       { label:"Last Working Day",    fieldKey:"lastWorkingDay" },
                      "Vacation Pending":  { label:"Travelling Date",     fieldKey:"travellingDate" },
                      "Vacation Approved": { label:"Return / Entry Date", fieldKey:"firstWorkingDay" },
                      "Onsite":            { label:"Date",                fieldKey:"date" },
                    };
                    const c = dcfg[ns] || dcfg["Onsite"];
                    setEditModal(prev => ({ ...prev, newStatus:ns, label:c.label, fieldKey:c.fieldKey }));
                  }}>
                  <option value="Onsite">Onsite</option>
                  <option value="On Vacation">On Vacation</option>
                  <option value="Vacation Pending">Yet to Go</option>
                  <option value="Vacation Approved">Returned Back</option>
                </select>
              </div>
            )}
            {editModal.newStatus !== "Onsite" && (
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>{editModal.label}</label>
                <input type="date" className={styles.modalInput} value={editModal.dateValue}
                  onChange={e => setEditModal(prev => ({ ...prev, dateValue:e.target.value }))} />
              </div>
            )}
            <div className={styles.modalFooter}>
              <button className={styles.modalCancelBtn} onClick={() => setEditModal(null)}>Cancel</button>
              <button className={styles.modalSaveBtn} onClick={handleEditDateConfirm}>Save Changes</button>
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
