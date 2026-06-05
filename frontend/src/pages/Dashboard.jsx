import React, { useState, useEffect } from "react";
import styles from "./Dashboard.module.css";
import Side from "./sidebar/Sidebar";
import DashboardOverview from "../components/DashboardOverview";
import CheckIn from "../components/CheckIn";
import MobileBottomNavigation from "../components/MobileBottomNavigation";
import TopNavbar, { PageBody, pageLayoutStyles } from "../components/TopNavbar";

function Dashboard() {
    const [userRole, setUserRole] = useState("");
  
    useEffect(() => {
       setUserRole(localStorage.getItem("role") || "");
    }, []);

  const dashboardTitle =
    userRole === "admin"
      ? "Admin Dashboard"
      : userRole === "hr"
        ? "HR Dashboard"
        : "Dashboard";

  return (
    <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
      <Side />
      <main className={`${styles["main-container"]} ${pageLayoutStyles.pageMain}`}>
        {/* Mobile Header */}
        {/* <div className={styles["mobile-header"]}>
          <div className={styles["mobile-header-content"]}>
            <div className={styles["mobile-welcome"]}>
              <div className={styles["mobile-greeting"]}>
                {getTimeGreeting()}, {username}
              </div>
              <div className={styles["mobile-date"]}>
                {getCurrentDate()}
              </div>
            </div>
            <div className={styles["mobile-profile"]}>
              <ProfileAvatar size={36} className={styles["mobile-profile-picture"]} />
              <div className={styles["mobile-profile-info"]}>
                <div className={styles["mobile-profile-name"]}>Larry Seth</div>
                <div className={styles["mobile-profile-role"]}>Sales Lead</div>
              </div>
              <img src={chevrondown} alt="" className={styles["mobile-dropdown"]} />
            </div>
          </div>
        </div> */}

        <TopNavbar
          title={dashboardTitle}
          breadcrumb="Dashboard"
          showGreeting
        />

        <PageBody as="section" className={styles["main-content"]}>
          <DashboardOverview />
        </PageBody>
      </main>

    </div>
  );
}

export default Dashboard;
