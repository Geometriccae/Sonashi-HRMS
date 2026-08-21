import React from "react";
import styles from "./Dashboard.module.css";
import Side from "./sidebar/Sidebar";
import TopNavbar, { PageBody, pageLayoutStyles } from "../components/TopNavbar";
import HrMetricsDashboard from "../components/HrMetricsDashboard";

function HrMetricsDashboardPage() {
  return (
    <div className={`${styles["dashboard-layout"]} ${pageLayoutStyles.pageLayout}`}>
      <Side />
      <main className={`${styles["main-container"]} ${pageLayoutStyles.pageMain}`}>
        <TopNavbar
          title="HR Metrics Dashboard"
          breadcrumb="HR Metrics Dashboard"
          subtitle="Overview of workforce, attendance, leave, payroll and HR activities"
        />

        <PageBody as="section" className={styles["main-content"]}>
          <HrMetricsDashboard />
        </PageBody>
      </main>
    </div>
  );
}

export default HrMetricsDashboardPage;
