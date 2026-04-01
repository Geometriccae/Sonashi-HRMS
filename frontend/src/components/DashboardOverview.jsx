import React from "react";
import styles from "./DashboardOverview.module.css";
import "bootstrap/dist/css/bootstrap.min.css";

function DashboardOverview() {
  const activeEmployeesCount = 0; // Static placeholder value

  return (
    <div className={styles.singleCardDashboard}>
      <div className={styles.metricCardBig}>
        <div className={styles.metricContent}>
          <div className={styles.metricLabel}>Total Active Employees</div>
          <div className={styles.metricValue}>{activeEmployeesCount}</div>
        </div>
        <div className={styles.metricDetails}>
          <div className={styles.changeIndicator}>
            <div className={styles.changeChip}>
              <span className={styles.changeIcon}>&#8599;</span>
              <span className={styles.grow}>+0%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
