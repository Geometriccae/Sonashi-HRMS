import React, { useState, useEffect } from "react";
import styles from "./DashboardOverview.module.css";
import "bootstrap/dist/css/bootstrap.min.css";
import employeeService from "../services/EmployeeService";

function DashboardOverview() {
  const [activeEmployeesCount, setActiveEmployeesCount] = useState(0);
  const [inactiveEmployeesCount, setInactiveEmployeesCount] = useState(0);
  const [totalEmployeesCount, setTotalEmployeesCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchCounts = async () => {
      try {
        const response = await employeeService.getEmployees();
        const rows = Array.isArray(response) ? response : (response?.data || response?.employees || []);
        
        let active = 0;
        let inactive = 0;
        
        rows.forEach(emp => {
          if (emp.employeeStatus && String(emp.employeeStatus).toLowerCase() === "active") {
            active++;
          } else {
            inactive++;
          }
        });
        
        if (isMounted) {
          setTotalEmployeesCount(rows.length);
          setActiveEmployeesCount(active);
          setInactiveEmployeesCount(inactive);
        }
      } catch (err) {
        console.error("Failed to fetch employees:", err);
      }
    };
    fetchCounts();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className={styles.multiCardDashboard}>
      <div className={styles.metricCardBig}>
        <div className={styles.metricContent}>
          <div className={styles.metricLabel}>Total Employees</div>
          <div className={styles.metricValue}>{totalEmployeesCount}</div>
        </div>
      </div>
      <div className={styles.metricCardBig}>
        <div className={styles.metricContent}>
          <div className={styles.metricLabel}>Active Employees</div>
          <div className={styles.metricValue}>{activeEmployeesCount}</div>
        </div>
      </div>
      <div className={styles.metricCardBig}>
        <div className={styles.metricContent}>
          <div className={styles.metricLabel}>Inactive Employees</div>
          <div className={styles.metricValue}>{inactiveEmployeesCount}</div>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
