import React, { useState, useEffect } from "react";
import styles from "./TeamManagement.module.css";
import Side from "../sidebar/Sidebar";

import belldot from "../../assets/dashboard/bell-dot.svg";
import chevrondown from "../../assets/dashboard/chevron-down.svg";
import chevrondright from "../../assets/dashboard/chevron-right.svg";
import admindemo from "../../assets/dashboard/admin-demo.jpg";
import arrowupright from "../../assets/dashboard/arrow-up-right.svg";
import TeamMembersTable from "../../components/team-management-components/TeamMembersTable";
import ProfileAvatar from "../../components/ProfileAvatar";
import NotificationBell from "../../components/NotificationBell";

function TeamManagement() {
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserRole(localStorage.getItem("role") || "");
  }, []);

  return (
    <div className={styles["dashboard-layout"]}>
      <Side />
      <main>
        <header className={styles["dashboard-header"]}>
          <div className={styles["dashboard-row"]}>
            <div className={styles["dashboard-title"]}>Team Management</div>

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
                <img src={chevrondown} alt="" />
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
          {/* Today's Attendance Card */}
          <div className={styles["attendance-card"]}>
            <div className={styles["card-header"]}>
              <div className={styles["card-title-section"]}>
                <div className={styles["card-title"]}>Today's Attendance</div>
                <div className={styles["card-main-stat"]}>
                  <div className={styles["percentage"]}>00%</div>
                  <div className={styles["growth-chip"]}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 21 21"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10.695 16.9132V3.7832M10.695 3.7832L5.77124 8.70694M10.695 3.7832L15.6187 8.70694"
                        stroke="#147129"
                        strokeWidth="1.64125"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>04%</span>
                  </div>
                </div>
              </div>
              <div className={styles["iconlink"]}>
                <img src={arrowupright} alt="arrowup" />
              </div>
            </div>

            {/* Attendance Chart */}
            <div className={styles["attendance-chart"]}>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{
                    height: "44px",
                    backgroundColor: "rgba(255,128,31,0.5)",
                  }}
                ></div>
                <div className={styles["day-label"]}>M</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "74px", backgroundColor: "#C0EECC" }}
                ></div>
                <div className={styles["day-label"]}>T</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{
                    height: "44px",
                    backgroundColor: "rgba(255,128,31,0.5)",
                  }}
                ></div>
                <div className={styles["day-label"]}>W</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "74px", backgroundColor: "#C0EECC" }}
                ></div>
                <div className={styles["day-label"]}>T</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "74px", backgroundColor: "#C0EECC" }}
                ></div>
                <div className={styles["day-label"]}>F</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{
                    height: "44px",
                    backgroundColor: "rgba(255,128,31,0.5)",
                  }}
                ></div>
                <div className={styles["day-label"]}>S</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "60px", backgroundColor: "#FF801F" }}
                ></div>
                <div className={styles["day-label"]}>Today</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "6px", backgroundColor: "#E9ECF1" }}
                ></div>
                <div className={styles["day-label"]}>M</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "6px", backgroundColor: "#E9ECF1" }}
                ></div>
                <div className={styles["day-label"]}>T</div>
              </div>
              <div className={styles["chart-bar"]}>
                <div
                  className={styles["bar"]}
                  style={{ height: "6px", backgroundColor: "#E9ECF1" }}
                ></div>
                <div className={styles["day-label"]}>W</div>
              </div>
            </div>
          </div>

          {/* Total Assigned Projects Card */}
          {/* <div className={styles["stats-card"]}>
            <div className={styles["card-header"]}>
              <div className={styles["card-title-section"]}>
                <div className={styles["card-title"]}>
                  Total Assigned Projects
                </div>
                <div className={styles["card-value"]}>33</div>
                <div className={styles["card-subtitle"]}>
                  <span className={styles["success-text"]}>21% </span>up from
                  last week
                </div>
              </div>
              <div className={styles["iconlink"]}>
                <img src={arrowupright} alt="arrowup" />
              </div>
            </div>
          </div> */}

           <div className={styles.cardbox}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Total Assigned Projects</h4>
                <div className={styles.iconlink}>
                  <img src={arrowupright} alt="arrowup" />
                </div>
              </div>
              <h2>00%</h2>
              <p className={styles["success-text"]}>
                0.0% down <span>from last week</span>
              </p>
            </div>
          </div>

          {/* Lead Conversion Card */}
          {/* <div className={styles["stats-card"]}>
            <div className={styles["card-header"]}>
              <div className={styles["card-title-section"]}>
                <div className={styles["card-title"]}>Lead Conversion</div>
                <div className={styles["card-value"]}>78%</div>
                <div className={styles["card-subtitle"]}>
                  <span className={styles["error-text"]}>1.5%</span>down from last week
                </div>
              </div>
              <div className={styles["iconlink"]}>
                <img src={arrowupright} alt="arrowup" />
              </div>
            </div>
          </div> */}

         

          <div className={styles.cardbox}>
            <div className={styles.cardboxcontent}>
              <div className={styles.cardheader}>
                <h4>Lead Conversion</h4>
                <div className={styles.iconlink}>
                  <img src={arrowupright} alt="arrowup" />
                </div>
              </div>
              <h2>00%</h2>
              <p className={styles["error-text"]}>
                0.0% down <span>from last week</span>
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
