import React, { useState, useEffect } from "react";
import styles from "./DashboardOverview.module.css";
import employeeService from "../services/EmployeeService";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaPlane,
  FaCalendarAlt,
  FaPassport,
  FaIdCard
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import ModalPortal from "./ModalPortal";
import DateInput from "./DateInput";
import { canUpdateVacationReturn } from "../utils/permissions";

const toDateInputValue = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toISOString().split("T")[0];
  } catch {
    return "";
  }
};

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
  return configs[status] || null;
};

const buildVacationDatePrompt = (employeeItem, newStatus) => {
  const cfg = getDateConfigForStatus(newStatus);
  if (!cfg) return null;
  return {
    employeeItem,
    newStatus,
    label: cfg.label,
    fieldKey: cfg.fieldKey,
    dateValue: toDateInputValue(employeeItem[cfg.fieldKey]),
    secondaryLabel: cfg.secondaryLabel,
    secondaryFieldKey: cfg.secondaryFieldKey,
    secondaryDateValue: cfg.secondaryFieldKey ? toDateInputValue(employeeItem[cfg.secondaryFieldKey]) : "",
    tertiaryLabel: cfg.tertiaryLabel,
    tertiaryFieldKey: cfg.tertiaryFieldKey,
    tertiaryDateValue: cfg.tertiaryFieldKey
      ? toDateInputValue(employeeItem.endDate || employeeItem.leaveEndDate)
      : "",
  };
};

