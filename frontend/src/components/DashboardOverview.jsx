import React, { useState, useEffect } from "react";
import styles from "./DashboardOverview.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import employeeService from "../services/EmployeeService";
import leaveRequestService from "../services/LeaveRequestService";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaPlane,
  FaCalendarAlt,
  FaPassport
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

function DashboardOverview() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    employees: [],
    leaveRequests: []
  });
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    onVacation: 0,
    upcomingVacation: 0,
    vacationReturn: 0,
    visaExpiry: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filteredList, setFilteredList] = useState([]);

  // Vacation date prompt modal
  const [datePrompt, setDatePrompt] = useState(null);
  // datePrompt = { employeeItem, newStatus, label, fieldKey, dateValue }

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [employees, leaveRequests] = await Promise.all([
          employeeService.getEmployees(),
          leaveRequestService.getLeaveRequests()
        ]);

        const empList = Array.isArray(employees) ? employees : (employees?.data || []);
        const leaveList = Array.isArray(leaveRequests) ? leaveRequests : (leaveRequests?.data || []);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const next60Days = new Date(today);
        next60Days.setDate(today.getDate() + 60);

        const next90Days = new Date(today);
        next90Days.setDate(today.getDate() + 90);

        // Map of empId -> vacationStatus for deduplication
        const empAttendanceMap = {};
        empList.forEach(emp => {
          const vs = emp.vacationStatus || "Not on Vacation";
          if (vs !== "Not on Vacation") {
            empAttendanceMap[emp._id] = vs;
          }
        });

        // 1. Employee Stats
        let active = 0;
        let inactive = 0;
        let visaExpiry = 0;
        let attOnVacation = 0;
        let attUpcoming = 0;
        let attVacReturn = 0;

        empList.forEach(emp => {
          const status = String(emp.employeeStatus || "Active").toLowerCase();
          const vs = emp.vacationStatus || "Not on Vacation";

          if (status === "active") active++;
          else if (status === "inactive") inactive++;

          // Count vacation statuses
          if (vs === "On Vacation") attOnVacation++;
          else if (vs === "Vacation Pending") attUpcoming++;
          else if (vs === "Vacation Approved") attVacReturn++;

          if (emp.visaExpiryDate) {
            const expiry = new Date(emp.visaExpiryDate);
            if (expiry > today && expiry <= next90Days) {
              visaExpiry++;
            }
          }
        });

        // 2. Vacation Stats (leave-request-based, skip employees with manual attendance)
        let onVacation = attOnVacation;
        let upcomingVacation = attUpcoming;
        let vacationReturn = attVacReturn;

        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);

        leaveList.forEach(req => {
          if (req.status === "Approved") {
            const empId = req.employee?._id || req.employee;
            // Skip if employee has a manual vacation status override
            if (empAttendanceMap[empId]) return;

            const start = new Date(req.startDate);
            const end = new Date(req.endDate);

            if (today >= start && today <= end) {
              onVacation++;
            } else if (start > today && start <= next60Days) {
              upcomingVacation++;
            } else if (end >= lastMonth && end < today) {
              vacationReturn++;
            }
          }
        });

        if (isMounted) {
          setData({ employees: empList, leaveRequests: leaveList });
          setCounts({
            total: empList.length,
            active,
            inactive,
            onVacation,
            upcomingVacation,
            vacationReturn,
            visaExpiry
          });
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

  const handleMarkAsReturned = async (req) => {
    if (!window.confirm(`Are you sure ${req.employeeName} has returned early? This will update their leave end date to today.`)) return;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Update Leave Request
      await leaveRequestService.updateLeaveRequest(req._id, {
        endDate: today.toISOString(),
        status: "Approved"
      });

      // Update Employee Attendance if possible
      const empId = req.employee?._id || req.employee;
      if (empId) {
        await employeeService.updateEmployee(empId, { attendance: "Onsite" });
      }

      window.location.reload(); // Refresh to update all cards
    } catch (err) {
      console.error("Failed to mark as returned:", err);
      alert("Failed to update status.");
    }
  };

  // Update a single employee's vacationStatus in-state (no page reload)
  const handleVacationStatusChange = async (employeeItem, newStatus, extraFields = {}) => {
    const empId = employeeItem._id || employeeItem.id;
    try {
      await employeeService.updateEmployee(empId, { vacationStatus: newStatus, ...extraFields });

      // Patch data.employees with both status and extra fields (dates)
      const updatedEmployees = data.employees.map(e =>
        (e._id === empId || e.id === empId) ? { ...e, vacationStatus: newStatus, ...extraFields } : e
      );

      // Patch filteredList with both status and extra fields (dates)
      setFilteredList(prev =>
        prev.map(e =>
          (e._id === empId || e.id === empId) ? { ...e, vacationStatus: newStatus, ...extraFields } : e
        )
      );

      // Recompute counts from updated list
      let attOnVacation = 0, attUpcoming = 0, attVacReturn = 0;
      updatedEmployees.forEach(e => {
        const vs = e.vacationStatus || "Not on Vacation";

        if (vs === "On Vacation") attOnVacation++;
        else if (vs === "Vacation Pending") attUpcoming++;
        else if (vs === "Vacation Approved") attVacReturn++;
      });
      setCounts(prev => ({
        ...prev,
        onVacation: attOnVacation,
        upcomingVacation: attUpcoming,
        vacationReturn: attVacReturn
      }));

      setData(prev => ({ ...prev, employees: updatedEmployees }));
      return updatedEmployees;
    } catch (err) {
      console.error("Failed to update vacation status:", err);
      alert("Failed to update status.");
      throw err;
    }
  };

  // Called when user picks a new status from the dropdown — show date modal first
  const handleStatusDropdownChange = (employeeItem, newStatus) => {
    const dateConfig = {
      "On Vacation": { label: "Last Working Day", fieldKey: "lastWorkingDay" },
      "Vacation Pending": { label: "Travelling Date", fieldKey: "travellingDate" },
      "Vacation Approved": { label: "Entered Date", fieldKey: "firstWorkingDay" },
    };
    const cfg = dateConfig[newStatus];
    if (cfg) {
      const categoryToReopen = selectedCategory;
      setSelectedCategory(null); // Close the table details modal first
      setDatePrompt({
        employeeItem,
        newStatus,
        label: cfg.label,
        fieldKey: cfg.fieldKey,
        dateValue: "",
        categoryToReopen
      });
    } else {
      handleVacationStatusChange(employeeItem, newStatus);
    }
  };

  // Confirm date modal → save both status + date, then reopen table
  const handleDatePromptConfirm = async () => {
    if (!datePrompt) return;
    const { employeeItem, newStatus, fieldKey, dateValue, categoryToReopen } = datePrompt;
    const extraFields = dateValue ? { [fieldKey]: new Date(dateValue).toISOString() } : {};
    try {
      const updatedEmployees = await handleVacationStatusChange(employeeItem, newStatus, extraFields);
      setDatePrompt(null);
      if (categoryToReopen) {
        handleCardClick(categoryToReopen, updatedEmployees);
      }
    } catch (err) {
      // handled in handleVacationStatusChange
    }
  };

  // Cancel date modal → reopen table details modal without changes
  const handleDatePromptCancel = () => {
    if (!datePrompt) return;
    const { categoryToReopen } = datePrompt;
    setDatePrompt(null);
    if (categoryToReopen) {
      handleCardClick(categoryToReopen);
    }
  };

  const handleCardClick = (category, customEmpList = null) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next60Days = new Date(today);
    next60Days.setDate(today.getDate() + 60);
    const next90Days = new Date(today);
    next90Days.setDate(today.getDate() + 90);

    const empSource = customEmpList || data.employees;

    let list = [];
    switch (category) {
      case "Total Employees":
        list = empSource;
        break;
      case "Active Employees":
        list = empSource.filter(e => {
          const status = String(e.employeeStatus || "Active").toLowerCase();
          return status === "active";
        });
        break;
      case "Inactive Employees":
        list = empSource.filter(e => String(e.employeeStatus || "Active").toLowerCase() === "inactive");
        break;
      case "On vacation": {
        // Employees with vacationStatus = "On Vacation"
        const attEmps = empSource
          .filter(e => e.vacationStatus === "On Vacation")
          .map(e => ({ ...e, _type: "employee" }));
        const attEmpIds = new Set(attEmps.map(e => e._id));
        // Leave-request-based (exclude already counted)
        const leaveEmps = data.leaveRequests
          .filter(req => {
            if (req.status !== "Approved") return false;
            const empId = req.employee?._id || req.employee;
            if (attEmpIds.has(empId)) return false;
            const s = new Date(req.startDate);
            const e = new Date(req.endDate);
            return today >= s && today <= e;
          })
          .map(req => {
            const empName = req.employeeName || req.employee?.employeeName || "Unknown";
            const linkedEmp = empSource.find(e =>
              (e._id === (req.employee?._id || req.employee)) ||
              (e.employeeName === empName)
            );
            return { ...req, employeeName: empName, employeeId: linkedEmp?.employeeId || req.employeeId || "-" };
          });
        list = [...attEmps, ...leaveEmps];
        break;
      }
      case "Yet to go": {
        const attEmps = empSource
          .filter(e => e.vacationStatus === "Vacation Pending")
          .map(e => ({ ...e, _type: "employee" }));
        const attEmpIds = new Set(attEmps.map(e => e._id));
        const leaveEmps = data.leaveRequests
          .filter(req => {
            if (req.status !== "Approved") return false;
            const empId = req.employee?._id || req.employee;
            if (attEmpIds.has(empId)) return false;
            const s = new Date(req.startDate);
            return s > today && s <= next60Days;
          })
          .map(req => {
            const empName = req.employeeName || req.employee?.employeeName || "Unknown";
            const linkedEmp = empSource.find(e =>
              (e._id === (req.employee?._id || req.employee)) ||
              (e.employeeName === empName)
            );
            return { ...req, employeeName: empName, employeeId: linkedEmp?.employeeId || req.employeeId || "-" };
          });
        list = [...attEmps, ...leaveEmps];
        break;
      }
      case "Returned back from vacation": {
        const attEmps = empSource
          .filter(e => e.vacationStatus === "Vacation Approved")
          .map(e => ({ ...e, _type: "employee" }));
        const attEmpIds = new Set(attEmps.map(e => e._id));
        const lastM = new Date(today);
        lastM.setMonth(today.getMonth() - 1);
        const leaveEmps = data.leaveRequests
          .filter(req => {
            if (req.status !== "Approved") return false;
            const empId = req.employee?._id || req.employee;
            if (attEmpIds.has(empId)) return false;
            const e = new Date(req.endDate);
            return e >= lastM && e < today;
          })
          .map(req => {
            const empName = req.employeeName || req.employee?.employeeName || "Unknown";
            const linkedEmp = empSource.find(e =>
              (e._id === (req.employee?._id || req.employee)) ||
              (e.employeeName === empName)
            );
            return { ...req, employeeName: empName, employeeId: linkedEmp?.employeeId || req.employeeId || "-" };
          });
        list = [...attEmps, ...leaveEmps];
        break;
      }
      case "Visa Expiry":
        list = empSource.filter(e => {
          if (!e.visaExpiryDate) return false;
          const expiry = new Date(e.visaExpiryDate);
          return expiry > today && expiry <= next90Days;
        });
        break;
      case "ONBOARDING":
        list = [];
        break;
      default:
        list = [];
    }
    setFilteredList(list);
    setSelectedCategory(category);
  };

  const cards = [
    { label: "Total Employees", value: counts.total, icon: <FaUsers />, color: "#4f46e5", trend: "+3 this month" },
    { label: "Active Employees", value: counts.active, icon: <FaUserCheck />, color: "#10b981", trend: "Steady" },
    { label: "Inactive Employees", value: counts.inactive, icon: <FaUserTimes />, color: "#64748b" },
    { label: "On vacation", value: counts.onVacation, icon: <FaPlane />, color: "#3b82f6", trend: "Live" },
    { label: "Yet to go", value: counts.upcomingVacation, icon: <FaCalendarAlt />, color: "#8b5cf6", sub: "Next 60 days", tooltip: "Employees with approved leave starting in the next 60 days" },
    { label: "Returned back from vacation", value: counts.vacationReturn, icon: <FaCalendarAlt />, color: "#ec4899", sub: "Last 1 month", tooltip: "Employees who returned from vacation in the last 1 month" },
    { label: "Visa Expiry", value: counts.visaExpiry, icon: <FaPassport />, color: "#f97316", sub: "Next 90 days", alert: true, tooltip: "Visas expiring within the next 3 months. Action required." },
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

        {/* Details Modal */}
        {selectedCategory && (
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
                {filteredList.length > 0 ? (
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
                            <th>{selectedCategory === "Visa Expiry" ? "Visa Expiry" : "Role"}</th>
                            <th>Vacation Status</th>
                            <th>
                              {(() => {
                                const vs = (filteredList[0] && filteredList[0].vacationStatus) || "";
                                if (vs === "On Vacation") return "Last Working Day";
                                if (vs === "Vacation Pending") return "Travelling Date";
                                if (vs === "Vacation Approved") return "Entered Date";
                                return "Date";
                              })()}
                            </th>
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
                              <td>{new Date(item.startDate).toLocaleDateString('en-GB')}</td>
                              <td>{new Date(item.endDate).toLocaleDateString('en-GB')}</td>
                              {selectedCategory === "On vacation" && (
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
                                  : item.role || item.employeeStatus || "-"}
                              </td>
                              <td>
                                {(localStorage.getItem("role") === "admin" || localStorage.getItem("role") === "hod") && selectedCategory === "Active Employees" ? (() => {
                                  const vs = item.vacationStatus || "Not on Vacation";
                                  const statusConfig = {
                                    "Not on Vacation": { bg: "linear-gradient(135deg,#d1fae5,#a7f3d0)", color: "#065f46", dot: "#10b981", icon: "✓" },
                                    "On Vacation": { bg: "linear-gradient(135deg,#dbeafe,#bfdbfe)", color: "#1e3a8a", dot: "#3b82f6", icon: "✈" },
                                    "Vacation Approved": { bg: "linear-gradient(135deg,#ede9fe,#ddd6fe)", color: "#4c1d95", dot: "#7c3aed", icon: "✔" },
                                    "Vacation Pending": { bg: "linear-gradient(135deg,#fef9c3,#fde68a)", color: "#713f12", dot: "#f59e0b", icon: "⏳" },
                                  };
                                  const cfg = statusConfig[vs] || statusConfig["Not on Vacation"];
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
                                        minWidth: "140px",
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
                                        <option value="Not on Vacation">Not on Vacation</option>
                                        <option value="On Vacation">On vacation</option>
                                        <option value="Vacation Approved">Returned back from vacation</option>
                                        <option value="Vacation Pending">Yet to go</option>
                                      </select>
                                    </div>
                                  );
                                })() : (
                                  (() => {
                                    const vs = item.vacationStatus || "Not on Vacation";
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
                                  const vs = item.vacationStatus || "Not on Vacation";
                                  const dateFieldMap = {
                                    "On Vacation": { key: "lastWorkingDay" },
                                    "Vacation Pending": { key: "travellingDate" },
                                    "Vacation Approved": { key: "firstWorkingDay" },
                                  };
                                  const cfg = dateFieldMap[vs];
                                  if (!cfg || !item[cfg.key]) return <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>;
                                  return (
                                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
                                      {new Date(item[cfg.key]).toLocaleDateString('en-GB')}
                                    </span>
                                  );
                                })()}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
        )}
      </div>

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
              position: "fixed", inset: 0, zIndex: 100001,
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
                  Set {datePrompt.label}
                </h3>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b", lineHeight: "1.5" }}>
                  Please select the vacation-related date for <strong style={{ color: "#334155" }}>{datePrompt.employeeItem.employeeName}</strong>.
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
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Select {datePrompt.label}
                </label>
                <input
                  type="date"
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
                  autoFocus
                />
              </div>

              {/* Footer Buttons */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button
                  onClick={handleDatePromptCancel}
                  style={{
                    padding: "12px 24px",
                    borderRadius: "12px",
                    border: "2px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={e => { e.target.style.background = "#f8fafc"; e.target.style.borderColor = "#cbd5e1"; e.target.style.color = "#475569"; }}
                  onMouseLeave={e => { e.target.style.background = "#fff"; e.target.style.borderColor = "#e2e8f0"; e.target.style.color = "#64748b"; }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDatePromptConfirm}
                  style={{
                    padding: "12px 28px",
                    borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                  onMouseEnter={e => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 16px rgba(79, 70, 229, 0.35)"; }}
                  onMouseLeave={e => { e.target.style.transform = "none"; e.target.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.25)"; }}
                >
                  Confirm
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
