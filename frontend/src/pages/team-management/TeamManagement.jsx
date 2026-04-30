import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./TeamManagement.module.css";
import Side from "../sidebar/Sidebar";
import NotificationBell from "../../components/NotificationBell";
import belldot from "../../assets/dashboard/bell-dot.svg";
import chevrondown from "../../assets/dashboard/chevron-down.svg";
import chevrondright from "../../assets/dashboard/chevron-right.svg";
import admindemo from "../../assets/dashboard/admin-demo.jpg";
import arrowupright from "../../assets/dashboard/arrow-up-right.svg";
import TeamMembersTable from "../../components/team-management-components/TeamMembersTable";
import ProfileAvatar from "../../components/ProfileAvatar";
import EmployeeService from "../../services/EmployeeService";
import AttendanceService from "../../services/AttendanceService";
import { FaBars } from "react-icons/fa";
import { useSidebar } from "../../context/SidebarContext";

function TeamManagement() {
  const { toggleSidebar } = useSidebar();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");
  
  // Stats state
  const [stats, setStats] = useState({
    attendancePercentage: 0,
    totalAssignedProjects: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0
  });

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
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
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["header-left"]}>
              <button className={styles.menuToggleBtn} onClick={toggleSidebar}>
                <FaBars />
              </button>
              <div className={styles["dashboard-title"]}>Team Management</div>
            </div>

            <div className={styles["dashboard-profile"]}>
              <NotificationBell/>
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username?.toUpperCase()}
                    </div>
                     <div className={styles["profile-type"]}>
                                          {userRole?.toUpperCase()}
                                        </div>
                  </div>
                </div>
                {/* <img src={chevrondown} alt="" /> */}
              </div>
            </div>
          </div>
        </header>

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-home"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-active"]}>Team Management</div>
          </div>
        </section>

        {/* Stats Cards Section */}
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
      </main>
    </div>
  );
}

export default TeamManagement;
