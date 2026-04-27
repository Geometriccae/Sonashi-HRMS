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
  FaPassport, 
  FaUserPlus 
} from "react-icons/fa";

function DashboardOverview() {
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
    visaExpiry: 0,
    onboarding: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filteredList, setFilteredList] = useState([]);

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
        today.setHours(0,0,0,0);
        
        const next60Days = new Date(today);
        next60Days.setDate(today.getDate() + 60);
        
        const next90Days = new Date(today);
        next90Days.setDate(today.getDate() + 90);

        // 1. Employee Stats
        let active = 0;
        let inactive = 0;
        let onboarding = 0;
        let visaExpiry = 0;

        empList.forEach(emp => {
          const status = String(emp.employeeStatus || "Active").toLowerCase();
          if (status === "active") active++;
          else if (status === "inactive") inactive++;
          else if (status === "onboarding" || status === "probation") onboarding++;

          if (emp.visaExpiryDate) {
            const expiry = new Date(emp.visaExpiryDate);
            if (expiry > today && expiry <= next90Days) {
              visaExpiry++;
            }
          }
        });

        // 2. Vacation Stats
        let onVacation = 0;
        let upcomingVacation = 0;

        leaveList.forEach(req => {
          if (req.status === "Approved") {
            const start = new Date(req.startDate);
            const end = new Date(req.endDate);
            
            if (today >= start && today <= end) {
              onVacation++;
            } else if (start > today && start <= next60Days) {
              upcomingVacation++;
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
            visaExpiry,
            onboarding
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

  const handleCardClick = (category) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const next60Days = new Date(today);
    next60Days.setDate(today.getDate() + 60);
    const next90Days = new Date(today);
    next90Days.setDate(today.getDate() + 90);

    let list = [];
    switch (category) {
      case "Total Employees":
        list = data.employees;
        break;
      case "Active Employees":
        list = data.employees.filter(e => String(e.employeeStatus || "Active").toLowerCase() === "active");
        break;
      case "Inactive Employees":
        list = data.employees.filter(e => String(e.employeeStatus || "Active").toLowerCase() === "inactive");
        break;
      case "On Vacation":
        list = data.leaveRequests
          .filter(req => {
            if (req.status !== "Approved") return false;
            const s = new Date(req.startDate);
            const e = new Date(req.endDate);
            return today >= s && today <= e;
          })
          .map(req => { 
            const empName = req.employeeName || req.employee?.employeeName || "Unknown";
            const linkedEmp = data.employees.find(e => 
              (e._id === (req.employee?._id || req.employee)) || 
              (e.employeeName === empName)
            );
            return { 
              ...req, 
              employeeName: empName,
              employeeId: linkedEmp?.employeeId || req.employeeId || req.employee?.employeeId || "-"
            };
          });
        break;
      case "Upcoming Vacations":
        list = data.leaveRequests
          .filter(req => {
            if (req.status !== "Approved") return false;
            const s = new Date(req.startDate);
            return s > today && s <= next60Days;
          })
          .map(req => { 
            const empName = req.employeeName || req.employee?.employeeName || "Unknown";
            const linkedEmp = data.employees.find(e => 
              (e._id === (req.employee?._id || req.employee)) || 
              (e.employeeName === empName)
            );
            return { 
              ...req, 
              employeeName: empName,
              employeeId: linkedEmp?.employeeId || req.employeeId || req.employee?.employeeId || "-"
            };
          });
        break;
      case "Visa Expiry":
        list = data.employees.filter(e => {
          if (!e.visaExpiryDate) return false;
          const expiry = new Date(e.visaExpiryDate);
          return expiry > today && expiry <= next90Days;
        });
        break;
      case "Onboarding":
        list = data.employees.filter(e => {
          const status = String(e.employeeStatus || "").toLowerCase();
          return status === "onboarding" || status === "probation";
        });
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
    { label: "On Vacation", value: counts.onVacation, icon: <FaPlane />, color: "#3b82f6", trend: "Live" },
    { label: "Upcoming Vacations", value: counts.upcomingVacation, icon: <FaCalendarAlt />, color: "#8b5cf6", sub: "Next 60 days", tooltip: "Employees with approved leave starting in the next 60 days" },
    { label: "Visa Expiry", value: counts.visaExpiry, icon: <FaPassport />, color: "#f97316", sub: "Next 90 days", alert: true, tooltip: "Visas expiring within the next 3 months. Action required." },
    { label: "Onboarding", value: counts.onboarding, icon: <FaUserPlus />, color: "#06b6d4", sub: "Probation/New", trend: "New" },
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
                      {selectedCategory.includes("Vacation") ? (
                        <>
                          <th>Start Date</th>
                          <th>End Date</th>
                        </>
                      ) : (
                        <>
                          <th>Department</th>
                          <th>{selectedCategory === "Visa Expiry" ? "Visa Expiry" : "Role"}</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.employeeName || item.name || "N/A"}</td>
                        <td>{item.employeeId || "-"}</td>
                        {selectedCategory.includes("Vacation") ? (
                          <>
                            <td>{new Date(item.startDate).toLocaleDateString()}</td>
                            <td>{new Date(item.endDate).toLocaleDateString()}</td>
                          </>
                        ) : (
                          <>
                            <td>{item.department || "-"}</td>
                            <td>
                              {selectedCategory === "Visa Expiry" 
                                ? <span style={{ color: "#ef4444", fontWeight: "600" }}>{new Date(item.visaExpiryDate).toLocaleDateString()}</span>
                                : item.role || item.employeeStatus || "-"}
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
              <button className={styles.modalCloseBtn} onClick={() => setSelectedCategory(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardOverview;
