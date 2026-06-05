import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./TeamManagement.module.css";
import Side from "../sidebar/Sidebar";
import TopNavbar, { PageBody, pageLayoutStyles } from "../../components/TopNavbar";
import arrowupright from "../../assets/dashboard/arrow-up-right.svg";
import TeamMembersTable from "../../components/team-management-components/TeamMembersTable";
import EmployeeService from "../../services/EmployeeService";
import AttendanceService from "../../services/AttendanceService";

function TeamManagement() {
  const navigate = useNavigate();
  
  // Stats state
  const [stats, setStats] = useState({
    attendancePercentage: 0,
    totalAssignedProjects: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const employees = await EmployeeService.getEmployees();
      
      // 1. Total Employees
      const totalEmployees = employees.length;
      
      let activeCount = 0;
      let inactiveCount = 0;
      employees.forEach(emp => {
          if (emp.employeeStatus && String(emp.employeeStatus).toLowerCase() === "active") {
            activeCount++;
          } else {
            inactiveCount++;
          }
      });

      // 2. Today's Attendance (Percentage of 'Onsite' employees)
      const todayStr = new Date().toISOString().slice(0, 10);
      let presentCount = 0;
      try {
        const todayRecords = await AttendanceService.getByRange(todayStr, todayStr);
        if (Array.isArray(todayRecords)) {
          presentCount = todayRecords.filter(r => r.status === 'Onsite').length;
        }
      } catch (err) {
        console.warn("Failed to fetch today's attendance for stats:", err);
        presentCount = employees.filter(emp => emp.attendance === 'Onsite').length;
      }

      const attendancePercentage = totalEmployees > 0 
        ? Math.round((presentCount / totalEmployees) * 100) 
        : 0;

      // 3. Total Assigned Projects
      const uniqueProjects = new Set();
      employees.forEach(emp => {
        if (Array.isArray(emp.assignedProjects)) {
          emp.assignedProjects.forEach(proj => {
            const projectId = (typeof proj === 'object' && proj !== null) ? proj._id : proj;
            if (projectId) uniqueProjects.add(projectId.toString());
          });
        }
      });
      const totalAssignedProjects = uniqueProjects.size;

      setStats({
        attendancePercentage,
        totalAssignedProjects,
        totalEmployees,
        activeEmployees: activeCount,
        inactiveEmployees: inactiveCount
      });

    } catch (error) {
      console.error("Error fetching team stats:", error);
    }
  };

  return (
    <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
      <Side />
      <main className={pageLayoutStyles.pageMain}>
        <TopNavbar title="Team Management" breadcrumb="Team Management" />

        <PageBody>
        <section className={styles["stats-container"]}>

          <div className={styles.cardbox} style={{ minHeight: "100px", padding: "1rem 1.5rem", gap: "0.5rem" }}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Total Employees</h4>
              </div>
              <h2>{stats.totalEmployees}</h2>
              <p className={styles["success-text"]}>
                Active Team Members
              </p>
            </div>
          </div>

          <div className={styles.cardbox} style={{ minHeight: "100px", padding: "1rem 1.5rem", gap: "0.5rem" }}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Active Employees</h4>
              </div>
              <h2>{stats.activeEmployees}</h2>
              <p className={styles["success-text"]}>
                Present in workspace
              </p>
            </div>
          </div>

          <div className={styles.cardbox} style={{ minHeight: "100px", padding: "1rem 1.5rem", gap: "0.5rem" }}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Inactive Employees</h4>
              </div>
              <h2>{stats.inactiveEmployees}</h2>
              <p className={styles["success-text"]}>
                Offboarded or absent
              </p>
            </div>
          </div>
        </section>

        {/* Team Members Table Section */}
        <section className={styles["main-content"]}>
          <TeamMembersTable />
        </section>
        </PageBody>
      </main>
    </div>
  );
}

export default TeamManagement;