function DashboardOverview() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    onVacation: 0,
    upcomingVacation: 0,
    vacationReturn: 0,
    visaExpiry: 0,
    passportExpiry: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);

  // Modal State
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filteredList, setFilteredList] = useState([]);

  // Vacation date prompt modal
  const [datePrompt, setDatePrompt] = useState(null);
  const [datePromptSaving, setDatePromptSaving] = useState(false);
  // datePrompt = { employeeItem, newStatus, label, fieldKey, dateValue }

  const CATEGORY_API_KEY = {
    "Total Employees": "total",
    "Active Employees": "active",
    "Inactive Employees": "inactive",
    "On vacation": "onVacation",
    "Yet to go": "yetToGo",
    "Returned back from vacation": "returned",
    "Visa Expiry": "visaExpiry",
    "Passport Expiry": "passportExpiry",
  };

  const applySummaryToCounts = (summary) => ({
    total: summary.totalEmployees ?? 0,
    active: summary.activeEmployees ?? 0,
    inactive: summary.inactiveEmployees ?? 0,
    onVacation: summary.onVacation ?? 0,
    upcomingVacation: summary.yetToGo ?? summary.upcomingVacation ?? 0,
    vacationReturn: summary.returnedBack ?? summary.vacationReturn ?? 0,
    visaExpiry: summary.visaExpiry ?? 0,
    passportExpiry: summary.passportExpiry ?? 0,
  });

  const refreshSummary = async ({ force = false } = {}) => {
    const summary = await employeeService.getEmployeeStats({ force });
    setCounts(applySummaryToCounts(summary));
    return summary;
  };

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Counts only — do not fetch all employees / leaves on dashboard open
        const summary = await employeeService.getEmployeeStats({ force: true });
        if (isMounted) {
          setCounts(applySummaryToCounts(summary));
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, []);

  const handleMarkAsReturned = (item) => {
    if (!canUpdateVacationReturn()) return;
    const todayStr = toDateInputValue(new Date());
    const plannedEnd = toDateInputValue(item.endDate);
    const prompt = buildVacationDatePrompt(
      {
        ...item,
        returnDate: item.returnDate || item.endDate || new Date(),
        firstWorkingDay: item.firstWorkingDay || item.returnDate || item.endDate || new Date(),
      },
      "Vacation Approved"
    );
    setDatePrompt({
      ...prompt,
      mode: "markReturn",
      dateValue: prompt.dateValue || plannedEnd || todayStr,
      secondaryDateValue: prompt.secondaryDateValue || plannedEnd || todayStr,
      categoryToReopen: selectedCategory,
    });
  };

  // Update a single employee's vacationStatus in-state (no page reload)
  const handleVacationStatusChange = async (employeeItem, newStatus, extraFields = {}) => {
    const empId = employeeItem.linkedEmployeeId || employeeItem._id || employeeItem.id;
    try {
      // Returning from vacation (early or extended): sync leave end date + statuses
      if (newStatus === "Vacation Approved" && (extraFields.returnDate || extraFields.firstWorkingDay)) {
        const returnDate = extraFields.returnDate || extraFields.firstWorkingDay;
        const firstWorkingDay = extraFields.firstWorkingDay || returnDate;
        await employeeService.markVacationReturn(empId, {
          returnDate,
          firstWorkingDay,
          leaveId: employeeItem.linkedLeaveId || null,
        });
      } else {
        await employeeService.updateEmployee(empId, { vacationStatus: newStatus, ...extraFields });
      }

      // Patch filteredList with both status and extra fields (dates)
      setFilteredList(prev =>
        prev.map(e =>
          (e._id === empId || e.id === empId || e.linkedEmployeeId === empId || String(e._id) === String(empId))
            ? { ...e, vacationStatus: newStatus, ...extraFields }
            : e
        )
      );

      employeeService.invalidateCache();
      await refreshSummary({ force: true });
      return true;
    } catch (err) {
      console.error("Failed to update vacation status:", err);
      alert(err?.message || "Failed to update status.");
      throw err;
    }
  };

  // Called when user picks a new status from the dropdown — show date modal first
  const handleStatusDropdownChange = (employeeItem, newStatus) => {
    const prompt = buildVacationDatePrompt(employeeItem, newStatus);
    if (prompt) {
      const categoryToReopen = selectedCategory;
      setSelectedCategory(null);
      setDatePrompt({ ...prompt, categoryToReopen });
    } else {
      handleVacationStatusChange(employeeItem, newStatus);
    }
  };

  // Confirm date modal → save both status + date, then reopen table
  const handleDatePromptConfirm = async () => {
    if (!datePrompt || datePromptSaving) return;
    const { employeeItem, newStatus, fieldKey, dateValue, secondaryFieldKey, secondaryDateValue, tertiaryFieldKey, tertiaryDateValue, categoryToReopen } = datePrompt;
    if (newStatus === "Vacation Approved" && !dateValue) {
      alert("Please select the Return / Entry Date.");
      return;
    }
    const extraFields = {};
    if (dateValue) extraFields[fieldKey] = new Date(dateValue).toISOString();
    if (secondaryFieldKey && secondaryDateValue) {
      extraFields[secondaryFieldKey] = new Date(secondaryDateValue).toISOString();
    } else if (newStatus === "Vacation Approved" && dateValue) {
      extraFields.firstWorkingDay = new Date(dateValue).toISOString();
    }
    if (tertiaryFieldKey && tertiaryDateValue) {
      extraFields[tertiaryFieldKey] = new Date(tertiaryDateValue).toISOString();
    }
    setDatePromptSaving(true);
    try {
      await handleVacationStatusChange(employeeItem, newStatus, extraFields);
      setDatePrompt(null);
      if (categoryToReopen) {
        handleCardClick(categoryToReopen);
      }
    } catch (err) {
      // handled in handleVacationStatusChange
    } finally {
      setDatePromptSaving(false);
    }
  };

  // Cancel date modal → reopen table details modal without changes
  const handleDatePromptCancel = () => {
    if (!datePrompt || datePromptSaving) return;
    const { categoryToReopen } = datePrompt;
    setDatePrompt(null);
    if (categoryToReopen) {
      handleCardClick(categoryToReopen);
    }
  };

  const handleCardClick = async (category) => {
    const apiKey = CATEGORY_API_KEY[category];
    if (!apiKey) return;

    setSelectedCategory(category);
    setFilteredList([]);
    setModalLoading(true);
    try {
      // Vacation categories often need the full matching set for status edits;
      // employee totals/expiry use a larger page size for the modal table.
      const needsFullVacationList = apiKey === "onVacation" || apiKey === "yetToGo" || apiKey === "returned";
      const result = await employeeService.getDashboardCategory({
        category: apiKey,
        page: 1,
        limit: needsFullVacationList ? 500 : 100,
        all: needsFullVacationList,
      });
      setFilteredList(Array.isArray(result?.employees) ? result.employees : []);
    } catch (err) {
      console.error("Failed to load dashboard category:", err);
      setFilteredList([]);
    } finally {
      setModalLoading(false);
    }
  };

  const cards = [
    { label: "Total Employees", value: counts.total, icon: <FaUsers />, color: "#4f46e5", trend: "+3 this month" },
    { label: "Active Employees", value: counts.active, icon: <FaUserCheck />, color: "#10b981", trend: "Steady" },
    { label: "Inactive Employees", value: counts.inactive, icon: <FaUserTimes />, color: "#64748b" },
    { label: "On vacation", value: counts.onVacation, icon: <FaPlane />, color: "#3b82f6", trend: "Live" },
    { label: "Yet to go", value: counts.upcomingVacation, icon: <FaCalendarAlt />, color: "#8b5cf6", sub: "All upcoming", tooltip: "All employees with approved or pending leave (any type) who are yet to travel (no date limit)" },
    { label: "Returned back from vacation", value: counts.vacationReturn, icon: <FaCalendarAlt />, color: "#ec4899", sub: "Last 6 months", tooltip: "Employees who returned from vacation in the last 6 months" },
    { label: "Visa Expiry", value: counts.visaExpiry, icon: <FaPassport />, color: "#f97316", sub: "Next 90 days", alert: true, tooltip: "Visas expiring within the next 3 months. Action required." },
    { label: "Passport Expiry", value: counts.passportExpiry, icon: <FaIdCard />, color: "#0d9488", sub: "Next 6 months", alert: true, tooltip: "Passports expiring within the next 6 months. Action required." },
  ];

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <span>Loading dashboard statistics...</span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.dashboardContainer}>
        <div className={styles.dashboardGrid}>
          {cards.map((card, index) => (
            <div
              key={index}
              className={`${styles.statCard} ${card.alert ? styles.alertCard : ""}`}
              title={card.tooltip || ""}
              onClick={() => handleCardClick(card.label)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.iconContainer} style={{ backgroundColor: `${card.color}15`, color: card.color }}>
                  {card.icon}
                </div>
                {card.trend && <div className={styles.trendBadge}>{card.trend}</div>}
                {card.alert && <div className={styles.alertDot}></div>}
              </div>
              <div className={styles.cardBody}>
                <div className={styles.statValue}>{card.value}</div>
                <div className={styles.statLabel}>{card.label}</div>
                {card.sub && <div className={styles.statSub}>{card.sub}</div>}
              </div>
              <div className={styles.cardActionHint}>Click to view details →</div>
            </div>
          ))}
        </div>

      </div>

        {/* Details Modal — portaled above header */}
        {selectedCategory && (
          <ModalPortal>
          <div className={styles.modalBackdrop} onClick={() => setSelectedCategory(null)}>
            <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h3 className={styles.modalTitle}>{selectedCategory}</h3>
                  <p className={styles.modalSubtitle}>Showing {filteredList.length} results</p>
                </div>
                <button className={styles.closeBtn} onClick={() => setSelectedCategory(null)}>&times;</button>
              </div>
              <div className={styles.modalBody}>
                {modalLoading ? (
                  <div className={styles.emptyState} style={{ padding: "40px 0" }}>
                    <div className={styles.spinner}></div>
                    <p>Loading {selectedCategory}…</p>
                  </div>
                ) : filteredList.length > 0 ? (
                  <div className={styles.modalTableWrap}>
                  <table className={styles.detailsTable}>
                    <thead>
                      <tr>
                        <th>Employee Name</th>
                        <th>ID</th>
                        {(selectedCategory === "On vacation" || selectedCategory === "Yet to go" || selectedCategory === "Returned back from vacation") ? (
                          <>
                            <th>Start Date</th>
                            <th>End Date</th>
                            {selectedCategory === "On vacation" && <th>Action</th>}
                          </>
                        ) : (
                          <>
                            <th>Department</th>
                            <th>{selectedCategory === "Visa Expiry" ? "Visa Expiry" : selectedCategory === "Passport Expiry" ? "Passport Expiry" : "Role"}</th>
                            <th>Vacation Status</th>
                            <th>Last Working Day / Travelling Date</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.map((item, idx) => (
                        <tr
                          key={idx}
                          onClick={() => {
                            const id = item._id || item.id || item.employee?._id;
                            if (id) navigate(`/teammanagement_salesleads/${id}`);
                          }}
                          style={{ cursor: 'pointer' }}
                          className={styles.modalRow}
                        >
                          <td>{item.employeeName || item.name || "N/A"}</td>
                          <td>{item.employeeId || "-"}</td>
                          {(selectedCategory === "On vacation" || selectedCategory === "Yet to go" || selectedCategory === "Returned back from vacation") ? (
                            <>
                              <td>{item.startDate ? new Date(item.startDate).toLocaleDateString('en-GB') : "—"}</td>
                              <td>{(item.endDate || item.leaveEndDate) ? new Date(item.endDate || item.leaveEndDate).toLocaleDateString('en-GB') : "—"}</td>
                              {selectedCategory === "On vacation" && canUpdateVacationReturn() && (
                                <td>
                                  <button
                                    className={styles.viewAllBtn}
                                    style={{
                                      padding: "6px 12px",
                                      fontSize: "11px",
                                      background: "#10b981",
                                      margin: 0,
                                      width: "auto"
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkAsReturned(item);
                                    }}
                                  >
                                    Mark Returned
                                  </button>
                                </td>
                              )}
                            </>
                          ) : (
                            <>
                              <td>{item.department || "-"}</td>
                              <td>
                                {selectedCategory === "Visa Expiry"
                                  ? <span style={{ color: "#ef4444", fontWeight: "600" }}>{new Date(item.visaExpiryDate).toLocaleDateString('en-GB')}</span>
                                  : selectedCategory === "Passport Expiry"
                                    ? <span style={{ color: "#ef4444", fontWeight: "600" }}>{new Date(item.passportExpiryDate).toLocaleDateString('en-GB')}</span>
                                    : item.role || item.employeeStatus || "-"}
                              </td>
                              <td>
                                {(localStorage.getItem("role") === "admin" || localStorage.getItem("role") === "hod") && selectedCategory === "Active Employees" ? (() => {
                                  const vs = item.vacationStatus || "Onsite";
                                  const statusConfig = {
                                    "Onsite": { bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)", color: "#065f46", dot: "#10b981", icon: "✓" },
                                    "On Vacation": { bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)", color: "#1e3a8a", dot: "#3b82f6", icon: "✈" },
                                    "Vacation Approved": { bg: "linear-gradient(135deg,#ede9fe,#ddd6fe)", color: "#4c1d95", dot: "#7c3aed", icon: "✔" },
                                    "Vacation Pending": { bg: "linear-gradient(135deg,#fef9c3,#fde68a)", color: "#713f12", dot: "#f59e0b", icon: "⏳" },
                                  };
                                  const cfg = statusConfig[vs] || statusConfig["Onsite"];
                                  return (
                                    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }} onClick={e => e.stopPropagation()}>
                                      {/* Pill badge display */}
                                      <div style={{
                                        display: "inline-flex", alignItems: "center", gap: "6px",
                                        padding: "5px 12px 5px 8px",
                                        borderRadius: "999px",
                                        background: cfg.bg,
                                        color: cfg.color,
                                        fontSize: "12px",
                                        fontWeight: "700",
                                        whiteSpace: "nowrap",
                                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                                        border: `1px solid ${cfg.dot}30`,
                                        userSelect: "none",
                                        cursor: "pointer",
                                        minWidth: "118px",
                                        justifyContent: "space-between",
                                        letterSpacing: "0.01em",
                                      }}>
                                        {/* Left: dot + icon + label */}
                                        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                          <span style={{
                                            width: "7px", height: "7px", borderRadius: "50%",
                                            background: cfg.dot,
                                            flexShrink: 0,
                                            boxShadow: `0 0 0 2px ${cfg.dot}30`,
                                          }} />
                                          <span style={{ fontSize: "11px" }}>{cfg.icon}</span>
                                          {vs === "On Vacation" ? "On vacation" : vs === "Vacation Approved" ? "Returned back from vacation" : vs === "Vacation Pending" ? "Yet to go" : vs}
                                        </span>
                                        {/* Right: chevron */}
                                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, marginLeft: "4px" }}>
                                          <path d="M2 3.5L5 6.5L8 3.5" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                      </div>
                                      {/* Invisible native select on top for browser UX */}
                                      <select
                                        style={{
                                          position: "absolute", inset: 0, opacity: 0,
                                          cursor: "pointer", width: "100%", height: "100%",
                                        }}
                                        value={vs}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const newStatus = e.target.value;
                                          handleStatusDropdownChange(item, newStatus);
                                        }}
                                      >
                                        <option value="Onsite">Onsite</option>
                                        <option value="On Vacation">On vacation</option>
                                        <option value="Vacation Approved">Returned back from vacation</option>
                                        <option value="Vacation Pending">Yet to go</option>
                                      </select>
                                    </div>
                                  );
                                })() : (
                                  (() => {
                                    const vs = item.vacationStatus || "Onsite";
                                    const dotColor = vs === "On Vacation" ? "#3b82f6" : vs === "Vacation Approved" ? "#7c3aed" : vs === "Vacation Pending" ? "#f59e0b" : "#10b981";
                                    return (
                                      <span style={{
                                        display: "inline-flex", alignItems: "center", gap: "5px",
                                        padding: "4px 10px", borderRadius: "999px",
                                        background: "#f8fafc", border: "1px solid #e2e8f0",
                                        fontSize: "12px", fontWeight: "600", color: "#334155"
                                      }}>
                                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                                        {vs === "On Vacation" ? "On vacation" : vs === "Vacation Approved" ? "Returned back from vacation" : vs === "Vacation Pending" ? "Yet to go" : vs}
                                      </span>
                                    );
                                  })()
                                )}
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                {(() => {
                                  const vs = item.vacationStatus || "Onsite";
                                  const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : null);
                                  if (vs === "On Vacation" || vs === "Vacation Pending") {
                                    const lines = [];
                                    if (item.lastWorkingDay) lines.push(`LWD: ${fmt(item.lastWorkingDay)}`);
                                    if (item.travellingDate) lines.push(`Travel: ${fmt(item.travellingDate)}`);
                                    if (!lines.length) return <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>;
                                    return (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        {lines.map((line) => (
                                          <span key={line} style={{ fontSize: "12px", fontWeight: "600", color: "#1e293b" }}>{line}</span>
                                        ))}
                                      </div>
                                    );
                                  }
                                  if (vs === "Vacation Approved") {
                                    const lines = [];
                                    if (item.returnDate) lines.push(`Return: ${fmt(item.returnDate)}`);
                                    if (item.firstWorkingDay) lines.push(`First Work Day: ${fmt(item.firstWorkingDay)}`);
                                    if (!lines.length) return <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>;
                                    return (
                                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                        {lines.map((line) => (
                                          <span key={line} style={{ fontSize: "12px", fontWeight: "600", color: "#1e293b" }}>{line}</span>
                                        ))}
                                      </div>
                                    );
                                  }
                                  return <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>;
                                })()}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <div className={styles.emptyState}>No data found for this category.</div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={styles.viewAllBtn}
                  onClick={() => {
                    if (selectedCategory === "On vacation" || selectedCategory === "Yet to go" || selectedCategory === "Returned back from vacation") {
                      navigate("/leave-requests");
                    } else {
                      navigate("/teammanagement");
                    }
                  }}
                >
                  View All in {(selectedCategory === "On vacation" || selectedCategory === "Yet to go" || selectedCategory === "Returned back from vacation") ? "Leave Management" : "Team Management"}
                </button>
                <button className={styles.modalCloseBtn} onClick={() => setSelectedCategory(null)}>Close</button>
              </div>
            </div>
          </div>
          </ModalPortal>
        )}

      {/* Vacation Date Prompt Modal */}
      {datePrompt && (() => {
        const nameInitials = datePrompt.employeeItem.employeeName
          ? datePrompt.employeeItem.employeeName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
          : "EE";

        const getStatusLabelAndStyle = (status) => {
          const config = {
            "On Vacation": { label: "On vacation", bg: "linear-gradient(135deg, #dbeafe, #bfdbfe)", color: "#1e3a8a", dot: "#3b82f6" },
            "Vacation Approved": { label: "Returned back from vacation", bg: "linear-gradient(135deg, #ede9fe, #ddd6fe)", color: "#4c1d95", dot: "#7c3aed" },
            "Vacation Pending": { label: "Yet to go", bg: "linear-gradient(135deg, #fef9c3, #fde68a)", color: "#713f12", dot: "#f59e0b" }
          };
          return config[status] || { label: status, bg: "#f8fafc", color: "#334155", dot: "#64748b" };
        };

        const statusCfg = getStatusLabelAndStyle(datePrompt.newStatus);

        return (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 10001,
              background: "rgba(15, 23, 42, 0.6)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "20px"
            }}
            onClick={handleDatePromptCancel}
          >
            <style>{`
              @keyframes datePromptFadeIn {
                from { opacity: 0; transform: scale(0.95) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
              @keyframes datePromptSpin {
                to { transform: rotate(360deg); }
              }
              .premium-input-date:focus {
                border-color: #6366f1 !important;
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15) !important;
              }
            `}</style>
            <div
              style={{
                background: "#fff",
                borderRadius: "24px",
                padding: "36px",
                width: "440px",
                maxWidth: "100%",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(79, 70, 229, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                position: "relative",
                overflow: "hidden",
                border: "1px solid #f1f5f9",
                animation: "datePromptFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Top Accent Gradient Bar */}
              <div style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: "6px",
                background: "linear-gradient(90deg, #4f46e5, #8b5cf6, #ec4899)"
              }} />

              {/* Close Button */}
              <button
                onClick={handleDatePromptCancel}
                style={{
                  position: "absolute",
                  top: "20px", right: "20px",
                  background: "#f1f5f9", border: "none",
                  width: "32px", height: "32px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "18px", color: "#64748b", cursor: "pointer",
                  transition: "all 0.2s ease",
                  lineHeight: 1
                }}
                onMouseEnter={e => { e.target.style.background = "#e2e8f0"; e.target.style.color = "#0f172a"; }}
                onMouseLeave={e => { e.target.style.background = "#f1f5f9"; e.target.style.color = "#64748b"; }}
              >&times;</button>

              {/* Avatar & Header */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8px", marginTop: "10px" }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #ede9fe, #c7d2fe)",
                  color: "#4f46e5",
                  fontSize: "22px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 16px rgba(79, 70, 229, 0.12)"
                }}>
                  {nameInitials}
                </div>
                <h3 style={{ margin: "10px 0 2px", fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>
                  {datePrompt.secondaryFieldKey ? "Set Vacation Dates" : `Set ${datePrompt.label}`}
                </h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.5" }}>
                  Please select the actual return date{datePrompt.secondaryFieldKey ? "s" : ""} for <strong style={{ color: "#334155" }}>{datePrompt.employeeItem.employeeName}</strong>
                  {datePrompt.mode === "markReturn" ? " (earlier or later than planned)." : "."}
                </p>
              </div>

              {/* Status Badge Visual Transition Indicator */}
              <div style={{
                background: "#f8fafc",
                borderRadius: "16px",
                padding: "14px 18px",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Updating Status to:
                  </span>
                </div>
                <div style={{ display: "inline-flex", alignSelf: "flex-start" }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 14px",
                    borderRadius: "999px",
                    background: statusCfg.bg,
                    color: statusCfg.color,
                    fontSize: "13px",
                    fontWeight: "800",
                    boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                    border: `1px solid ${statusCfg.dot}25`
                  }}>
                    <span style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: statusCfg.dot,
                      boxShadow: `0 0 0 2px ${statusCfg.dot}25`
                    }} />
                    {statusCfg.label}
                  </span>
                </div>
              </div>

              {/* Date Input Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Select {datePrompt.label}
                  </label>
                  <DateInput
                    value={datePrompt.dateValue}
                    className="premium-input-date"
                    onChange={e => setDatePrompt(prev => ({ ...prev, dateValue: e.target.value }))}
                    style={{
                      border: "2px solid #e2e8f0",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      fontSize: "15px",
                      color: "#0f172a",
                      fontWeight: "600",
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                      cursor: "pointer"
                    }}
                  />
                </div>
                {datePrompt.secondaryFieldKey && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Select {datePrompt.secondaryLabel}
                    </label>
                    <DateInput
                      value={datePrompt.secondaryDateValue}
                      className="premium-input-date"
                      onChange={e => setDatePrompt(prev => ({ ...prev, secondaryDateValue: e.target.value }))}
                      style={{
                        border: "2px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        fontSize: "15px",
                        color: "#0f172a",
                        fontWeight: "600",
                        outline: "none",
                        width: "100%",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                        cursor: "pointer"
                      }}
                    />
                  </div>
                )}
                {datePrompt.tertiaryFieldKey && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Select {datePrompt.tertiaryLabel}
                    </label>
                    <DateInput
                      value={datePrompt.tertiaryDateValue}
                      className="premium-input-date"
                      onChange={e => setDatePrompt(prev => ({ ...prev, tertiaryDateValue: e.target.value }))}
                      style={{
                        border: "2px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "12px 16px",
                        fontSize: "15px",
                        color: "#0f172a",
                        fontWeight: "600",
                        outline: "none",
                        width: "100%",
                        boxSizing: "border-box",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                        cursor: "pointer"
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  onClick={handleDatePromptCancel}
                  disabled={datePromptSaving}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    border: "2px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: datePromptSaving ? "not-allowed" : "pointer",
                    opacity: datePromptSaving ? 0.6 : 1,
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={e => { if (!datePromptSaving) { e.target.style.background = "#f8fafc"; e.target.style.borderColor = "#cbd5e1"; e.target.style.color = "#475569"; } }}
                  onMouseLeave={e => { if (!datePromptSaving) { e.target.style.background = "#fff"; e.target.style.borderColor = "#e2e8f0"; e.target.style.color = "#64748b"; } }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDatePromptConfirm}
                  disabled={datePromptSaving}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "12px",
                    border: "none",
                    background: datePromptSaving ? "#94a3b8" : "linear-gradient(135deg, #4f46e5, #6366f1)",
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: datePromptSaving ? "not-allowed" : "pointer",
                    boxShadow: datePromptSaving ? "none" : "0 4px 12px rgba(79, 70, 229, 0.25)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    minWidth: "120px"
                  }}
                  onMouseEnter={e => { if (!datePromptSaving) { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 16px rgba(79, 70, 229, 0.35)"; } }}
                  onMouseLeave={e => { if (!datePromptSaving) { e.target.style.transform = "none"; e.target.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.25)"; } }}
                >
                  {datePromptSaving && (
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.35)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "datePromptSpin 0.7s linear infinite"
                      }}
                    />
                  )}
                  {datePromptSaving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

export default DashboardOverview;
