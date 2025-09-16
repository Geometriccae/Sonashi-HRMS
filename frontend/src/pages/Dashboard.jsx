import React, { useState, useEffect } from "react";
import styles from "./Dashboard.module.css";
import Side from "./sidebar/Sidebar";
import DashboardOverview from "../components/DashboardOverview";

import belldot from "../assets/dashboard/bell-dot.svg";
import chevrondown from "../assets/dashboard/chevron-down.svg";
import chevrondright from "../assets/dashboard/chevron-right.svg";
import ProfileAvatar from "../components/ProfileAvatar";

function Dash() {

    const [username, setUsername] = useState("");
  
    useEffect(() => {
      setUsername(localStorage.getItem("username") || "");
    }, []);
  

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Dashboard</div>

            <div className={styles["dashboard-profile"]}>
              <img
                src={belldot}
                alt="belldot"
                className={styles["belldot-icon"]}
              />
              <div className={styles["profile-info"]}>
                <div className={styles["profile-row"]}>
                  <ProfileAvatar size={40} className={styles["profile-picture"]} />
                  <div className={styles["profile-column"]}>
                    <div className={styles["profile-name"]}>{username?.toUpperCase()}</div>
                    <div className={styles["profile-type"]}>Administrator</div>
                  </div>
                </div>
                <img src={chevrondown} alt="" />
              </div>
            </div>
          </div>
        </header>

        {/* breadcrumb */}
        <section className={styles["breadcrumb-section"]}>
          <div className={styles["breadcrumb"]}>
            <div className={styles["breadcrumb-one"]}>Home</div>
            <img src={chevrondright} alt="" />
            <div className={styles["breadcrumb-two"]}>Dashboard</div>
          </div>
        </section>

        {/* Main Content */}
        <section className={styles["main-content"]}>
          <DashboardOverview />
        </section>
      </main>
    </div>
  );
}

export default Dash;
